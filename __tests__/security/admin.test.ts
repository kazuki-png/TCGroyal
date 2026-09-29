// @vitest-environment node
import { beforeEach, it, expect, vi } from 'vitest'
vi.mock('server-only',()=>({}))
const m = vi.hoisted(()=>({host:vi.fn(),client:vi.fn(),mfa:vi.fn(),role:'kyc_reviewer'}))
vi.mock('@/lib/admin/serverHostAccess',()=>({isAdminHostAllowedFromHeaders:m.host}))
vi.mock('@/lib/supabase/server',()=>({createClient:m.client}))
vi.mock('next/navigation',()=>({redirect:vi.fn()}))
import {getAdminAccess} from '@/lib/admin/authorization'
beforeEach(()=>{m.role='kyc_reviewer';m.host.mockResolvedValue(true);m.mfa.mockResolvedValue({data:{currentLevel:'aal2'}});m.client.mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:'u',email_confirmed_at:'yes'}}}),mfa:{getAuthenticatorAssuranceLevel:m.mfa}},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{id:'u',role:m.role}})})})})})})
it('accepts a reviewer with password-only authentication without consulting MFA',async()=>{m.mfa.mockClear();m.mfa.mockResolvedValue({data:{currentLevel:'aal1',nextLevel:'aal2'}});expect(await getAdminAccess(true)).not.toBeNull();expect(m.mfa).not.toHaveBeenCalled()})
it('denies ordinary admins for KYC',async()=>{m.role='admin';expect(await getAdminAccess(true)).toBeNull()})
it('denies disallowed hosts',async()=>{m.host.mockResolvedValue(false);expect(await getAdminAccess()).toBeNull()})
it('denies unauthenticated users',async()=>{m.client.mockResolvedValue({auth:{getUser:async()=>({data:{user:null}})}});expect(await getAdminAccess()).toBeNull()})
it('denies unconfirmed email addresses',async()=>{m.client.mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:'u',email_confirmed_at:null}}})}});expect(await getAdminAccess()).toBeNull()})
it('accepts a verified reviewer with aal2',async()=>{expect(await getAdminAccess(true)).not.toBeNull()})
