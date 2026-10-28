import { z } from 'zod'
import { createWorkflowClient as createAdminClient, checkWorkflowRateLimit as checkSharedRateLimit } from '@/lib/lending/workflow-client'
import { rateLimitResponse } from '@/lib/security/sharedRateLimit'
import { getWorkflowActor } from '@/lib/lending/workflow-server'
import { isLendingEnabled, isSameOriginRequest } from '@/lib/lending/local-config'
import { fetchSnkrdunkSnapshot } from '@/lib/lending/snkrdunk'
import { parsePsaCert } from '@/lib/lending/psa'

export const runtime = 'nodejs'
const json = (body: unknown, status = 200) => Response.json(body, {
  status, headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' },
})
const money = z.number().int().min(0).max(10_000_000)
const inputSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('quote'), cardUid: z.uuid() }).strict(),
  z.object({ type: z.literal('apply'), quoteId: z.uuid(), certInput: z.string().max(250), amountJpy: money.min(100000), deposit: z.enum(['mail', 'store']), key: z.uuid() }).strict(),
  z.object({ type: z.literal('verify_mapping'), cardUid: z.uuid(), productId: z.string().regex(/^[1-9]\d{0,8}$/), verified: z.literal(true) }).strict(),
  z.object({ type: z.literal('command'), loanId: z.uuid(), version: z.number().int().positive(), key: z.uuid(),
    action: z.enum(['receive','offer','accept','fund','cancel','reject','report_repayment','reject_repayment','confirm_repayment','return','request_extension','request_additional','extend','reject_request','forfeit']),
    payload: z.object({ amountJpy: money.optional(), monthlyRateBps: z.number().int().min(0).max(200).optional(),
      location: z.string().trim().max(120).optional(), certNumber: z.string().regex(/^\d{6,12}$/).optional(),
      inspected: z.boolean().optional(), termsAccepted: z.boolean().optional(), reviewed: z.boolean().optional(),
      reference: z.string().trim().min(4).max(120).optional(), reason: z.string().trim().min(1).max(500).optional(),
      manualValuationJpy: z.number().int().min(1).max(1000000000).optional(), manualCapJpy: money.min(100000).optional(),
    }).strict(),
  }).strict(),
])

export async function GET(request: Request) {
  if (!isLendingEnabled()) return json({ error: '融資テスト環境が構成されていません。' }, 503)
  const actor = await getWorkflowActor(request)
  if (!actor) return json({ error: 'ログインが必要です。' }, 401)
  const { data, error } = await createAdminClient().rpc('lending_list', { p_actor: actor.id })
  if (error) return json({ error: '融資データを取得できません。テストDBの稼働状態と設定を確認してください。' }, 503)
  return json({ ...data, role: actor.role, demo: actor.demo, marketFixture: actor.demo && process.env.LENDING_MARKET_FIXTURE === 'true' })
}

export async function POST(request: Request) {
  if (!isLendingEnabled()) return json({ error: '融資テスト環境が構成されていません。' }, 503)
  const actor = await getWorkflowActor(request)
  if (!actor) return json({ error: 'ログインが必要です。' }, 401)
  if (!isSameOriginRequest(request)) return json({ error: '不正な送信元です。' }, 403)
  const limit = await checkSharedRateLimit('lending:workflow', actor.id, { limit: 60, windowMs: 60000 })
  if (!limit.allowed) return rateLimitResponse(limit)
  let body: unknown
  try {
    const raw = await request.text()
    if (raw.length > 4096) return json({ error: '入力が大きすぎます。' }, 413)
    body = JSON.parse(raw)
  } catch { return json({ error: '入力形式を確認してください。' }, 400) }
  const input = inputSchema.safeParse(body)
  if (!input.success) return json({ error: '入力内容を確認してください。' }, 400)
  const db = createAdminClient()
  const v = input.data
  async function marketForCard(cardUid: string) {
    const { data: mapping } = await db.from('lending_product_mappings').select('product_id').eq('card_uid', cardUid).eq('active', true).maybeSingle()
    if (!mapping) throw Error('mapping_missing')
    return actor!.demo && process.env.LENDING_MARKET_FIXTURE === 'true' ? {
      provider: 'snkrdunk', productId: mapping.product_id, grade: 'PSA10', currency: 'JPY',
      fetchedAt: new Date().toISOString(), floorPriceJpy: 1000000, sales: [],
      coverage: 'latest_page_only', dailySalesAverage: null, sourceUrl: `https://snkrdunk.com/apparels/${mapping.product_id}`,
    } : await fetchSnkrdunkSnapshot(mapping.product_id)
  }
  let response
  if (v.type === 'quote') {
    const rate = await checkSharedRateLimit('lending:market', actor.id, { limit: 6, windowMs: 60000 })
    if (!rate.allowed) return rateLimitResponse(rate)
    try {
      const market = await marketForCard(v.cardUid)
      response = await db.rpc('lending_create_quote', { p_actor: actor.id, p_card: v.cardUid, p_market: market })
    } catch { return json({ error: 'スニダンの価格を取得できません。手動査定が必要です。' }, 502) }
  } else if (v.type === 'apply') {
    const cert = parsePsaCert(v.certInput)
    if (!cert) return json({ error: 'PSA鑑定番号またはPSA公式のQRコードURLを入力してください。' }, 400)
    const { data: binding, error: bindingError } = await db.from('lending_assessments').select('cert_number').eq('quote_id',v.quoteId).eq('user_id',actor.id).maybeSingle()
    if(bindingError) return json({error:'査定情報を確認できません。'},503)
    if(binding && binding.cert_number!==cert) return json({error:'検索したPSA鑑定番号と申込の番号が一致しません。'},409)
    response = await db.rpc('lending_apply', { p_actor: actor.id, p_quote: v.quoteId, p_cert: cert, p_amount: v.amountJpy, p_deposit: v.deposit, p_key: v.key })
  } else if (v.type === 'verify_mapping') {
    if (actor.role !== 'admin') return json({ error: '管理者権限が必要です。' }, 403)
    response = await db.rpc('lending_verify_mapping', { p_actor: actor.id, p_card: v.cardUid, p_product: v.productId })
  } else {
    const customerActions = ['cancel','accept','report_repayment','request_extension','request_additional']
    if (!customerActions.includes(v.action) && actor.role !== 'admin') return json({ error: '管理者権限が必要です。' }, 403)
    let payload: Record<string, unknown> = v.payload
    if (v.action === 'offer') {
      const rate = await checkSharedRateLimit('lending:market', actor.id, { limit: 6, windowMs: 60000 })
      if (!rate.allowed) return rateLimitResponse(rate)
      const { data: loan } = await db.from('lending_loans').select('quote_id').eq('id', v.loanId).maybeSingle()
      const { data: original } = await db.from('lending_quotes').select('card_uid,source').eq('id', loan?.quote_id ?? '').maybeSingle()
      if (!original) return json({ error: '申込が見つかりません。' }, 404)
      try { payload = original.source==='support' ? v.payload : { ...v.payload, market: await marketForCard(original.card_uid) } }
      catch { return json({ error: '再査定用の価格を取得できません。条件提示を保留してください。' }, 502) }
    }
    response = await db.rpc('lending_command', { p_actor: actor.id, p_loan: v.loanId, p_action: v.action, p_payload: payload, p_key: v.key, p_version: v.version })
  }
  if (response.error) {
    const messages: Record<string, string> = {
      version_conflict: '他の操作で更新されました。一覧を更新して再確認してください。',
      identity_required: '融資用の本人確認が完了していません。',
      stale_price: 'TCG ROYALの買取価格が古いため、更新が必要です。',
      below_minimum: '概算額が最低融資額10万円を下回ります。',
      quote_expired_or_exceeded: '見積もりの期限または上限額を確認してください。',
      repayment_amount_mismatch: '入金額が現在の返済必要額と一致しません。',
    }
    const message = messages[response.error.message] ?? '操作を完了できません。状態・入力・重複申込を確認してください。'
    return json({ error: message }, 409)
  }
  // Business RPC results contain internal columns; callers refresh their scoped view.
  return json({ ok: true, ...(v.type === 'quote' ? { quote: response.data } : {}) })
}
