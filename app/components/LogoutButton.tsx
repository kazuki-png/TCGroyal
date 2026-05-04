'use client'

import { useTransition } from 'react'
import { logout } from '@/app/actions/auth'

export function LogoutButton() {
  const [pending, startTransition] = useTransition()

  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => logout())}
      className="text-sm text-zinc-500 hover:text-zinc-900 disabled:opacity-50"
    >
      ログアウト
    </button>
  )
}
