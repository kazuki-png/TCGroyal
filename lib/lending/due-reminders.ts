import 'server-only'
import {createHmac} from 'node:crypto'
import {createWorkflowClient} from './workflow-client'
import {sendFcmMessage} from './push'
export function reminderWorkerToken(secret:string){return createHmac('sha256',secret).update('lending:due-reminders:v1').digest('hex')}
interface Job {id:string;loan_id:string;user_id:string;due_at:string;channel:'email'|'push';target_id:string;lease_id:string}
export async function dispatchDueReminders(){
 const db=createWorkflowClient(),email=!!process.env.RESEND_API_KEY&&!!process.env.RESEND_FROM_EMAIL,push=!!process.env.LENDING_FCM_SERVICE_ACCOUNT_JSON
 const prepared=await db.rpc('lending_prepare_due_reminders');if(prepared.error)throw Error('reminder_queue_unavailable')
 const claimed=await db.rpc('lending_claim_due_reminders',{p_limit:4,p_email:email,p_push:push});if(claimed.error)throw Error('reminder_queue_unavailable')
 const jobs=(claimed.data??[]) as Job[]
 for(let i=0;i<jobs.length;i+=2)await Promise.all(jobs.slice(i,i+2).map(async job=>{
  let provider:string|null=null,error:string|null=null
  try{
   // Recheck immediately before delivery; repayment/extension invalidates old reminders.
   const current=await db.from('lending_loans').select('status,due_at').eq('id',job.loan_id).maybeSingle()
   const day=(s:string)=>new Date(Date.parse(s)+9*3600000).toISOString().slice(0,10)
   if(current.error)throw Error('reminder_send_failed')
   if(!current.data||!['active','repayment_pending'].includes(current.data.status)||day(current.data.due_at)!==day(job.due_at))throw Error('recipient_unavailable')
   const deadline=new Date(job.due_at).toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'numeric',day:'numeric'}),text=`返済期限は${deadline}です。返済・延長のお手続きはアプリでご確認ください。銀行振込は着金までに時間がかかる場合があります。`
   if(job.channel==='push'){
    const device=await db.from('lending_push_devices').select('token').eq('id',job.target_id).eq('user_id',job.user_id).maybeSingle()
    if(device.error)throw Error('reminder_send_failed')
    if(!device.data||device.data.token.startsWith('disabled:'))throw Error('recipient_unavailable')
    provider=await sendFcmMessage(device.data.token,{title:'TCG ROYAL 返済期限のお知らせ',body:text},{screen:'loans',entityKind:'loan',entityId:job.loan_id},job.id)
   }else{
    const user=await db.auth.admin.getUserById(job.user_id)
    if(user.error)throw Error('reminder_send_failed')
    const address=user.data.user?.email
    if(!address||!user.data.user?.email_confirmed_at||address.endsWith('.invalid'))throw Error('recipient_unavailable')
    const response=await fetch('https://api.resend.com/emails',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`lending-due-${job.id}`},body:JSON.stringify({from:process.env.RESEND_FROM_EMAIL,to:[address],subject:'TCG ROYAL 返済期限のお知らせ',text})})
    if(!response.ok)throw Error('reminder_send_failed')
    const data=await response.json();if(typeof data.id!=='string')throw Error('reminder_send_failed');provider=data.id
   }
  }catch(cause){error=cause instanceof Error&&cause.message==='recipient_unavailable'?'recipient_unavailable':'reminder_send_failed'}
  const finished=await db.rpc('lending_finish_due_reminder',{p_job:job.id,p_lease:job.lease_id,p_provider:provider,p_error:error});if(finished.error)throw Error('reminder_result_unavailable')
 }))
 return {processed:jobs.length,emailConfigured:email,pushConfigured:push}
}
