// @vitest-environment node
import {beforeEach,describe,expect,it,vi} from 'vitest'
vi.mock('server-only',()=>({}))
const mocks=vi.hoisted(()=>({client:vi.fn(),rpc:vi.fn(),eq:vi.fn(),single:vi.fn()}))
vi.mock('@/lib/lending/workflow-client',()=>({createWorkflowClient:mocks.client}))
import {repaymentPreview,repaymentPreviewInput} from '@/lib/lending/repayment-preview'
const id='10000000-0000-4000-8000-000000000001',actor={id:'owner',role:'customer'}
beforeEach(()=>{vi.resetAllMocks();const q={select:vi.fn(()=>q),eq:mocks.eq,maybeSingle:mocks.single};mocks.eq.mockReturnValue(q);mocks.client.mockReturnValue({from:vi.fn(()=>q),rpc:mocks.rpc});mocks.single.mockResolvedValue({data:{id,user_id:'owner',status:'active',principal_jpy:100000,monthly_rate_bps:100,interest_start_at:'2026-10-01',due_at:'2099-12-31T00:00:00Z',version:3},error:null});mocks.rpc.mockResolvedValue({data:3000,error:null})})
describe('repayment date preview',()=>{
 it('uses the existing settlement function with server owned values and owner scope',async()=>{const value=await repaymentPreview(actor,{loanId:id,date:'2099-12-30'});expect(mocks.eq).toHaveBeenCalledWith('user_id','owner');expect(mocks.rpc).toHaveBeenCalledWith('lending_interest',expect.objectContaining({p_principal:100000,p_rate:100,p_start:'2026-10-01',p_at:'2099-12-30T14:59:59.999Z'}));expect(value).toMatchObject({principalJpy:100000,interestJpy:3000,totalJpy:103000,version:3})})
 it('rejects a missing or closed contract before financial calculation',async()=>{for(const data of [null,{status:'returned'}]){mocks.single.mockResolvedValueOnce({data,error:null});await expect(repaymentPreview(actor,{loanId:id,date:'2099-12-30'})).rejects.toThrow('repayment_not_found')}expect(mocks.rpc).not.toHaveBeenCalled()})
 it('rejects dates outside the term, malformed dates and client prices',async()=>{await expect(repaymentPreview(actor,{loanId:id,date:'2000-01-01'})).rejects.toThrow('repayment_date_outside_term');await expect(repaymentPreview(actor,{loanId:id,date:'2100-01-01'})).rejects.toThrow('repayment_date_outside_term');expect(mocks.rpc).not.toHaveBeenCalled();expect(repaymentPreviewInput.safeParse({loanId:id,date:'2026-02-30'}).success).toBe(false);expect(repaymentPreviewInput.safeParse({loanId:id,date:'2026-11-01',principalJpy:1}).success).toBe(false)})
 it('fails closed on a database or missing interest result',async()=>{for(const error of [{message:'db secret'},null]){mocks.rpc.mockResolvedValue({data:null,error});await expect(repaymentPreview(actor,{loanId:id,date:'2099-12-30'})).rejects.toThrow('repayment_unavailable')}mocks.single.mockResolvedValue({data:null,error:{}});await expect(repaymentPreview(actor,{loanId:id,date:'2099-12-30'})).rejects.toThrow('repayment_unavailable')})
})
