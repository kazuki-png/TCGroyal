// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/security/safeRemoteFetch', () => ({ fetchPublicRemoteUrl: vi.fn() }))
import { fetchPublicRemoteUrl } from '@/lib/security/safeRemoteFetch'
import { fetchSnkrdunkSnapshot, parseSnkrdunkHistory } from '@/lib/lending/snkrdunk'

const payload = { minPrice: 86000, history: [{ price: 88000, date: '20時間前', condition: 'PSA10' }] }
afterEach(() => vi.resetAllMocks())

describe('SNKRDUNK adapter', () => {
  it('keeps relative dates as source text and volume unknown', () => {
    expect(parseSnkrdunkHistory('408333', payload, '2026-10-26T03:00:00Z')).toMatchObject({
      floorPriceJpy: 86000, sales: [{ priceJpy: 88000, displayedDate: '20時間前' }],
      dailySalesAverage: null, coverage: 'latest_page_only',
    })
  })
  it('represents no listings as unavailable instead of a zero valuation', () => {
    expect(parseSnkrdunkHistory('408333', { minPrice: 0, history: [] }, '').floorPriceJpy).toBeNull()
  })
  it.each([
    { minPrice: -1, history: [] },
    { minPrice: '86000', history: [] },
    { minPrice: 86000, history: [{ ...payload.history[0], condition: 'A' }] },
    { minPrice: 86000, history: [{ ...payload.history[0], price: 0 }] },
    { history: [] },
  ])('fails closed on changed or mixed-grade response', bad => {
    expect(() => parseSnkrdunkHistory('408333', bad, '')).toThrow()
  })
  it.each(['../1', 'https://localhost/', '0', '1?condition_id=18', '1/2'])('rejects remote path injection %s', async id => {
    await expect(fetchSnkrdunkSnapshot(id)).rejects.toThrow()
    expect(fetchPublicRemoteUrl).not.toHaveBeenCalled()
  })
  it('uses only the fixed host, PSA10 filter and bounded request', async () => {
    vi.mocked(fetchPublicRemoteUrl).mockResolvedValue(Response.json(payload))
    await fetchSnkrdunkSnapshot('408333')
    const [url, options] = vi.mocked(fetchPublicRemoteUrl).mock.calls[0]
    expect(url.toString()).toBe('https://snkrdunk.com/v1/apparels/408333/sales-history?page=1&per_page=20&condition_id=22')
    expect(options).toMatchObject({ maxRedirects: 0, timeoutMs: 10000, maxBytes: 256000 })
  })
  it('does not use challenge HTML or unavailable upstream data', async () => {
    vi.mocked(fetchPublicRemoteUrl).mockResolvedValue(new Response('<html>challenge</html>', { headers: { 'content-type': 'text/html' } }))
    await expect(fetchSnkrdunkSnapshot('408333')).rejects.toThrow()
    vi.mocked(fetchPublicRemoteUrl).mockResolvedValue(new Response('', { status: 429 }))
    await expect(fetchSnkrdunkSnapshot('408333')).rejects.toThrow()
  })
})
