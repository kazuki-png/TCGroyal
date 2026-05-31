import type { Card } from '@/lib/types'

export const CARD_PRICE_VISIBILITY_HOURS = 48

export type CardUserVisibility = 'all' | 'visible' | 'hidden'

export function visiblePriceUpdatedAfter(referenceDate = new Date()) {
  return new Date(
    referenceDate.getTime() - CARD_PRICE_VISIBILITY_HOURS * 60 * 60 * 1000
  ).toISOString()
}

export function isCardVisibleToUsers(
  card: Pick<Card, 'buy_price_updated_at'>,
  referenceDate = new Date()
) {
  if (!card.buy_price_updated_at) return false
  return new Date(card.buy_price_updated_at).getTime() >=
    new Date(visiblePriceUpdatedAfter(referenceDate)).getTime()
}

export function cardHiddenReason(card: Pick<Card, 'buy_price_updated_at'>) {
  if (!card.buy_price_updated_at) return '価格未更新'
  return '48時間以上未更新'
}
