import sharp from 'sharp'
import {createHash} from 'node:crypto'
import {z} from 'zod'
import {lendingAccess,lendingJson,boundedBody} from '@/lib/lending/api-guard'
import {createWorkflowClient,checkWorkflowRateLimit} from '@/lib/lending/workflow-client'
import {extractCardHints} from '@/lib/lending/card-image'
import {imageSearchQuery} from '@/lib/lending/catalog'
import {searchCatalog} from '@/lib/lending/catalog-server'
export const runtime='nodejs'
export const maxDuration=30
export async function POST(request:Request){
 const actor=await lendingAccess(request,'lending:card-image',6);if(actor instanceof Response)return actor
 if(!process.env.OPENAI_API_KEY?.trim())return lendingJson({error:'画像検索は準備中です。カード名・型番で検索するか、個別見積もりをご利用ください。'},503)
 let image:Buffer,key:string
 try{
  const raw=await boundedBody(request,3*1024*1024+65536)
  const form=await new Response(new Uint8Array(raw),{headers:{'Content-Type':request.headers.get('content-type')??''}}).formData()
  key=z.uuid().parse(form.get('key'))
  if(form.get('consent')!=='true')throw Error('consent')
  const file=form.get('file');if(!(file instanceof File)||!file.size||file.size>3*1024*1024)throw Error('file')
  const decoder=sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:24000000,animated:false,failOn:'warning'})
  const meta=await decoder.metadata();if(!['jpeg','png','webp','heif'].includes(meta.format??'')||(meta.pages??1)>1)throw Error('format')
  image=await decoder.rotate().resize({width:1536,height:1536,fit:'inside',withoutEnlargement:true}).jpeg({quality:85}).toBuffer()
 }catch{return lendingJson({error:'3MB以下のカード画像を選び、画像送信への同意を確認してください。'},400)}
 const hash=createHash('sha256').update(image).digest('hex'),db=createWorkflowClient()
 const claim=await db.from('lending_image_searches').insert({id:key,user_id:actor.id,image_hash:hash}).select('id').single()
 if(claim.error){
  const {data:prior}=await db.from('lending_image_searches').select('status,result,image_hash').eq('id',key).eq('user_id',actor.id).maybeSingle()
  if(prior?.image_hash===hash&&prior.status==='completed')return lendingJson(prior.result)
  return lendingJson({error:'画像検索を処理中か、前回の処理を完了できませんでした。結果を確認し、再検索する場合は画像を選び直してください。'},409)
 }
 try{
  const limits=await Promise.all([checkWorkflowRateLimit('lending:image-daily',actor.id,{limit:100,windowMs:86400000}),checkWorkflowRateLimit('lending:image-global-daily','all',{limit:600,windowMs:86400000})])
  if(limits.some(l=>!l.allowed)){
   await db.from('lending_image_searches').update({status:'failed'}).eq('id',key).eq('user_id',actor.id)
   return lendingJson({error:'画像検索の利用上限に達しました。カード名・型番で検索してください。'},429)
  }
  const {hints,usage,model}=await extractCardHints(image)
  const usageSaved=await db.from('lending_image_searches').update({model,input_tokens:usage.inputTokens,output_tokens:usage.outputTokens}).eq('id',key).eq('user_id',actor.id)
  if(usageSaved.error)throw Error('usage_save')
  const query=imageSearchQuery(hints)
  const matches=query?await searchCatalog(query,hints.category??'all'):{cards:[],total:0,page:1}
  const result={...matches,hints,imageRequestId:key}
  const saved=await db.from('lending_image_searches').update({status:'completed',result,model,input_tokens:usage.inputTokens,output_tokens:usage.outputTokens}).eq('id',key).eq('user_id',actor.id)
  if(saved.error)throw Error('save')
  return lendingJson(result)
 }catch{
  await db.from('lending_image_searches').update({status:'failed'}).eq('id',key).eq('user_id',actor.id)
  return lendingJson({error:'画像を読み取れませんでした。再撮影、カード名・型番での検索、個別見積もりをお試しください。'},502)
 }
}
