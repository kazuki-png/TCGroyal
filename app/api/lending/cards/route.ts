import { z } from 'zod'
import { lendingAccess,lendingJson,boundedBody } from '@/lib/lending/api-guard'
import { createWorkflowClient } from '@/lib/lending/workflow-client'
import { fetchPsaCertificate,readCachedPsaCertificate } from '@/lib/lending/psa-provider'
import { searchSnkrdunk,fetchSnkrdunkProduct,cardNumberMatches } from '@/lib/lending/snkrdunk-search'
import { fetchSnkrdunkSnapshot } from '@/lib/lending/snkrdunk'
import { parsePsaCert } from '@/lib/lending/psa'
import type { Certificate } from '@/lib/lending/mobile-types'
export const runtime='nodejs'
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('lookup'),certInput:z.string().min(6).max(250)}).strict(),
 z.object({action:z.literal('manual_lookup'),certInput:z.string().min(6).max(250),subject:z.string().trim().min(2).max(100),cardNumber:z.string().trim().min(1).max(40),brand:z.enum(['pokemon','onepiece']),grade:z.literal('10'),unverifiedConfirmed:z.literal(true)}).strict(),
 z.object({action:z.literal('search'),lookupId:z.uuid(),query:z.string().trim().min(2).max(100)}).strict(),
 z.object({action:z.literal('assess'),lookupId:z.uuid(),productId:z.string().regex(/^[1-9]\d{0,8}$/),confirmed:z.literal(true)}).strict(),
 z.object({action:z.literal('request'),assessmentId:z.uuid(),consent:z.literal(true)}).strict(),
 z.object({action:z.literal('cancel'),assessmentId:z.uuid()}).strict(),
])
export async function POST(request:Request) {
 const actor=await lendingAccess(request,'lending:card-discovery',12);if(actor instanceof Response)return actor
 const db=createWorkflowClient()
 let input:z.infer<typeof schema>
 try{input=schema.parse(JSON.parse((await boundedBody(request,2048)).toString('utf8')))}catch{return lendingJson({error:'入力内容を確認してください。'},400)}
 try{
 if(input.action==='lookup'||input.action==='manual_lookup'){
  const certNumber=parsePsaCert(input.certInput)
  if(!certNumber)return lendingJson({error:'PSA番号または公式QRコードURLを入力してください。'},400)
  let cached:{id:string;certificate:Certificate}|null=null
  if(input.action==='lookup'){
   const result=await db.from('lending_certificate_lookups').select('id,certificate,expires_at')
    .eq('user_id',actor.id).eq('cert_number',certNumber).contains('certificate',{verifiedBy:'psa_api'})
    .gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(1).maybeSingle()
   if(result.error)throw Error('鑑定情報を確認できません。時間をおいて再度お試しください。')
   const certificate=readCachedPsaCertificate(result.data?.certificate,certNumber)
   if(result.data&&certificate&&Date.parse(result.data.expires_at)>Date.now())cached={id:result.data.id,certificate}
  }
  const certificate:Certificate=input.action==='lookup'?(cached?.certificate??await fetchPsaCertificate(input.certInput)):{
   verifiedBy:'user_entered',certNumber,specId:null,year:'未照会',brand:input.brand==='pokemon'?'POKEMON（手入力）':'ONE PIECE（手入力）',category:'TCG CARDS',
   cardNumber:input.cardNumber,subject:input.subject,variety:'未照会',grade:input.grade,gradeDescription:'ユーザー申告・公式API未照会',eligible:true,
   sourceUrl:`https://www.psacard.com/cert/${certNumber}/psa`,fetchedAt:new Date().toISOString()}
  let lookupId=cached?.id
  if(!lookupId){
   const {data,error}=await db.from('lending_certificate_lookups').insert({user_id:actor.id,cert_number:certificate.certNumber,certificate}).select('id').single()
   if(error)throw Error('鑑定情報を保存できません。')
   lookupId=data.id
  }
  const searchQuery=`${certificate.subject} ${certificate.cardNumber}`.slice(0,100)
  let candidates:Awaited<ReturnType<typeof searchSnkrdunk>>=[],searchWarning:string|undefined
  if(certificate.eligible){try{candidates=await searchSnkrdunk(searchQuery)}catch{searchWarning='スニダンの商品検索に接続できません。商品IDを指定できます。'}}
  return lendingJson({id:lookupId,certificate,candidates,searchQuery,searchWarning,cacheHit:!!cached})
 }
 if(input.action==='request'||input.action==='cancel'){
  if(actor.role!=='customer')return lendingJson({error:'利用者の接続コードで操作してください。'},403)
  const operation=input.action
  const query=db.from('lending_assessments').update(operation==='request'?{status:'submitted',submitted_at:new Date().toISOString()}:{status:'cancelled'})
   .eq('id',input.assessmentId).eq('user_id',actor.id).eq('status',operation==='request'?'draft':'submitted')
  if(operation==='request')query.gt('expires_at',new Date().toISOString())
  const {data,error}=await query.select('id').maybeSingle()
  if(error||!data)return lendingJson({error:'期限切れ・重複依頼・更新済みです。一覧を更新してください。'},409)
  return lendingJson({ok:true})
 }
 const {data:lookup}=await db.from('lending_certificate_lookups').select('id,cert_number,certificate,expires_at').eq('id',input.lookupId).eq('user_id',actor.id).maybeSingle()
 if(!lookup||Date.parse(lookup.expires_at)<=Date.now())return lendingJson({error:'鑑定番号を検索し直してください。'},404)
 if(input.action==='search')return lendingJson({candidates:await searchSnkrdunk(input.query)})
 const certificate=lookup.certificate as Certificate
 if(!certificate.eligible)return lendingJson({error:'PSA10のみ自動査定に対応しています。'},409)
 const [product,market]=await Promise.all([fetchSnkrdunkProduct(input.productId),fetchSnkrdunkSnapshot(input.productId)])
 if(!cardNumberMatches(certificate.cardNumber,`${product.name} ${product.englishName}`))return lendingJson({error:'PSAとスニダンのカード番号が一致しません。別の商品を選んでください。'},409)
 if(!market.floorPriceJpy)return lendingJson({error:'PSA10の出品価格がありません。手動査定が必要です。'},409)
 const estimateJpy=Math.floor(Math.min(market.floorPriceJpy*0.4,10000000)/1000)*1000
 const {data:mapping}=await db.from('lending_product_mappings').select('card_uid').eq('product_id',input.productId).eq('active',true).limit(2)
 let quote:null|{id:string;cap_jpy:number;expires_at:string}=null
 if(certificate.verifiedBy==='psa_api'&&mapping?.length===1){const result=await db.rpc('lending_create_quote',{p_actor:actor.id,p_card:mapping[0].card_uid,p_market:market});if(!result.error)quote=result.data}
 const {data:assessment,error}=await db.from('lending_assessments').insert({user_id:actor.id,lookup_id:lookup.id,cert_number:lookup.cert_number,
  product_id:input.productId,product,market_snapshot:market,estimate_jpy:quote?.cap_jpy??estimateJpy,quote_id:quote?.id??null})
  .select('id,cert_number,product_id,product,estimate_jpy,quote_id,status,created_at,expires_at,submitted_at').single()
 if(error)throw Error('価格情報を保存できません。')
 return lendingJson({assessment,quote,market:{fetchedAt:market.fetchedAt,sourceUrl:market.sourceUrl,grade:market.grade},requiresReview:!quote,
  notice:quote?'概算です。現物検品後に最終条件を提示します。':'参考額です。運営がカードの商品対応・状態・買取価格を確認してから融資条件を提示します。'})
 }catch(error){return lendingJson({error:error instanceof Error?error.message:'検索・価格取得を完了できません。'},502)}
}
