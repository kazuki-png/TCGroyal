import {z} from 'zod'
import {adminLendingAccess} from '@/lib/lending/admin-access'
import {lendingJson,boundedBody} from '@/lib/lending/api-guard'
import {createWorkflowClient} from '@/lib/lending/workflow-client'
import {scheduleStatusNotifications} from '@/lib/lending/status-notifications'
export const runtime='nodejs'
export const maxDuration=60
const schema=z.object({kind:z.enum(['case','loan']),id:z.uuid()}).strict()
export async function GET(request:Request){
 const actor=await adminLendingAccess(request);if(actor instanceof Response)return actor
 const url=new URL(request.url),parsed=schema.safeParse({kind:url.searchParams.get('kind'),id:url.searchParams.get('id')})
 if(!parsed.success)return lendingJson({error:'案件を確認してください。'},400)
 const {kind,id}=parsed.data,db=createWorkflowClient()
 const {data:events,error}=await db.from('lending_status_notifications').select('id,entity_kind,entity_id,entity_version,from_status,to_status,created_at,deliveries:lending_push_deliveries(id,status,total_attempts,error_code,accepted_at,received_at)').eq('entity_kind',kind).eq('entity_id',id).order('created_at',{ascending:false}).limit(30)
 if(error)return lendingJson({error:'通知履歴を取得できません。'},503)
 scheduleStatusNotifications(kind,id)
 return lendingJson({configured:!!process.env.LENDING_FCM_SERVICE_ACCOUNT_JSON,events:events??[]})
}
export async function POST(request:Request){
 const actor=await adminLendingAccess(request);if(actor instanceof Response)return actor
 let input
 try{input=schema.parse(JSON.parse((await boundedBody(request,1024)).toString('utf8')))}catch{return lendingJson({error:'案件を確認してください。'},400)}
 const {data,error}=await createWorkflowClient().rpc('lending_retry_status_push',{p_actor:actor.id,p_kind:input.kind,p_entity:input.id})
 if(error)return lendingJson({error:'通知の再送を準備できません。'},503)
 scheduleStatusNotifications(input.kind,input.id)
 return lendingJson({queued:data,notice:'未送信・失敗した通知を再送待ちにしました。送信受付済みの通知は再送しません。'})
}
