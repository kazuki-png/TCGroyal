'use client'

import type { MouseEvent } from 'react'

export function DeleteBannerButton({
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
      className="rounded-lg border border-red-800 px-5 py-2 text-sm font-semibold text-red-200 hover:bg-red-950"
    >
      削除
    </button>
  )
}
