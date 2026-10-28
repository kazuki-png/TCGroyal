// @vitest-environment node
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'
vi.mock('server-only',()=>({}))
vi.mock('@/lib/lending/workflow-server',()=>({getWorkflowActor:vi.fn()}))
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:vi.fn()}))
vi.mock('@/lib/security/sharedRateLimit',()=>({checkSharedRateLimit:vi.fn(),rateLimitResponse:()=>new Response(null,{status:429})}))
import { GET,POST } from '@/app/api/lending/workflow/route'
import { getWorkflowActor } from '@/lib/lending/workflow-server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkSharedRateLimit } from '@/lib/security/sharedRateLimit'
const request=(body?:unknown,origin='http://127.0.0.1:3000')=>new Request('http://127.0.0.1:3000/api/lending/workflow',{
 method:body?'POST':'GET',headers:{origin,'content-type':'application/json'},body:body?JSON.stringify(body):undefined,
})
beforeEach(()=>{
 vi.resetAllMocks();vi.stubEnv('NODE_ENV','development');vi.stubEnv('VERCEL','');vi.stubEnv('LENDING_WORKFLOW_ENABLED','true');vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','http://127.0.0.1:54321')
 vi.mocked(getWorkflowActor).mockResolvedValue({id:'10000000-0000-4000-8000-000000000001',role:'customer',demo:true})
 vi.mocked(checkSharedRateLimit).mockResolvedValue({allowed:true} as Awaited<ReturnType<typeof checkSharedRateLimit>>)
})
afterEach(()=>vi.unstubAllEnvs())
describe('workflow route protection',()=>{
 it('never constructs a database client for a hosted database or production build',async()=>{
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://production.supabase.co')
  expect((await GET(request())).status).toBe(503)
  expect((await POST(request({type:'quote'}))).status).toBe(503)
  expect(getWorkflowActor).not.toHaveBeenCalled();expect(createAdminClient).not.toHaveBeenCalled()
 })
 it('requires an authenticated or explicit local demo actor',async()=>{
  vi.mocked(getWorkflowActor).mockResolvedValue(null)
  expect((await GET(request())).status).toBe(401);expect(createAdminClient).not.toHaveBeenCalled()
 })
 it('rejects cross-origin mutations before accessing a database',async()=>{
  expect((await POST(request({type:'quote'},'https://evil.example'))).status).toBe(403)
  expect(createAdminClient).not.toHaveBeenCalled()
 })
 it('rate limits before handling a financial command',async()=>{
  vi.mocked(checkSharedRateLimit).mockResolvedValue({allowed:false} as Awaited<ReturnType<typeof checkSharedRateLimit>>)
  expect((await POST(request({type:'quote'}))).status).toBe(429);expect(createAdminClient).not.toHaveBeenCalled()
 })
})
