'use client'

import type { Card } from '@/lib/types'

export function CardList({
  pokemon,
}: {
  pokemon: Card[]
}) {
  const cards = pokemon

  return (
    <div>
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
