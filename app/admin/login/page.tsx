'use client'

import { useActionState } from 'react'
import { adminLogin } from '@/app/actions/auth'

export default function AdminLoginPage() {
  const [state, action, pending] = useActionState(adminLogin, undefined)

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-900 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="text-2xl font-bold tracking-tight text-white">
            TCG Royal
          </span>
          <p className="mt-2 text-zinc-400">管理者ログイン</p>
        </div>

        <form
          action={action}
          className="rounded-2xl bg-zinc-800 p-8 border border-zinc-700"
        >
          {state?.error && (
            <p className="mb-4 rounded-lg bg-red-900/40 px-4 py-3 text-sm text-red-400">
              {state.error}
            </p>
          )}

          <div className="mb-4">
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-300">
              メールアドレス
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-zinc-600 bg-zinc-700 px-4 py-2.5 text-sm text-white outline-none focus:border-zinc-400 placeholder:text-zinc-500"
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-zinc-300">
              パスワード
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-zinc-600 bg-zinc-700 px-4 py-2.5 text-sm text-white outline-none focus:border-zinc-400"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-white py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 disabled:opacity-50"
          >
            {pending ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  )
}
