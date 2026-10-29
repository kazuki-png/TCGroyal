// @vitest-environment node
import {beforeEach,describe,it,expect,vi} from 'vitest'
vi.mock('server-only',()=>({}))
const mocks=vi.hoisted(()=>({access:vi.fn(),rpc:vi.fn(),client:vi.fn()}))
vi.mock('@/lib/lending/admin-access',()=>({adminLendingAccess:mocks.access}))
vi.mock('@/lib/lending/workflow-client',()=>({createWorkflowClient:mocks.client}))
import {GET,POST} from '@/app/api/admin/lending/route'
const id='10000000-0000-4000-8000-000000000001',admin='10000000-0000-4000-8000-000000000002'
const req=(body:unknown)=>new Request('https://preview.example/api/admin/lending',{method:'POST',body:JSON.stringify(body)})
beforeEach(()=>{vi.resetAllMocks();mocks.access.mockResolvedValue({id:admin});mocks.client.mockReturnValue({rpc:mocks.rpc});mocks.rpc.mockResolvedValue({data:{rows:[],total:0},error:null})})
describe('administrator lending API',()=>{
 it('does not call database functions on an authorization failure',async()=>{mocks.access.mockResolvedValue(Response.json({error:'forbidden'},{status:403}));expect((await GET(new Request('https://preview.example/api/admin/lending'))).status).toBe(403);expect(mocks.client).not.toHaveBeenCalled()})
 it('validates paging/filters and binds dashboard/detail to the verified actor',async()=>{
  expect((await GET(new Request('https://preview.example/api/admin/lending?filter=overdue&page=2'))).status).toBe(200);expect(mocks.rpc).toHaveBeenCalledWith('lending_admin_dashboard',{p_actor:admin,p_search:'',p_filter:'overdue',p_page:2})
  expect((await GET(new Request('https://preview.example/api/admin/lending?kind=loan&id='+id))).status).toBe(200);expect(mocks.rpc).toHaveBeenCalledWith('lending_admin_detail',{p_actor:admin,p_kind:'loan',p_id:id})
  expect((await GET(new Request('https://preview.example/api/admin/lending?page=-1'))).status).toBe(400);expect((await GET(new Request('https://preview.example/api/admin/lending?filter=__proto__'))).status).toBe(400)
 })
 it('does not allow administrators to consent or apply on behalf of customers',async()=>{
  expect((await POST(req({kind:'case',action:'accept',caseId:id,version:1,key:id,payload:{amountJpy:100000,termsAccepted:true,deposit:'mail'}}))).status).toBe(403)
  expect((await POST(req({kind:'loan',type:'command',loanId:id,version:1,key:id,action:'accept',payload:{termsAccepted:true}}))).status).toBe(403);expect(mocks.rpc).not.toHaveBeenCalled()
 })
 it('accepts review commands with the same retry key and version',async()=>{
  expect((await POST(req({kind:'case',action:'review',caseId:id,version:2,key:id,payload:{message:'確認中'}}))).status).toBe(200)
  expect(mocks.rpc).toHaveBeenCalledWith('lending_support_command',{p_actor:admin,p_case:id,p_action:'review',p_payload:{message:'確認中'},p_key:id,p_version:2})
 })
 it('rejects price/market injection and never fetches a provider for an old loan',async()=>{
  const body={kind:'loan',type:'command',loanId:id,version:1,key:id,action:'offer',payload:{amountJpy:100000,monthlyRateBps:100}}
  expect((await POST(req({...body,payload:{...body.payload,market:{price:999999}}}))).status).toBe(400)
  mocks.rpc.mockResolvedValue({data:{item:{valuation_source:'snkrdunk'}},error:null});expect((await POST(req(body))).status).toBe(409);expect(mocks.rpc).toHaveBeenCalledTimes(1)
 })
})
