'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createOrder } from '@/app/actions/orders'
import type { Card, CartItem } from '@/lib/types'

export function NewOrderForm({ cards }: { cards: Card[] }) {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()

  const filtered = cards.filter((c) => c.category === 'pokemon')

  const addToCart = (card: Card) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.card.id === card.id)
      if (existing) {
        return prev.map((i) =>
          i.card.id === card.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [...prev, { card, quantity: 1 }]
    })
  }

  const removeFromCart = (cardId: string) => {
    setCart((prev) => prev.filter((i) => i.card.id !== cardId))
  }

  const updateQty = (cardId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(cardId)
      return
    }
    setCart((prev) =>
      prev.map((i) => (i.card.id === cardId ? { ...i, quantity: qty } : i))
    )
  }

  const total = cart.reduce((s, i) => s + i.card.buy_price * i.quantity, 0)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(undefined)
    if (cart.length === 0) {
      setError('カードを選択してください')
      return
    }
    const fd = new FormData(e.currentTarget)
    const bankInfo = {
      bank_name: fd.get('bank_name') as string,
      bank_branch: fd.get('bank_branch') as string,
      bank_account_no: fd.get('bank_account_no') as string,
      bank_holder: fd.get('bank_holder') as string,
    }
    startTransition(async () => {
      const res = await createOrder(cart, bankInfo)
      if (res?.error) {
        setError(res.error)
        return
      }
      setCart([])
      router.push(res?.redirectTo ?? '/mypage/orders')
    })
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">カードを選択</h2>

          {filtered.length === 0 ? (
            <p className="py-8 text-center text-zinc-400">カードが登録されていません</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((card) => (
                <div
                  key={card.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-100 p-4 hover:border-zinc-300 transition-colors"
                >
                  <div>
                    <p className="font-medium text-zinc-900">{card.name}</p>
                    <p className="text-sm text-zinc-500">
                      ポケモン / {card.grade}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-zinc-900">
                      ¥{card.buy_price.toLocaleString()}
                    </p>
                    <button
                      onClick={() => addToCart(card)}
                      className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
                    >
                      追加
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">カート</h2>
          {cart.length === 0 ? (
            <p className="py-4 text-center text-sm text-zinc-400">
              カードを追加してください
            </p>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.card.id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{item.card.name}</p>
                    <p className="text-xs text-zinc-500">{item.card.grade}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQty(item.card.id, item.quantity - 1)}
                      className="h-6 w-6 rounded text-center text-zinc-600 hover:bg-zinc-100"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm">{item.quantity}</span>
                    <button
                      onClick={() => updateQty(item.card.id, item.quantity + 1)}
                      className="h-6 w-6 rounded text-center text-zinc-600 hover:bg-zinc-100"
                    >
                      ＋
                    </button>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.card.id)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    削除
                  </button>
                </div>
              ))}
              <div className="border-t border-zinc-100 pt-3">
                <p className="text-right font-semibold">
                  合計: ¥{total.toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">振込先口座</h2>

          {error && (
            <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          {[
            { name: 'bank_name', label: '銀行名', placeholder: '○○銀行' },
            { name: 'bank_branch', label: '支店名', placeholder: '△△支店' },
            { name: 'bank_account_no', label: '口座番号', placeholder: '1234567' },
            { name: 'bank_holder', label: '口座名義', placeholder: 'ヤマダ タロウ' },
          ].map(({ name, label, placeholder }) => (
            <div key={name} className="mb-3">
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                {label}
              </label>
              <input
                name={name}
                required
                placeholder={placeholder}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={pending || cart.length === 0}
            className="mt-2 w-full rounded-lg bg-zinc-900 py-3 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-40"
          >
            {pending ? '送信中...' : '申込を確定する'}
          </button>
        </form>
      </div>
    </div>
  )
}
