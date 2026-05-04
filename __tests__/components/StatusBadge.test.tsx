import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '@/app/components/StatusBadge'
import type { OrderStatus } from '@/lib/types'

describe('StatusBadge', () => {
  it('unhandledのラベルを表示する', () => {
    render(<StatusBadge status="unhandled" />)
    expect(screen.getByText('未対応')).toBeInTheDocument()
  })

  it('completedのラベルを表示する', () => {
    render(<StatusBadge status="completed" />)
    expect(screen.getByText('完了')).toBeInTheDocument()
  })

  it('acceptedの場合はblueクラスを持つ', () => {
    const { container } = render(<StatusBadge status="accepted" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-blue-100')
  })

  it('completedの場合はgreenクラスを持つ', () => {
    const { container } = render(<StatusBadge status="completed" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-green-100')
  })

  const statuses: OrderStatus[] = [
    'unhandled',
    'accepted',
    'waiting_arrival',
    'inspecting',
    'pending_approval',
    'pending_transfer',
    'completed',
  ]

  it.each(statuses)('ステータス %s を正しく表示する', (status) => {
    const { container } = render(<StatusBadge status={status} />)
    expect(container.firstChild).toBeTruthy()
    expect(container.firstChild?.textContent).toBeTruthy()
  })
})
