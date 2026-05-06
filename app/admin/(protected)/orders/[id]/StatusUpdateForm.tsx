'use client'

import { useState, useTransition } from 'react'
import { updateOrderStatus } from '@/app/actions/orders'
import { ORDER_STATUS_LABELS, EMAIL_TRIGGER_STATUSES } from '@/lib/types'
import type { OrderStatus } from '@/lib/types'

export function StatusUpdateForm({
  orderId,
  nextStatuses,
  previousStatuses,
}: {
  orderId: string
  nextStatuses: OrderStatus[]
  previousStatuses: OrderStatus[]
}) {
  const [selected, setSelected] = useState<OrderStatus | ''>(nextStatuses[0] ?? '')
  const [rollbackSelected, setRollbackSelected] = useState<OrderStatus | ''>(
    previousStatuses[previousStatuses.length - 1] ?? ''
  )
  const [rollbackReason, setRollbackReason] = useState('')
  const [error, setError] = useState<string>()
  const [success, setSuccess] = useState(false)
  const [pending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(undefined)
    setSuccess(false)
    if (!selected) {
      setError('変更先ステータスを選択してください')
      return
    }
    startTransition(async () => {
      const res = await updateOrderStatus(orderId, selected)
      if (res?.error) {
        setError(res.error)
      } else {
        setSuccess(true)
      }
    })
  }

  const handleRollbackSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(undefined)
    setSuccess(false)

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
      const res = await updateOrderStatus(orderId, rollbackSelected, reason)
      if (res?.error) {
        setError(res.error)
      } else {
        setSuccess(true)
        setRollbackReason('')
      }
    })
  }

  return (
    <div className="space-y-5">
      {error && (
        <p className="rounded-lg bg-red-900/40 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg bg-green-900/40 px-4 py-3 text-sm text-green-400">
          ステータスを更新しました
        </p>
      )}

      {nextStatuses.length > 0 && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            {nextStatuses.map((s) => (
              <label
                key={s}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                  selected === s
                    ? 'border-red-500 bg-zinc-800'
                    : 'border-zinc-700 hover:border-zinc-500'
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value={s}
                  checked={selected === s}
                  onChange={() => setSelected(s)}
                  className="accent-red-600"
                />
                <div>
                  <p className="text-sm font-medium text-white">
                    {ORDER_STATUS_LABELS[s]}
                  </p>
                  {EMAIL_TRIGGER_STATUSES.includes(s) && (
                    <p className="text-xs text-zinc-400">メール送信あり</p>
                  )}
                </div>
              </label>
            ))}
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
          >
            {pending ? '更新中...' : 'ステータスを更新'}
          </button>
        </form>
      )}

      {previousStatuses.length > 0 && (
        <form
          onSubmit={handleRollbackSubmit}
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
            {previousStatuses.map((status) => (
              <option key={status} value={status}>
                {ORDER_STATUS_LABELS[status]}
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
  )
}
