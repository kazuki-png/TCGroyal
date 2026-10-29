import 'server-only'
import { createSign } from 'node:crypto'
import { z } from 'zod'
const accountSchema=z.object({project_id:z.string().regex(/^[a-z][a-z0-9-]{4,62}$/),client_email:z.string().email(),private_key:z.string().min(100)})
export async function sendFcmMessage(token:string,notification:{title:string;body:string},data:Record<string,string>,tag?:string) {
 const raw=process.env.LENDING_FCM_SERVICE_ACCOUNT_JSON;if(!raw)throw Error('push_not_configured')
 const account=accountSchema.parse(JSON.parse(raw)),now=Math.floor(Date.now()/1000)
 const encode=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString('base64url')
 const body=`${encode({alg:'RS256',typ:'JWT'})}.${encode({iss:account.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})}`
 const assertion=`${body}.${createSign('RSA-SHA256').update(body).sign(account.private_key,'base64url')}`
 const auth=await fetch('https://oauth2.googleapis.com/token',{method:'POST',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),redirect:'error'})
 if(!auth.ok)throw Error('fcm_auth_failed')
 const {access_token}=z.object({access_token:z.string().min(10)}).parse(await auth.json())
 const r=await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,{method:'POST',signal:AbortSignal.timeout(10000),redirect:'error',
 headers:{Authorization:`Bearer ${access_token}`,'Content-Type':'application/json'},body:JSON.stringify({message:{token,
  notification,data,android:{priority:'high',notification:{channel_id:'lending-test',...(tag?{tag}:{})}}}})})
 if(!r.ok){const error=await r.json().catch(()=>null);const unregistered=Array.isArray(error?.error?.details)&&error.error.details.some((d:{errorCode?:string})=>d.errorCode==='UNREGISTERED');throw Error(unregistered?'device_not_registered':'fcm_send_failed')}
 return z.object({name:z.string().max(500)}).parse(await r.json()).name
}
export function sendFcmTest(token:string,testId:string){return sendFcmMessage(token,{title:'TCG ROYAL',body:'プッシュ通知の受信テストです。アプリを開いて確認してください。'},{screen:'notifications',testId})}
export function sendFcmStatus(token:string,event:{id:string;kind:'case'|'loan';entityId:string}){
 return sendFcmMessage(token,{title:'TCG ROYAL',body:'お手続きの状況が更新されました。アプリでご確認ください。'},{screen:'loans',notificationId:event.id,entityKind:event.kind,entityId:event.entityId},event.id)
}
