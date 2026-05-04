import { describe, it, expect } from 'vitest'
import { ORDER_STATUS_FLOW, EMAIL_TRIGGER_STATUSES } from '@/lib/types'
import type { OrderStatus } from '@/lib/types'

describe('ステータス遷移ロジック', () => {
  it('nextStatusesは現在のインデックスより後のステータスだけを含む', () => {
    const currentStatus: OrderStatus = 'accepted'
    const currentIndex = ORDER_STATUS_FLOW.indexOf(currentStatus)
    const nextStatuses = ORDER_STATUS_FLOW.slice(currentIndex + 1)

    expect(nextStatuses).not.toContain('unhandled')
    expect(nextStatuses).not.toContain('accepted')
    expect(nextStatuses).toContain('waiting_arrival')
    expect(nextStatuses).toContain('completed')
  })

  it('completedの場合はnextStatusesが空になる', () => {
    const currentStatus: OrderStatus = 'completed'
    const currentIndex = ORDER_STATUS_FLOW.indexOf(currentStatus)
    const nextStatuses = ORDER_STATUS_FLOW.slice(currentIndex + 1)

    expect(nextStatuses).toHaveLength(0)
  })

  it('unhandledの場合は6つの次のステータスがある', () => {
    const currentStatus: OrderStatus = 'unhandled'
    const currentIndex = ORDER_STATUS_FLOW.indexOf(currentStatus)
    const nextStatuses = ORDER_STATUS_FLOW.slice(currentIndex + 1)

    expect(nextStatuses).toHaveLength(6)
  })

  it('後退する変更は無効である', () => {
    const isValidTransition = (
      currentStatus: OrderStatus,
      newStatus: OrderStatus
    ) => {
      const currentIndex = ORDER_STATUS_FLOW.indexOf(currentStatus)
      const newIndex = ORDER_STATUS_FLOW.indexOf(newStatus)
      return newIndex > currentIndex
    }

    expect(isValidTransition('waiting_arrival', 'accepted')).toBe(false)
    expect(isValidTransition('accepted', 'waiting_arrival')).toBe(true)
    expect(isValidTransition('completed', 'unhandled')).toBe(false)
  })
})

describe('メール送信トリガー', () => {
  it('acceptedでメールが送信される', () => {
    expect(EMAIL_TRIGGER_STATUSES.includes('accepted')).toBe(true)
  })

  it('inspectingではメールが送信されない', () => {
    expect(EMAIL_TRIGGER_STATUSES.includes('inspecting')).toBe(false)
  })

  it('completedでメールが送信される', () => {
    expect(EMAIL_TRIGGER_STATUSES.includes('completed')).toBe(true)
  })
})

describe('合計金額計算', () => {
  it('カートアイテムの合計を正しく計算する', () => {
    const items = [
      { card: { id: '1', buy_price: 10000 }, quantity: 2 },
      { card: { id: '2', buy_price: 5000 }, quantity: 3 },
    ]
    const total = items.reduce(
      (sum, item) => sum + item.card.buy_price * item.quantity,
      0
    )
    expect(total).toBe(35000)
  })

  it('空のカートは0円になる', () => {
    const items: { card: { buy_price: number }; quantity: number }[] = []
    const total = items.reduce(
      (sum, item) => sum + item.card.buy_price * item.quantity,
      0
    )
    expect(total).toBe(0)
  })
})
