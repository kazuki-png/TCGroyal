import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { z } from 'zod'
import { lendingAccess,lendingJson,boundedBody } from '@/lib/lending/api-guard'
import { createWorkflowClient } from '@/lib/lending/workflow-client'
export const runtime='nodejs'
const bucket='lending-identity'
const docSchema=z.object({documentType:z.enum(['drivers_license','passport','mynumber_front','address_proof']),side:z.enum(['front','back']),consent:z.literal('true')})
export async function POST(request:Request){
 if(process.env.LENDING_DOCUMENT_UPLOAD_ENABLED!=='true')return lendingJson({error:'本人確認書類の受付は設定待ちです。'},404)
 const actor=await lendingAccess(request,'lending:identity-upload',6);if(actor instanceof Response)return actor
 let file:File,documentType:z.infer<typeof docSchema>['documentType'],side:'front'|'back'
 try{
  const bytes=await boundedBody(request,3*1024*1024+65536)
  const form=await new Response(new Uint8Array(bytes),{headers:{'Content-Type':request.headers.get('content-type')??''}}).formData()
  const parsed=docSchema.parse({documentType:form.get('documentType'),side:form.get('side'),consent:form.get('consent')})
  documentType=parsed.documentType;side=parsed.side
  const value=form.get('file');if(!(value instanceof File)||value.size===0||value.size>3*1024*1024)throw Error('file')
  if(documentType==='mynumber_front'&&side==='back')throw Error('mynumber')
  file=value
 }catch{return lendingJson({error:'3MB以下のJPG/PNG画像を選び、送信内容への同意を確認してください。マイナンバーカードは表面のみ送信できます。'},400)}
 let image:Buffer
 try{
  const decoder=sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:24000000,animated:false,failOn:'warning'})
  const meta=await decoder.metadata();if(!['jpeg','png','heif'].includes(meta.format??'')||(meta.pages??1)>1)throw Error('format')
  image=await decoder.rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).jpeg({quality:88}).toBuffer()
  if(image.byteLength>3*1024*1024)throw Error('size')
 }catch{return lendingJson({error:'画像を読み取れません。JPGまたはPNGで保存し直してください。'},400)}
 const db=createWorkflowClient(),path=`${actor.id}/${randomUUID()}.jpg`
 const started=await db.rpc('lending_begin_document',{p_actor:actor.id,p_type:documentType,p_side:side,p_path:path})
 if(started.error)return lendingJson({error:'書類の保存準備ができません。'},503)
 const id=started.data
 const upload=await db.storage.from(bucket).upload(path,image,{contentType:'image/jpeg',cacheControl:'0',upsert:false})
 if(upload.error){await db.from('lending_documents').update({status:'deleted',deleted_at:new Date().toISOString()}).eq('id',id).eq('user_id',actor.id);return lendingJson({error:'書類を保存できません。再度お試しください。'},503)}
 const saved=await db.from('lending_documents').update({status:'pending'}).eq('id',id).eq('user_id',actor.id).eq('status','uploading')
 if(saved.error)return lendingJson({error:'送信結果を確認できません。マイページを更新してください。'},503)
 return lendingJson({ok:true,id,status:'pending',notice:'書類を送信しました。本人確認は運営による確認待ちです。'})
}
export async function DELETE(request:Request){
 const actor=await lendingAccess(request,'lending:identity-delete',10);if(actor instanceof Response)return actor
 const id=new URL(request.url).searchParams.get('id');if(!z.uuid().safeParse(id).success)return lendingJson({error:'書類IDが不正です。'},400)
 const db=createWorkflowClient()
 const {data:doc,error}=await db.from('lending_documents').select('id,storage_path,status,uploaded_at').eq('id',id!).eq('user_id',actor.id).neq('status','deleted').maybeSingle()
 if(error||!doc)return lendingJson({error:'書類が見つかりません。'},404)
 if(doc.status==='uploading'&&Date.parse(doc.uploaded_at)>Date.now()-15*60000)return lendingJson({error:'書類を送信中です。しばらくしてから再度お試しください。'},409)
 const removed=await db.storage.from(bucket).remove([doc.storage_path]);if(removed.error)return lendingJson({error:'書類を削除できません。'},503)
 const result=await db.from('lending_documents').update({status:'deleted',deleted_at:new Date().toISOString()}).eq('id',doc.id).eq('user_id',actor.id)
 if(result.error)return lendingJson({error:'削除結果を確認できません。'},503)
 return lendingJson({ok:true})
}
