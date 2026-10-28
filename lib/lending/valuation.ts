import type { IndicativeQuote, LendingCard, MarketSnapshot } from './types'

const DAY_MS = 86_400_000

export function liquidityTier(dailyAverage: number | null) {
  if (dailyAverage === null || !Number.isFinite(dailyAverage) || dailyAverage < 1) return null
  if (dailyAverage >= 10) return { score: 3, ltvPercent: 60 } as const
  if (dailyAverage >= 5) return { score: 2, ltvPercent: 50 } as const
  return { score: 1, ltvPercent: 40 } as const
}

// Preview only. Product mapping, identity, physical inspection and funding approval
// are deliberately not represented as approved by this calculation.
export function calculateIndicativeQuote(
  card: LendingCard,
  market: MarketSnapshot,
  now = new Date(),
): IndicativeQuote {
  const result: IndicativeQuote = {
    ruleVersion: 'snkrdunk-preview-v1', status: 'unavailable',
    indicativeAmountJpy: null, ltvPercent: 40, minimumAmountJpy: 100000,
    reasons: [], calculatedAt: now.toISOString(),
  }
  const reasons = result.reasons
  if (card.grade !== 'PSA10' || !['pokemon', 'onepiece'].includes(card.category)) {
    reasons.push('対象はポケモン・ワンピースのPSA10のみです。')
  }
  if (!Number.isSafeInteger(card.buy_price) || card.buy_price <= 0 || card.buy_price > 1_000_000_000) {
    reasons.push('TCG ROYALの有効な買取価格が必要です。')
  }
  const buyAge = now.getTime() - Date.parse(card.buy_price_updated_at ?? '')
  if (!Number.isFinite(buyAge) || buyAge < 0 || buyAge > DAY_MS) {
    reasons.push('買取価格が未更新、または更新から24時間を超えています。')
  }
  const marketAge = now.getTime() - Date.parse(market.fetchedAt)
  if (!Number.isFinite(marketAge) || marketAge < 0 || marketAge > 5 * 60_000) {
    reasons.push('スニダンのデータを再取得してください。')
  }
  if (market.grade !== 'PSA10' || market.currency !== 'JPY' || !Number.isSafeInteger(market.floorPriceJpy)
    || market.floorPriceJpy === null || market.floorPriceJpy <= 0 || market.floorPriceJpy > 1_000_000_000) {
    reasons.push('PSA10の有効な掲載価格を取得できません。')
  }
  if (reasons.length) return result

  // Integer yen, round down to ¥1,000. No inferred transaction frequency.
  const cap = Math.min(Math.floor(market.floorPriceJpy! * 40 / 100), Math.floor(card.buy_price * 60 / 100), 10_000_000)
  const amount = Math.floor(cap / 1000) * 1000
  if (amount < 100000) {
    reasons.push('概算額が最低融資額10万円を下回ります。')
    return result
  }
  result.status = 'manual_review_required'
  result.indicativeAmountJpy = amount
  reasons.push('商品・型番の対応とPSA番号の現物確認が必要です。')
  reasons.push('成約件数は未確定のため、流動性スコアは付けず40%で参考計算しています。')
  reasons.push('掲載価格を使った参考額です。最終査定・契約・融資承認は行っていません。')
  return result
}
