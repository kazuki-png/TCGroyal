import { z } from 'zod'
import { lendingAccess,lendingJson,boundedBody } from '@/lib/lending/api-guard'
import { createWorkflowClient } from '@/lib/lending/workflow-client'
import { sendFcmTest } from '@/lib/lending/push'
export const runtime='nodejs'
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('register'),token:z.string().min(20).max(4096),platform:z.literal('android')}).strict(),
 z.object({action:z.literal('test'),deviceId:z.uuid()}).strict(),
 z.object({action:z.literal('received'),testId:z.uuid()}).strict(),
 z.object({action:z.literal('unregister'),deviceId:z.uuid()}).strict(),
])
export async function POST(request:Request){
 const actor=await lendingAccess(request,'lending:notifications',6);if(actor instanceof Response)return actor
 let input:z.infer<typeof schema>
 try{input=schema.parse(JSON.parse((await boundedBody(request,6000)).toString('utf8')))}catch{return lendingJson({error:'通知設定の入力が不正です。'},400)}
 const db=createWorkflowClient()
 if(input.action==='received'){
  const {error}=await db.from('lending_notification_tests').update({status:'received',received_at:new Date().toISOString()}).eq('id',input.testId).eq('user_id',actor.id).in('status',['sending','accepted'])
  return error?lendingJson({error:'受信記録を保存できません。'},503):lendingJson({ok:true})
 }
 if(input.action==='register'){
  if(!process.env.LENDING_FCM_SERVICE_ACCOUNT_JSON)return lendingJson({error:'サーバーのFCM設定が必要です。端末内通知テストは利用できます。'},503)
  const {data:existing}=await db.from('lending_push_devices').select('id,user_id').eq('token',input.token).maybeSingle()
  if(existing&&existing.user_id!==actor.id)return lendingJson({error:'この通知端末は別の会員に登録されています。'},409)
  if(existing)return lendingJson({deviceId:existing.id})
  const {data,error}=await db.from('lending_push_devices').insert({user_id:actor.id,token:input.token,platform:input.platform}).select('id').single()
  return error?lendingJson({error:'通知端末を登録できません。'},503):lendingJson({deviceId:data.id})
 }
 const {data:device}=await db.from('lending_push_devices').select('id,token').eq('id',input.deviceId).eq('user_id',actor.id).maybeSingle()
 if(!device)return lendingJson({error:'通知端末が見つかりません。'},404)
 if(input.action==='unregister'){
  // Retain referenced test history; replace token with an unusable tombstone.
  const {error}=await db.from('lending_push_devices').update({token:`disabled:${device.id}`,updated_at:new Date().toISOString()}).eq('id',device.id).eq('user_id',actor.id)
  return error?lendingJson({error:'通知設定を解除できません。'},503):lendingJson({ok:true})
 }
 if(device.token.startsWith('disabled:'))return lendingJson({error:'通知端末を登録し直してください。'},409)
 if(!process.env.LENDING_FCM_SERVICE_ACCOUNT_JSON)return lendingJson({error:'サーバーのFCM設定が必要です。'},503)
 const {data:record,error}=await db.from('lending_notification_tests').insert({user_id:actor.id,device_id:device.id,status:'sending'}).select('id').single()
 if(error)return lendingJson({error:'通知テストを開始できません。'},503)
 try{
  const messageId=await sendFcmTest(device.token,record.id)
  await db.from('lending_notification_tests').update({status:'accepted',provider_message_id:messageId}).eq('id',record.id).eq('status','sending')
  return lendingJson({ok:true,testId:record.id,notice:'FCMが送信を受け付けました。端末での受信を確認してください。'})
 }catch(error){
  const known=['push_not_configured','fcm_auth_failed','device_not_registered','fcm_send_failed']
  const code=error instanceof Error&&known.includes(error.message)?error.message:'push_send_failed'
  await db.from('lending_notification_tests').update({status:'failed',error_code:code}).eq('id',record.id).eq('status','sending')
  return lendingJson({error:'通知を送信できません。Firebase設定と端末の通知許可を確認してください。'},502)
 }
}
