'use client'

import { useState } from 'react'
import type { Card } from '@/lib/types'

type Tab = 'pokemon' | 'onepiece'

const CATEGORY_LABEL: Record<Tab, string> = {
  pokemon: 'ポケモンカード',
  onepiece: 'ワンピースカード',
}

export function CardList({
  pokemon,
  onepiece,
}: {
  pokemon: Card[]
  onepiece: Card[]
}) {
  const [tab, setTab] = useState<Tab>('pokemon')
  const cards = tab === 'pokemon' ? pokemon : onepiece

  return (
    <div>
      <div className="mb-6 flex gap-2">
        {(['pokemon', 'onepiece'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-zinc-900 text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            {CATEGORY_LABEL[t]}
          </button>
        ))}
      </div>

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 py-16 text-center text-zinc-400">
          現在買取対象カードはありません
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200">
          <table className="w-full">
            <thead className="bg-zinc-50">
              <tr className="text-left text-sm text-zinc-500">
                <th className="px-4 py-3 font-medium">カード名</th>
                <th className="px-4 py-3 font-medium">カード番号</th>
                <th className="px-4 py-3 font-medium">グレード</th>
                <th className="px-4 py-3 text-right font-medium">買取価格</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((card) => (
                <tr
                  key={card.id}
                  className="border-t border-zinc-100 hover:bg-zinc-50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-medium text-zinc-900">
                    {card.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500">
                    {card.card_number ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500">
                    {card.grade}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-zinc-900">
                    ¥{card.buy_price.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
