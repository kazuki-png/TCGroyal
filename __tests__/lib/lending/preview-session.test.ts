// @vitest-environment node
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'
import { createHash } from 'node:crypto'
vi.mock('server-only',()=>({}))
import { isPreviewLendingEnabled } from '@/lib/lending/local-config'
import { issuePreviewSession,readPreviewActor } from '@/lib/lending/preview-session'
const customerCode='customer-test-code-123456789'
const adminCode='admin-test-code-987654321'
const hash=(text:string)=>createHash('sha256').update(text).digest('hex')
beforeEach(()=>{
 const values={VERCEL_ENV:'preview',LENDING_WORKFLOW_ENABLED:'true',LENDING_PREVIEW_DB_REF:'mkmkkkdserlcaycknuxp',
 LENDING_PREVIEW_SUPABASE_URL:'https://mkmkkkdserlcaycknuxp.supabase.co',LENDING_PREVIEW_SUPABASE_SERVICE_ROLE_KEY:'test-only-key',
 LENDING_PREVIEW_SESSION_SECRET:'test-secret-at-least-32-characters-long',LENDING_PREVIEW_CUSTOMER_CODE_HASH:hash(customerCode),LENDING_PREVIEW_ADMIN_CODE_HASH:hash(adminCode),
 LENDING_PREVIEW_CUSTOMER_ID:'10000000-0000-4000-8000-000000000001',LENDING_PREVIEW_ADMIN_ID:'10000000-0000-4000-8000-000000000002'}
 for(const [key,value] of Object.entries(values))vi.stubEnv(key,value)
})
afterEach(()=>vi.unstubAllEnvs())
const req=(token:string)=>new Request('https://test-preview.vercel.app/api/lending/workflow',{headers:{Authorization:`Bearer ${token}`,'x-lending-demo-role':'admin'}})
describe('Preview test sessions',()=>{
 it('only enables a separately configured Preview database',()=>expect(isPreviewLendingEnabled()).toBe(true))
 it('never permits production Vercel or known production database refs',()=>{
  vi.stubEnv('VERCEL_ENV','production');expect(isPreviewLendingEnabled()).toBe(false)
  vi.stubEnv('VERCEL_ENV','preview');vi.stubEnv('LENDING_PREVIEW_DB_REF','beavxtmhwctptgaehvty');vi.stubEnv('LENDING_PREVIEW_SUPABASE_URL','https://beavxtmhwctptgaehvty.supabase.co')
  expect(isPreviewLendingEnabled()).toBe(false)
 })
 it('does not allow a shared code or subject to grant both roles',()=>{
  vi.stubEnv('LENDING_PREVIEW_ADMIN_CODE_HASH',hash(customerCode));expect(isPreviewLendingEnabled()).toBe(false)
 })
 it('binds customer privileges to the signed session, ignoring a forged role header',()=>{
  const session=issuePreviewSession(customerCode,1000000)!
  expect(readPreviewActor(req(session.token),1000001)?.role).toBe('customer')
  expect(readPreviewActor(req(issuePreviewSession(adminCode,1000000)!.token),1000001)?.role).toBe('admin')
 })
 it('rejects invalid codes, tampering, expired sessions and unsigned role headers',()=>{
  expect(issuePreviewSession('not-the-right-code')).toBeNull()
  const session=issuePreviewSession(customerCode,1000000)!
  expect(readPreviewActor(req(`${session.token}tampered`),1000001)).toBeNull()
  expect(readPreviewActor(req(session.token),1000000+7200001)).toBeNull()
  expect(readPreviewActor(new Request('https://test-preview.vercel.app',{headers:{'x-lending-demo-role':'admin'}}))).toBeNull()
 })
 it('invalidates sessions after secret rotation',()=>{
  const token=issuePreviewSession(customerCode,1000000)!.token
  vi.stubEnv('LENDING_PREVIEW_SESSION_SECRET','rotated-test-secret-at-least-32-characters-long')
  expect(readPreviewActor(req(token),1000001)).toBeNull()
 })
})
