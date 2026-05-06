'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export function UpdatePasswordForm() {
  const router = useRouter()
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const password = formData.get('password') as string
    const passwordConfirm = formData.get('password_confirm') as string

    if (password.length < 8) {
      setError('パスワードは8文字以上で入力してください')
      return
    }
    if (password !== passwordConfirm) {
      setError('パスワードが一致しません')
      return
    }

    setError(undefined)
    startTransition(async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setError('パスワードの更新に失敗しました。リセットメールから再度お試しください')
        return
      }
      router.push('/login')
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-zinc-700 bg-zinc-800 p-8">
      {error && (
        <p className="mb-4 rounded-lg border border-red-800 bg-red-900/40 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="mb-4">
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-zinc-300">
          新しいパスワード（8文字以上）
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          className="w-full rounded-lg border border-zinc-600 bg-zinc-700 px-4 py-2.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
        />
      </div>

      <div className="mb-6">
        <label htmlFor="password_confirm" className="mb-1.5 block text-sm font-medium text-zinc-300">
          新しいパスワード（確認）
        </label>
        <input
          id="password_confirm"
          name="password_confirm"
          type="password"
          required
          autoComplete="new-password"
          className="w-full rounded-lg border border-zinc-600 bg-zinc-700 px-4 py-2.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-[#c9a52e] py-2.5 text-sm font-black text-[#0e0c09] shadow-[0_14px_40px_rgba(201,165,46,0.18)] transition-colors hover:bg-[#d7b865] disabled:opacity-50"
      >
        {pending ? '更新中...' : 'パスワードを更新'}
      </button>
    </form>
  )
}
