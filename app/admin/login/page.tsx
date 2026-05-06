'use client'

import { useActionState } from 'react'
import { adminLogin } from '@/app/actions/auth'
import { SiteLogo } from '@/app/components/SiteLogo'

export default function AdminLoginPage() {
  const [state, action, pending] = useActionState(adminLogin, undefined)

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b0a08] px-4 text-[#ede8d5]">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <SiteLogo priority />
          </div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-[#c9a52e]">
            Admin Login
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-[#f6f0dc]">
            管理者ログイン
          </h1>
        </div>

        <form
          action={action}
          className="rounded-[28px] border border-[#2d2a20] bg-[#12100c] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
        >
          {state?.error && (
            <p className="mb-4 rounded-[16px] border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">
              {state.error}
            </p>
          )}

          <div className="mb-4">
            <label htmlFor="email" className="mb-1 block text-sm font-black text-[#d7ceb8]">
              メールアドレス
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-[16px] border border-[#3a3528] bg-[#0f0e0b] px-4 py-2.5 text-sm font-semibold text-[#f6f0dc] outline-none transition-colors placeholder:text-[#5f5748] focus:border-[#c9a52e] focus:ring-2 focus:ring-[#c9a52e]/15"
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="mb-1 block text-sm font-black text-[#d7ceb8]">
              パスワード
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-[16px] border border-[#3a3528] bg-[#0f0e0b] px-4 py-2.5 text-sm font-semibold text-[#f6f0dc] outline-none transition-colors focus:border-[#c9a52e] focus:ring-2 focus:ring-[#c9a52e]/15"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-[18px] bg-[#c9a52e] py-2.5 text-sm font-black text-[#0e0c09] shadow-[0_14px_40px_rgba(201,165,46,0.18)] transition-colors hover:bg-[#d7b865] disabled:opacity-50"
          >
            {pending ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  )
}
