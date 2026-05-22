'use client'

import { Suspense, useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { SiteFooter } from '@/app/components/SiteFooter'
import { SiteHeader } from '@/app/components/SiteHeader'
import { loginAction } from './actions'

function RegisteredBanner() {
  const searchParams = useSearchParams()
  if (searchParams.get('registered') !== '1') return null
  return (
    <p className="mb-5 rounded-[16px] border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-300">
      登録が完了しました。ログインしてください。
    </p>
  )
}

function ErrorBanner() {
  const searchParams = useSearchParams()
  if (searchParams.get('error') !== 'auth_callback_failed') return null
  return (
    <p className="mb-5 rounded-[16px] border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">
      認証に失敗しました。もう一度お試しください。
    </p>
  )
}

function NextInput() {
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? ''
  if (!next) return null
  return <input type="hidden" name="next" value={next} />
}

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, undefined)

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0a08] text-[#ede8d5]">
      <SiteHeader
        isAuthenticated={false}
        priorityLogo
        breadcrumbs={[
          { href: '/', label: 'トップ' },
          { label: 'ログイン' },
        ]}
      />
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <section className="w-full max-w-md rounded-[28px] border border-[#2d2a20] bg-[#12100c] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-7">
          <p className="text-center text-xs font-black uppercase tracking-[0.22em] text-[#c9a52e]">
            Login
          </p>
          <h1 className="mt-3 text-center text-2xl font-black leading-snug text-[#f6f0dc]">
            TCG ROYALのアカウントを
            <br />
            お持ちの方
          </h1>

          <form action={action} className="mt-7 text-left">
            <Suspense>
              <RegisteredBanner />
              <ErrorBanner />
              <NextInput />
            </Suspense>

            {state?.error && (
              <p className="mb-5 rounded-[16px] border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">
                {state.error}
              </p>
            )}

            <div className="mb-4">
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-black text-[#d7ceb8]"
              >
                メールアドレス
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="example@tcg-royal.jp"
                className="h-12 w-full rounded-[16px] border border-[#3a3528] bg-[#0f0e0b] px-4 text-sm font-semibold text-[#f6f0dc] outline-none transition-colors placeholder:text-[#5f5748] focus:border-[#c9a52e] focus:ring-2 focus:ring-[#c9a52e]/15"
              />
            </div>

            <div className="mb-5">
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-black text-[#d7ceb8]"
              >
                パスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="パスワードを入力"
                className="h-12 w-full rounded-[16px] border border-[#3a3528] bg-[#0f0e0b] px-4 text-sm font-semibold text-[#f6f0dc] outline-none transition-colors placeholder:text-[#5f5748] focus:border-[#c9a52e] focus:ring-2 focus:ring-[#c9a52e]/15"
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="h-12 w-full rounded-[18px] bg-[#c9a52e] text-base font-black text-[#0e0c09] shadow-[0_14px_40px_rgba(201,165,46,0.18)] transition-colors hover:bg-[#d7b865] disabled:opacity-50"
            >
              {pending ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>

          <Link
            href="/forgot-password"
            className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-full border border-[#3a3528] bg-[#0f0e0b] px-5 text-sm font-black text-[#d7ceb8] transition-colors hover:border-[#c9a52e]/60 hover:text-[#c9a52e]"
          >
            パスワードをお忘れですか？
          </Link>

          <div className="my-10 flex items-center gap-3">
            <span className="h-px flex-1 bg-[#2d2a20]" />
            <span className="text-sm font-black text-[#8f8369]">または</span>
            <span className="h-px flex-1 bg-[#2d2a20]" />
          </div>

          <h2 className="text-center text-xl font-black leading-snug text-[#f6f0dc]">
            TCG ROYALのアカウントを
            <br />
            お持ちではない方
          </h2>
          <p className="mt-3 text-center text-xs font-semibold text-[#8f8369]">
            郵送買取のご利用には登録が必要です。
          </p>
          <Link
            href="/register"
            className="mt-5 flex h-12 w-full items-center justify-center rounded-[18px] border border-[#c9a52e]/50 bg-[#171511] text-base font-black text-[#c9a52e] transition-colors hover:border-[#d7b865] hover:bg-[#211f18]"
          >
            新規登録
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
