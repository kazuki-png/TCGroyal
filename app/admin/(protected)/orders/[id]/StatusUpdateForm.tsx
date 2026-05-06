'use client'

import { useState, useTransition } from 'react'
import { updateOrderStatus } from '@/app/actions/orders'
import { ORDER_STATUS_LABELS, EMAIL_TRIGGER_STATUSES } from '@/lib/types'
import type { OrderStatus } from '@/lib/types'

export function StatusUpdateForm({
  orderId,
  nextStatuses,
}: {
  orderId: string
  nextStatuses: OrderStatus[]
}) {
  const [selected, setSelected] = useState<OrderStatus>(nextStatuses[0])
  const [error, setError] = useState<string>()
  const [success, setSuccess] = useState(false)
  const [pending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(undefined)
    setSuccess(false)
    startTransition(async () => {
      const res = await updateOrderStatus(orderId, selected)
      if (res?.error) {
        setError(res.error)
      } else {
        setSuccess(true)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
  )
}
