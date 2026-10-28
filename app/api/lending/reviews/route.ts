import {z} from 'zod'
import {lendingAccess,lendingJson,boundedBody} from '@/lib/lending/api-guard'
import {createWorkflowClient} from '@/lib/lending/workflow-client'
export async function GET(request:Request){
 const actor=await lendingAccess(request,'lending:reviews',30);if(actor instanceof Response)return actor
 if(actor.role!=='admin')return lendingJson({error:'管理者権限が必要です。'},403)
 const db=createWorkflowClient()
 const id=new URL(request.url).searchParams.get('documentId')
 if(id){
  if(!z.uuid().safeParse(id).success)return lendingJson({error:'書類IDが不正です。'},400)
  const {data:doc}=await db.from('lending_documents').select('id,storage_path,status').eq('id',id).in('status',['pending','verified','rejected']).maybeSingle()
  if(!doc)return lendingJson({error:'書類が見つかりません。'},404)
  const audit=await db.from('lending_document_access').insert({document_id:doc.id,actor_id:actor.id,action:'view'})
  if(audit.error)return lendingJson({error:'閲覧記録を保存できません。'},503)
  const {data,error}=await db.storage.from('lending-identity').createSignedUrl(doc.storage_path,60)
  return error?lendingJson({error:'書類を取得できません。'},503):lendingJson({url:data.signedUrl})
 }
 const [assessments,documents]=await Promise.all([
  db.from('lending_assessments').select('id,user_id,cert_number,product,estimate_jpy,created_at').eq('status','submitted').order('created_at',{ascending:false}).limit(50),
  db.from('lending_documents').select('id,user_id,document_type,side,status,uploaded_at').eq('status','pending').order('uploaded_at',{ascending:false}).limit(50),
 ])
 if(assessments.error||documents.error)return lendingJson({error:'確認待ち一覧を取得できません。'},503)
 return lendingJson({assessments:assessments.data,documents:documents.data})
}
export async function POST(request:Request){
 if(process.env.LENDING_DOCUMENT_UPLOAD_ENABLED!=='true')return lendingJson({error:'画像書類によるテスト承認は無効です。JPKI連携を使用してください。'},404)
 const actor=await lendingAccess(request,'lending:document-review',20);if(actor instanceof Response)return actor
 if(actor.role!=='admin'||!actor.demo)return lendingJson({error:'この操作は検証環境の管理者専用です。'},403)
 const schema=z.object({documentId:z.uuid(),approve:z.boolean(),testOnlyConfirmed:z.literal(true)}).strict()
 let value:z.infer<typeof schema>
 try{value=schema.parse(JSON.parse((await boundedBody(request,1024)).toString('utf8')))}catch{return lendingJson({error:'検証用であることを確認してください。'},400)}
 const {error}=await createWorkflowClient().rpc('lending_review_document',{p_actor:actor.id,p_document:value.documentId,p_approve:value.approve})
 return error?lendingJson({error:'書類が更新済みです。一覧を再読み込みしてください。'},409):lendingJson({ok:true})
}
