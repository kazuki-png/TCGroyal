import { describe, expect, it } from 'vitest'
import { calculateIndicativeQuote, liquidityTier } from '@/lib/lending/valuation'
import type { LendingCard, MarketSnapshot } from '@/lib/lending/types'

const now = new Date('2026-10-26T03:00:00Z')
const card: LendingCard = {
  public_uid: 'd97c713d-e7c3-4bf6-a4e5-647a6e1c3bc1', name: 'テスト',
  card_number: '001/100', category: 'pokemon', grade: 'PSA10',
  buy_price: 800000, buy_price_updated_at: now.toISOString(),
}
const market: MarketSnapshot = {
  provider: 'snkrdunk', productId: '408333', grade: 'PSA10', currency: 'JPY',
  fetchedAt: now.toISOString(), sourceUrl: 'https://snkrdunk.com/apparels/408333',
  floorPriceJpy: 1000000, sales: [], coverage: 'latest_page_only', dailySalesAverage: null,
}

describe('indicative lending valuation', () => {
  it('uses 40% without inferring liquidity, and never approves funding', () => {
    expect(calculateIndicativeQuote(card, market, now)).toMatchObject({
      status: 'manual_review_required', indicativeAmountJpy: 400000, ltvPercent: 40,
    })
  })
  it('caps at 60% of TCG ROYAL buy price', () => {
    expect(calculateIndicativeQuote({ ...card, buy_price: 300000 }, market, now).indicativeAmountJpy).toBe(180000)
  })
  it('caps at 10 million and rounds down to 1000 yen', () => {
    expect(calculateIndicativeQuote({ ...card, buy_price: 100000000 }, { ...market, floorPriceJpy: 100000000 }, now).indicativeAmountJpy).toBe(10000000)
    expect(calculateIndicativeQuote(card, { ...market, floorPriceJpy: 333333 }, now).indicativeAmountJpy).toBe(133000)
  })
  it('rejects amounts below 100000 and accepts the exact minimum', () => {
    expect(calculateIndicativeQuote(card, { ...market, floorPriceJpy: 249999 }, now).status).toBe('unavailable')
    expect(calculateIndicativeQuote(card, { ...market, floorPriceJpy: 250000 }, now).indicativeAmountJpy).toBe(100000)
  })
  it.each([null, 'invalid', '2026-10-25T02:59:59Z', '2026-10-26T04:00:00Z'])('rejects missing, stale or future buy price date %s', date => {
    expect(calculateIndicativeQuote({ ...card, buy_price_updated_at: date }, market, now).status).toBe('unavailable')
  })
  it.each([0, -1, NaN, Infinity, 1.5])('rejects invalid buy price %s', price => {
    expect(calculateIndicativeQuote({ ...card, buy_price: price }, market, now).indicativeAmountJpy).toBeNull()
  })
  it('rejects stale market data and unsupported cards', () => {
    expect(calculateIndicativeQuote(card, { ...market, fetchedAt: '2026-10-26T02:54:59Z' }, now).status).toBe('unavailable')
    expect(calculateIndicativeQuote({ ...card, grade: 'PSA9' }, market, now).status).toBe('unavailable')
    expect(calculateIndicativeQuote({ ...card, category: 'other' }, market, now).status).toBe('unavailable')
    expect(calculateIndicativeQuote(card, { ...market, floorPriceJpy: null }, now).status).toBe('unavailable')
  })
})

describe('liquidity rules for future complete-volume observations', () => {
  it.each([null, NaN, Infinity, -1, 0, 0.99])('does not invent a score for %s', volume => {
    expect(liquidityTier(volume)).toBeNull()
  })
  it.each([[1, 1, 40], [4.99, 1, 40], [5, 2, 50], [9.99, 2, 50], [10, 3, 60]])('handles threshold %s', (volume, score, ltvPercent) => {
    expect(liquidityTier(volume)).toEqual({ score, ltvPercent })
  })
})
