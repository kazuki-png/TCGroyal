import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CardList } from './components/CardList'
import type { Card } from '@/lib/types'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: cards } = await supabase
    .from('cards')
    .select('*')
    .order('category')
    .order('name')

  const pokemon = (cards ?? []).filter((c) => c.category === 'pokemon') as Card[]
  const onepiece = (cards ?? []).filter((c) => c.category === 'onepiece') as Card[]

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-200 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="text-xl font-bold tracking-tight">TCG Royal</span>
          <div className="flex gap-4">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              ログイン
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              新規登録
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900">
            PSA鑑定カード 郵送買取
          </h1>
          <p className="mt-3 text-lg text-zinc-500">
            ポケモン・ワンピースのPSA鑑定品を高価買取
          </p>
          <Link
            href="/register"
            className="mt-6 inline-block rounded-xl bg-zinc-900 px-8 py-3 text-sm font-semibold text-white hover:bg-zinc-700"
          >
            無料で申し込む
          </Link>
        </div>

        <CardList pokemon={pokemon} onepiece={onepiece} />
      </main>

      <footer className="border-t border-zinc-200 px-6 py-8 text-center text-sm text-zinc-400">
        © 2025 TCG Royal. All rights reserved.
      </footer>
    </div>
  )
}
