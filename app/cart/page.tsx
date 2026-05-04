import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CartForm } from './CartForm'
import type { Card } from '@/lib/types'

export default async function CartPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: cards } = await supabase
    .from('cards')
    .select('*')
    .order('category')
    .order('name')

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight">
            TCG Royal
          </Link>
          <Link href="/mypage" className="text-sm text-zinc-500 hover:text-zinc-900">
            ← マイページ
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-bold">買取申込</h1>
        <CartForm cards={(cards ?? []) as Card[]} />
      </main>
    </div>
  )
}
