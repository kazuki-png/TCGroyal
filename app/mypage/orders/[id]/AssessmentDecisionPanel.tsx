'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { submitAssessmentDecision } from './actions'
import type { OrderStatus } from '@/lib/types'
import type { OrderItemRow } from '../orderDisplay'

type Decision = 'approved' | 'cancelled'

function currency(value: number) {
  return `¥${value.toLocaleString('ja-JP')}`
}

function decisionLabel(decision?: Decision | null | '') {
  if (decision === 'approved') return '承認'
  if (decision === 'cancelled') return 'キャンセル'
  return '未選択'
}

function decisionBadgeClass(decision?: Decision | null | '') {
  if (decision === 'approved') return 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200'
  if (decision === 'cancelled') return 'border-red-400/40 bg-red-400/15 text-red-200'
  return 'border-zinc-700 bg-zinc-950 text-zinc-400'
}

function reductionBadgeClass(isReduced: boolean) {
  return isReduced
    ? 'bg-red-500/15 text-red-300'
    : 'bg-emerald-500/15 text-emerald-300'
}

function DecisionButtons({
  value,
  onChange,
  disabled,
}: {
  value: Decision | ''
  onChange: (value: Decision) => void
  disabled?: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(['approved', 'cancelled'] as const).map((decision) => {
        const active = value === decision
        return (
          <button
            key={decision}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(decision)}
            className={[
              'rounded-xl border px-3 py-2 text-xs font-black transition-colors disabled:cursor-not-allowed disabled:opacity-60',
              active && decision === 'approved'
                ? 'border-emerald-400 bg-emerald-400 text-[#06160c]'
                : '',
              active && decision === 'cancelled'
                ? 'border-red-400 bg-red-500 text-white'
                : '',
              !active
                ? 'border-[#3a3528] bg-[#0f0e0b] text-[#8f8369] hover:border-[#c9a52e]/60 hover:text-[#f6f0dc]'
                : '',
            ].join(' ')}
          >
            {decisionLabel(decision)}
          </button>
        )
      })}
    </div>
  )
}

export function AssessmentDecisionPanel({
  orderId,
  status,
  assessmentReady,
  items,
}: {
  orderId: string
  status: OrderStatus
  assessmentReady: boolean
  items: OrderItemRow[]
}) {
  const router = useRouter()
  const canRespond = assessmentReady && status === 'pending_approval'
  const [decisions, setDecisions] = useState<Record<string, Decision | ''>>(() =>
    Object.fromEntries(
      items.map((item) => [item.id, item.customer_decision ?? ''])
    )
  )
  const [error, setError] = useState<string>()
  const [success, setSuccess] = useState(false)
  const [pending, startTransition] = useTransition()

  const rows = useMemo(
    () =>
      items.map((item) => {
        const assessedUnitPrice = item.assessed_unit_price ?? item.unit_price
        const decision = decisions[item.id] ?? item.customer_decision ?? ''
        return {
          ...item,
          assessedUnitPrice,
          assessedSubtotal: assessedUnitPrice * item.quantity,
          isReduced: assessedUnitPrice < item.unit_price,
          decision,
        }
      }),
    [decisions, items]
  )
  const allSelected = rows.every((item) => item.decision)
  const acceptedTotal = rows.reduce((sum, item) => {
    if (item.decision !== 'approved') return sum
    return sum + item.assessedSubtotal
  }, 0)
  const displayTotal = canRespond
    ? acceptedTotal
    : rows.reduce((sum, item) => {
        if (item.customer_decision === 'cancelled') return sum
        return sum + item.assessedSubtotal
      }, 0)
  const submittedTotal = rows.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  )

  const choose = (itemId: string, decision: Decision) => {
    setDecisions((current) => ({
      ...current,
      [itemId]: decision,
    }))
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(undefined)
    setSuccess(false)

    if (!allSelected) {
      setError('すべての商品について承認またはキャンセルを選択してください')
      return
    }

    startTransition(async () => {
      const result = await submitAssessmentDecision(
        orderId,
        rows.map((item) => ({
          itemId: item.id,
          decision: item.decision as Decision,
        }))
      )

      if (result?.error) {
        setError(result.error)
        return
      }

      setSuccess(true)
      router.refresh()
    })
  }

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#2d2a20] bg-[#15130f]">
      <div className="border-b border-[#2d2a20] px-5 py-4">
        <h2 className="text-lg font-black text-[#f6f0dc]">
          申し込んだカードの内訳
        </h2>
        {canRespond && (
          <p className="mt-1 text-sm font-semibold text-[#8f8369]">
            当社査定額を確認し、商品ごとに承認またはキャンセルを選択してください。
          </p>
        )}
        {!assessmentReady && (
          <p className="mt-1 text-sm font-semibold text-[#8f8369]">
            当社査定額は査定完了後に表示されます。現在は査定待ちです。
          </p>
        )}
      </div>

      {error && (
        <p className="mx-5 mt-4 rounded-xl bg-red-950/50 px-4 py-3 text-sm font-bold text-red-300">
          {error}
        </p>
      )}
      {success && (
        <p className="mx-5 mt-4 rounded-xl bg-emerald-950/50 px-4 py-3 text-sm font-bold text-emerald-300">
          査定結果を確定しました
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:hidden">
          {rows.map((item) => (
            <article
              key={item.id}
              className="rounded-[18px] border border-[#2d2a20] bg-[#0f0e0b] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-[#f6f0dc]">
                    {item.card_name}
                  </h3>
                  <p className="mt-1 text-xs font-semibold text-[#8f8369]">
                    {item.grade} / {item.quantity}点
                  </p>
                </div>
                {assessmentReady ? (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black ${reductionBadgeClass(item.isReduced)}`}
                  >
                    {item.isReduced ? '減額あり' : '減額なし'}
                  </span>
                ) : (
                  <span className="rounded-full bg-[#2d2a20] px-3 py-1 text-xs font-black text-[#c9a52e]">
                    査定待ち
                  </span>
                )}
              </div>
              {item.item_type === 'unlisted' && item.requested_note && (
                <p className="mt-3 text-xs font-semibold text-[#8f8369]">
                  {item.requested_note}
                </p>
              )}
              <dl className="mt-4 grid grid-cols-1 gap-3 text-xs min-[390px]:grid-cols-3">
                <div>
                  <dt className="text-[#8f8369]">申込時単価</dt>
                  <dd className="mt-1 break-words font-black text-[#ede8d5] [overflow-wrap:anywhere]">
                    {currency(item.unit_price)}
                  </dd>
                </div>
                {assessmentReady ? (
                  <>
                    <div>
                      <dt className="text-[#8f8369]">当社査定額</dt>
                      <dd className="mt-1 break-words font-black text-[#f6f0dc] [overflow-wrap:anywhere]">
                        {currency(item.assessedUnitPrice)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#8f8369]">小計</dt>
                      <dd className="mt-1 break-words font-black text-red-300 [overflow-wrap:anywhere]">
                        {currency(item.assessedSubtotal)}
                      </dd>
                    </div>
                  </>
                ) : (
                  <div className="col-span-2">
                    <dt className="text-[#8f8369]">状態</dt>
                    <dd className="mt-1 font-black text-[#c9a52e]">
                      査定待ち
                    </dd>
                  </div>
                )}
              </dl>
              {assessmentReady && (
                <div className="mt-4">
                  {canRespond ? (
                    <DecisionButtons
                      value={item.decision as Decision | ''}
                      onChange={(decision) => choose(item.id, decision)}
                      disabled={pending}
                    />
                  ) : (
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${decisionBadgeClass(item.customer_decision)}`}
                    >
                      {decisionLabel(item.customer_decision)}
                    </span>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>

        <div className="hidden overflow-x-auto xl:block">
          <table className="w-full min-w-[980px] text-sm text-[#ede8d5]">
            <thead className="bg-[#0f0e0b] text-left text-xs font-black uppercase tracking-[0.14em] text-[#c9a52e]">
              {assessmentReady ? (
                <tr>
                  <th className="px-5 py-3">カード名</th>
                  <th className="px-5 py-3">グレード</th>
                  <th className="px-5 py-3 text-right">数量</th>
                  <th className="px-5 py-3 text-right">申込時単価</th>
                  <th className="px-5 py-3 text-right">当社査定額</th>
                  <th className="px-5 py-3 text-right">小計</th>
                  <th className="px-5 py-3 text-center">減額</th>
                  <th className="px-5 py-3 text-center">回答</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-5 py-3">カード名</th>
                  <th className="px-5 py-3">グレード</th>
                  <th className="px-5 py-3 text-right">数量</th>
                  <th className="px-5 py-3 text-right">申込時単価</th>
                  <th className="px-5 py-3 text-right">申込時小計</th>
                  <th className="px-5 py-3 text-center">状態</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-[#2d2a20]">
              {rows.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="px-5 py-4 font-black leading-tight text-[#f6f0dc]">
                    {item.card_name}
                    {item.item_type === 'unlisted' && item.requested_note && (
                      <span className="mt-1 block text-xs font-semibold text-[#8f8369]">
                        {item.requested_note}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 font-semibold text-[#8f8369]">
                    {item.grade}
                  </td>
                  <td className="px-5 py-4 text-right font-black text-[#f6f0dc]">
                    {item.quantity}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-[#ede8d5]">
                    {currency(item.unit_price)}
                  </td>
                  {assessmentReady ? (
                    <>
                      <td className="whitespace-nowrap px-5 py-4 text-right font-black text-[#f6f0dc]">
                        {currency(item.assessedUnitPrice)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right font-black text-red-300">
                        {currency(item.assessedSubtotal)}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${reductionBadgeClass(item.isReduced)}`}
                        >
                          {item.isReduced ? '減額あり' : '減額なし'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        {canRespond ? (
                          <DecisionButtons
                            value={item.decision as Decision | ''}
                            onChange={(decision) => choose(item.id, decision)}
                            disabled={pending}
                          />
                        ) : (
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${decisionBadgeClass(item.customer_decision)}`}
                          >
                            {decisionLabel(item.customer_decision)}
                          </span>
                        )}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="whitespace-nowrap px-5 py-4 text-right font-black text-red-300">
                        {currency(item.unit_price * item.quantity)}
                      </td>
                      <td className="px-5 py-4 text-center">
                      <span
                        className="inline-flex rounded-full border border-[#c9a52e]/30 bg-[#c9a52e]/10 px-3 py-1 text-xs font-black text-[#c9a52e]"
                      >
                        査定待ち
                      </span>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-[#2d2a20] bg-[#0f0e0b] px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold text-[#8f8369]">
                {!assessmentReady
                  ? '申込時合計'
                  : canRespond
                    ? '承認予定額'
                    : '確定金額'}
              </p>
              <p className="mt-1 text-xl font-black text-red-300">
                {currency(assessmentReady ? displayTotal : submittedTotal)}
              </p>
            </div>
            {canRespond && (
              <button
                type="submit"
                disabled={pending || !allSelected}
                className="rounded-xl bg-[#c9a52e] px-6 py-3 text-sm font-black text-[#0e0c09] transition-colors hover:bg-[#d7b865] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? '確定中...' : '確定する'}
              </button>
            )}
          </div>
        </div>
      </form>
    </section>
  )
}
