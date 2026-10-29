import {beforeEach,describe,expect,it,vi} from 'vitest'
vi.mock('server-only',()=>({}))
const mocks=vi.hoisted(()=>({access:vi.fn(),rpc:vi.fn(),client:vi.fn()}))
vi.mock('@/lib/lending/api-guard',()=>({lendingAccess:mocks.access,lendingJson:(value:unknown,status=200)=>Response.json(value,{status}),boundedBody:async(request:Request)=>Buffer.from(await request.text())}))
vi.mock('@/lib/lending/workflow-client',()=>({createWorkflowClient:mocks.client}))
import {GET,POST} from '@/app/api/lending/support-cases/route'
const actor='10000000-0000-4000-8000-000000000001',id='20000000-0000-4000-8000-000000000001',key='30000000-0000-4000-8000-000000000001'
const draft={reason:'ungraded',cardName:'未鑑定カード',cardNumber:'',condition:'',notes:'',requestedAmount:''}
const request=(body:unknown)=>new Request('https://preview.example/api/lending/support-cases',{method:'POST',body:JSON.stringify(body)})
beforeEach(()=>{vi.clearAllMocks();mocks.access.mockResolvedValue({id:actor,role:'customer'});mocks.client.mockReturnValue({rpc:mocks.rpc});mocks.rpc.mockResolvedValue({data:{id,reference:'TR-123456ABCDEF'},error:null})})
describe('tracked support case API',()=>{
 it('binds creation to the verified caller, requires consent and keeps the retry key',async()=>{
  expect((await POST(request({action:'create',draft,consent:true,key}))).status).toBe(200)
  expect(mocks.rpc).toHaveBeenCalledWith('lending_support_create',{p_actor:actor,p_input:{...draft,consent:true},p_key:key})
  expect((await POST(request({action:'create',draft,key}))).status).toBe(400)
 })
 it('rejects customer attempts to assign another owner or to perform staff updates before contacting the database',async()=>{
  for(const body of [{action:'create',draft,consent:true,key,userId:id},{action:'offer',caseId:id,version:1,key,payload:{amountJpy:100000,valuationJpy:200000,message:'fake admin'}},{action:'link',caseId:id,version:1,key,payload:{userId:id}}])expect((await POST(request(body))).status).toBe(403)
  expect(mocks.client).not.toHaveBeenCalled()
 })
 it('scopes reads server-side and returns only bounded searches',async()=>{
  expect((await GET(new Request('https://preview.example/api/lending/support-cases?search=TR-123'))).status).toBe(200)
  expect(mocks.rpc).toHaveBeenCalledWith('lending_support_list',{p_actor:actor,p_search:'TR-123'})
  expect((await GET(new Request('https://preview.example/api/lending/support-cases?search='+ 'a'.repeat(101)))).status).toBe(400)
 })
 it('does not invoke business RPCs without authentication',async()=>{
  mocks.access.mockResolvedValue(Response.json({error:'login'},{status:401}))
  expect((await POST(request({action:'create',draft,consent:true,key}))).status).toBe(401)
  expect(mocks.client).not.toHaveBeenCalled()
 })
})
