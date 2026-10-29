import 'server-only'
import {getAdminAccess} from '@/lib/admin/authorization'
import {isAdministrativeRole} from '@/lib/admin/roles'
import {isLendingEnabled,isLocalLendingEnabled,isSameOriginRequest} from './local-config'
import {getWorkflowActor} from './workflow-server'
import {checkWorkflowRateLimit} from './workflow-client'
import {lendingJson} from './api-guard'
// Cookie-authenticated admin routes must never substitute a fixture/admin ID or cross databases.
export async function adminLendingAccess(request?:Request){
 if(!isLendingEnabled())return lendingJson({error:'融資管理の接続設定を確認してください。'},503)
 let actor:string|undefined
 if(request&&isLocalLendingEnabled()&&process.env.LENDING_LOCAL_DEMO==='true'){
  const local=await getWorkflowActor(request);if(local?.role==='admin')actor=local.id
 }else{
  const access=await getAdminAccess()
  if(!access)return lendingJson({error:'管理者ログインが必要です。'},403)
  if(!isAdministrativeRole(access.role))return lendingJson({error:'管理者権限が必要です。'},403)
  if(process.env.NEXT_PUBLIC_SUPABASE_URL!==process.env.LENDING_PREVIEW_SUPABASE_URL)return lendingJson({error:'管理画面と融資管理のデータ接続先が一致していません。'},503)
  if(access.user.factors?.some(f=>f.status==='verified')){
   const assurance=await access.supabase.auth.mfa.getAuthenticatorAssuranceLevel()
   if(assurance.error||assurance.data.currentLevel!=='aal2')return lendingJson({error:'管理者の追加認証が必要です。'},403)
  }
  actor=access.user.id
 }
 if(!actor)return lendingJson({error:'管理者権限が必要です。'},403)
 if(request){
  if(request.method!=='GET'&&!isSameOriginRequest(request))return lendingJson({error:'不正な送信元です。'},403)
  const rate=await checkWorkflowRateLimit('lending:admin',actor,{limit:60,windowMs:60000})
  if(!rate.allowed)return lendingJson({error:'操作回数が多いため、しばらく待ってください。'},429)
 }
 return {id:actor}
}
