'use client'

import { useTransition } from 'react'
import { logout } from '@/app/actions/auth'

export function LogoutButton() {
  const [pending, startTransition] = useTransition()

  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => logout())}
      className="text-sm font-semibold text-[#8f8369] transition-colors hover:text-[#d7b865] disabled:opacity-50"
    >
      ログアウト
    </button>
  )
}
