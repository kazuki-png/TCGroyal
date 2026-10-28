'use client'
import {SupportCaseManager} from './SupportCaseManager'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { LOAN_STATUS_LABELS, type LoanCommand, type WorkflowLoan, type WorkflowState } from '@/lib/lending/workflow-types'
import { PsaScanner } from './PsaScanner'
import { LendingReviewPanel } from './LendingReviewPanel'

const field = 'mt-2 w-full rounded-xl border border-white/15 bg-[#121b2c] px-3 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-amber-300'
const button = 'rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-[#111827] disabled:opacity-40'
const yen = (amount: number) => `¥${amount.toLocaleString('ja-JP')}`
const date = (value: string | null) => value ? new Date(value).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '—'
const actionLabels: Record<LoanCommand, string> = {
  receive: '検品・保管を記録', offer: '最終条件を提示', accept: '条件に同意', fund: '出金を記録', cancel: '申込をキャンセル',
  reject: '申込を見送る', report_repayment: '振込済みを申告', reject_repayment: '入金申告を差し戻す', confirm_repayment: '入金を照合・記録', return: '返却を記録',
  request_extension: '3か月延長を申請', request_additional: '追加借入の相談を申請', extend: '延長利息の入金を確認',
  reject_request: '追加申請を見送る', forfeit: '質流れを記録',
}
type Send = (body: Record<string, unknown>) => Promise<void>

function LoanActions({ loan, admin, send, busy }: { loan: WorkflowLoan; admin: boolean; send: Send; busy: boolean }) {
  const actions: LoanCommand[] = []
  const pending = loan.requests.find(r => r.status === 'pending')
  if (admin) {
    if (loan.status === 'submitted') actions.push('receive', 'reject')
    if (loan.status === 'received') actions.push('offer', 'reject')
    if (loan.status === 'offered') actions.push('offer', 'reject')
    if (loan.status === 'accepted') actions.push('fund', 'offer', 'reject')
    if (['active','repayment_pending'].includes(loan.status)) actions.push('confirm_repayment')
    if (loan.status === 'repayment_pending') actions.push('reject_repayment')
    if (loan.status === 'return_pending') actions.push('return')
    if (loan.status === 'active' && pending) {
      if (pending.kind === 'extension') actions.push('extend')
      actions.push('reject_request')
    }
    if (loan.status === 'active' && !pending && loan.due_at && Date.parse(loan.due_at) < Date.parse(loan.evaluated_at)) actions.push('forfeit')
  } else {
    if (['submitted','received','offered','accepted'].includes(loan.status)) actions.push('cancel')
    if (loan.status === 'offered') actions.unshift('accept')
    if (loan.status === 'active') {
      actions.push('report_repayment')
      if (!pending && loan.due_at && Date.parse(loan.evaluated_at) < Date.parse(loan.due_at)) actions.push('request_extension','request_additional')
    }
  }
  const [selected, setSelected] = useState<LoanCommand | ''>('')
  const action = actions.includes(selected as LoanCommand) ? selected as LoanCommand : actions[0]
  if (!actions.length) return null
  const needsAmount = ['offer','fund','confirm_repayment','extend','request_additional'].includes(action)
  const needsReference = ['fund','confirm_repayment','return','extend'].includes(action)
  const needsConsent = ['accept','request_extension','request_additional','forfeit'].includes(action)
  const amount = action === 'confirm_repayment' ? loan.payoff_jpy : action === 'extend' ? pending?.amount_jpy ?? 0 : action === 'request_additional' ? 10000 : loan.offered_jpy ?? loan.requested_jpy

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const payload: Record<string, unknown> = {}
    if (needsAmount) payload.amountJpy = Number(values.get('amount'))
    if (needsReference) payload.reference = values.get('reference')
    if (action === 'offer') {payload.monthlyRateBps = Math.round(Number(values.get('rate')) * 100);if(!loan.cert_number){payload.manualValuationJpy=Number(values.get('valuation'));payload.manualCapJpy=Number(values.get('cap'));payload.reason=values.get('basis')}}
    if (action === 'receive') { payload.location = values.get('location'); if(loan.cert_number)payload.certNumber = values.get('cert'); payload.inspected = values.get('inspected') === 'on' }
    if (['reject','reject_repayment'].includes(action)) payload.reason = values.get('reason')
    if (['accept','request_extension','request_additional'].includes(action)) payload.termsAccepted = values.get('consent') === 'on'
    if (action === 'forfeit') payload.reviewed = values.get('consent') === 'on'
    await send({ type: 'command', loanId: loan.id, version: loan.version, action, payload })
  }

  return <form onSubmit={submit} className="mt-5 border-t border-white/10 pt-5">
    <fieldset disabled={busy} className="space-y-4">
      <label className="block text-sm">手続き
        <select className={field} value={action} onChange={e => setSelected(e.target.value as LoanCommand)}>
          {actions.map(value => <option key={value} value={value}>{actionLabels[value]}</option>)}
        </select>
      </label>
      {action === 'receive' && <>
        {loan.cert_number&&<label className="block text-sm">現物のPSA鑑定番号<input className={field} name="cert" inputMode="numeric" pattern="[0-9]{6,12}" required /></label>}
        <label className="block text-sm">保管場所<input className={field} name="location" maxLength={120} required placeholder="金庫A / 棚01" /></label>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="inspected" required className="mt-1" />カード・ラベル・スラブと申込内容の一致を検品しました</label>
      </>}
      {needsAmount && <label key={`${action}-${amount}`} className="block text-sm">{action === 'confirm_repayment' || action === 'extend' ? '照合した実入金額（円）' : '金額（円）'}
        <input name="amount" type="number" min={0} max={10000000} step={1} defaultValue={amount} required className={field} />
      </label>}
      {action === 'offer' && <label className="block text-sm">月利（%）<input name="rate" type="number" min={0} max={2} step={0.01} defaultValue={2} required className={field} /></label>}
      {action==='offer'&&!loan.cert_number&&<><label className="block text-sm">現物確認後のカード評価額（円）<input className={field} name="valuation" type="number" min={1} max={1000000000} required/></label><label className="block text-sm">再査定した融資上限（円）<input className={field} name="cap" type="number" min={100000} max={10000000} step={10000} required/></label><label className="block text-sm">現物の確認内容・評価根拠<textarea className={field} name="basis" maxLength={500} required/></label></>}
      {needsReference && <label className="block text-sm">{action === 'return' ? '返却追跡番号・店頭受領番号' : '銀行明細・現金受領記録の照合番号'}
        <input name="reference" minLength={4} maxLength={120} required className={field} />
      </label>}
      {['reject','reject_repayment'].includes(action) && <label className="block text-sm">理由<input name="reason" maxLength={500} required className={field} /></label>}
      {action === 'request_extension' && <p className="text-sm leading-7 text-amber-100">現在の3か月分の利息 {yen(Math.ceil(loan.principal_jpy * (loan.monthly_rate_bps ?? 0) * 3 / 10000))} を精算し、現在の期限から3か月延長する申請です。入金確認までは期限は変わりません。</p>}
      {action === 'request_additional' && <p className="text-sm leading-7 text-zinc-300">追加借入は再査定・変更契約が必要です。ここでは相談を受け付け、元本は増やしません。</p>}
      {needsConsent && <label className="flex items-start gap-3 text-sm leading-6"><input name="consent" type="checkbox" required className="mt-1" />
        {action === 'forfeit' ? '期限と入金状況・申請状況を確認しました' : '表示された条件と手続き内容を確認し、同意します'}
      </label>}
      <button className={button} type="submit">{busy ? '処理中…' : actionLabels[action]}</button>
    </fieldset>
  </form>
}

function LoanCard({ loan, admin, send, busy }: { loan: WorkflowLoan; admin: boolean; send: Send; busy: boolean }) {
  const terms = loan.terms
  function downloadTerms() {
    if (!terms) return
    const content = ['TCG ROYAL 契約条件（ローカル検証用の草案）', `申込ID: ${loan.id}`, `カード: ${loan.card_name}`, loan.cert_number?`PSA鑑定番号: ${loan.cert_number}`:'PSA番号なし・個別見積もり',
      `元本: ${yen(terms.principalJpy)}`, `月利: ${terms.monthlyRateBps / 100}%`, `期間: ${terms.termMonths}か月（出金日が起算日）`,
      `手数料: ${yen(terms.feesJpy)}`, '期限前返済: 暦月単位の切り上げ、最低1か月・最大3か月分',
      '返済・延長の手続きがなく期限を経過した場合は質流れの確認対象になります。',
      `同意日時: ${date(loan.terms_accepted_at)}`, `条件版: ${terms.documentVersion} / ${terms.version}`,
      ...loan.requests.filter(r => r.kind === 'extension' && r.status === 'completed').map(r => `延長記録: 利息 ${yen(r.amount_jpy)} / 延長後の期限 ${date(r.consent_terms.newDueAt ?? null)}`)].join('\n')
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `loan-${loan.id}-terms.txt`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <article className="rounded-2xl border border-white/10 bg-[#111b2d] p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-bold">{loan.card_name}</h3><span className="rounded-full bg-amber-200/10 px-3 py-1 text-xs font-bold text-amber-200">{LOAN_STATUS_LABELS[loan.status]}</span></div>
    <p className="mt-2 text-xs text-zinc-400">{loan.cert_number?`カード番号 ${loan.card_number??''} / PSA鑑定番号 ${loan.cert_number}`:'PSA番号なし・個別見積もり'}</p>
    <p className="mt-5 text-xs text-zinc-400">{loan.status === 'active' || loan.status === 'repayment_pending' ? '借入元本' : '申込希望額'}</p>
    <p className="mt-1 text-3xl font-bold tracking-tight">{yen(['active','repayment_pending'].includes(loan.status) ? loan.principal_jpy : loan.requested_jpy)}</p>
    <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
      <div><dt className="text-zinc-400">現在の返済必要額</dt><dd className="mt-1 font-semibold">{loan.payoff_jpy ? yen(loan.payoff_jpy) : '—'}</dd></div>
      <div><dt className="text-zinc-400">返済期限（日本時間）</dt><dd className="mt-1">{date(loan.due_at)}</dd></div>
      {admin && <div><dt className="text-zinc-400">保管場所</dt><dd>{loan.storage_location ?? '未入庫'}</dd></div>}
    </dl>
    {terms && <details open={loan.status === 'offered'} className="mt-5 rounded-xl bg-black/20 p-4 text-sm leading-7">
      <summary className="cursor-pointer font-bold text-amber-200">契約条件を確認</summary>
      <p>元本 {yen(terms.principalJpy)} / 月利 {terms.monthlyRateBps / 100}% / {terms.termMonths}か月 / 手数料 {yen(terms.feesJpy)}</p>
      <p>満期返済額 {yen(terms.principalJpy + Math.ceil(terms.principalJpy * terms.monthlyRateBps * terms.termMonths / 10000))}</p>
      <p>期限前返済は暦月単位の切り上げで、最低1か月・最大3か月分の利息です。期間は出金日から数えます。</p>
      <p>返済・延長の手続きなく期限を経過した場合は質流れの確認対象になります。</p>
      <p>同意日時: {date(loan.terms_accepted_at)}</p>
      {loan.requests.filter(r => r.kind === 'extension' && r.status === 'completed').map(r => <p key={r.id}>延長記録: 利息 {yen(r.amount_jpy)} / 延長後の期限 {date(r.consent_terms.newDueAt ?? null)}</p>)}
      <button type="button" onClick={downloadTerms} className="mt-2 text-amber-200 underline">条件書の草案を保存</button>
    </details>}
    {loan.requests.filter(r => r.status === 'pending').map(r => <p key={r.id} className="mt-4 rounded-lg bg-amber-100/10 p-3 text-sm text-amber-100">{r.kind === 'extension' ? '延長申請' : '追加借入相談'}を確認中 / {yen(r.amount_jpy)}</p>)}
    <LoanActions key={loan.version} loan={loan} admin={admin} send={send} busy={busy} />
    <details className="mt-5 text-xs leading-6 text-zinc-400"><summary className="cursor-pointer">手続き・入出金の履歴</summary>
      <ol className="mt-2 space-y-1">{loan.events.map(e => <li key={e.version}>{date(e.created_at)} / {actionLabels[e.action as LoanCommand] ?? e.action} / {LOAN_STATUS_LABELS[e.to_status]}{e.reason ? ` / ${e.reason}` : ''}</li>)}</ol>
      <ul className="mt-3">{loan.ledger.map(e => <li key={e.id}>{date(e.created_at)} / {({ disbursement: '出金', repayment: '返済入金', extension_interest: '延長利息入金', forfeiture: '質流れによる元本処理' } as Record<string,string>)[e.kind]} / {yen(e.amount_jpy)}</li>)}</ul>
    </details>
  </article>
}

export function LendingWorkspace({ demo, preview = false }: { demo: boolean; preview?: boolean }) {
  const [localRole, setRole] = useState<'customer' | 'admin'>('customer')
  const [state, setState] = useState<WorkflowState | null>(null)
  const role = demo ? localRole : state?.role ?? 'customer'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [cert, setCert] = useState('')
  const [cardUid, setCardUid] = useState('')
  const [quote, setQuote] = useState<{ id: string; cap_jpy: number; expires_at: string } | null>(null)
  const retries = useRef(new Map<string, string>())

  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch('/api/lending/workflow', { headers: { 'x-lending-demo-role': role }, signal, cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) throw Error(data.error ?? 'データを取得できません。')
    return data as WorkflowState
  }, [role])
  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal).then(setState).catch(cause => { if (!controller.signal.aborted) setError(cause.message) })
    return () => controller.abort()
  }, [load])

  const send: Send = async body => {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    const signature = JSON.stringify(body)
    const key = retries.current.get(signature) ?? crypto.randomUUID()
    retries.current.set(signature, key)
    try {
      const response = await fetch('/api/lending/workflow', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-lending-demo-role': role },
        body: JSON.stringify(['apply','command'].includes(String(body.type)) ? { ...body, key } : body),
      })
      const data = await response.json()
      if (!response.ok) throw Error(data.error ?? '手続きを完了できません。')
      retries.current.delete(signature)
      if (data.quote) setQuote(data.quote)
      else { setQuote(null); setNotice('手続きを記録しました。') }
      setState(await load())
    } catch (cause) { setError(cause instanceof Error ? cause.message : '通信に失敗しました。') }
    finally { setBusy(false) }
  }

  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!quote) return
    const form = new FormData(event.currentTarget)
    await send({ type: 'apply', quoteId: quote.id, certInput: cert, amountJpy: Number(form.get('amount')), deposit: form.get('deposit') })
  }
  const outstanding = state?.outstandingJpy ?? 0

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const code = new FormData(event.currentTarget).get('code')
    try {
      const response = await fetch('/api/lending/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })
      if (!response.ok) throw Error('テスト接続コードを確認してください。')
      setState(await load())
    } catch (cause) { setError(cause instanceof Error ? cause.message : '接続できません。') }
    finally { setBusy(false) }
  }
  if (preview && !state) return <main className="min-h-screen bg-[#0a1220] px-5 py-16 text-white"><div className="mx-auto max-w-md space-y-6">
    <h1 className="text-2xl font-bold text-amber-200">TCG ROYAL Preview</h1>
    <p className="text-sm leading-7 text-zinc-400">架空データを使った融資アプリのテスト環境です。利用者または管理者のテスト接続コードを入力してください。</p>
    <form onSubmit={connect} className="space-y-4"><label className="block text-sm">テスト接続コード<input name="code" type="password" autoComplete="off" required minLength={16} maxLength={200} className={field} /></label><button disabled={busy} className={button}>テスト環境に接続</button></form>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
  </div></main>

  return <main className="min-h-screen bg-[#0a1220] text-[#f1f4fa]">
    <header className="border-b border-white/10 px-5 py-5"><div className="mx-auto flex max-w-5xl items-center justify-between gap-4"><div><p className="font-bold tracking-[0.18em] text-amber-200">TCG ROYAL</p><p className="mt-1 text-xs text-zinc-400">カード担保融資</p></div><span className="rounded-full border border-white/15 px-3 py-1 text-xs">テスト環境</span></div></header>
    <div className="mx-auto max-w-5xl space-y-7 px-5 py-7 sm:py-10">
      {demo && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/20 bg-amber-200/5 p-4 text-sm"><p>架空の会員・本人確認・価格で業務を検証します。実際の送金は行いません。</p><label>表示する役割<select disabled={busy} className={`${field} ml-2 mt-0 w-auto`} value={role} onChange={e => { setState(null); setQuote(null); setError(''); setNotice(''); setRole(e.target.value as 'customer' | 'admin') }}><option value="customer">利用者</option><option value="admin">管理者</option></select></label></div>}
      <div><h1 className="text-3xl font-bold">{role === 'admin' ? '融資管理' : '申込・契約'}</h1></div>
      {role==='admin'&&<><SupportCaseManager role={role} onChanged={async()=>{setState(await load())}}/><LendingReviewPanel role={role}/></>}
      <section className="grid gap-4 sm:grid-cols-3" aria-label="利用状況">
        {[['借入元本の合計', yen(outstanding)], ['申込・契約', `${state?.loanCount ?? 0}件`], role === 'admin' ? ['入金確認待ち（表示分）', `${state?.loans.filter(l => l.status === 'repayment_pending').length ?? 0}件`] : ['本人確認', state?.identityVerified ? '確認済み（検証用）' : '未完了']].map(([label,value]) => <div key={label} className="rounded-2xl border border-white/10 bg-[#111b2d] p-5"><p className="text-xs text-zinc-400">{label}</p><p className="mt-3 text-2xl font-bold">{value}</p></div>)}
      </section>
      <div aria-live="polite">{error && <p role="alert" className="rounded-xl bg-red-950/50 p-4 text-sm text-red-200">{error}</p>}{notice && <p role="status" className="rounded-xl bg-emerald-950/50 p-4 text-sm text-emerald-200">{notice}</p>}</div>
      {!state && !error && <p role="status">契約情報を読み込んでいます…</p>}
      {role === 'customer' && state && <section className="rounded-2xl border border-white/10 bg-[#111b2d] p-5 sm:p-6">
        <h2 className="text-xl font-bold">新しく申し込む</h2><p className="mt-2 text-sm leading-7 text-zinc-400">ポケモン・ワンピースのPSA10が対象です。概算の確認後、カード到着・検品を経て最終条件を提示します。</p>
        <form onSubmit={apply} className="mt-5"><fieldset disabled={busy} className="space-y-5">
          <label className="block text-sm">カード<select className={field} required value={cardUid} onChange={e => { setCardUid(e.target.value); setQuote(null) }}><option value="">カードを選択</option>{state.cards.map(c => <option key={c.public_uid} value={c.public_uid}>{c.name} / {c.card_number}</option>)}</select></label>
          <div><label htmlFor="psa-cert" className="text-sm">PSA鑑定番号 / QRコードURL</label><input id="psa-cert" className={field} required maxLength={250} value={cert} onChange={e => setCert(e.target.value)} placeholder="鑑定番号、または https://www.psacard.com/cert/..." /><div className="mt-3"><PsaScanner onCert={setCert} /></div></div>
          {!quote ? <button type="button" disabled={!cardUid || busy} onClick={() => void send({ type: 'quote', cardUid })} className={button}>概算額を確認</button> : <div className="space-y-4 rounded-xl bg-black/20 p-4">
            <p className="text-sm text-zinc-400">借入可能額の目安</p><p className="text-3xl font-bold text-amber-200">{yen(quote.cap_jpy)}</p><p className="text-xs text-zinc-400">有効期限 {date(quote.expires_at)} / 最終査定前</p>
            <label className="block text-sm">借入希望額（円）<input name="amount" type="number" min={100000} max={quote.cap_jpy} step={10000} defaultValue={Math.min(300000,Math.floor(quote.cap_jpy / 10000)*10000)} required className={field} /></label>
            <label className="block text-sm">預入方法<select name="deposit" className={field}><option value="mail">郵送</option><option value="store">店頭持込</option></select></label>
            <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" required className="mt-1" />概算は融資承認ではなく、現物検品後の条件に改めて同意することを確認しました</label>
            <button type="submit" className={button}>この内容で申し込む</button>
          </div>}
        </fieldset></form>
      </section>}
      <section className="space-y-4"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">{role === 'admin' ? '申込・契約一覧' : 'ご利用中の申込・契約'}</h2><button disabled={busy} className="text-sm text-amber-200 underline" onClick={() => { void load().then(setState).catch(cause => setError(cause.message)) }}>一覧を更新</button></div>
        {state && state.loanCount > state.loans.length && <p className="text-xs text-zinc-400">新しい順に50件を表示しています。元本の合計と件数は全契約の集計です。</p>}
        {state?.loans.length === 0 && <p className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-zinc-400">まだ申込はありません。</p>}
        <div className="grid items-start gap-5 lg:grid-cols-2">{state?.loans.map(loan => <LoanCard key={loan.id} loan={loan} admin={state.role === 'admin'} send={send} busy={busy} />)}</div>
      </section>
      <footer className="border-t border-white/10 py-5 text-xs leading-6 text-zinc-500">テスト環境です。実際の送金・契約書交付は行いません。{state?.marketFixture && '表示する市場価格は固定のテストデータです。'}</footer>
    </div>
  </main>
}
