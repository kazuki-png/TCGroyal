import 'server-only'
import { z } from 'zod'
import { fetchPublicRemoteUrl } from '@/lib/security/safeRemoteFetch'
import type { MarketSnapshot } from './types'

const money = z.number().int().min(0).max(1_000_000_000)
const historySchema = z.object({
  minPrice: money.nullable(),
  history: z.array(z.object({
    price: money.positive(), date: z.string().min(1).max(100),
    condition: z.literal('PSA10'),
  })).max(20),
})

export function parseSnkrdunkHistory(productId: string, payload: unknown, fetchedAt: string): MarketSnapshot {
  if (!/^[1-9]\d{0,8}$/.test(productId)) throw new Error('スニダンの商品IDが不正です。')
  const data = historySchema.safeParse(payload)
  if (!data.success) throw new Error('スニダンの応答形式が変わりました。手動査定に切り替えてください。')
  return {
    provider: 'snkrdunk', productId, grade: 'PSA10', currency: 'JPY', fetchedAt,
    sourceUrl: `https://snkrdunk.com/apparels/${productId}`,
    floorPriceJpy: data.data.minPrice || null,
    sales: data.data.history.map(row => ({ priceJpy: row.price, displayedDate: row.date })),
    coverage: 'latest_page_only', dailySalesAverage: null,
  }
}

export async function fetchSnkrdunkSnapshot(productId: string): Promise<MarketSnapshot> {
  if (!/^[1-9]\d{0,8}$/.test(productId)) throw new Error('スニダンの商品IDが不正です。')
  // Fixed origin and path; never accept a caller-supplied remote URL or follow redirects.
  const url = new URL(`https://snkrdunk.com/v1/apparels/${productId}/sales-history`)
  url.search = new URLSearchParams({ page: '1', per_page: '20', condition_id: '22' }).toString()
  const response = await fetchPublicRemoteUrl(url, {
    timeoutMs: 10_000, maxBytes: 256_000, maxRedirects: 0,
    headers: { Accept: 'application/json', 'User-Agent': 'TCG-Royal-Research/0.1' },
  })
  if (!response.ok) throw new Error('スニダンのデータを取得できません。時間をおいて再試行してください。')
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('スニダンからJSONを取得できません。手動査定に切り替えてください。')
  }
  return parseSnkrdunkHistory(productId, await response.json(), new Date().toISOString())
}
