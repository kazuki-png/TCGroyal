// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ admin: vi.fn(), client: vi.fn(), access: vi.fn(), limit: vi.fn(), rpc: vi.fn(), from: vi.fn(), storage: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.admin }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.client }))
vi.mock('@/lib/admin/authorization', () => ({ getAdminAccess: mocks.access, requireAdminUser: vi.fn() }))
vi.mock('@/lib/security/serverRateLimit', () => ({ checkServerActionRateLimit: mocks.limit }))
vi.mock('@/lib/security/sharedRateLimit', () => ({ checkRequestRateLimit: mocks.limit, rateLimitResponse: () => new Response(null, { status: 429 }) }))
vi.mock('@/lib/email/send', () => ({ logEmailDebug: vi.fn(), sendAdminOrderNotification: vi.fn(), sendOrderSubmittedEmail: vi.fn(), sendStatusEmail: vi.fn() }))
vi.mock('@/lib/orders/notification', () => ({ loadOrderForNotification: vi.fn() }))
vi.mock('@/lib/orders/reviewCouponNotification', () => ({ cancelReviewCouponEmailForOrder: vi.fn(), scheduleReviewCouponEmailForCompletedOrder: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn(() => { throw new Error('redirect') }) }))
import { createOrder } from '@/app/actions/orders'
import { GET, DELETE } from '@/app/api/admin/kyc/[documentId]/route'
import type { CartItem } from '@/lib/types'
const uid = '11111111-1111-4111-8111-111111111111'
const doc = { id: 'doc', user_id: uid, storage_path: `${uid}/file.jpg`, deleted_at: null, deletion_requested_at: null }
const ctx = { params: Promise.resolve({ documentId: 'doc' }) }
const request = () => new Request('https://shop.invalid/api/admin/kyc/doc', { method: 'DELETE', headers: { origin: 'https://shop.invalid' } })
function chain(data: unknown) { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data, error: null }) }; return q }
beforeEach(() => { vi.resetAllMocks(); mocks.limit.mockResolvedValue({ allowed: true }); mocks.access.mockResolvedValue({ user: { id: uid } }); mocks.admin.mockReturnValue({ from: mocks.from, rpc: mocks.rpc, storage: { from: mocks.storage } }) })
describe('order boundary', () => {
  it.each(['user_id','status','total_amount','coupon_amount'])('rejects injected %s before privileged access', async key => {
    const bank = { bank_name: 'Bank', bank_branch: 'Branch', bank_account_no: '1234567', bank_holder: 'Name', [key]: 'attacker' }
    const result = await createOrder([{ card: { id: 'unlisted-card-request' }, quantity: 1 }] as CartItem[], bank)
    expect(result.error).toBeTruthy(); expect(mocks.admin).not.toHaveBeenCalled(); expect(mocks.client).not.toHaveBeenCalled()
  })
  it('rejects non-array carts', async () => {
    const result = await createOrder(null as unknown as CartItem[], { bank_name:'a',bank_branch:'b',bank_account_no:'1234567',bank_holder:'c' })
    expect(result.error).toBeTruthy()
  })
})
describe('KYC fail-closed behavior', () => {
  it('does not sign if audit logging fails', async () => {
    const sign = vi.fn()
    mocks.from.mockImplementation(table => table === 'identity_documents' ? chain(doc) : { insert: async () => ({ error: { message: 'offline' } }) })
    mocks.storage.mockReturnValue({ createSignedUrl: sign })
    const response = await GET(request(), ctx)
    expect(response.status).toBe(503); expect(sign).not.toHaveBeenCalled()
  })
  it('does not finalize metadata when object removal fails', async () => {
    mocks.rpc.mockResolvedValue({ data: doc, error: null }); mocks.storage.mockReturnValue({ remove: async () => ({ error: { message:'offline' } }) })
    expect((await DELETE(request(),ctx)).status).toBe(503)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })
  it('supports an idempotent already-deleted response', async () => {
    mocks.rpc.mockResolvedValue({ data: { ...doc, deleted_at: '2026-09-28' }, error:null })
    expect((await DELETE(request(),ctx)).status).toBe(200); expect(mocks.storage).not.toHaveBeenCalled()
  })
  it('blocks foreign object paths even for privileged deletion', async () => {
    mocks.rpc.mockResolvedValue({ data:{ ...doc, storage_path:'another-user/file.jpg' },error:null })
    expect((await DELETE(request(),ctx)).status).toBe(409); expect(mocks.storage).not.toHaveBeenCalled()
  })
  it('rejects missing admin authorization', async () => {
    mocks.access.mockResolvedValue(null)
    expect((await GET(request(),ctx)).status).toBe(403); expect(mocks.admin).not.toHaveBeenCalled()
  })
  it('requires same-origin deletion', async () => {
    expect((await DELETE(new Request('https://shop.invalid/api/admin/kyc/doc', { method:'DELETE',headers:{origin:'https://evil.invalid'} }),ctx)).status).toBe(403)
  })
})
