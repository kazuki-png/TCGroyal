import { describe, expect, it } from 'vitest'
import {
  CARD_PRICE_VISIBILITY_HOURS,
  cardHiddenReason,
  isCardVisibleToUsers,
  visiblePriceUpdatedAfter,
} from '@/lib/cards/visibility'

const NOW = new Date('2026-05-31T00:00:00.000Z')

describe('card user visibility', () => {
  it('48時間以内に価格更新されたカードは表示対象', () => {
    expect(
      isCardVisibleToUsers(
        { buy_price_updated_at: '2026-05-29T00:00:00.000Z' },
        NOW
      )
    ).toBe(true)
  })

  it('48時間より前の価格更新カードは非表示', () => {
    expect(
      isCardVisibleToUsers(
        { buy_price_updated_at: '2026-05-28T23:59:59.999Z' },
        NOW
      )
    ).toBe(false)
  })

  it('価格更新がないカードは非表示', () => {
    expect(isCardVisibleToUsers({ buy_price_updated_at: null }, NOW)).toBe(false)
    expect(cardHiddenReason({ buy_price_updated_at: null })).toBe('価格未更新')
  })

  it('表示期限の基準日時を計算する', () => {
    expect(visiblePriceUpdatedAfter(NOW)).toBe(
      new Date(
        NOW.getTime() - CARD_PRICE_VISIBILITY_HOURS * 60 * 60 * 1000
      ).toISOString()
    )
  })
})
