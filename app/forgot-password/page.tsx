'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { SiteFooter } from '@/app/components/SiteFooter'
import { SiteHeader } from '@/app/components/SiteHeader'
import { forgotPasswordAction } from './actions'

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(forgotPasswordAction, undefined)

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <SiteHeader isAuthenticated={false} priorityLogo />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            パスワードのリセット
          </h1>
          <p className="mt-2 text-zinc-400">TCG Royal</p>
        </div>

        <div className="rounded-2xl bg-zinc-800 border border-zinc-700 p-8">
          {state?.success ? (
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-900/40 border border-green-800">
                  <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <h2 className="mb-2 text-lg font-semibold text-white">メールを送信しました</h2>
              <p className="text-sm text-zinc-400">
                入力いただいたメールアドレスにパスワードリセット用のリンクを送信しました。
                メールをご確認ください。
              </p>
              <p className="mt-2 text-xs text-zinc-600">
                メールが届かない場合は迷惑メールフォルダをご確認ください。
              </p>
              <Link
                href="/login"
                className="mt-6 inline-block text-sm text-white underline underline-offset-2 hover:text-zinc-300"
              >
                ログインに戻る
              </Link>
            </div>
          ) : (
            <>
              <p className="mb-6 text-sm text-zinc-400">
                登録済みのメールアドレスを入力してください。パスワードリセット用のリンクをお送りします。
              </p>

              {state?.error && (
                <p className="mb-4 rounded-lg bg-red-900/40 border border-red-800 px-4 py-3 text-sm text-red-400">
                  {state.error}
                </p>
              )}

              <form action={action}>
                <div className="mb-6">
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

                <button
                  type="submit"
                  disabled={pending}
                  className="w-full rounded-xl bg-[#c9a52e] py-2.5 text-sm font-black text-[#0e0c09] shadow-[0_14px_40px_rgba(201,165,46,0.18)] transition-colors hover:bg-[#d7b865] disabled:opacity-50"
                >
                  {pending ? '送信中...' : 'リセットメールを送信'}
                </button>
              </form>

              <p className="mt-4 text-center text-sm text-zinc-500">
                <Link href="/login" className="text-white underline underline-offset-2 hover:text-zinc-200">
                  ログインに戻る
                </Link>
              </p>
            </>
          )}
        </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
