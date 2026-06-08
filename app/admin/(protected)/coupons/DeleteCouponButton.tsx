'use client'

import type { MouseEvent } from 'react'

export function DeleteCouponButton({
  action,
}: {
  action: (formData: FormData) => void | Promise<void>
}) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (!window.confirm('本当に削除しますか？')) {
      event.preventDefault()
    }
  }

  return (
    <button
      type="submit"
      formAction={action}
      onClick={handleClick}
      className="h-10 rounded-lg border border-red-500/60 px-4 text-sm font-black text-red-300 transition-colors hover:bg-red-500/10"
    >
      削除
    </button>
  )
}
