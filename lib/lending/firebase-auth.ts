import 'server-only'
import {createHash} from 'node:crypto'
import {isPreviewLendingEnabled} from './local-config'
import {normalizeMobilePhone} from './phone'

export function firebasePhoneConfiguration() {
 if(!isPreviewLendingEnabled()||process.env.FIREBASE_AUTH_EMULATOR_HOST)return null
 try {
  const account=JSON.parse(process.env.LENDING_FCM_SERVICE_ACCOUNT_JSON??'{}')
  const projectId=process.env.LENDING_FIREBASE_PROJECT_ID
  if(!projectId||!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)||account.project_id!==projectId||!account.client_email||!account.private_key)return null
  return {projectId,account}
 }catch{return null}
}
export async function verifyFirebasePhone(token:string,fresh=false) {
 const config=firebasePhoneConfiguration()
 if(!config||token.length>10000||token.split('.').length!==3)throw Error('firebase_not_configured')
 const [{cert,getApps,initializeApp},{getAuth}]=await Promise.all([import('firebase-admin/app'),import('firebase-admin/auth')])
 const name=`lending-preview-${config.projectId}`
 const app=getApps().find(a=>a.name===name)??initializeApp({projectId:config.projectId,credential:cert(config.account)},name)
 // Check signature, issuer, audience, expiry, disabled user and token revocation.
 const value=await getAuth(app).verifyIdToken(token,true)
 const phone=normalizeMobilePhone(value.phone_number??'',true)
 const now=Math.floor(Date.now()/1000)
 if(value.firebase.sign_in_provider!=='phone'||!phone||!value.uid||value.auth_time>now||
  (fresh&&now-value.auth_time>600))throw Error('phone_auth_required')
 const subjectHash=createHash('sha256').update(`${config.projectId}:${value.uid}`).digest('hex')
 // Stable, provider-specific ID makes retrying initial provisioning safe.
 const hex=subjectHash.slice(0,12)+'5'+subjectHash.slice(13,16)+'a'+subjectHash.slice(17,32)
 const userId=`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`
 return {subjectHash,userId,phone}
}
