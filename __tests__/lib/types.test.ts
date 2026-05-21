import { describe, it, expect } from 'vitest'
import {
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABELS,
  EMAIL_TRIGGER_STATUSES,
} from '@/lib/types'

describe('ORDER_STATUS_FLOW', () => {
  it('unhandledから始まりcompletedで終わる', () => {
    expect(ORDER_STATUS_FLOW[0]).toBe('unhandled')
    expect(ORDER_STATUS_FLOW[ORDER_STATUS_FLOW.length - 1]).toBe('completed')
  })

  it('7つのステータスを持つ', () => {
    expect(ORDER_STATUS_FLOW).toHaveLength(7)
  })

  it('acceptedはunhandledの後である', () => {
    const unhandledIndex = ORDER_STATUS_FLOW.indexOf('unhandled')
    const acceptedIndex = ORDER_STATUS_FLOW.indexOf('accepted')
    expect(acceptedIndex).toBeGreaterThan(unhandledIndex)
  })
})

describe('ORDER_STATUS_LABELS', () => {
  it('全てのステータスにラベルがある', () => {
    for (const status of ORDER_STATUS_FLOW) {
      expect(ORDER_STATUS_LABELS[status]).toBeDefined()
      expect(typeof ORDER_STATUS_LABELS[status]).toBe('string')
    }
  })

  it('unhandledのラベルは未対応', () => {
    expect(ORDER_STATUS_LABELS.unhandled).toBe('未対応')
  })

  it('completedのラベルは完了', () => {
    expect(ORDER_STATUS_LABELS.completed).toBe('完了')
  })
})

describe('EMAIL_TRIGGER_STATUSES', () => {
  it('accepted, pending_approval, completedを含む', () => {
    expect(EMAIL_TRIGGER_STATUSES).toContain('accepted')
    expect(EMAIL_TRIGGER_STATUSES).toContain('pending_approval')
    expect(EMAIL_TRIGGER_STATUSES).toContain('completed')
  })

  it('3つのトリガーステータスを持つ', () => {
    expect(EMAIL_TRIGGER_STATUSES).toHaveLength(3)
  })

  it('unhandledはトリガーにならない', () => {
    expect(EMAIL_TRIGGER_STATUSES).not.toContain('unhandled')
  })
})
