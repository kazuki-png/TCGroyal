import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface PriceRecord {
  category: 'pokemon' | 'onepiece'
  card_name: string
  card_number: string | null
  grade: string
  price: number
  site_name: string
  fetched_at: string
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function randomDelay() {
  // 1〜5秒のランダム待機
  return sleep(1000 + Math.random() * 4000)
}

// =============================================
// シンソク (JSON API)
// =============================================
async function fetchShinsoku(
  brand: string,
  category: 'pokemon' | 'onepiece',
  fetched_at: string
): Promise<PriceRecord[]> {
  const records: PriceRecord[] = []
  let page = 0

  while (true) {
    const url = `https://shinsoku-tcg.com/api/items?postal_only=true&sort=price_desc&type=PSA&brand=${encodeURIComponent(brand)}&page=${page}&limit=40`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'tcg-royal-price-bot/1.0' },
    })

    if (!res.ok) break

    const json = await res.json()
    // レスポンス構造: { ok, data: { items, has_more } }
    const payload = json.data ?? json
    const items: unknown[] = Array.isArray(payload.items) ? payload.items : []

    for (const item of items) {
      const i = item as Record<string, unknown>
      const tags = Array.isArray(i.tags) ? i.tags : []
      const gradeLabel =
        tags.length > 0 && typeof (tags[0] as Record<string, unknown>).label === 'string'
          ? ((tags[0] as Record<string, unknown>).label as string)
          : 'PSA10'
      const price = Number(i.postal_purchase_price_s)
      if (!price || price <= 0) continue

      records.push({
        category,
        card_name: String(i.name ?? ''),
        card_number: i.modelno ? String(i.modelno) : null,
        grade: gradeLabel,
        price,
        site_name: 'シンソク',
        fetched_at,
      })
    }

    if (!payload.has_more) break
    page++
    await randomDelay()
  }

  return records
}

// =============================================
// トレカバンク (HTML スクレイピング)
// =============================================
async function fetchTorecabank(
  categoryId: number,
  category: 'pokemon' | 'onepiece',
  fetched_at: string
): Promise<PriceRecord[]> {
  const records: PriceRecord[] = []
  const seenIds = new Set<string>()
  let page = 1

  while (true) {
    const url = `https://store.torecabank.com/mail_buy_list?category=${categoryId}&types%5B0%5D=1&sort=price_desc&page=${page}`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'tcg-royal-price-bot/1.0',
        Accept: 'text/html',
      },
    })

    if (!res.ok) break

    const html = await res.text()

    // li.item ブロックを全て抽出
    const liPattern = /<li[^>]*class="[^"]*\bitem\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi
    const liMatches = [...html.matchAll(liPattern)]

    if (liMatches.length === 0) break

    let foundAny = false

    for (const liMatch of liMatches) {
      const block = liMatch[1]

      // カード名＋カード番号 (p.name の中の空白区切り: token[0]=card_name, token[2]=card_number)
      const nameMatch = block.match(/<p[^>]*class="[^"]*\bname\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
      if (!nameMatch) continue
      const nameText = nameMatch[1].replace(/<[^>]+>/g, '').trim()
      const tokens = nameText.split(/\s+/)
      const card_name = tokens[0] ?? ''
      const card_number = tokens[2] ?? null

      // グレード (p.tag)
      const tagMatch = block.match(/<p[^>]*class="[^"]*\btag\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
      const grade = tagMatch
        ? tagMatch[1].replace(/<[^>]+>/g, '').trim()
        : 'PSA10'

      // 価格 (p.price 内の数字)
      const priceMatch = block.match(/<p[^>]*class="[^"]*\bprice\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
      if (!priceMatch) continue
      const priceText = priceMatch[1].replace(/<[^>]+>/g, '').replace(/[^\d]/g, '')
      const price = Number(priceText)
      if (!price || price <= 0) continue

      if (!card_name) continue

      // PC用・モバイル用で同一アイテムが2回出力されるため重複排除
      // data-id があればそれを使い、なければカード名+価格をフォールバックキーとして使う
      const dataIdMatch = liMatch[0].match(/data-id="(\d+)"/)
      const dedupKey = dataIdMatch ? dataIdMatch[1] : `name::${card_name}::${price}`
      if (seenIds.has(dedupKey)) continue
      seenIds.add(dedupKey)

      records.push({
        category,
        card_name,
        card_number: card_number || null,
        grade,
        price,
        site_name: 'トレカバンク',
        fetched_at,
      })
      foundAny = true
    }

    // 次ページがなければ終了
    const hasNext = html.includes(`page=${page + 1}`) || /<a[^>]+rel="next"/i.test(html)
    if (!foundAny || !hasNext) break

    page++
    await randomDelay()
  }

  return records
}

// =============================================
// メインハンドラ
// =============================================
Deno.serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const fetched_at = new Date().toISOString()
  const allRecords: PriceRecord[] = []
  const errors: string[] = []

  console.log('[start] fetched_at:', fetched_at)
  console.log('[env] SUPABASE_URL:', SUPABASE_URL ? 'set' : 'MISSING')
  console.log('[env] SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING')

  // シンソク — ポケモン
  try {
    const records = await fetchShinsoku('ポケモン', 'pokemon', fetched_at)
    console.log('[shinsoku] pokemon:', records.length, 'records')
    allRecords.push(...records)
  } catch (e) {
    errors.push(`shinsoku/pokemon: ${e}`)
    console.error('[shinsoku] pokemon error:', e)
  }
  await randomDelay()

  // シンソク — ワンピース
  try {
    const records = await fetchShinsoku('ワンピース', 'onepiece', fetched_at)
    console.log('[shinsoku] onepiece:', records.length, 'records')
    allRecords.push(...records)
  } catch (e) {
    errors.push(`shinsoku/onepiece: ${e}`)
    console.error('[shinsoku] onepiece error:', e)
  }
  await randomDelay()

  // トレカバンク — ポケモン (category=1)
  try {
    const records = await fetchTorecabank(1, 'pokemon', fetched_at)
    console.log('[torecabank] pokemon:', records.length, 'records')
    allRecords.push(...records)
  } catch (e) {
    errors.push(`torecabank/pokemon: ${e}`)
    console.error('[torecabank] pokemon error:', e)
  }
  await randomDelay()

  // トレカバンク — ワンピース (category=2)
  try {
    const records = await fetchTorecabank(2, 'onepiece', fetched_at)
    console.log('[torecabank] onepiece:', records.length, 'records')
    allRecords.push(...records)
  } catch (e) {
    errors.push(`torecabank/onepiece: ${e}`)
    console.error('[torecabank] onepiece error:', e)
  }

  console.log('[total] records collected:', allRecords.length)

  if (allRecords.length === 0) {
    return Response.json({ success: true, inserted: 0, message: 'No records fetched', errors })
  }

  // バッチで挿入（100件ずつ）
  const BATCH = 100
  let inserted = 0
  for (let i = 0; i < allRecords.length; i += BATCH) {
    const batch = allRecords.slice(i, i + BATCH)
    try {
      const result = await supabase.from('reference_prices').insert(batch)
      const error = result?.error
      if (error) {
        console.error('[insert] error:', error.message, error.code)
        errors.push(`insert: ${error.message}`)
      } else {
        inserted += batch.length
        console.log('[insert] ok, batch', Math.floor(i / BATCH) + 1, '/', Math.ceil(allRecords.length / BATCH))
      }
    } catch (e) {
      console.error('[insert] threw:', e)
      errors.push(`insert threw: ${e}`)
    }
  }

  return Response.json({ success: true, inserted, total: allRecords.length, errors })
})
