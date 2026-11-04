import 'server-only'
import {z} from 'zod'
import {createWorkflowClient} from './workflow-client'
import type {RepaymentPreview} from './repayment-types'
export const repaymentPreviewInput=z.object({loanId:z.uuid(),date:z.iso.date()}).strict()
export async function repaymentPreview(actor:{id:string;role:string},input:z.infer<typeof repaymentPreviewInput>):Promise<RepaymentPreview>{
 const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10)
 if(input.date<today)throw Error('repayment_date_outside_term')
 const {data,error}=await createWorkflowClient().rpc('lending_payment_snapshot',{p_actor:actor.id,p_loan:input.loanId,p_date:input.date})
 if(error||!data)throw Error(error?.message==='repayment_not_found'?'repayment_not_found':error?.message==='repayment_date_outside_term'?'repayment_date_outside_term':'repayment_unavailable')
 return data as RepaymentPreview
}
