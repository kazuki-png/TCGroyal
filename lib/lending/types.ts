export interface MarketSnapshot {
  provider: 'snkrdunk'
  productId: string
  grade: 'PSA10'
  currency: 'JPY'
  fetchedAt: string
  sourceUrl: string
  floorPriceJpy: number | null
  sales: { priceJpy: number; displayedDate: string }[]
  // The first page is not a complete observation window or a volume measure.
  coverage: 'latest_page_only'
  dailySalesAverage: null
}

export interface LendingCard {
  public_uid: string
  name: string
  card_number: string | null
  category: string
  grade: string
  buy_price: number
  buy_price_updated_at: string | null
}

export interface IndicativeQuote {
  ruleVersion: 'snkrdunk-preview-v1'
  status: 'manual_review_required' | 'unavailable'
  indicativeAmountJpy: number | null
  ltvPercent: 40
  minimumAmountJpy: 100000
  reasons: string[]
  calculatedAt: string
}
