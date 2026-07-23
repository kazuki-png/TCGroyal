import { describe, it, expect } from 'vitest'
import {
  orderSubmittedEmailHtml,
  acceptedEmailHtml,
  adminNotificationEmailHtml,
  pendingApprovalEmailHtml,
  completedEmailHtml,
  cancelledEmailHtml,
} from '@/lib/email/templates'
import type { OrderWithItems } from '@/lib/types'

const mockOrder: OrderWithItems = {
  id: '12345678-0000-0000-0000-000000000000',
  order_number: '20260521-01',
  user_id: 'user-1',
  status: 'accepted',
  total_amount: 50000,
  bank_name: 'テスト銀行',
  bank_branch: 'テスト支店',
  bank_account_no: '1234567',
  bank_holder: 'ヤマダ タロウ',
  note: null,
  assessment_saved_at: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  order_items: [
    {
      id: 'item-1',
      order_id: '12345678-0000-0000-0000-000000000000',
      card_id: 'card-1',
      item_type: 'card',
      card_name: 'リザードン',
      grade: 'PSA10',
      quantity: 2,
      unit_price: 25000,
      assessed_unit_price: 25000,
      customer_decision: null,
      customer_decided_at: null,
      requested_note: null,
      created_at: '2025-01-01T00:00:00Z',
    },
  ],
}

describe('orderSubmittedEmailHtml', () => {
  it('注文番号と明細が含まれる', () => {
    const html = orderSubmittedEmailHtml(mockOrder)
    expect(html).toContain('20260521-01')
    expect(html).toContain('リザードン')
    expect(html).toContain('50,000')
  })
})

describe('acceptedEmailHtml', () => {
  it('注文番号が含まれる', () => {
    const html = acceptedEmailHtml(mockOrder)
    expect(html).toContain('20260521-01')
  })

  it('発送先住所が含まれる', () => {
    const html = acceptedEmailHtml(mockOrder)
    expect(html).toContain('東京都新宿区西新宿1丁目14-5')
    expect(html).toContain('03-6900-4003')
  })

  it('有効なHTMLドキュメントである', () => {
    const html = acceptedEmailHtml(mockOrder)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('</html>')
  })
})

describe('pendingApprovalEmailHtml', () => {
  it('注文番号と査定結果合計額が含まれる', () => {
    const html = pendingApprovalEmailHtml(mockOrder)
    expect(html).toContain('20260521-01')
    expect(html).toContain('50,000')
  })

  it('マイページリンクが含まれる', () => {
    const html = pendingApprovalEmailHtml(mockOrder, {
      mypageUrl: 'https://example.com/mypage/orders/1',
    })
    expect(html).toContain('https://example.com/mypage/orders/1')
  })
})

describe('completedEmailHtml', () => {
  it('注文番号と振込金額が含まれる', () => {
    const html = completedEmailHtml(mockOrder)
    expect(html).toContain('20260521-01')
    expect(html).toContain('50,000')
  })
})

describe('cancelledEmailHtml', () => {
  it('案内する返送料がお客様負担である', () => {
    const html = cancelledEmailHtml(mockOrder)

    expect(html).toContain(
      'キャンセル時の商品の返送料はお客様負担とさせていただいております。',
    )
    expect(html).not.toContain('返送料につきましても、TCG ROYALにて負担')
  })
})

describe('adminNotificationEmailHtml', () => {
  it('キャンセル通知の明細にキャンセル状況が含まれる', () => {
    const html = adminNotificationEmailHtml('cancellation', {
      ...mockOrder,
      order_items: [
        {
          ...mockOrder.order_items[0],
          customer_decision: 'cancelled',
        },
      ],
    })

    expect(html).toContain('ユーザーよりキャンセル申請がありました。')
    expect(html).toContain('キャンセル状況')
    expect(html).toContain('キャンセル')
  })
})
