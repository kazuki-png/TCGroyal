import type {WorkflowLoan} from './workflow-types'
import {LOAN_STATUS_LABELS} from './workflow-types'
import {SUPPORT_CASE_STATUS,type SupportCase} from './support-case-types'

export type TransactionGroup='attention'|'progress'|'completed'
export interface LendingTransaction {
 id:string;loanId:string|null;caseId:string|null;reference:string;title:string;quantity:number;
 status:string;statusLabel:string;group:TransactionGroup;nextAction:string;
 amountJpy:number|null;amountLabel:string;dueAt:string|null;updatedAt:string;
}
const complete=new Set(['returned','forfeited','rejected','cancelled'])
const actions:Record<string,string>={submitted:'発送・受付内容を確認',received:'検品内容を確認',offered:'融資条件を確認',accepted:'振込手続きを確認',active:'返済手続きを確認',repayment_pending:'返済の申告内容を確認',return_pending:'返却状況を確認'}
export function buildTransactions(loans:WorkflowLoan[],cases:SupportCase[],now=Date.now()):LendingTransaction[]{
 const byLoan=new Map(cases.filter(item=>item.loan_id).map(item=>[item.loan_id,item]))
 const loanIds=new Set(loans.map(item=>item.id))
 const rows:LendingTransaction[]=loans.map(loan=>{
  const item=byLoan.get(loan.id),active=['active','repayment_pending'].includes(loan.status)
  const urgent=loan.status==='active'&&!!loan.due_at&&Date.parse(loan.due_at)<=now+7*86400000
  const group:TransactionGroup=complete.has(loan.status)?'completed':loan.status==='offered'||urgent?'attention':'progress'
  return {id:`loan:${loan.id}`,loanId:loan.id,caseId:item?.id??null,reference:item?.reference??`契約 ${loan.id.slice(0,8)}`,title:loan.card_name,quantity:loan.collateral_items?.reduce((sum,row)=>sum+row.quantity,0)??1,status:loan.status,statusLabel:LOAN_STATUS_LABELS[loan.status],group,nextAction:actions[loan.status]??'取引履歴を確認',amountJpy:active?loan.principal_jpy:loan.status==='offered'?loan.offered_jpy:complete.has(loan.status)?null:loan.requested_jpy,amountLabel:active?'借入元本':loan.status==='offered'?'正式な融資提示額':'申込希望額',dueAt:loan.due_at,updatedAt:loan.events.at(-1)?.created_at??loan.created_at}
 })
 for(const item of cases){
  if(item.loan_id&&loanIds.has(item.loan_id))continue
  const done=['cancelled','declined'].includes(item.status),attention=['offered','information_required'].includes(item.status)
  rows.push({id:`case:${item.id}`,loanId:item.loan_id,caseId:item.id,reference:item.reference,title:item.card_name,quantity:item.collateral_items?.reduce((sum,row)=>sum+row.quantity,0)??1,status:item.status,statusLabel:item.loan_status?LOAN_STATUS_LABELS[item.loan_status]:SUPPORT_CASE_STATUS[item.status],group:done?'completed':attention?'attention':'progress',nextAction:item.loan_id?'契約情報を確認':item.status==='information_required'?'必要な情報を確認':item.status==='offered'?'事前見積もりを確認':'査定の状況を確認',amountJpy:item.offer_jpy??item.requested_jpy,amountLabel:item.offer_jpy!==null?'事前見積もり額':'申込希望額',dueAt:null,updatedAt:item.updated_at})
 }
 return rows.sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt)||a.id.localeCompare(b.id))
}
