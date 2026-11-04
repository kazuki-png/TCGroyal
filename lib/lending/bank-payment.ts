import 'server-only'
import {z} from 'zod'
import {createWorkflowClient} from './workflow-client'
import type {BankPaymentPreview} from './bank-payment-types'
export const bankPaymentInput=z.object({loanId:z.uuid(),date:z.iso.date()}).strict()
export async function bankPaymentPreview(actor:{id:string;role:string},input:z.infer<typeof bankPaymentInput>):Promise<BankPaymentPreview>{
 const {data,error}=await createWorkflowClient().rpc('lending_payment_snapshot',{p_actor:actor.id,p_loan:input.loanId,p_date:input.date})
 if(error||!data)throw Error(error?.message==='repayment_not_found'?'repayment_not_found':error?.message==='repayment_date_outside_term'?'repayment_date_outside_term':'repayment_unavailable')
 return data as BankPaymentPreview
}
