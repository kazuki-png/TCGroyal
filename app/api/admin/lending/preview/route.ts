import { z } from 'zod'
import { getAdminAccess } from '@/lib/admin/authorization'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkSharedRateLimit, rateLimitResponse } from '@/lib/security/sharedRateLimit'
import { fetchSnkrdunkSnapshot } from '@/lib/lending/snkrdunk'
import { calculateIndicativeQuote } from '@/lib/lending/valuation'

export const runtime = 'nodejs'
const json = (body: unknown, status = 200) => Response.json(body, {
  status, headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' },
})
const inputSchema = z.object({
  cardUid: z.uuid(), productId: z.string().regex(/^[1-9]\d{0,8}$/),
}).strict()

export async function POST(request: Request) {
  const access = await getAdminAccess()
  if (!access || access.role !== 'admin') return json({ error: '管理者権限が必要です。' }, 403)
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: '不正な送信元です。' }, 403)
  const limit = await checkSharedRateLimit('lending:preview', access.user.id, { limit: 6, windowMs: 60000 })
  if (!limit.allowed) return rateLimitResponse(limit)
  if (Number(request.headers.get('content-length')) > 1024) return json({ error: '入力が大きすぎます。' }, 413)
  let body: unknown
  try {
    const text = await request.text()
    if (text.length > 1024) return json({ error: '入力が大きすぎます。' }, 413)
    body = JSON.parse(text)
  } catch { return json({ error: 'JSON形式で入力してください。' }, 400) }
  const input = inputSchema.safeParse(body)
  if (!input.success) return json({ error: 'カードとスニダンの商品IDを確認してください。' }, 400)
  const { data: card, error } = await createAdminClient().from('cards')
    .select('public_uid,name,card_number,category,grade,buy_price,buy_price_updated_at')
    .eq('public_uid', input.data.cardUid).maybeSingle()
  if (error) return json({ error: 'カード情報を取得できません。' }, 503)
  if (!card) return json({ error: 'カードが見つかりません。' }, 404)
  if (card.grade !== 'PSA10' || !['pokemon', 'onepiece'].includes(card.category)) {
    return json({ error: '対象はポケモン・ワンピースのPSA10のみです。' }, 422)
  }
  try {
    const market = await fetchSnkrdunkSnapshot(input.data.productId)
    return json({ card, market, quote: calculateIndicativeQuote(card, market) })
  } catch {
    return json({ error: '価格データを取得できません。商品IDを確認するか、手動査定に切り替えてください。' }, 502)
  }
}
