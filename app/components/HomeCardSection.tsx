'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Card } from '@/lib/types'

const CARDS_PER_PAGE = 12

type Category = 'pokemon' | 'onepiece'

const CATEGORY_LABEL: Record<Category, string> = {
  pokemon: 'ポケモン',
  onepiece: 'ワンピース',
}

function normalizeImageUrl(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)
    return url.toString()
  } catch {
    return trimmed
  }
}

function duplicatedImageUrls(cards: Card[]) {
  const counts = new Map<string, number>()

  for (const card of cards) {
    const key = normalizeImageUrl(card.image_url)
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([url]) => url)
  )
}

function CardPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-lg bg-[#1e1c17]">
      <span className="text-xs font-black tracking-[0.25em] text-[#4a4233]">
        未登録
      </span>
    </div>
  )
}

function getPaginationItems(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  if (current <= 3) {
    return [1, 2, 3, 'ellipsis', total]
  }
  if (current >= total - 2) {
    return [1, 'ellipsis', total - 2, total - 1, total]
  }
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total]
}

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number
  totalPages: number
  onPageChange: (p: number) => void
}) {
  const [inputValue, setInputValue] = useState(String(page))

  useEffect(() => {
    setInputValue(String(page))
  }, [page])

  if (totalPages <= 1) return null

  const items = getPaginationItems(page, totalPages)
  const navBtn = 'flex h-12 items-center gap-1 border-[#2d2a20] px-5 text-sm font-semibold text-[#7a6e55] transition-colors hover:bg-[#252420] disabled:cursor-not-allowed disabled:text-[#3a3628]'

  const commitInput = () => {
    const n = parseInt(inputValue, 10)
    if (!Number.isNaN(n) && n >= 1 && n <= totalPages) {
      onPageChange(n)
    } else {
      setInputValue(String(page))
    }
  }

  return (
    <nav aria-label="ページネーション" className="mt-8 flex flex-col items-center gap-3">
      {/* Mobile compact: prev | input/total | next */}
      <div className="inline-flex overflow-hidden rounded-lg border border-[#2d2a20] bg-[#1c1b18] shadow-[0_12px_34px_rgba(0,0,0,0.32)] sm:hidden">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className={`${navBtn} border-r`}
        >
          <span aria-hidden="true">‹</span>
          前へ
        </button>
        <form
          onSubmit={(e) => { e.preventDefault(); commitInput() }}
          className="flex h-12 items-center gap-1.5 px-3"
        >
          <input
            type="text"
            inputMode="numeric"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={commitInput}
            className="h-8 w-10 rounded border border-[#3a3528] bg-[#0f0e0b] text-center text-sm font-black text-[#c9a52e] outline-none focus:border-[#c9a52e]"
            aria-label="ページ番号"
          />
          <span className="text-sm text-[#5a5243]">/ {totalPages}</span>
        </form>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className={`${navBtn} border-l`}
        >
          次へ
          <span aria-hidden="true">›</span>
        </button>
      </div>

      {/* Desktop full pagination + page jump */}
      <div className="hidden items-center gap-3 sm:flex">
        <div className="inline-flex overflow-hidden rounded-lg border border-[#2d2a20] bg-[#1c1b18] shadow-[0_12px_34px_rgba(0,0,0,0.32)]">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className={`${navBtn} border-r`}
          >
            <span aria-hidden="true">‹</span>
            前へ
          </button>

          {items.map((item, i) =>
            item === 'ellipsis' ? (
              <span
                key={`ellipsis-${i}`}
                className="flex h-12 min-w-12 items-center justify-center px-3 text-sm text-[#5a5243]"
              >
                ...
              </span>
            ) : (
              <button
                key={item}
                onClick={() => onPageChange(item)}
                aria-current={item === page ? 'page' : undefined}
                className={`h-12 min-w-12 px-4 text-sm transition-colors ${
                  item === page
                    ? 'border-x border-[#c9a52e] bg-[#0e0c09] font-black text-[#c9a52e]'
                    : 'font-medium text-[#7a6e55] hover:bg-[#252420]'
                }`}
              >
                {item}
              </button>
            )
          )}

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className={`${navBtn} border-l`}
          >
            次へ
            <span aria-hidden="true">›</span>
          </button>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); commitInput() }}
          className="flex items-center gap-1.5"
        >
          <input
            type="text"
            inputMode="numeric"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={commitInput}
            className="h-9 w-12 rounded-lg border border-[#3a3528] bg-[#1c1b18] text-center text-sm font-black text-[#c9a52e] outline-none focus:border-[#c9a52e]"
            aria-label="ページ番号"
          />
          <span className="text-sm text-[#5a5243]">/ {totalPages}</span>
        </form>
      </div>
    </nav>
  )
}

function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handler = () => setVisible(window.scrollY > 400)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="ページ最上部へ戻る"
      className={`fixed bottom-6 right-6 z-50 grid h-12 w-12 place-items-center rounded-full bg-zinc-950 text-white shadow-lg transition-all hover:bg-zinc-800 dark:bg-[#c9a52e] dark:text-[#0e0c09] dark:hover:bg-[#d4b73f] ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
      }`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 15l7-7 7 7" />
      </svg>
    </button>
  )
}

export function HomeCardSection({ cards }: { cards: Card[] }) {
  const [enabled, setEnabled] = useState<Set<Category>>(new Set(['pokemon', 'onepiece']))
  const [page, setPage] = useState(1)
  const [categoryControlsVisible, setCategoryControlsVisible] = useState(true)
  const lastScrollYRef = useRef(0)
  const repeatedImageUrls = useMemo(() => duplicatedImageUrls(cards), [cards])

  const filtered = cards.filter((c) => enabled.has(c.category as Category))
  const totalPages = Math.max(1, Math.ceil(filtered.length / CARDS_PER_PAGE))
  const pageCards = filtered.slice((page - 1) * CARDS_PER_PAGE, page * CARDS_PER_PAGE)

  function toggleCategory(cat: Category) {
    setEnabled((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) {
        next.delete(cat)
      } else {
        next.add(cat)
      }
      return next
    })
    setPage(1)
  }

  function handlePageChange(p: number) {
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY
      setCategoryControlsVisible(
        currentY < 140 || currentY < lastScrollYRef.current
      )
      lastScrollYRef.current = currentY
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (cards.length === 0) return null

  return (
    <>
      <section className="mt-8 sm:mt-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl font-black tracking-wide text-[#c9a52e] sm:text-2xl">
              買取カード一覧
            </h2>
            <p className="mt-1 text-sm font-semibold text-[#7a6e55]">
              登録済みカードから高価買取カードを表示しています。
            </p>
          </div>
          <div
            className={`sticky top-[69px] z-30 flex gap-2 rounded-full border border-[#2d2a20] bg-[#0f0e0b]/90 p-1 shadow-[0_14px_40px_rgba(0,0,0,0.34)] backdrop-blur transition-all duration-200 ${
              categoryControlsVisible
                ? 'translate-y-0 opacity-100'
                : 'pointer-events-none -translate-y-4 opacity-0'
            }`}
          >
            {(['pokemon', 'onepiece'] as Category[]).map((cat) => (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                aria-pressed={enabled.has(cat)}
                className={`rounded-full px-5 py-2 text-sm font-black transition-colors ${
                  enabled.has(cat)
                    ? 'bg-[#c9a52e] text-[#0e0c09] shadow-[0_8px_20px_rgba(201,165,46,0.18)]'
                    : 'bg-[#252420] text-[#8f8369] hover:bg-[#2e2b25] hover:text-[#d7ceb8]'
                }`}
              >
                {CATEGORY_LABEL[cat]}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-[#2d2a20] bg-[#15130f] py-16 text-center text-[#5a5243]">
            カテゴリーを選択してください
          </div>
        ) : (
          <>
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(min(100%, 156px), 1fr))',
              }}
            >
              {pageCards.map((card) => (
                <article
                  key={card.id}
                  className="rounded-2xl border border-[#2d2a20] bg-[linear-gradient(180deg,#1b1812_0%,#12100c_100%)] p-3 shadow-[0_18px_46px_rgba(0,0,0,0.38)] transition-colors hover:border-[#4a4233] sm:p-4"
                >
                  <div className="relative mx-auto aspect-[5/7] overflow-hidden rounded-lg bg-[#1e1c17]">
                    {card.image_url && !repeatedImageUrls.has(normalizeImageUrl(card.image_url) ?? '') ? (
                      <Image
                        src={card.image_url}
                        alt={card.name}
                        fill
                        sizes="(max-width: 359px) 92vw, (max-width: 767px) 48vw, (max-width: 1279px) 24vw, 16vw"
                        className="object-contain"
                      />
                    ) : (
                      <CardPlaceholder />
                    )}
                  </div>
                  <div className="mt-3">
                    <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-black leading-snug text-[#ede8d5]">
                      {card.name}
                    </h3>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="rounded-full bg-[#2d2a20] px-2.5 py-0.5 text-xs font-black text-[#c9a52e]">
                        {card.grade}
                      </span>
                      <span className="truncate text-xs font-semibold text-[#5a5243]">
                        {card.card_number ?? '-'}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-nowrap text-xl font-black text-red-400">
                      ¥{card.buy_price.toLocaleString('ja-JP')}
                    </p>
                  </div>
                </article>
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
          </>
        )}
      </section>

      <ScrollToTop />
    </>
  )
}
