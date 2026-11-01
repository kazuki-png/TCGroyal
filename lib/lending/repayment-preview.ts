import 'server-only'
import {z} from 'zod'
import {createWorkflowClient} from './workflow-client'
import type {RepaymentPreview} from './repayment-types'
export const repaymentPreviewInput=z.object({loanId:z.uuid(),date:z.iso.date()}).strict()
export async function repaymentPreview(actor:{id:string;role:string},input:z.infer<typeof repaymentPreviewInput>):Promise<RepaymentPreview>{
 const db=createWorkflowClient();let query=db.from('lending_loans').select('id,user_id,status,principal_jpy,monthly_rate_bps,interest_start_at,due_at,version').eq('id',input.loanId)
 if(actor.role!=='admin')query=query.eq('user_id',actor.id)
 const {data:loan,error}=await query.maybeSingle()
 if(error)throw Error('repayment_unavailable')
 if(!loan||!['active','repayment_pending'].includes(loan.status))throw Error('repayment_not_found')
 const now=new Date(),today=new Date(now.getTime()+9*3600000).toISOString().slice(0,10),due=new Date(loan.due_at)
 const dueDate=new Date(due.getTime()+9*3600000).toISOString().slice(0,10)
 if(input.date<today||input.date>dueDate)throw Error('repayment_date_outside_term')
 const basisAt=new Date(Math.min(Date.parse(`${input.date}T23:59:59.999+09:00`),due.getTime())).toISOString()
 // Use the same database function as settlement. Do not duplicate financial
 // arithmetic on the device or change the loan/ledger while previewing.
 const result=await db.rpc('lending_interest',{p_principal:loan.principal_jpy,p_rate:loan.monthly_rate_bps,p_start:loan.interest_start_at,p_at:basisAt})
 if(result.error||result.data===null||!Number.isSafeInteger(Number(result.data))||Number(result.data)<0)throw Error('repayment_unavailable')
 return {principalJpy:loan.principal_jpy,interestJpy:Number(result.data),totalJpy:loan.principal_jpy+Number(result.data),basisAt,calculatedAt:now.toISOString(),version:loan.version}
}
