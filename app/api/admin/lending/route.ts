import {z} from 'zod'
import {adminLendingAccess} from '@/lib/lending/admin-access'
import {createWorkflowClient} from '@/lib/lending/workflow-client'
import {lendingJson,boundedBody} from '@/lib/lending/api-guard'
import {ADMIN_FILTERS} from '@/lib/lending/admin-types'
import {supportCaseRequest,supportCaseError} from '@/lib/lending/support-cases'
import {workflowInputSchema as inputSchema} from '@/lib/lending/workflow-input'
import {scheduleStatusNotifications} from '@/lib/lending/status-notifications'
import {inspectionInputError} from '@/lib/lending/inspection-input'
export const runtime='nodejs'
export const maxDuration=60
export async function GET(request:Request){
 const actor=await adminLendingAccess(request);if(actor instanceof Response)return actor
 const url=new URL(request.url),db=createWorkflowClient()
 if(url.searchParams.has('id')){
  const id=url.searchParams.get('id'),kind=url.searchParams.get('kind')
  if(!z.uuid().safeParse(id).success||!['case','loan'].includes(kind??''))return lendingJson({error:'案件を確認してください。'},400)
  const result=await db.rpc('lending_admin_detail',{p_actor:actor.id,p_kind:kind,p_id:id})
  return result.error?lendingJson({error:result.error.message==='not_found'?'案件が見つかりません。':'案件を取得できません。'},result.error.message==='not_found'?404:503):lendingJson(result.data)
 }
 const search=url.searchParams.get('search')??'',filter=url.searchParams.get('filter')??'all',page=Number(url.searchParams.get('page')??1)
 if(search.length>100||!Object.hasOwn(ADMIN_FILTERS,filter)||!Number.isInteger(page)||page<1||page>10000)return lendingJson({error:'検索条件を確認してください。'},400)
 const result=await db.rpc('lending_admin_dashboard',{p_actor:actor.id,p_search:search,p_filter:filter,p_page:page})
 if(!result.error)scheduleStatusNotifications()
 return result.error?lendingJson({error:'融資状況を取得できません。'},503):lendingJson(result.data)
}
export async function POST(request:Request){
 const actor=await adminLendingAccess(request);if(actor instanceof Response)return actor
 let raw:Record<string,unknown>
 try{raw=JSON.parse((await boundedBody(request,8192)).toString('utf8'));if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('input')}catch{return lendingJson({error:'入力内容を確認してください。'},400)}
 const {kind,...body}=raw,db=createWorkflowClient()
 if(kind==='case'){
  if(body.action==='rollback'){
   const rollback=z.object({action:z.literal('rollback'),caseId:z.uuid(),status:z.enum(['registered','reviewing']),reason:z.string().trim().min(1).max(500),version:z.number().int().positive(),key:z.uuid()}).strict().safeParse(body)
   if(!rollback.success)return lendingJson({error:'戻し先と理由を確認してください。'},400)
   const v=rollback.data,result=await db.rpc('lending_revert_case_status',{p_actor:actor.id,p_case:v.caseId,p_status:v.status,p_reason:v.reason,p_version:v.version,p_key:v.key})
   if(result.error)return lendingJson({error:supportCaseError(result.error.message)},409)
   scheduleStatusNotifications('case',v.caseId)
   return lendingJson({case:result.data})
  }
  const parsed=supportCaseRequest.safeParse(body)
  if(!parsed.success)return lendingJson({error:'入力内容と確認欄を確認してください。'},400)
  const input=parsed.data
  if(input.action==='accept')return lendingJson({error:'見積もりへの同意・申込は利用者が行います。'},403)
  const result=input.action==='create'?await db.rpc('lending_support_create',{p_actor:actor.id,p_input:{...input.draft,consent:input.consent,...(input.userId?{userId:input.userId}:{}),...(input.contactLabel!==undefined?{contactLabel:input.contactLabel}:{})},p_key:input.key}):await db.rpc('lending_support_command',{p_actor:actor.id,p_case:input.caseId,p_action:input.action,p_payload:input.payload,p_key:input.key,p_version:input.version})
  if(!result.error)scheduleStatusNotifications('case',result.data.id)
  return result.error?lendingJson({error:supportCaseError(result.error.message)},409):lendingJson({case:result.data})
 }
 if(kind!=='loan')return lendingJson({error:'案件の種類を確認してください。'},400)
 const parsed=inputSchema.safeParse(body)
 if(!parsed.success||parsed.data.type!=='command')return lendingJson({error:'手続きの入力内容を確認してください。'},400)
 const v=parsed.data
 if(['accept','report_repayment','request_extension','request_additional'].includes(v.action))return lendingJson({error:'この手続きは利用者が行います。'},403)
 if(v.action==='offer'||v.action==='receive'){
  const original=await db.rpc('lending_admin_detail',{p_actor:actor.id,p_kind:'loan',p_id:v.loanId})
  if(original.error)return lendingJson({error:'申込を取得できません。'},404)
  // Let the command RPC resolve successful retries and version conflicts first.
  if(v.action==='receive'&&original.data.item.version===v.version&&original.data.item.status==='submitted'){
   const error=inspectionInputError(original.data.item.cert_number,v.payload)
   if(error)return lendingJson({error},400)
  }
  if(v.action==='offer'&&original.data.item.valuation_source!=='support')return lendingJson({error:'旧方式の申込です。個別見積もりとして再受付してから条件を提示してください。'},409)
 }
 const result=await db.rpc('lending_command',{p_actor:actor.id,p_loan:v.loanId,p_action:v.action,p_payload:v.payload,p_key:v.key,p_version:v.version})
 if(!result.error)scheduleStatusNotifications('loan',v.loanId)
 const messages:Record<string,string>={version_conflict:'他の操作で更新されました。再読み込みしてください。',identity_required:'利用者の融資用本人確認が完了していません。',manual_evidence_required:'現物評価額・融資上限・評価根拠を入力してください。',inspection_required:'現物の検品内容・鑑定番号・保管場所を確認してください。',amount_invalid:'金額と見積もり上限を確認してください。',repayment_amount_mismatch:'照合した入金額が返済必要額と一致しません。',duplicate_reference:'この照合番号は記録済みです。',invalid_transition:'現在の状態ではこの操作はできません。',idempotency_conflict:'前回と送信内容が異なります。一覧を更新してください。'}
 return result.error?lendingJson({error:messages[result.error.message]??'手続きを記録できません。状態と入力内容を確認してください。'},409):lendingJson({ok:true})
}
