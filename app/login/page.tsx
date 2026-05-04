'use client'

import { Suspense, useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { loginAction } from './actions'

function RegisteredBanner() {
  const searchParams = useSearchParams()
  if (searchParams.get('registered') !== '1') return null
  return (
    <p className="mb-4 rounded-lg bg-green-900/40 border border-green-800 px-4 py-3 text-sm text-green-400">
      登録が完了しました。ログインしてください。
    </p>
  )
}

function ErrorBanner() {
  const searchParams = useSearchParams()
  if (searchParams.get('error') !== 'auth_callback_failed') return null
  return (
    <p className="mb-4 rounded-lg bg-red-900/40 border border-red-800 px-4 py-3 text-sm text-red-400">
      認証に失敗しました。もう一度お試しください。
    </p>
  )
}

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, undefined)

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="text-2xl font-bold tracking-tight text-white hover:text-zinc-300 transition-colors">
            TCG Royal
          </Link>
          <p className="mt-2 text-zinc-400">アカウントにログイン</p>
        </div>

        <form action={action} className="rounded-2xl bg-zinc-800 border border-zinc-700 p-8">
          <Suspense>
            <RegisteredBanner />
            <ErrorBanner />
          </Suspense>

          {state?.error && (
            <p className="mb-4 rounded-lg bg-red-900/40 border border-red-800 px-4 py-3 text-sm text-red-400">
              {state.error}
            </p>
          )}

          <div className="mb-4">
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-zinc-300">
              メールアドレス
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-zinc-600 bg-zinc-700 px-4 py-2.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
            />
          </div>

          <div className="mb-2">
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-zinc-300">
              パスワード
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-zinc-600 bg-zinc-700 px-4 py-2.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
            />
          </div>

          <div className="mb-6 text-right">
            <Link href="/forgot-password" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              パスワードをお忘れの方
            </Link>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 disabled:opacity-50"
          >
            {pending ? 'ログイン中...' : 'ログイン'}
          </button>

          <p className="mt-4 text-center text-sm text-zinc-500">
            アカウントをお持ちでない方は{' '}
            <Link href="/register" className="text-white underline underline-offset-2 hover:text-zinc-200">
              新規登録
            </Link>
          </p>
        </form>

        <p className="mt-8 text-center text-xs text-zinc-600">
          © 2025 TCG Royal
        </p>
      </div>
    </div>
  )
}
