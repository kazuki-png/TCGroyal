'use client'

import { Suspense, useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { SiteHeader } from '@/app/components/SiteHeader'
import { loginAction } from './actions'

function RegisteredBanner() {
  const searchParams = useSearchParams()
  if (searchParams.get('registered') !== '1') return null
  return (
    <p className="mb-5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
      登録が完了しました。ログインしてください。
    </p>
  )
}

function ErrorBanner() {
  const searchParams = useSearchParams()
  if (searchParams.get('error') !== 'auth_callback_failed') return null
  return (
    <p className="mb-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
      認証に失敗しました。もう一度お試しください。
    </p>
  )
}

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, undefined)

  return (
    <div className="flex min-h-screen flex-col bg-white text-zinc-900">
      <SiteHeader
        isAuthenticated={false}
        borderClassName="border-b border-zinc-200"
        priorityLogo
      />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-7 sm:px-6">
        <section className="text-center">
          <h1 className="mb-6 text-[20px] font-black leading-snug">
            TCG ROYALのアカウントを
            <br />
            お持ちの方
          </h1>

          <form action={action} className="text-left">
            <Suspense>
              <RegisteredBanner />
              <ErrorBanner />
            </Suspense>

            {state?.error && (
              <p className="mb-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {state.error}
              </p>
            )}

            <div className="mb-4">
              <label htmlFor="email" className="mb-1.5 block text-lg font-black">
                メールアドレス
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="example@tcg-royal.jp"
                className="h-[38px] w-full rounded-[13px] border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-[#d4c400]/40"
              />
            </div>

            <div className="mb-5">
              <label htmlFor="password" className="mb-1.5 block text-lg font-black">
                パスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="パスワードを入力"
                className="h-[38px] w-full rounded-[13px] border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-[#d4c400]/40"
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="mb-3 h-[38px] w-full rounded-[10px] bg-black text-lg font-black text-[#d4c400] transition-colors hover:bg-zinc-800 disabled:opacity-50"
            >
              {pending ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>

          <Link
            href="/forgot-password"
            className="inline-flex h-[26px] min-w-[260px] items-center justify-center rounded-full border border-zinc-300 bg-zinc-200 px-5 text-sm font-black text-zinc-950 hover:bg-zinc-300"
          >
            パスワードをお忘れですか？
          </Link>

          <div className="my-16 flex items-center gap-2">
            <span className="h-px flex-1 bg-zinc-400" />
            <span className="text-lg font-black">または</span>
            <span className="h-px flex-1 bg-zinc-400" />
          </div>

          <h2 className="mb-5 text-[20px] font-black leading-snug">
            TCG ROYALのアカウントをお
            <br />
            持ちではない方
          </h2>
          <p className="mb-4 text-xs text-zinc-700">
            郵送買取のご利用には登録が必要です。
          </p>
          <Link
            href="/register"
            className="flex h-[38px] w-full items-center justify-center rounded-[13px] border border-zinc-300 bg-white text-lg font-black text-[#c8b900] transition-colors hover:bg-zinc-50"
          >
            新規登録
          </Link>
        </section>
      </main>
    </div>
  )
}
