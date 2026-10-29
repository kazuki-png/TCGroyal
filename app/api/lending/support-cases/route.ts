import {lendingAccess,lendingJson,boundedBody} from '@/lib/lending/api-guard'
import {createWorkflowClient} from '@/lib/lending/workflow-client'
import {supportCaseRequest,supportCaseError} from '@/lib/lending/support-cases'
import {scheduleStatusNotifications} from '@/lib/lending/status-notifications'
export const runtime='nodejs'
export const maxDuration=60
export async function GET(request:Request){
 const actor=await lendingAccess(request,'lending:support-read',30);if(actor instanceof Response)return actor
 const search=new URL(request.url).searchParams.get('search')??''
 if(search.length>100)return lendingJson({error:'検索は100文字以内で指定してください。'},400)
 const {data,error}=await createWorkflowClient().rpc('lending_support_list',{p_actor:actor.id,p_search:search})
 return error?lendingJson({error:'相談案件を取得できません。'},503):lendingJson(data)
}
export async function POST(request:Request){
 const actor=await lendingAccess(request,'lending:support-write',15);if(actor instanceof Response)return actor
 let input
 try{input=supportCaseRequest.parse(JSON.parse((await boundedBody(request,8192)).toString('utf8')))}catch{return lendingJson({error:'入力内容と同意を確認してください。'},400)}
 if(actor.role!=='admin'&&(input.action==='create'?(input.userId!==undefined||input.contactLabel!==undefined):!['accept','cancel'].includes(input.action)))return lendingJson({error:'管理者権限が必要です。'},403)
 const db=createWorkflowClient()
 const result=input.action==='create'?await db.rpc('lending_support_create',{p_actor:actor.id,p_input:{...input.draft,consent:input.consent,...(input.userId?{userId:input.userId}:{}),...(input.contactLabel!==undefined?{contactLabel:input.contactLabel}:{})},p_key:input.key}):await db.rpc('lending_support_command',{p_actor:actor.id,p_case:input.caseId,p_action:input.action,p_payload:input.payload,p_key:input.key,p_version:input.version})
 if(result.error)return lendingJson({error:supportCaseError(result.error.message)},409)
 scheduleStatusNotifications()
 return lendingJson({case:result.data})
}
