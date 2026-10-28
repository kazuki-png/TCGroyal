import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LendingPreview } from '@/app/admin/(protected)/lending/LendingPreview'

const card = { public_uid: 'd97c713d-e7c3-4bf6-a4e5-647a6e1c3bc1', name: 'テストカード', card_number: '001', category: 'pokemon', grade: 'PSA10', buy_price: 1000000, buy_price_updated_at: '2026-10-26T03:00:00Z' }
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function fillForm() {
  fireEvent.change(screen.getByLabelText('TCG ROYALのカード'), { target: { value: card.public_uid } })
  fireEvent.change(screen.getByLabelText('スニダンの商品ID'), { target: { value: '408333' } })
  fireEvent.click(screen.getByRole('button', { name: 'スニダンから取得して概算を確認' }))
}

describe('lending preview operator flow', () => {
  it('shows a manual-review result and clears it when the product changes', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      card,
      market: { floorPriceJpy: 1000000, fetchedAt: '2026-10-26T03:00:00Z', sourceUrl: 'https://snkrdunk.com/apparels/408333', sales: [{ priceJpy: 990000, displayedDate: '20時間前' }] },
      quote: { status: 'manual_review_required', indicativeAmountJpy: 400000, reasons: ['現物確認が必要です。'] },
    }) })
    vi.stubGlobal('fetch', fetch)
    render(<LendingPreview cards={[card]} />)
    fillForm()
    expect(await screen.findByText('¥400,000')).toBeInTheDocument()
    expect(screen.getByText('要手動審査 / 参考額')).toBeInTheDocument()
    expect(screen.getByText('20時間前')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/admin/lending/preview', expect.objectContaining({
      body: JSON.stringify({ cardUid: card.public_uid, productId: '408333' }),
    }))
    fireEvent.change(screen.getByLabelText('スニダンの商品ID'), { target: { value: '408334' } })
    expect(screen.queryByText('¥400,000')).not.toBeInTheDocument()
  })
  it('shows the server error and lets the operator retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: '価格データを取得できません。' }) }))
    render(<LendingPreview cards={[card]} />)
    fillForm()
    expect(await screen.findByRole('alert')).toHaveTextContent('価格データを取得できません。')
    await waitFor(() => expect(screen.getByRole('button')).toBeEnabled())
    expect(screen.queryByText('要手動審査 / 参考額')).not.toBeInTheDocument()
  })
})
