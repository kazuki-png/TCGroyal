import { describe,expect,it } from 'vitest'
import { isLocalLendingEnabled,isLoopbackRequest,isSameOriginRequest } from '@/lib/lending/local-config'
import { parsePsaCert } from '@/lib/lending/psa'

describe('local-only workflow isolation',()=>{
 const env={LENDING_WORKFLOW_ENABLED:'true',NODE_ENV:'development',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321'}
 it('allows an explicitly enabled loopback development database',()=>expect(isLocalLendingEnabled(env)).toBe(true))
 it.each([
  {...env,NODE_ENV:'production'}, {...env,VERCEL:'1'}, {...env,LENDING_WORKFLOW_ENABLED:'false'},
  {...env,NEXT_PUBLIC_SUPABASE_URL:'https://project.supabase.co'},
  {...env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1.evil.example'},
  {...env,NEXT_PUBLIC_SUPABASE_URL:'http://user:password@localhost'},
  {...env,NEXT_PUBLIC_SUPABASE_URL:'not-a-url'},
 ])('blocks production, hosted and malformed configuration',config=>expect(isLocalLendingEnabled(config)).toBe(false))
 it('does not accept a remote host just because its name contains localhost',()=>{
  expect(isLoopbackRequest('http://127.0.0.1:3000')).toBe(true)
  expect(isLoopbackRequest('https://localhost.attacker.example')).toBe(false)
 })
 it('checks the browser-facing host without accepting cross-origin or forwarded host',()=>{
  expect(isSameOriginRequest(new Request('http://localhost:3000/api/lending/workflow',{headers:{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000'}}))).toBe(true)
  expect(isSameOriginRequest(new Request('http://localhost:3000/api/lending/workflow',{headers:{host:'127.0.0.1:3000',origin:'http://evil.example','x-forwarded-host':'evil.example'}}))).toBe(false)
 })
})
describe('PSA QR identifier parsing',()=>{
 it.each(['12345678','https://www.psacard.com/cert/12345678/psa','https://psacard.com/cert/12345678/'])('accepts a cert number or official QR URL %s',input=>expect(parsePsaCert(input)).toBe('12345678'))
 it.each(['123','https://psacard.com.evil.example/cert/12345678','javascript:alert(1)','http://psacard.com/cert/12345678','https://evil@psacard.com/cert/12345678','https://psacard.com:444/cert/12345678','https://psacard.com/cert/12345678/extra'])('rejects an invalid or spoofed QR %s',input=>expect(parsePsaCert(input)).toBeNull())
})
