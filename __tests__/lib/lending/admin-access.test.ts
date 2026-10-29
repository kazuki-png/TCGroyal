// @vitest-environment node
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest'
vi.mock('server-only',()=>({}))
const mocks=vi.hoisted(()=>({access:vi.fn(),enabled:vi.fn(),local:vi.fn(),origin:vi.fn(),actor:vi.fn(),rate:vi.fn(),assurance:vi.fn()}))
vi.mock('@/lib/admin/authorization',()=>({getAdminAccess:mocks.access}))
vi.mock('@/lib/lending/local-config',()=>({isLendingEnabled:mocks.enabled,isLocalLendingEnabled:mocks.local,isSameOriginRequest:mocks.origin}))
vi.mock('@/lib/lending/workflow-server',()=>({getWorkflowActor:mocks.actor}))
vi.mock('@/lib/lending/workflow-client',()=>({checkWorkflowRateLimit:mocks.rate}))
import {adminLendingAccess} from '@/lib/lending/admin-access'
const req=new Request('https://preview.example/api/admin/lending',{method:'POST',headers:{'x-lending-demo-role':'admin'}})
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://preview.supabase.co');vi.stubEnv('LENDING_PREVIEW_SUPABASE_URL','https://preview.supabase.co');mocks.enabled.mockReturnValue(true);mocks.local.mockReturnValue(false);mocks.origin.mockReturnValue(true);mocks.rate.mockResolvedValue({allowed:true});mocks.access.mockResolvedValue({user:{id:'verified-admin',factors:[]},role:'admin',supabase:{auth:{mfa:{getAuthenticatorAssuranceLevel:mocks.assurance}}}})})
afterEach(()=>vi.unstubAllEnvs())
describe('admin cookie bridge stays inside the configured lending database',()=>{
 it('accepts the verified administrator without asking for a fixture code',async()=>{expect(await adminLendingAccess(req)).toEqual({id:'verified-admin'});expect(mocks.actor).not.toHaveBeenCalled()})
 it('rejects a customer, reviewer or missing login despite a spoofed admin header',async()=>{for(const access of [null,{user:{id:'user'},role:'customer'},{user:{id:'reviewer'},role:'kyc_reviewer'}]){mocks.access.mockResolvedValue(access);expect((await adminLendingAccess(req) as Response).status).toBe(403)}})
 it('does not cross from the website database into a different lending project',async()=>{vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://another.supabase.co');expect((await adminLendingAccess(req) as Response).status).toBe(503);expect(mocks.rate).not.toHaveBeenCalled()})
 it('requires AAL2 when an enrolled factor exists',async()=>{
  mocks.access.mockResolvedValue({user:{id:'verified-admin',factors:[{status:'verified'}]},role:'admin',supabase:{auth:{mfa:{getAuthenticatorAssuranceLevel:mocks.assurance}}}})
  mocks.assurance.mockResolvedValue({error:null,data:{currentLevel:'aal1'}});expect((await adminLendingAccess(req) as Response).status).toBe(403)
  mocks.assurance.mockResolvedValue({error:null,data:{currentLevel:'aal2'}});expect(await adminLendingAccess(req)).toEqual({id:'verified-admin'})
 })
 it('rejects disabled environments and cross-origin writes',async()=>{mocks.enabled.mockReturnValue(false);expect((await adminLendingAccess(req) as Response).status).toBe(503);mocks.enabled.mockReturnValue(true);mocks.origin.mockReturnValue(false);expect((await adminLendingAccess(req) as Response).status).toBe(403)})
})
