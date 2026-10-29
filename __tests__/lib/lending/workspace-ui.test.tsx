import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LendingWorkspace, LoanCard } from '@/app/lending/LendingWorkspace'
import type { WorkflowLoan, WorkflowState } from '@/lib/lending/workflow-types'

const uid = '20000000-0000-4000-8000-000000000001'
const loanId = '30000000-0000-4000-8000-000000000001'
const base: WorkflowState = { role: 'customer', demo: true, marketFixture: true, identityVerified: true, outstandingJpy: 0, loanCount: 0,
  cards: [{ public_uid: uid, name: 'テストカード', card_number: 'TEST-001', productId: '408333' }], loans: [] }
const submitted: WorkflowLoan = { id: loanId, version: 1, status: 'submitted', cert_number: '12345678',
  card_name: 'テストカード', card_number: 'TEST-001', requested_jpy: 300000, offered_jpy: null,
  principal_jpy: 0, monthly_rate_bps: null, due_at: null, funded_at: null,
  created_at: '2026-10-26T03:00:00Z', evaluated_at: '2026-10-26T03:00:00Z', storage_location: null,
  payoff_jpy: 0, terms: null, terms_accepted_at: null, events: [], ledger: [], requests: [] }
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('physical inspection form', () => {
  it.each(['12345678', null])('sends the checked inspection and storage for certificate %s', async cert => {
    const send = vi.fn().mockResolvedValue(undefined)
    render(<LoanCard loan={{...submitted, cert_number: cert}} admin send={send} busy={false} />)
    if (cert) fireEvent.change(screen.getByLabelText('現物のPSA鑑定番号'), {target:{value:cert}})
    else expect(screen.queryByLabelText('現物のPSA鑑定番号')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('保管場所'), {target:{value:'  金庫A / 棚01  '}})
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', {name:'ステータス・手続きを更新'}))
    await waitFor(() => expect(send).toHaveBeenCalledOnce())
    expect(send.mock.calls[0][0]).toMatchObject({action:'receive',version:1,payload:{location:'金庫A / 棚01',inspected:true}})
    expect(send.mock.calls[0][0].payload.certNumber).toBe(cert ?? undefined)
  })
  it('explains a mismatched certificate and allows correction without losing the storage entry', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    render(<LoanCard loan={submitted} admin send={send} busy={false} />)
    fireEvent.change(screen.getByLabelText('現物のPSA鑑定番号'), {target:{value:'99999999'}})
    fireEvent.change(screen.getByLabelText('保管場所'), {target:{value:'金庫A'}})
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', {name:'ステータス・手続きを更新'}))
    expect(screen.getByRole('alert')).toHaveTextContent('現物のPSA鑑定番号が申込時の番号と一致しません')
    expect(send).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('現物のPSA鑑定番号'), {target:{value:submitted.cert_number}})
    fireEvent.click(screen.getByRole('button', {name:'ステータス・手続きを更新'}))
    await waitFor(() => expect(send).toHaveBeenCalledOnce())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('rejects a whitespace-only storage location', () => {
    const send=vi.fn()
    render(<LoanCard loan={{...submitted,cert_number:null}} admin send={send} busy={false} />)
    fireEvent.change(screen.getByLabelText('保管場所'), {target:{value:'   '}})
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', {name:'ステータス・手続きを更新'}))
    expect(screen.getByRole('alert')).toHaveTextContent('保管場所を1〜120文字で入力してください。')
    expect(send).not.toHaveBeenCalled()
  })
})

describe('customer lending workspace', () => {
  it('submits a quote-bound application with the QR URL and a retry key', async () => {
    const mutations: Record<string, unknown>[] = []
    let applied = false
    vi.stubGlobal('fetch', vi.fn(async (_url, options?: RequestInit) => {
      if (options?.method === 'POST') {
        const body = JSON.parse(String(options.body)); mutations.push(body)
        if (body.type === 'quote') return Response.json({ ok: true, quote: { id: loanId, cap_jpy: 400000, expires_at: '2026-10-26T03:15:00Z' } })
        applied = true; return Response.json({ ok: true })
      }
      return Response.json({ ...base, loans: applied ? [submitted] : [] })
    }))
    render(<LendingWorkspace demo />)
    await screen.findByText('新しく申し込む')
    fireEvent.change(screen.getByLabelText('カード'), { target: { value: uid } })
    fireEvent.change(screen.getByLabelText('PSA鑑定番号 / QRコードURL'), { target: { value: 'https://www.psacard.com/cert/12345678/psa' } })
    fireEvent.click(screen.getByRole('button', { name: '概算額を確認' }))
    await screen.findByText('¥400,000')
    expect(screen.getByRole('button', { name: 'この内容で申し込む' })).toBeEnabled()
    fireEvent.click(screen.getByLabelText('概算は融資承認ではなく、現物検品後の条件に改めて同意することを確認しました'))
    fireEvent.click(screen.getByRole('button', { name: 'この内容で申し込む' }))
    await screen.findByText('到着待ち')
    expect(mutations[1]).toMatchObject({ type: 'apply', quoteId: loanId, certInput: 'https://www.psacard.com/cert/12345678/psa', amountJpy: 300000, deposit: 'mail' })
    expect(mutations[1].key).toMatch(/^[a-f\d-]{36}$/)
  })

  it('requires explicit consent and submits the displayed terms version', async () => {
    const offered: WorkflowLoan = { ...submitted, status: 'offered', version: 3, offered_jpy: 300000,
      monthly_rate_bps: 200, terms: { version: 3, principalJpy: 300000, monthlyRateBps: 200, termMonths: 3, feesJpy: 0, documentVersion: 'local-draft-v1' } }
    const requests: Record<string, unknown>[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url, options?: RequestInit) => {
      if (options?.method === 'POST') { requests.push(JSON.parse(String(options.body))); return Response.json({ ok: true }) }
      return Response.json({ ...base, loans: [offered] })
    }))
    render(<LendingWorkspace demo />)
    await screen.findByText('契約条件を確認')
    expect(screen.getByText(/満期返済額 ¥318,000/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '条件に同意' }))
    expect(requests).toHaveLength(0)
    fireEvent.click(screen.getByLabelText('表示された条件と手続き内容を確認し、同意します'))
    fireEvent.click(screen.getByRole('button', { name: '条件に同意' }))
    await waitFor(() => expect(requests).toHaveLength(1))
    expect(requests[0]).toMatchObject({ type: 'command', loanId, version: 3, action: 'accept', payload: { termsAccepted: true } })
  })

  it('keeps the same idempotency key when a network failure is retried', async () => {
    const requests: Record<string, unknown>[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url, options?: RequestInit) => {
      if (options?.method === 'POST') {
        requests.push(JSON.parse(String(options.body))); throw Error('接続が切れました')
      }
      return Response.json({ ...base, loans: [submitted] })
    }))
    render(<LendingWorkspace demo />)
    await screen.findByText('到着待ち')
    fireEvent.click(screen.getByRole('button', { name: '申込をキャンセル' }))
    await screen.findByRole('alert')
    await waitFor(() => expect(screen.getByRole('button', { name: '申込をキャンセル' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: '申込をキャンセル' }))
    await waitFor(() => expect(requests).toHaveLength(2))
    expect(requests[0].key).toBe(requests[1].key)
  })
})
