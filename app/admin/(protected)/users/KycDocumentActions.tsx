'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export function KycDocumentActions({ documentId }: { documentId: string }) {
  const router = useRouter()
  const [viewPending, startViewTransition] = useTransition()
  const [deletePending, startDeleteTransition] = useTransition()
  const [error, setError] = useState<string>()

  const handleView = () => {
    setError(undefined)
    startViewTransition(async () => {
      const res = await fetch(`/api/admin/kyc/${documentId}`, {
        method: 'GET',
      })
      const data = (await res.json()) as { url?: string; error?: string }

      if (!res.ok || !data.url) {
        setError(data.error ?? '取得に失敗しました')
        return
      }

      // signed URL はブラウザで開くのみ。保存しない。
      window.open(data.url, '_blank', 'noopener,noreferrer')
    })
  }

  const handleDelete = () => {
    if (
      !window.confirm(
        '本人確認書類を削除しますか？\nこの操作は取り消せません。原本ファイルがストレージから完全に削除されます。'
      )
    )
      return

    setError(undefined)
    startDeleteTransition(async () => {
      const res = await fetch(`/api/admin/kyc/${documentId}`, {
        method: 'DELETE',
      })
      const data = (await res.json()) as { success?: boolean; error?: string }

      if (!res.ok) {
        setError(data.error ?? '削除に失敗しました')
        return
      }

      router.refresh()
    })
  }

  const isPending = viewPending || deletePending

  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={handleView}
          disabled={isPending}
          className="h-7 rounded border border-yellow-700 px-2.5 text-[11px] font-black text-yellow-500 transition-colors hover:bg-yellow-900/20 disabled:opacity-50"
        >
          {viewPending ? '取得中...' : '書類を確認'}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="h-7 rounded border border-red-800 px-2.5 text-[11px] font-black text-red-500 transition-colors hover:bg-red-900/20 disabled:opacity-50"
        >
          {deletePending ? '削除中...' : '原本削除'}
        </button>
      </div>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  )
}
