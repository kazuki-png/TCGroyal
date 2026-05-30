'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cancelOrder } from './actions'

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const [success, setSuccess] = useState(false)

  const handleCancel = () => {
    setError(undefined)
    setSuccess(false)

    if (!window.confirm('この買取申し込みをキャンセルしますか？')) {
      return
    }

    startTransition(async () => {
      const result = await cancelOrder(orderId)
      if (result?.error) {
        setError(result.error)
        return
      }

      setSuccess(true)
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleCancel}
        disabled={pending}
        className="w-full rounded-xl border border-red-400/40 bg-red-500/15 px-4 py-3 text-sm font-black text-red-200 transition-colors hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {pending ? 'キャンセル処理中...' : '申し込みをキャンセルする'}
      </button>
      {error && (
        <p className="text-sm font-bold text-red-300" aria-live="polite">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm font-bold text-emerald-300" aria-live="polite">
          キャンセルを受け付けました
        </p>
      )}
    </div>
  )
}
