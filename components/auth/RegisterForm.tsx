'use client'
import { useActionState } from 'react'
import Link from 'next/link'
import { registerAction, type RegisterState } from '@/app/register/actions'

export function RegisterForm() {
  const [state, action, pending] = useActionState<RegisterState | undefined, FormData>(registerAction, undefined)
  return <form action={action} className="mx-auto max-w-lg space-y-5 rounded-xl border border-zinc-700 p-6">
    <p>メールアドレスを確認してから、会員情報と本人確認書類を登録します。</p>
    <label className="block">メールアドレス<input name="email" type="email" autoComplete="email" required maxLength={254} className="mt-2 block w-full rounded border border-[#777777] bg-[#ffffff] p-3 text-[#111111]" /></label>
    <label className="block">パスワード（12文字以上）<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="mt-2 block w-full rounded border border-[#777777] bg-[#ffffff] p-3 text-[#111111]" /></label>
    <label className="block">パスワード（確認）<input name="password_confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="mt-2 block w-full rounded border border-[#777777] bg-[#ffffff] p-3 text-[#111111]" /></label>
    {state?.error && <p role="alert" className="text-red-500">{state.error}</p>}
    {state?.success && <p role="status">{state.success}</p>}
    <button disabled={pending} className="rounded bg-yellow-500 px-6 py-3 font-bold text-black disabled:opacity-50">{pending ? '送信中…' : '確認メールを送信'}</button>
    <p><Link href="/login" className="underline">ログインはこちら</Link></p>
  </form>
}
