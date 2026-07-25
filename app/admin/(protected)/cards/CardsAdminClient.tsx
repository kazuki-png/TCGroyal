'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Card } from '@/lib/types'
import {
  cardHiddenReason,
  isCardVisibleToUsers,
  type CardUserVisibility,
} from '@/lib/cards/visibility'
import {
  createCard,
  deleteCard,
  updateCard,
} from './actions'

type CategoryFilter = 'all' | 'pokemon' | 'onepiece'
export type CardSortKey = 'created_at' | 'name' | 'card_number' | 'grade' | 'buy_price' | 'buy_price_updated_at'
export type CardSortDirection = 'asc' | 'desc'

export type CardTableFilters = {
  name: string
  cardNumber: string
  grade: string
  priceMin: string
  priceMax: string
  visibility: CardUserVisibility
  sort: CardSortKey
  dir: CardSortDirection
}

type CsvImportStreamEvent =
  | {
      type: 'start'
      rows: number
      downloadTotal: number
      percent: number
      message: string
    }
  | {
      type: 'progress'
      phase: 'downloading' | 'inserting'
      processed: number
      total: number
      percent: number
      message: string
    }
  | {
      type: 'warning'
      message: string
    }
  | {
      type: 'complete'
      inserted: number
      updated: number
      skipped: number
      warnings: string[]
      percent: number
      message: string
    }
  | {
      type: 'error'
      message: string
    }

type CsvImportState = {
  busy: boolean
  complete: boolean
  progress: number
  message: string
  warnings: string[]
  error: string
}

const CATEGORY_LABELS = {
  pokemon: 'ポケモン',
  onepiece: 'ワンピース',
} as const

const CATEGORY_TABS: { key: CategoryFilter; label: string }[] = [
  { key: 'all', label: 'すべて' },
  { key: 'pokemon', label: 'ポケモン' },
  { key: 'onepiece', label: 'ワンピース' },
]

const VISIBILITY_LABELS: Record<CardUserVisibility, string> = {
  all: 'すべて',
  visible: 'ユーザー表示中',
  hidden: 'ユーザー非表示',
}

const SAMPLE_CSV = [
  'name,category,card_number,grade,buy_price,image_url',
  'リザードン holo,pokemon,25TH-004,PSA10,180000,',
  'モンキー・D・ルフィ,onepiece,OP01-001,PSA10,62000,',
].join('\n')

function initialCsvImportState(): CsvImportState {
  return {
    busy: false,
    complete: false,
    progress: 0,
    message: '',
    warnings: [],
    error: '',
  }
}

function currency(value: number) {
  return `¥${value.toLocaleString('ja-JP')}`
}

function categoryBadge(category: Card['category']) {
  return category === 'pokemon'
    ? 'bg-amber-500/15 text-amber-200'
    : 'bg-red-500/15 text-red-200'
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="閉じる"
        onClick={onClose}
      />
      <div className="relative max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-white shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl font-black">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-full border border-zinc-700 text-sm font-black hover:bg-zinc-900"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function CardFields({ card }: { card?: Card }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <label className="block">
        <span className="mb-1 block text-xs font-black text-zinc-400">カード画像</span>
        <input
          name="image"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:font-black file:text-white"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-black text-zinc-400">カード名</span>
        <input
          name="name"
          required
          defaultValue={card?.name ?? ''}
          className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm font-semibold text-white outline-none"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-black text-zinc-400">カテゴリ</span>
        <select
          name="category"
          required
          defaultValue={card?.category ?? 'pokemon'}
          className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm font-semibold text-white outline-none"
        >
          <option value="pokemon">ポケモン</option>
          <option value="onepiece">ワンピース</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-black text-zinc-400">型番</span>
        <input
          name="card_number"
          defaultValue={card?.card_number ?? ''}
          className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm font-semibold text-white outline-none"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-black text-zinc-400">グレード</span>
        <select
          name="grade"
          required
          defaultValue={card?.grade ?? 'PSA10'}
          className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm font-semibold text-white outline-none"
        >
          <option value="PSA10">PSA10</option>
          <option value="PSA9">PSA9</option>
          <option value="PSA8">PSA8</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-black text-zinc-400">買取価格</span>
        <input
          name="buy_price"
          required
          inputMode="numeric"
          defaultValue={card?.buy_price ?? ''}
          className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm font-semibold text-white outline-none"
        />
      </label>
      <label className="block md:col-span-2 xl:col-span-3">
        <span className="mb-1 block text-xs font-black text-zinc-400">画像URL</span>
        <input
          name="image_url"
          defaultValue={card?.image_url ?? ''}
          placeholder="CSV取込や外部URL利用時のみ"
          className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm font-semibold text-white outline-none placeholder:text-zinc-600"
        />
      </label>
    </div>
  )
}

export function CardsAdminClient({
  cards,
  category,
  page,
  totalPages,
  counts,
  filters,
  saved,
  deleted,
  error,
}: {
  cards: Card[]
  category: CategoryFilter
  page: number
  totalPages: number
  counts: Record<CategoryFilter, number>
  filters: CardTableFilters
  saved?: string
  deleted?: string
  error?: string
}) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [editing, setEditing] = useState<Card | null>(null)
  const [preview, setPreview] = useState<Card | null>(null)
  const [pageInput, setPageInput] = useState(String(page))
  const [csvImport, setCsvImport] = useState<CsvImportState>(() => initialCsvImportState())
  const [copyFeedback, setCopyFeedback] = useState<string>()

  useEffect(() => {
    setPageInput(String(page))
  }, [page])

  const hrefFor = (overrides: Partial<CardTableFilters & { category: CategoryFilter; page: number }>) => {
    const next = { ...filters, category, page, ...overrides }
    const params = new URLSearchParams()
    if (next.category && next.category !== 'all') params.set('category', next.category)
    if (next.page && next.page > 1) params.set('page', String(next.page))
    if (next.name) params.set('name', next.name)
    if (next.cardNumber) params.set('card_number', next.cardNumber)
    if (next.grade) params.set('grade', next.grade)
    if (next.priceMin) params.set('price_min', next.priceMin)
    if (next.priceMax) params.set('price_max', next.priceMax)
    if (next.visibility !== 'all') params.set('visibility', next.visibility)
    if (next.sort !== 'created_at') params.set('sort', next.sort)
    if (next.dir !== 'desc') params.set('dir', next.dir)
    const query = params.toString()
    return query ? `/admin/cards?${query}` : '/admin/cards'
  }

  const sortHref = (sort: CardSortKey) => {
    const dir = filters.sort === sort && filters.dir === 'asc' ? 'desc' : 'asc'
    return hrefFor({ sort, dir, page: 1 })
  }

  const sortMark = (sort: CardSortKey) => {
    if (filters.sort !== sort) return ''
    return filters.dir === 'asc' ? ' ↑' : ' ↓'
  }

  const applyCsvImportEvent = (event: CsvImportStreamEvent) => {
    if (event.type === 'start' || event.type === 'progress') {
      setCsvImport((current) => ({
        ...current,
        busy: true,
        complete: false,
        progress: event.percent,
        message: event.message,
        error: '',
      }))
      return
    }

    if (event.type === 'warning') {
      setCsvImport((current) => ({
        ...current,
        warnings: [...current.warnings, event.message],
      }))
      return
    }

    if (event.type === 'complete') {
      setCsvImport((current) => ({
        ...current,
        busy: false,
        complete: true,
        progress: 100,
        message: event.message,
        warnings: event.warnings.length > 0 ? event.warnings : current.warnings,
        error: '',
      }))
      router.refresh()
      return
    }

    setCsvImport((current) => ({
      ...current,
      busy: false,
      complete: false,
      error: event.message,
      message: '取込に失敗しました',
    }))
  }

  const handleCsvImport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const file = formData.get('csv') as File | null

    if (!file || file.size === 0) {
      setCsvImport({
        ...initialCsvImportState(),
        error: 'CSVファイルを選択してください',
      })
      return
    }

    setCsvImport({
      ...initialCsvImportState(),
      busy: true,
      message: 'CSVをアップロードしています...',
    })

    try {
      const response = await fetch('/api/admin/cards/import', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.message ?? 'CSV取込に失敗しました')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          applyCsvImportEvent(JSON.parse(line) as CsvImportStreamEvent)
        }
      }

      buffer += decoder.decode()
      if (buffer.trim()) {
        applyCsvImportEvent(JSON.parse(buffer) as CsvImportStreamEvent)
      }
    } catch (importError) {
      setCsvImport((current) => ({
        ...current,
        busy: false,
        complete: false,
        error:
          importError instanceof Error
            ? importError.message
            : 'CSV取込に失敗しました',
        message: '取込に失敗しました',
      }))
    }
  }

  const closeImportModal = () => {
    if (csvImport.busy) return
    setImporting(false)
    setCsvImport(initialCsvImportState())
  }

  const commitPageInput = () => {
    const requestedPage = Number.parseInt(pageInput, 10)
    if (!Number.isFinite(requestedPage)) {
      setPageInput(String(page))
      return
    }

    const nextPage = Math.min(totalPages, Math.max(1, requestedPage))
    setPageInput(String(nextPage))
    if (nextPage !== page) router.push(hrefFor({ page: nextPage }))
  }

  const copyCollectorsUid = async (publicUid: string) => {
    try {
      await navigator.clipboard.writeText(publicUid)
      setCopyFeedback('Copied')
    } catch {
      setCopyFeedback('コピーに失敗しました')
    }
  }

  return (
    <div className="min-w-0 space-y-5">
      <section className="bg-zinc-950 px-5 py-5 text-white">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-black">カード</h1>
            <p className="mt-1 text-xs font-black text-zinc-500">
              登録 {counts.all.toLocaleString('ja-JP')}件
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setCsvImport(initialCsvImportState())
                setImporting(true)
              }}
              className="h-10 rounded-lg border border-zinc-600 px-4 text-xs font-black text-white hover:bg-zinc-900"
            >
              CSV取込
            </button>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="h-10 rounded-lg bg-red-600 px-4 text-xs font-black text-white hover:bg-red-500"
            >
              カード追加
            </button>
          </div>
        </div>

        {saved && (
          <p className="mt-4 rounded-lg border border-emerald-900 bg-emerald-950/50 px-3 py-2 text-sm font-black text-emerald-200">
            保存しました
          </p>
        )}
        {deleted && (
          <p className="mt-4 rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm font-black text-red-200">
            削除しました
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm font-black text-red-200">
            {error}
          </p>
        )}
        {copyFeedback && (
          <p className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-emerald-700 bg-emerald-950 px-4 py-2 text-sm font-black text-emerald-100 shadow-xl">
            {copyFeedback}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {CATEGORY_TABS.map((tab) => (
            <Link
              key={tab.key}
              href={hrefFor({ category: tab.key, page: 1 })}
              className={[
                'rounded-full px-4 py-1.5 text-sm font-black',
                category === tab.key
                  ? 'bg-red-600 text-white'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800',
              ].join(' ')}
            >
              {tab.label} {counts[tab.key].toLocaleString('ja-JP')}
            </Link>
          ))}
        </div>
      </section>

      <form
        action="/admin/cards"
        method="get"
        className="grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-white md:grid-cols-2 xl:grid-cols-7"
      >
        {category !== 'all' && <input type="hidden" name="category" value={category} />}
        <input type="hidden" name="sort" value={filters.sort} />
        <input type="hidden" name="dir" value={filters.dir} />
        <label className="block">
          <span className="mb-1 block text-xs font-black text-zinc-400">カード名</span>
          <input
            name="name"
            defaultValue={filters.name}
            className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm font-semibold text-white outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-black text-zinc-400">型番</span>
          <input
            name="card_number"
            defaultValue={filters.cardNumber}
            className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm font-semibold text-white outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-black text-zinc-400">グレード</span>
          <select
            name="grade"
            defaultValue={filters.grade}
            className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm font-semibold text-white outline-none"
          >
            <option value="">すべて</option>
            <option value="PSA10">PSA10</option>
            <option value="PSA9">PSA9</option>
            <option value="PSA8">PSA8</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-black text-zinc-400">価格下限</span>
          <input
            name="price_min"
            defaultValue={filters.priceMin}
            inputMode="numeric"
            className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm font-semibold text-white outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-black text-zinc-400">価格上限</span>
          <input
            name="price_max"
            defaultValue={filters.priceMax}
            inputMode="numeric"
            className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm font-semibold text-white outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-black text-zinc-400">ユーザー表示</span>
          <select
            name="visibility"
            defaultValue={filters.visibility}
            className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm font-semibold text-white outline-none"
          >
            <option value="all">{VISIBILITY_LABELS.all}</option>
            <option value="visible">{VISIBILITY_LABELS.visible}</option>
            <option value="hidden">{VISIBILITY_LABELS.hidden}</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="h-10 rounded-lg bg-red-600 px-4 text-xs font-black text-white hover:bg-red-500"
          >
            絞り込み
          </button>
          <Link
            href={hrefFor({ name: '', cardNumber: '', grade: '', priceMin: '', priceMax: '', visibility: 'all', page: 1 })}
            className="flex h-10 items-center rounded-lg border border-zinc-700 px-4 text-xs font-black text-zinc-300 hover:bg-zinc-900"
          >
            クリア
          </Link>
        </div>
      </form>

      <div className="w-full max-w-full overflow-x-auto overscroll-x-contain rounded-2xl border border-zinc-800 bg-zinc-950 pb-2 text-white">
        <table className="w-full min-w-[1420px] table-fixed">
          <colgroup>
            <col className="w-[120px]" />
            <col className="w-[340px]" />
            <col className="w-[120px]" />
            <col className="w-[140px]" />
            <col className="w-[110px]" />
            <col className="w-[150px]" />
            <col className="w-[170px]" />
            <col className="w-[150px]" />
            <col className="w-[100px]" />
            <col className="w-[120px]" />
          </colgroup>
          <thead className="bg-[#222221]">
            <tr className="text-left text-xs text-zinc-400">
              <th className="whitespace-nowrap px-4 py-3 font-black">画像</th>
              <th className="px-4 py-3 font-black">
                <Link href={sortHref('name')} className="hover:text-white">
                  カード名{sortMark('name')}
                </Link>
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-black">カテゴリ</th>
              <th className="whitespace-nowrap px-4 py-3 font-black">
                <Link href={sortHref('card_number')} className="hover:text-white">
                  型番{sortMark('card_number')}
                </Link>
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-black">
                <Link href={sortHref('grade')} className="hover:text-white">
                  グレード{sortMark('grade')}
                </Link>
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-black">
                <Link href={sortHref('buy_price')} className="hover:text-white">
                  買取価格{sortMark('buy_price')}
                </Link>
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-black">
                <Link href={sortHref('buy_price_updated_at')} className="hover:text-white">
                  価格更新日時{sortMark('buy_price_updated_at')}
                </Link>
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-black">ユーザー表示</th>
              <th className="whitespace-nowrap px-4 py-3 font-black">Collectors UID</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-black">操作</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => {
              const visibleToUsers = isCardVisibleToUsers(card)
              return (
                <tr key={card.id} className="border-t border-zinc-800">
                  <td className="px-4 py-3">
                    {card.image_url ? (
                      <button
                        type="button"
                        onClick={() => setPreview(card)}
                        className="relative block h-16 w-12 overflow-hidden rounded border border-zinc-700 bg-zinc-900"
                      >
                        <Image
                          src={card.image_url}
                          alt={card.name}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      </button>
                    ) : (
                      <div className="h-16 w-12 rounded border border-zinc-800 bg-zinc-900" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-black">{card.name}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-black ${categoryBadge(card.category)}`}>
                      {CATEGORY_LABELS[card.category]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-300">{card.card_number ?? '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-300">{card.grade}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-black">{currency(card.buy_price)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">
                    {card.buy_price_updated_at
                      ? new Date(card.buy_price_updated_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                      : '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-black ${
                        visibleToUsers
                          ? 'bg-emerald-500/15 text-emerald-200'
                          : 'bg-zinc-700 text-zinc-200'
                      }`}
                    >
                      {visibleToUsers ? '表示中' : cardHiddenReason(card)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => copyCollectorsUid(card.public_uid)}
                      className="h-8 whitespace-nowrap rounded border border-zinc-600 px-3 text-xs font-black text-zinc-200 hover:bg-zinc-900"
                    >
                      Copy UID
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(card)}
                        className="h-8 rounded border border-zinc-600 px-3 text-xs font-black hover:bg-zinc-900"
                      >
                        編集
                      </button>
                      <form
                        action={deleteCard}
                        onSubmit={(event) => {
                          if (!window.confirm('本当に削除しますか？')) {
                            event.preventDefault()
                          }
                        }}
                      >
                        <input type="hidden" name="card_id" value={card.id} />
                        <button
                          type="submit"
                          className="h-8 rounded border border-red-900 px-3 text-xs font-black text-red-200 hover:bg-red-950"
                        >
                          削除
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm font-black text-zinc-400">
        <div className="flex items-center gap-2">
          <span>ページ</span>
          <input
            type="number"
            min="1"
            max={totalPages}
            value={pageInput}
            onChange={(event) => setPageInput(event.target.value)}
            onBlur={commitPageInput}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitPageInput()
              }
            }}
            className="h-9 w-20 rounded border border-zinc-700 bg-zinc-950 px-3 text-center text-sm font-black text-white outline-none"
            aria-label="現在のページ"
          />
          <span>/ {totalPages}</span>
        </div>
        <div className="flex gap-2">
          <Link
            href={hrefFor({ page: Math.max(1, page - 1) })}
            className="rounded border border-zinc-700 px-3 py-2 hover:bg-zinc-900"
          >
            前へ
          </Link>
          <Link
            href={hrefFor({ page: Math.min(totalPages, page + 1) })}
            className="rounded border border-zinc-700 px-3 py-2 hover:bg-zinc-900"
          >
            次へ
          </Link>
        </div>
      </div>

      {creating && (
        <Modal title="カード追加" onClose={() => setCreating(false)}>
          <form action={createCard} className="space-y-4">
            <CardFields />
            <button
              type="submit"
              className="h-10 rounded-lg bg-red-600 px-5 text-sm font-black text-white hover:bg-red-500"
            >
              追加
            </button>
          </form>
        </Modal>
      )}

      {importing && (
        <Modal title="CSV取込" onClose={closeImportModal}>
          <div className="space-y-4">
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE_CSV)}`}
              download="cards_sample.csv"
              className="inline-flex h-10 items-center rounded-lg border border-zinc-700 px-4 text-xs font-black text-zinc-200 hover:bg-zinc-900"
            >
              サンプルCSVをダウンロード
            </a>
            <form onSubmit={handleCsvImport} className="space-y-4">
              <div className="rounded-xl border border-zinc-800 bg-black/70 p-4">
                <p className="text-sm font-black text-zinc-100">取込時の挙動</p>
                <p className="mt-1 text-xs font-semibold text-zinc-500">
                  デフォルトは既存カードの価格更新のみで、新規カードはスキップします。
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <label className="flex gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm font-black text-zinc-100">
                    <input type="hidden" name="updateExisting" value="false" />
                    <input
                      name="updateExisting"
                      type="checkbox"
                      value="true"
                      defaultChecked
                      disabled={csvImport.busy}
                      className="mt-1 h-4 w-4 accent-red-600"
                    />
                    <span>
                      既存カードを更新
                      <span className="mt-1 block text-xs font-semibold text-zinc-500">
                        カテゴリ・カード名・型番・グレードが一致する行の価格を更新します。
                      </span>
                    </span>
                  </label>
                  <label className="flex gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm font-black text-zinc-100">
                    <input type="hidden" name="insertNew" value="false" />
                    <input
                      name="insertNew"
                      type="checkbox"
                      value="true"
                      disabled={csvImport.busy}
                      className="mt-1 h-4 w-4 accent-red-600"
                    />
                    <span>
                      新規カードをDBに保存する
                      <span className="mt-1 block text-xs font-semibold text-zinc-500">
                        一致する既存カードがない行を新規カードとして登録します。
                      </span>
                    </span>
                  </label>
                  <label className="flex gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm font-black text-zinc-100">
                    <input type="hidden" name="downloadImages" value="false" />
                    <input
                      name="downloadImages"
                      type="checkbox"
                      value="true"
                      defaultChecked
                      disabled={csvImport.busy}
                      className="mt-1 h-4 w-4 accent-red-600"
                    />
                    <span>
                      画像URLをStorageに保存
                      <span className="mt-1 block text-xs font-semibold text-zinc-500">
                        Web上の画像を取得し、カード画像Bucketに保存したURLを登録します。
                      </span>
                    </span>
                  </label>
                </div>
              </div>
              <input
                name="csv"
                type="file"
                required
                accept=".csv,text/csv"
                disabled={csvImport.busy}
                className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-sm file:font-black file:text-white"
              />
              {(csvImport.busy || csvImport.complete || csvImport.error) && (
                <div className="rounded-xl border border-zinc-800 bg-black p-4">
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm font-black">
                    <span className={csvImport.error ? 'text-red-200' : 'text-zinc-100'}>
                      {csvImport.message || 'ダウンロード中...'}
                    </span>
                    <span className="text-zinc-400">{csvImport.progress}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={csvImport.progress}
                    readOnly
                    className="h-2 w-full accent-red-600"
                    aria-label="CSV取込進捗"
                  />
                  {csvImport.busy && (
                    <p className="mt-2 text-xs font-black text-zinc-500">
                      画像URLをStorageに保存する場合は、トラフィックを抑えるため間隔を空けて順番に取得します。
                    </p>
                  )}
                  {csvImport.error && (
                    <p className="mt-3 text-sm font-black text-red-200">{csvImport.error}</p>
                  )}
                  {csvImport.warnings.length > 0 && (
                    <div className="mt-3 space-y-1 rounded-lg border border-amber-900 bg-amber-950/30 p-3">
                      <p className="text-xs font-black text-amber-200">
                        画像取得の警告
                      </p>
                      {csvImport.warnings.slice(0, 8).map((warning) => (
                        <p key={warning} className="text-xs font-semibold text-amber-100">
                          {warning}
                        </p>
                      ))}
                      {csvImport.warnings.length > 8 && (
                        <p className="text-xs font-black text-amber-200">
                          他 {csvImport.warnings.length - 8} 件
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              <button
                type="submit"
                disabled={csvImport.busy}
                className="h-10 rounded-lg bg-red-600 px-5 text-sm font-black text-white hover:bg-red-500"
              >
                {csvImport.busy ? '取込中' : '取込'}
              </button>
            </form>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal title="カード編集" onClose={() => setEditing(null)}>
          <form key={editing.id} action={updateCard} className="space-y-4">
            <input type="hidden" name="card_id" value={editing.id} />
            <CardFields card={editing} />
            <button
              type="submit"
              className="h-10 rounded-lg bg-red-600 px-5 text-sm font-black text-white hover:bg-red-500"
            >
              保存
            </button>
          </form>
        </Modal>
      )}

      {preview && preview.image_url && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="閉じる"
            onClick={() => setPreview(null)}
          />
          <div className="relative h-[80vh] w-full max-w-xl">
            <Image
              src={preview.image_url}
              alt={preview.name}
              fill
              sizes="80vw"
              className="object-contain"
            />
          </div>
        </div>
      )}
    </div>
  )
}
