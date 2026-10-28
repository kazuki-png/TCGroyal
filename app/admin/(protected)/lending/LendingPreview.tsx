'use client'

import { useState, type FormEvent } from 'react'
import type { LendingCard, MarketSnapshot, IndicativeQuote } from '@/lib/lending/types'

type Preview = { card: LendingCard; market: MarketSnapshot; quote: IndicativeQuote }
const yen = (value: number) => `¥${value.toLocaleString('ja-JP')}`
const field = 'mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-white'

export function LendingPreview({ cards }: { cards: LendingCard[] }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Preview | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = new FormData(event.currentTarget)
    setBusy(true); setError(''); setResult(null)
    try {
      const response = await fetch('/api/admin/lending/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardUid: form.get('cardUid'), productId: form.get('productId') }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? '査定に失敗しました。')
      setResult(data)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '通信に失敗しました。') }
    finally { setBusy(false) }
  }

  return (
    <>
      <form onSubmit={submit} onChange={() => { setResult(null); setError('') }} className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <fieldset disabled={busy} className="space-y-5 disabled:opacity-60">
          <div>
            <label htmlFor="cardUid" className="text-sm font-bold">TCG ROYALのカード</label>
            <select id="cardUid" name="cardUid" required className={field} defaultValue="">
              <option value="" disabled>カードを選択</option>
              {cards.map(card => <option key={card.public_uid} value={card.public_uid}>
                {card.name} / {card.card_number ?? '型番なし'} / {yen(card.buy_price)}
              </option>)}
            </select>
            <p className="mt-2 text-xs text-zinc-500">買取価格の高い順に最大200件。価格は24時間以内の更新が必要です。</p>
          </div>
          <div>
            <label htmlFor="productId" className="text-sm font-bold">スニダンの商品ID</label>
            <input id="productId" name="productId" type="text" inputMode="numeric" pattern="[1-9][0-9]{0,8}" maxLength={9} required placeholder="例：408333" className={field} aria-describedby="product-help" />
            <p id="product-help" className="mt-2 text-xs leading-6 text-zinc-500">
              商品URLの /apparels/ に続く数字。同じカード名・型番・言語・版であることを確認してください。
            </p>
          </div>
          <button disabled={!cards.length} type="submit" className="w-full rounded-xl bg-amber-400 p-3 font-black text-black disabled:opacity-50">
            {busy ? '価格を取得しています…' : 'スニダンから取得して概算を確認'}
          </button>
        </fieldset>
      </form>
      <div aria-live="polite" aria-busy={busy}>
        {error && <p role="alert" className="rounded-xl border border-red-900 p-4 text-sm text-red-300">{error}</p>}
        {result && <section className="space-y-5 rounded-2xl border border-zinc-700 bg-zinc-950 p-6">
          <div>
            <p className="text-sm text-amber-400">{result.quote.status === 'unavailable' ? '概算の算出対象外' : '要手動審査 / 参考額'}</p>
            <h2 className="mt-2 text-lg font-bold">{result.card.name}</h2>
            <p className="mt-3 text-4xl font-black">{result.quote.indicativeAmountJpy === null ? '—' : yen(result.quote.indicativeAmountJpy)}</p>
          </div>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-zinc-500">TCG ROYAL買取価格</dt><dd>{yen(result.card.buy_price)}</dd></div>
            <div><dt className="text-zinc-500">PSA10掲載価格（成約価格とは異なります）</dt><dd>{result.market.floorPriceJpy === null ? '取得なし' : yen(result.market.floorPriceJpy)}</dd></div>
            <div><dt className="text-zinc-500">参考LTV / 最低融資額</dt><dd>40% / ¥100,000</dd></div>
            <div><dt className="text-zinc-500">取得日時</dt><dd>{new Date(result.market.fetchedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}（日本時間）</dd></div>
          </dl>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-amber-200">
            {result.quote.reasons.map(reason => <li key={reason}>{reason}</li>)}
          </ul>
          <a href={result.market.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-sm text-amber-400 underline">スニダンで商品を照合する（別タブ）</a>
          <div>
            <h3 className="font-bold">取得したPSA10売買履歴（最大20件）</h3>
            <p className="my-2 text-xs text-zinc-500">期間全体の件数ではありません。1日平均の成約件数は未確定です。</p>
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-zinc-700"><th scope="col" className="py-2">サイト上の日時表記</th><th scope="col" className="py-2 text-right">価格</th></tr></thead>
              <tbody>{result.market.sales.map((sale, i) => <tr key={i} className="border-b border-zinc-900"><td className="py-2">{sale.displayedDate}</td><td className="py-2 text-right">{yen(sale.priceJpy)}</td></tr>)}</tbody>
            </table>
            {!result.market.sales.length && <p className="mt-3 text-sm text-zinc-400">履歴がありません。</p>}
          </div>
        </section>}
      </div>
    </>
  )
}
