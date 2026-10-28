// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/admin/authorization', () => ({ getAdminAccess: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/security/sharedRateLimit', () => ({
  checkSharedRateLimit: vi.fn(), rateLimitResponse: () => new Response(null, { status: 429 }),
}))
vi.mock('@/lib/lending/snkrdunk', () => ({ fetchSnkrdunkSnapshot: vi.fn() }))
import { getAdminAccess } from '@/lib/admin/authorization'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkSharedRateLimit } from '@/lib/security/sharedRateLimit'
import { fetchSnkrdunkSnapshot } from '@/lib/lending/snkrdunk'
import { POST } from '@/app/api/admin/lending/preview/route'

const uid = 'd97c713d-e7c3-4bf6-a4e5-647a6e1c3bc1'
const card = { public_uid: uid, name: 'テスト', card_number: '001', grade: 'PSA10', category: 'pokemon', buy_price: 1000000, buy_price_updated_at: new Date().toISOString() }
const request = (body: unknown = { cardUid: uid, productId: '408333' }, origin = 'https://admin.example.com') => new Request('https://admin.example.com/api/admin/lending/preview', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})
const access = { user: { id: 'admin-id' }, role: 'admin' } as Awaited<ReturnType<typeof getAdminAccess>>
const lookup = vi.fn()

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getAdminAccess).mockResolvedValue(access)
  vi.mocked(checkSharedRateLimit).mockResolvedValue({ allowed: true } as Awaited<ReturnType<typeof checkSharedRateLimit>>)
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: lookup }
  vi.mocked(createAdminClient).mockReturnValue({ from: () => query } as unknown as ReturnType<typeof createAdminClient>)
  lookup.mockResolvedValue({ data: card, error: null })
})

describe('admin lending preview authorization and failures', () => {
  it('rejects unauthenticated requests before database or remote access', async () => {
    vi.mocked(getAdminAccess).mockResolvedValue(null)
    expect((await POST(request())).status).toBe(403)
    expect(createAdminClient).not.toHaveBeenCalled()
    expect(fetchSnkrdunkSnapshot).not.toHaveBeenCalled()
  })
  it('rejects a reviewer without the admin role', async () => {
    vi.mocked(getAdminAccess).mockResolvedValue({ ...access, role: 'kyc_reviewer' } as NonNullable<typeof access>)
    expect((await POST(request())).status).toBe(403)
  })
  it('rejects cross-origin requests', async () => {
    expect((await POST(request(undefined, 'https://evil.example'))).status).toBe(403)
    expect(fetchSnkrdunkSnapshot).not.toHaveBeenCalled()
  })
  it('rate limits upstream requests', async () => {
    vi.mocked(checkSharedRateLimit).mockResolvedValue({ allowed: false } as Awaited<ReturnType<typeof checkSharedRateLimit>>)
    expect((await POST(request())).status).toBe(429)
    expect(fetchSnkrdunkSnapshot).not.toHaveBeenCalled()
  })
  it('rejects client-supplied prices instead of overriding database values', async () => {
    expect((await POST(request({ cardUid: uid, productId: '408333', buy_price: 99999999 }))).status).toBe(400)
    expect(fetchSnkrdunkSnapshot).not.toHaveBeenCalled()
  })
  it('rejects unknown and unsupported cards before upstream access', async () => {
    lookup.mockResolvedValueOnce({ data: null, error: null })
    expect((await POST(request())).status).toBe(404)
    lookup.mockResolvedValueOnce({ data: { ...card, grade: 'PSA9' }, error: null })
    expect((await POST(request())).status).toBe(422)
    expect(fetchSnkrdunkSnapshot).not.toHaveBeenCalled()
  })
  it('fails closed on upstream errors without exposing internals', async () => {
    vi.mocked(fetchSnkrdunkSnapshot).mockRejectedValue(new Error('private upstream details'))
    const response = await POST(request())
    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain('private upstream details')
  })
  it('uses database price and responds without public caching', async () => {
    vi.mocked(fetchSnkrdunkSnapshot).mockResolvedValue({
      provider: 'snkrdunk', productId: '408333', grade: 'PSA10', currency: 'JPY',
      fetchedAt: new Date().toISOString(), floorPriceJpy: 1000000,
      sourceUrl: 'https://snkrdunk.com/apparels/408333', sales: [],
      coverage: 'latest_page_only', dailySalesAverage: null,
    })
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect((await response.json()).quote).toMatchObject({ status: 'manual_review_required', indicativeAmountJpy: 400000 })
  })
})
