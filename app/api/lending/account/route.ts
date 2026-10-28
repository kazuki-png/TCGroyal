import { z } from 'zod'
import { lendingAccess,lendingJson,boundedBody } from '@/lib/lending/api-guard'
import { createWorkflowClient } from '@/lib/lending/workflow-client'
import { isPreviewLendingEnabled } from '@/lib/lending/local-config'
import {firebasePhoneConfiguration} from '@/lib/lending/firebase-auth'
import {normalizeMobilePhone} from '@/lib/lending/phone'
const columns='last_name,first_name,last_name_kana,first_name_kana,birthday,postal_code,address,phone,updated_at'
export async function GET(request:Request){
 const actor=await lendingAccess(request,'lending:account',60);if(actor instanceof Response)return actor
 const db=createWorkflowClient()
 const [profile,summary,documents,assessments,notifications,identity,phone]=await Promise.all([
  db.from('profiles').select(columns).eq('id',actor.id).single(),db.rpc('lending_account_summary',{p_actor:actor.id}),
  db.from('lending_documents').select('id,document_type,side,status,uploaded_at').eq('user_id',actor.id).neq('status','deleted').order('uploaded_at',{ascending:false}).limit(30),
  db.from('lending_assessments').select('id,cert_number,product_id,product,estimate_jpy,quote_id,status,created_at,expires_at,submitted_at').eq('user_id',actor.id).order('created_at',{ascending:false}).limit(30),
  db.from('lending_notification_tests').select('id,status,created_at,received_at,error_code').eq('user_id',actor.id).order('created_at',{ascending:false}).limit(10),
  db.from('lending_identity_checks').select('method,expires_at').eq('user_id',actor.id).maybeSingle(),
  db.from('lending_firebase_accounts').select('phone,verified_at').eq('user_id',actor.id).maybeSingle(),
 ])
 if([profile,summary,documents,assessments,notifications,identity,phone].some(r=>r.error))return lendingJson({error:'マイページの情報を取得できません。'},503)
 const active=identity.data&&Date.parse(identity.data.expires_at)>Date.now()
 return lendingJson({authentication:actor.authProvider==='supabase'?{provider:'supabase',email:actor.email,emailVerified:true}:{provider:actor.demo?'preview':'supabase'},profile:profile.data,summary:summary.data,documents:documents.data,assessments:assessments.data,notifications:notifications.data,
  identity:{method:identity.data?.method??null,expiresAt:identity.data?.expires_at??null,status:active?(identity.data!.method==='jpki'?'verified':'test_verified'):'unverified'},
  phone:{status:phone.data&&normalizeMobilePhone(profile.data?.phone??'',isPreviewLendingEnabled())===phone.data.phone?'test_verified':'unverified',verifiedAt:phone.data?.verified_at??null},
  capabilities:{psaConfigured:!!process.env.PSA_API_ACCESS_TOKEN,remotePushConfigured:!!process.env.LENDING_FCM_SERVICE_ACCOUNT_JSON,phoneConfigured:actor.demo&&!!firebasePhoneConfiguration(),preview:isPreviewLendingEnabled(),documentUploadEnabled:process.env.LENDING_DOCUMENT_UPLOAD_ENABLED==='true',jpkiConfigured:false}})
}
const nonempty=z.string().trim().min(1).max(100)
const schema=z.object({last_name:nonempty,first_name:nonempty,last_name_kana:nonempty,first_name_kana:nonempty,
 birthday:z.iso.date(),postal_code:z.string().regex(/^\d{3}-?\d{4}$/),address:z.string().trim().min(3).max(300),
 phone:z.string().regex(/^\+?[\d-]{10,16}$/),updated_at:z.iso.datetime({offset:true})}).strict()
export async function POST(request:Request){
 const actor=await lendingAccess(request,'lending:profile-save',10);if(actor instanceof Response)return actor
 let value:z.infer<typeof schema>
 try{value=schema.parse(JSON.parse((await boundedBody(request,4096)).toString('utf8')));if(value.birthday>new Date().toISOString().slice(0,10))throw Error('future')}
 catch{return lendingJson({error:'氏名・カナ・生年月日・住所・電話番号を確認してください。'},400)}
 const {updated_at,...payload}=value
 const {error}=await createWorkflowClient().rpc('lending_update_profile',{p_actor:actor.id,p_payload:payload,p_version:updated_at})
 if(error)return lendingJson({error:'プロフィールが更新されました。マイページを更新して再入力してください。'},409)
 return lendingJson({ok:true,notice:'保存しました。本人情報を変更した場合は本人確認をやり直してください。'})
}
