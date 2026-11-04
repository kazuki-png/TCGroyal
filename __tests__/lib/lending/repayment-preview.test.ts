// @vitest-environment node
import {beforeEach,describe,expect,it,vi} from 'vitest'
vi.mock('server-only',()=>({}))
const mocks=vi.hoisted(()=>({client:vi.fn(),rpc:vi.fn()}))
vi.mock('@/lib/lending/workflow-client',()=>({createWorkflowClient:mocks.client}))
import {repaymentPreview,repaymentPreviewInput} from '@/lib/lending/repayment-preview'
import {bankPaymentPreview} from '@/lib/lending/bank-payment'
const id='10000000-0000-4000-8000-000000000001',actor={id:'owner',role:'customer'}
beforeEach(()=>{vi.resetAllMocks();mocks.client.mockReturnValue({rpc:mocks.rpc});mocks.rpc.mockResolvedValue({data:{principalJpy:100000,interestJpy:3000,totalJpy:103000,version:3,chargeLabel:'期限前返済手数料'},error:null})})
describe('bank repayment preview',()=>{
 it('uses the server-owned remaining-charge snapshot with actor and date only',async()=>{const value=await repaymentPreview(actor,{loanId:id,date:'2099-12-30'});expect(mocks.rpc).toHaveBeenCalledWith('lending_payment_snapshot',{p_actor:'owner',p_loan:id,p_date:'2099-12-30'});expect(value).toMatchObject({totalJpy:103000,chargeLabel:'期限前返済手数料'});await bankPaymentPreview(actor,{loanId:id,date:'2099-12-30'});expect(mocks.rpc).toHaveBeenCalledTimes(2)})
 it('preserves owner/closed-contract errors without exposing database errors',async()=>{mocks.rpc.mockResolvedValue({data:null,error:{message:'repayment_not_found'}});await expect(repaymentPreview(actor,{loanId:id,date:'2099-12-30'})).rejects.toThrow('repayment_not_found');mocks.rpc.mockResolvedValue({data:null,error:{message:'db private'}});await expect(repaymentPreview(actor,{loanId:id,date:'2099-12-30'})).rejects.toThrow('repayment_unavailable')})
 it('rejects past dates, malformed dates and client-supplied prices',async()=>{await expect(repaymentPreview(actor,{loanId:id,date:'2000-01-01'})).rejects.toThrow('repayment_date_outside_term');expect(mocks.rpc).not.toHaveBeenCalled();expect(repaymentPreviewInput.safeParse({loanId:id,date:'2026-02-30'}).success).toBe(false);expect(repaymentPreviewInput.safeParse({loanId:id,date:'2026-11-01',principalJpy:1}).success).toBe(false)})
 it('maps a date outside the contract to an actionable error',async()=>{mocks.rpc.mockResolvedValue({data:null,error:{message:'repayment_date_outside_term'}});await expect(repaymentPreview(actor,{loanId:id,date:'2099-12-30'})).rejects.toThrow('repayment_date_outside_term')})
})
