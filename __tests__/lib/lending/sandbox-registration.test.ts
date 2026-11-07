// @vitest-environment node
import {afterEach,describe,it,expect,vi} from 'vitest'
import {NextRequest} from 'next/server'
import {proxy} from '@/proxy'
import {MOBILE_PREVIEW_ORIGIN} from '@/lib/lending/mobile-preview-host'
import {GET as about} from '@/app/lending/about/route'
import {GET as privacy} from '@/app/lending/privacy/route'
import {GET as terms} from '@/app/lending/terms/route'
import {GET as callback} from '@/app/api/lending/identity/callback/route'
afterEach(()=>vi.unstubAllEnvs())
describe('sandbox registration URLs',()=>{
 it.each([['/lending/about',about],['/lending/privacy',privacy],['/lending/terms',terms]] as const)('serves standalone public HTML at %s only in Preview',async(path,handler)=>{
  vi.stubEnv('VERCEL_ENV','preview')
  expect((await proxy(new NextRequest(MOBILE_PREVIEW_ORIGIN+path))).headers.get('x-middleware-next')).toBe('1')
  const response=handler()
  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toContain('text/html')
  const html=await response.text()
  expect(html).toContain('テスト環境')
  expect(html).not.toMatch(/<script|<iframe/)
  vi.stubEnv('VERCEL_ENV','production')
  expect(handler().status).toBe(404)
 })
 it('does not accept unsolicited authorization responses or reflect secrets',async()=>{
  vi.stubEnv('VERCEL_ENV','preview')
  const path='/api/lending/identity/callback'
  expect((await proxy(new NextRequest(MOBILE_PREVIEW_ORIGIN+path))).headers.get('x-middleware-next')).toBe('1')
  expect(callback(new Request(MOBILE_PREVIEW_ORIGIN+path)).status).toBe(200)
  const response=callback(new Request(MOBILE_PREVIEW_ORIGIN+path+'?code=secret-code&state=secret-state&error_description=untrusted'))
  expect(response.status).toBe(400)
  expect(response.headers.get('referrer-policy')).toBe('no-referrer')
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(response.headers.has('set-cookie')).toBe(false)
  expect(await response.text()).not.toMatch(/secret-code|secret-state|untrusted/)
  vi.stubEnv('VERCEL_ENV','production')
  expect(callback(new Request(MOBILE_PREVIEW_ORIGIN+path)).status).toBe(404)
 })
 it.each(['/lending','/lending/private','/lending/privacy/export','/api/lending/identity','/api/lending/identity/callback/other'])('keeps unrelated routes closed: %s',async path=>{
  vi.stubEnv('VERCEL_ENV','preview')
  expect((await proxy(new NextRequest(MOBILE_PREVIEW_ORIGIN+path))).status).toBe(404)
 })
})
