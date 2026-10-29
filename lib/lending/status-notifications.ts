import 'server-only'
import {after} from 'next/server'
import {createWorkflowClient} from './workflow-client'
import {sendFcmStatus} from './push'
import type {StatusPushJob} from './status-push-types'
export async function dispatchStatusNotifications(kind?:'case'|'loan',entityId?:string){
 if(!process.env.LENDING_FCM_SERVICE_ACCOUNT_JSON)return {configured:false,processed:0}
 const db=createWorkflowClient()
 const {data,error}=await db.rpc('lending_claim_status_push',{p_limit:5,p_kind:kind??null,p_entity:entityId??null})
 if(error)throw Error('push_queue_unavailable')
 const jobs=(data??[]) as StatusPushJob[]
 const results=await Promise.allSettled(jobs.map(async job=>{
  let message:string|null=null,code:string|null=null
  try{message=await sendFcmStatus(job.token,{id:job.notificationId,kind:job.kind,entityId:job.entityId})}
  catch(error){const known=['device_not_registered','fcm_auth_failed','fcm_send_failed','push_not_configured'];code=error instanceof Error&&known.includes(error.message)?error.message:'push_send_failed'}
  const saved=await db.rpc('lending_finish_status_push',{p_job:job.id,p_lease:job.leaseId,p_message:message,p_error:code})
  if(saved.error)throw Error('push_result_unavailable')
 }))
 if(results.some(result=>result.status==='rejected'))throw Error('push_result_unavailable')
 return {configured:true,processed:jobs.length}
}
export function scheduleStatusNotifications(kind?:'case'|'loan',entityId?:string){
 if(!process.env.LENDING_FCM_SERVICE_ACCOUNT_JSON)return
 after(async()=>{try{await dispatchStatusNotifications(kind,entityId)}catch{/* The persisted lease/queue is retried by a later worker invocation. */}})
}
