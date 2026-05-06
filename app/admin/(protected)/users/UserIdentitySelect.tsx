'use client'

import { useState, useTransition } from 'react'
import { setIdentityStatus } from './actions'

export function UserIdentitySelect({
  userId,
  verified,
}: {
  userId: string
  verified: boolean
}) {
  const [value, setValue] = useState(verified ? 'verified' : 'unverified')
  const [pending, startTransition] = useTransition()

  return (
    <select
      value={value}
      disabled={pending}
      onChange={(event) => {
        const next = event.target.value
        setValue(next)
        startTransition(async () => {
          const result = await setIdentityStatus(userId, next === 'verified')
          if (result?.error) setValue(value)
        })
      }}
      className="h-9 rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-xs font-black text-white outline-none disabled:opacity-50"
    >
      <option value="unverified">未確認</option>
      <option value="verified">本人確認済み</option>
    </select>
  )
}
