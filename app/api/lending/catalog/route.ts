import {lendingAccess,lendingJson,boundedBody} from '@/lib/lending/api-guard'
import {createWorkflowClient,checkWorkflowRateLimit} from '@/lib/lending/workflow-client'
import {catalogInput} from '@/lib/lending/catalog'
import {catalogColumns,searchCatalog} from '@/lib/lending/catalog-server'
import {parsePsaCert} from '@/lib/lending/psa'
import {visiblePriceUpdatedAfter} from '@/lib/cards/visibility'
import {calculateIndicativeQuote} from '@/lib/lending/valuation'
import {fetchSnkrdunkSnapshot} from '@/lib/lending/snkrdunk'
import {supportCaseError} from '@/lib/lending/support-cases'
import type {CatalogCard} from '@/lib/lending/catalog-types'
import type {MarketSnapshot} from '@/lib/lending/types'
export const runtime='nodejs'
export async function POST(request:Request){
 const actor=await lendingAccess(request,'lending:catalog',30);if(actor instanceof Response)return actor
 let input
 try{input=catalogInput.parse(JSON.parse((await boundedBody(request,8192)).toString('utf8')))}catch{return lendingJson({error:'入力内容を確認してください。'},400)}
 try{
  if(input.action==='search')return lendingJson(await searchCatalog(input.query,input.category,input.page))
  if(actor.role!=='customer')return lendingJson({error:'利用者のアカウントで操作してください。'},403)
  const db=createWorkflowClient()
  if(input.action==='submit'){
   const {data,error}=await db.rpc('lending_catalog_submit',{p_actor:actor.id,p_assessment:input.assessmentId,p_amount:input.requestedAmount===''?null:Number(input.requestedAmount),p_notes:input.notes,p_key:input.key})
   if(error){const message:Record<string,string>={assessment_expired:'参考査定の期限が切れています。カードを選び直してください。',card_changed:'カード情報が更新されました。検索し直して確認してください。',assessment_already_submitted:'この査定依頼は受付済みです。貸付状況を確認してください。'};return lendingJson({error:message[error.message]??supportCaseError(error.message)},409)}
   return lendingJson({case:data})
  }
  const cert=input.certInput?parsePsaCert(input.certInput):null
  if(input.certInput&&(!cert||input.declaredGrade==='ungraded'))return lendingJson({error:'鑑定番号と鑑定状態を確認してください。未鑑定の場合は番号を空欄にしてください。'},400)
  let method:'catalog'|'image'='catalog'
  if(input.imageRequestId){
   const {data:image,error}=await db.from('lending_image_searches').select('id').eq('id',input.imageRequestId).eq('user_id',actor.id).eq('status','completed').maybeSingle()
   if(error||!image)return lendingJson({error:'画像検索を実行し直すか、通常検索から選択してください。'},409)
   method='image'
  }
  const {data,error}=await db.from('cards').select(catalogColumns).eq('public_uid',input.cardUid).gte('buy_price_updated_at',visiblePriceUpdatedAfter()).maybeSingle()
  if(error||!data)return lendingJson({error:'カードが更新されたか、現在選択できません。検索し直してください。'},409)
  const card=data as CatalogCard
  let indicative:number|null=null,market:unknown=null
  let reasons=['運営がカード・現物状態を確認して個別に見積もります。']
  if(input.declaredGrade==='PSA10'&&card.grade==='PSA10'&&['pokemon','onepiece'].includes(card.category)){
   const {data:mapping,error:mappingError}=await db.from('lending_product_mappings').select('product_id').eq('card_uid',card.public_uid).eq('active',true).maybeSingle()
   if(!mappingError&&mapping){
    const limit=await checkWorkflowRateLimit('lending:catalog-market',actor.id,{limit:6,windowMs:60000})
    if(!limit.allowed)return lendingJson({error:'価格の取得回数が多いため、少し待ってからお試しください。'},429)
    try{market=actor.demo&&process.env.LENDING_MARKET_FIXTURE==='true'?{provider:'snkrdunk',productId:mapping.product_id,grade:'PSA10',currency:'JPY',fetchedAt:new Date().toISOString(),floorPriceJpy:1000000,sales:[],coverage:'latest_page_only',dailySalesAverage:null,sourceUrl:`https://snkrdunk.com/apparels/${mapping.product_id}`} satisfies MarketSnapshot:await fetchSnkrdunkSnapshot(mapping.product_id);const quote=calculateIndicativeQuote(card,market as MarketSnapshot);indicative=quote.indicativeAmountJpy;reasons=quote.reasons}
    catch{reasons=['価格を取得できません。査定依頼は受け付け、運営が見積もりをご案内します。']}
   }else reasons=['スニダンとの商品対応を運営が確認して見積もります。']
  }else reasons=['未鑑定・グレード違いは個別査定です。PSA10の価格は流用しません。']
  const {data:assessment,error:saveError}=await db.from('lending_catalog_assessments').insert({user_id:actor.id,card_uid:card.public_uid,card,declared_grade:input.declaredGrade,cert_number:cert,search_method:method,image_request_id:input.imageRequestId??null,indicative_jpy:indicative,reasons,market_snapshot:market}).select('id,card,declared_grade,cert_number,search_method,indicative_jpy,reasons,expires_at').single()
  if(saveError)return lendingJson({error:'査定情報を保存できません。時間をおいて再度お試しください。'},503)
  return lendingJson({assessment})
 }catch{return lendingJson({error:'カードを取得できません。通常検索または個別見積もりをお試しください。'},503)}
}
