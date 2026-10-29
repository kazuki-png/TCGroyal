// @vitest-environment node
import {afterEach,describe,it,expect,vi} from 'vitest'
import {NextRequest} from 'next/server'
import {proxy} from '@/proxy'
import {MOBILE_PREVIEW_ORIGIN} from '@/lib/lending/mobile-preview-host'
afterEach(()=>vi.unstubAllEnvs())
describe('mobile-only Preview host',()=>{
 it.each(['/','/admin','/admin/login','/api/admin/lending','/api/cards','/mypage','/admin/data.png','/_next/static/chunk.js'])('does not expose %s',async path=>{
  vi.stubEnv('VERCEL_ENV','preview')
  expect((await proxy(new NextRequest(MOBILE_PREVIEW_ORIGIN+path))).status).toBe(404)
 })
 it('allows the authenticated lending API to handle its own authorization',async()=>{
  vi.stubEnv('VERCEL_ENV','preview')
  const response=await proxy(new NextRequest(MOBILE_PREVIEW_ORIGIN+'/api/lending/catalog'))
  expect(response.headers.get('x-middleware-next')).toBe('1')
 })
 it('fails closed outside Preview and ignores spoofed forwarded hosts',async()=>{
  vi.stubEnv('VERCEL_ENV','production')
  expect((await proxy(new NextRequest(MOBILE_PREVIEW_ORIGIN+'/api/lending/catalog'))).status).toBe(404)
  vi.stubEnv('VERCEL_ENV','preview')
  expect((await proxy(new NextRequest(MOBILE_PREVIEW_ORIGIN+'/admin',{headers:{'x-forwarded-host':'tcg-royal-git-develop-collectorsrepublic.vercel.app'}}))).status).toBe(404)
 })
})
