import { describe, it, expect } from 'vitest'
import {
  acceptedEmailHtml,
  waitingArrivalEmailHtml,
  completedEmailHtml,
} from '@/lib/email/templates'
import type { OrderWithItems } from '@/lib/types'

const mockOrder: OrderWithItems = {
  id: '12345678-0000-0000-0000-000000000000',
  user_id: 'user-1',
  status: 'accepted',
  total_amount: 50000,
  bank_name: 'テスト銀行',
  bank_branch: 'テスト支店',
  bank_account_no: '1234567',
  bank_holder: 'ヤマダ タロウ',
  note: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  order_items: [
    {
      id: 'item-1',
      order_id: '12345678-0000-0000-0000-000000000000',
      card_id: 'card-1',
      card_name: 'リザードン',
      grade: 'PSA10',
      quantity: 2,
      unit_price: 25000,
      created_at: '2025-01-01T00:00:00Z',
    },
  ],
}

describe('acceptedEmailHtml', () => {
  it('申込番号が含まれる', () => {
    const html = acceptedEmailHtml(mockOrder)
    expect(html).toContain('12345678')
  })

  it('カード名が含まれる', () => {
    const html = acceptedEmailHtml(mockOrder)
    expect(html).toContain('リザードン')
  })

  it('合計金額が含まれる', () => {
    const html = acceptedEmailHtml(mockOrder)
    expect(html).toContain('50,000')
  })

  it('有効なHTMLドキュメントである', () => {
    const html = acceptedEmailHtml(mockOrder)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('</html>')
  })
})

describe('waitingArrivalEmailHtml', () => {
  it('申込番号が含まれる', () => {
    const html = waitingArrivalEmailHtml(mockOrder)
    expect(html).toContain('12345678')
  })

  it('送付先住所が含まれる', () => {
    const html = waitingArrivalEmailHtml(mockOrder)
    expect(html).toContain('TCG Royal')
  })
})

describe('completedEmailHtml', () => {
  it('振込金額が含まれる', () => {
    const html = completedEmailHtml(mockOrder)
    expect(html).toContain('50,000')
  })

  it('銀行情報が含まれる', () => {
    const html = completedEmailHtml(mockOrder)
    expect(html).toContain('テスト銀行')
    expect(html).toContain('1234567')
    expect(html).toContain('ヤマダ タロウ')
  })

  it('bank_nameがnullの場合にハイフンを表示する', () => {
    const order = { ...mockOrder, bank_name: null }
    const html = completedEmailHtml(order)
    expect(html).toContain('銀行：-')
  })
})
