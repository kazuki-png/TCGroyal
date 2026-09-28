// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ link: vi.fn(), send: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ auth: { admin: { generateLink: mocks.link } } }) }))
vi.mock('@/lib/email/send', () => ({ sendSignupConfirmationEmail: mocks.send }))
vi.mock('@/lib/security/serverRateLimit', () => ({ checkServerActionRateLimit: async () => ({ allowed: true }) }))
import { registerAction } from '@/app/register/actions'
function form() { const data = new FormData(); data.set('email','test@example.invalid'); data.set('password','strong-password-123'); data.set('password_confirm','strong-password-123'); return data }
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://shop.invalid')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ mailer_autoconfirm:false }) }))
  mocks.link.mockResolvedValue({ data:{ properties:{ hashed_token:'one-time-token' },user:{ email_confirmed_at:null } },error:null }); mocks.send.mockResolvedValue(true)
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
it('sends a signup-only confirmation and never returns the token', async () => {
  const result = await registerAction(undefined, form())
  expect(result.success).toBeTruthy(); expect(JSON.stringify(result)).not.toContain('one-time-token')
  expect(mocks.link).toHaveBeenCalledWith({type:'signup',email:'test@example.invalid',password:'strong-password-123'})
  const url = new URL(mocks.send.mock.calls[0][1]); expect(url.origin).toBe('https://shop.invalid'); expect(url.searchParams.get('type')).toBe('signup')
})
it('refuses registration if email confirmation is disabled', async () => {
  vi.mocked(fetch).mockResolvedValue({ok:true,json:async()=>({mailer_autoconfirm:true})} as Response)
  expect((await registerAction(undefined,form())).error).toBeTruthy(); expect(mocks.link).not.toHaveBeenCalled()
})
it('does not send a login link to an existing confirmed account', async () => {
  mocks.link.mockResolvedValue({data:null,error:{code:'email_exists'}})
  expect((await registerAction(undefined,form())).success).toBeTruthy(); expect(mocks.send).not.toHaveBeenCalled()
})
it('reports failure if the mail provider fails', async () => {
  mocks.send.mockResolvedValue(false)
  expect((await registerAction(undefined,form())).error).toBeTruthy()
})
