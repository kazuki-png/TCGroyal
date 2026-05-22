'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveOrderAssessment, setOrderStatus } from './actions'
import {
  EMAIL_TRIGGER_STATUSES,
  ORDER_STATUS_LABELS,
  canEditOrderAssessment,
  type OrderStatus,
} from '@/lib/types'

type Decision = 'approved' | 'cancelled'

export type AssessmentEditorItem = {
  id: string
  card_name: string
  item_type?: 'card' | 'unlisted'
  grade: string
  quantity: number
  unit_price: number
  assessed_unit_price?: number | null
  customer_decision?: Decision | null
  customer_decided_at?: string | null
  requested_note?: string | null
}

function currency(value: number) {
  return `¥${value.toLocaleString('ja-JP')}`
}

function normalizePriceInput(value: string) {
  const numeric = Number(value.replace(/[^\d]/g, ''))
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(99_999_999, Math.floor(numeric)))
}

function decisionLabel(decision?: Decision | null) {
  if (decision === 'approved') return '承認'
  if (decision === 'cancelled') return 'キャンセル'
  return '未回答'
}

function decisionClass(decision?: Decision | null) {
  if (decision === 'approved') return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
  if (decision === 'cancelled') return 'border-red-500/40 bg-red-500/15 text-red-200'
  return 'border-zinc-700 bg-zinc-950 text-zinc-400'
}

const STATUS_ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  accepted: '申込内容を確認して受付済みへ',
  waiting_arrival: '受付を完了して到着待ちへ',
  inspecting: '到着を確認したので査定中へ',
  pending_transfer: '振込待ちへ進める',
  completed: '振込完了にする',
}

const STATUS_HELPER_TEXT: Partial<Record<OrderStatus, string>> = {
  inspecting:
    '査定中です。当社査定額を入力して保存すると、お客様対応待ちへ移動します。',
  pending_approval: 'お客様の承認またはキャンセル回答を待っています。',
  completed: 'この注文は完了しています。',
}

function StopIcon({ tooltip }: { tooltip: string }) {
  return (
    <div className="group relative inline-block">
      <span
        className="cursor-help select-none text-base leading-none text-zinc-500"
        aria-label={tooltip}
      >
        ⊘
      </span>
      <div className="pointer-events-none absolute bottom-full right-0 z-20 mb-1.5 hidden whitespace-nowrap rounded-md bg-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-200 shadow-lg group-hover:block">
        {tooltip}
      </div>
    </div>
  )
}

export function AssessmentEditor({
  orderId,
  status,
  assessmentSavedAt,
  items,
  nextStatuses = [],
  previousStatuses = [],
}: {
  orderId: string
  status: OrderStatus
  assessmentSavedAt?: string | null
  items: AssessmentEditorItem[]
  nextStatuses?: OrderStatus[]
  previousStatuses?: OrderStatus[]
}) {
  const router = useRouter()
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      items.map((item) => [
        item.id,
        String(item.assessed_unit_price ?? item.unit_price),
      ])
    )
  )
  const [error, setError] = useState<string>()
  const [success, setSuccess] = useState<string>()
  const [pending, startTransition] = useTransition()
  const editable = canEditOrderAssessment(status, assessmentSavedAt)
  const needsAssessmentRepair = status === 'pending_approval' && !assessmentSavedAt

  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | ''>(
    nextStatuses[0] ?? ''
  )
  const [rollbackSelected, setRollbackSelected] = useState<OrderStatus | ''>(
    previousStatuses[previousStatuses.length - 1] ?? ''
  )
  const [rollbackReason, setRollbackReason] = useState('')

  const rows = useMemo(
    () =>
      items.map((item) => {
        const assessedUnitPrice = normalizePriceInput(prices[item.id] ?? '0')
        return {
          ...item,
          assessedUnitPrice,
          assessedSubtotal: assessedUnitPrice * item.quantity,
          isReduced: assessedUnitPrice < item.unit_price,
        }
      }),
    [items, prices]
  )
  const assessedTotal = rows.reduce(
    (sum, item) => sum + item.assessedSubtotal,
    0
  )
  const originalTotal = items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  )

  const handleSaveAssessment = (event: React.FormEvent) => {
    event.preventDefault()
    setError(undefined)
    setSuccess(undefined)

    if (!editable) {
      setError('査定額を変更できるのは査定中の注文のみです')
      return
    }

    startTransition(async () => {
      const result = await saveOrderAssessment(
        orderId,
        rows.map((item) => ({
          itemId: item.id,
          assessedUnitPrice: item.assessedUnitPrice,
        }))
      )

      if (result?.error) {
        setError(result.error)
        return
      }

      setSuccess('査定額を保存しました')
      router.refresh()
    })
  }

  const handleStatusUpdate = (event: React.FormEvent) => {
    event.preventDefault()
    setError(undefined)
    setSuccess(undefined)

    if (!selectedStatus) {
      setError('変更先ステータスを選択してください')
      return
    }

    startTransition(async () => {
      const result = await setOrderStatus(orderId, selectedStatus)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccess('ステータスを更新しました')
        router.refresh()
      }
    })
  }

  const handleRollback = (event: React.FormEvent) => {
    event.preventDefault()
    setError(undefined)
    setSuccess(undefined)

    if (!rollbackSelected) {
      setError('戻し先ステータスを選択してください')
      return
    }

    const reason = rollbackReason.trim()
    if (!reason) {
      setError('ステータスを戻す理由を入力してください')
      return
    }

    if (!window.confirm('本当にステータスを戻しますか？')) return

    startTransition(async () => {
      const result = await setOrderStatus(orderId, rollbackSelected, reason)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccess('ステータスを戻しました')
        setRollbackReason('')
        router.refresh()
      }
    })
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">申込カードと当社査定額</h2>
          <p className="mt-1 text-sm text-zinc-400">
            {needsAssessmentRepair
              ? 'お客様対応待ちですが査定額が未保存です。ここで査定額を保存するとユーザー確認へ進められます。'
              : editable
              ? '保存すると注文はお客様対応待ちへ移動し、ユーザーが商品ごとに承認またはキャンセルを選択できます。'
              : '査定結果を確認し、次のステータスへ進めてください。'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right text-sm">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
            <p className="text-xs text-zinc-500">申込時合計</p>
            <p className="font-black text-zinc-200">{currency(originalTotal)}</p>
          </div>
          <div className="rounded-xl border border-[#c9a52e]/40 bg-[#c9a52e]/10 px-3 py-2">
            <p className="text-xs text-[#d7b865]">査定合計</p>
            <p className="font-black text-[#f6f0dc]">{currency(assessedTotal)}</p>
          </div>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-950/50 px-4 py-3 text-sm font-bold text-red-300">
          {error}
        </p>
      )}
      {success && (
        <p className="mb-4 rounded-lg bg-emerald-950/50 px-4 py-3 text-sm font-bold text-emerald-300">
          {success}
        </p>
      )}

      <form onSubmit={handleSaveAssessment} className="space-y-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="border-b border-zinc-700 text-left text-sm text-zinc-400">
                <th className="pb-2 font-medium">カード名</th>
                <th className="pb-2 font-medium">グレード</th>
                <th className="pb-2 text-right font-medium">数量</th>
                <th className="pb-2 text-right font-medium">申込時単価</th>
                <th className="pb-2 text-right font-medium">当社査定額</th>
                <th className="pb-2 text-right font-medium">査定小計</th>
                <th className="pb-2 text-center font-medium">減額</th>
                <th className="pb-2 text-center font-medium">ユーザー回答</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} className="border-b border-zinc-800 align-top">
                  <td className="py-3 pr-3 text-sm text-white">
                    <span className="font-bold">{item.card_name}</span>
                    {item.item_type === 'unlisted' && item.requested_note && (
                      <span className="mt-1 block text-xs text-zinc-500">
                        {item.requested_note}
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-sm text-zinc-400">{item.grade}</td>
                  <td className="py-3 pr-3 text-right text-sm text-white">
                    {item.quantity}枚
                  </td>
                  <td className="py-3 pr-3 text-right text-sm text-white">
                    {currency(item.unit_price)}
                  </td>
                  <td className="py-3 pr-3 text-right">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <input
                        inputMode="numeric"
                        value={prices[item.id] ?? ''}
                        disabled={!editable || pending}
                        onChange={(event) =>
                          setPrices((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                        className="h-10 w-32 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-right text-sm font-black text-white outline-none focus:border-[#c9a52e] disabled:cursor-not-allowed disabled:bg-zinc-900 disabled:text-zinc-500"
                      />
                      {!editable && (
                        <StopIcon tooltip="査定中のみ変更できます" />
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-right text-sm font-black text-[#f6f0dc]">
                    {currency(item.assessedSubtotal)}
                  </td>
                  <td className="py-3 pr-3 text-center">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${
                        item.isReduced
                          ? 'bg-red-500/15 text-red-300'
                          : 'bg-emerald-500/15 text-emerald-300'
                      }`}
                    >
                      {item.isReduced ? '減額あり' : '減額なし'}
                    </span>
                  </td>
                  <td className="py-3 text-center">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${decisionClass(item.customer_decision)}`}
                    >
                      {decisionLabel(item.customer_decision)}
                    </span>
                    {item.customer_decided_at && (
                      <span className="mt-1 block text-[11px] text-zinc-500">
                        {new Date(item.customer_decided_at).toLocaleString('ja-JP')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 査定保存ボタン（査定中のみ） */}
        {editable && (
          <div className="flex justify-end border-t border-zinc-800 pt-5">
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-red-500 disabled:opacity-50"
            >
              {pending ? '保存中...' : '査定額を保存してお客様対応待ちへ'}
            </button>
          </div>
        )}
      </form>

      {/* ステータス遷移（査定中以外） */}
      {!editable && (
        <div className="mt-5 space-y-5 border-t border-zinc-800 pt-5">
          {nextStatuses.length > 0 ? (
            <form onSubmit={handleStatusUpdate} className="space-y-3">
              <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                    次のアクション
                  </p>
                  <h3 className="mt-1 text-sm font-black text-white">
                    現在: {ORDER_STATUS_LABELS[status]}
                  </h3>
                  <p className="mt-1 text-xs font-semibold text-zinc-400">
                    次の状態へ進めます。
                  </p>
                </div>
                {nextStatuses.length === 1 ? (
                  <input type="hidden" name="nextStatus" value={selectedStatus} />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {nextStatuses.map((s) => (
                      <label
                        key={s}
                        className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${
                          selectedStatus === s
                            ? 'border-red-500 bg-zinc-800'
                            : 'border-zinc-700 hover:border-zinc-500'
                        }`}
                      >
                        <input
                          type="radio"
                          name="nextStatus"
                          value={s}
                          checked={selectedStatus === s}
                          onChange={() => setSelectedStatus(s)}
                          className="accent-red-600"
                        />
                        <span className="text-xs font-black text-white">
                          {ORDER_STATUS_LABELS[s]}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {selectedStatus && EMAIL_TRIGGER_STATUSES.includes(selectedStatus) && (
                <p className="text-xs font-semibold text-zinc-400">メール送信あり</p>
              )}
              <button
                type="submit"
                disabled={pending || !selectedStatus}
                className="w-full rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {pending
                  ? '更新中...'
                  : selectedStatus
                    ? (STATUS_ACTION_LABELS[selectedStatus] ?? 'ステータスを更新')
                    : 'ステータスを更新'}
              </button>
            </form>
          ) : (
            <p className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-500">
              {STATUS_HELPER_TEXT[status] ?? 'このステータスで実行できる次アクションはありません。'}
            </p>
          )}

          {previousStatuses.length > 0 && (
            <form
              onSubmit={handleRollback}
              className="space-y-3 border-t border-zinc-800 pt-5"
            >
              <h3 className="text-sm font-black text-white">ステータスを戻す</h3>
              <select
                value={rollbackSelected}
                onChange={(event) =>
                  setRollbackSelected(event.target.value as OrderStatus)
                }
                className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm font-black text-white outline-none"
              >
                {previousStatuses.map((s) => (
                  <option key={s} value={s}>
                    {ORDER_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <textarea
                value={rollbackReason}
                onChange={(event) => setRollbackReason(event.target.value)}
                placeholder="戻し理由を入力"
                className="min-h-24 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500"
              />
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-lg border border-red-700 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-950/40 disabled:opacity-50"
              >
                {pending ? '更新中...' : '理由を記録して戻す'}
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  )
}
