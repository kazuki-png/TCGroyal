import {z} from 'zod'
import {boundedBody,lendingJson} from '@/lib/lending/api-guard'
import {firebasePhoneConfiguration,verifyFirebasePhone} from '@/lib/lending/firebase-auth'
import {isPreviewLendingEnabled,isSameOriginRequest} from '@/lib/lending/local-config'
import {createWorkflowClient,checkWorkflowRateLimit} from '@/lib/lending/workflow-client'
import {getClientIpFromHeaders,rateLimitResponse} from '@/lib/security/rateLimit'
export const runtime='nodejs'
export async function GET(){
 if(!isPreviewLendingEnabled())return lendingJson({error:'Preview専用です。'},404)
 const config=firebasePhoneConfiguration()
 return lendingJson({enabled:!!config,projectId:config?.projectId??null})
}
export async function POST(request:Request){
 if(!isPreviewLendingEnabled())return lendingJson({error:'Preview専用です。'},404)
 if(!isSameOriginRequest(request))return lendingJson({error:'不正な送信元です。'},403)
 if(!firebasePhoneConfiguration())return lendingJson({error:'Firebase電話番号認証は設定待ちです。テスト接続コードを利用してください。'},503)
 const rate=await checkWorkflowRateLimit('lending:firebase-login',getClientIpFromHeaders(request.headers),{limit:10,windowMs:60000})
 if(!rate.allowed)return rateLimitResponse(rate)
 let token:string
 try{token=z.object({idToken:z.string().min(20).max(10000)}).strict().parse(JSON.parse((await boundedBody(request,11000)).toString())).idToken}
 catch{return lendingJson({error:'認証情報が不正です。'},400)}
 let verified:Awaited<ReturnType<typeof verifyFirebasePhone>>
 try{verified=await verifyFirebasePhone(token,true)}catch{return lendingJson({error:'電話番号認証をやり直してください。'},401)}
 const db=createWorkflowClient()
 // Firebase accounts are separate customers. Never merge into shared fixture or admin accounts.
 const existing=await db.auth.admin.getUserById(verified.userId)
 if(existing.error&&existing.error.status!==404)return lendingJson({error:'アカウントを確認できません。'},503)
 if(!existing.data.user){
  const created=await db.auth.admin.createUser({id:verified.userId,email:`firebase-${verified.subjectHash}@lending-preview.invalid`,email_confirm:false,
   app_metadata:{provider:'lending_firebase_preview'}})
  if(created.error){const retry=await db.auth.admin.getUserById(verified.userId);if(!retry.data.user)return lendingJson({error:'アカウントを準備できません。'},503)}
 }
 const bound=await db.rpc('lending_bind_firebase_phone',{p_actor:verified.userId,p_subject_hash:verified.subjectHash,p_phone:verified.phone})
 if(bound.error)return lendingJson({error:'電話番号を登録できません。'},503)
 return lendingJson({ok:true,notice:'Preview用の電話番号アカウントで接続しました。本人確認書類の確認は別途必要です。'})
}
