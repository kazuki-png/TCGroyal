'use client'

import Image from 'next/image'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveOrderAssessment, setOrderStatus } from './actions'
import {
  EMAIL_TRIGGER_STATUSES,
  ORDER_STATUS_LABELS,
  canEditOrderAssessment,
  type OrderStatus,
} from '@/lib/types'

type Decision = 'approved' | 'cancelled'
type CardGrade = 'PSA10' | 'PSA9' | 'PSA8'
type CardCategory = 'pokemon' | 'onepiece'
type CardPickerSortKey = 'name' | 'card_number' | 'grade' | 'buy_price'
type CardPickerSortDirection = 'asc' | 'desc'
type CardPickerGradeFilter = 'all' | CardGrade

type ManualUnlistedDraft = {
  localId: string
  existingCardId: string
  cardName: string
  grade: CardGrade
  assessedUnitPrice: string
  saveToDb: boolean
}

const CARD_GRADES: CardGrade[] = ['PSA10', 'PSA9', 'PSA8']
const CARD_PICKER_PAGE_SIZE = 10
const CATEGORY_LABELS: Record<CardCategory, string> = {
  pokemon: 'ポケモン',
  onepiece: 'ワンピース',
}

export type AssessmentEditorItem = {
  id: string
  card_name: string
  item_type?: 'card' | 'unlisted'
  grade: string
  quantity: number
  unit_price: number
  assessed_unit_price?: number | null
  customer_decision?: Decision | null
  customer_decided_at?: string | null
  requested_note?: string | null
}

export type AssessmentCardOption = {
  id: string
  name: string
  card_number: string | null
  category: CardCategory
  grade: CardGrade
  buy_price: number
  image_url: string | null
}

function currency(value: number) {
  return `¥${value.toLocaleString('ja-JP')}`
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u30a1-\u30f6]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0x60)
    )
}

function searchTokens(value: string) {
  return value
    .split(/\s+/)
    .map((token) => normalizeSearchText(token.trim()))
    .filter(Boolean)
}

function categoryBadge(category: CardCategory) {
  return category === 'pokemon'
    ? 'bg-amber-500/15 text-amber-200'
    : 'bg-red-500/15 text-red-200'
}

function CardThumb({
  card,
  size = 'sm',
}: {
  card: AssessmentCardOption
  size?: 'sm' | 'md'
}) {
  const className =
    size === 'md'
      ? 'relative h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900'
      : 'relative h-14 w-10 shrink-0 overflow-hidden rounded border border-zinc-700 bg-zinc-900'

  if (!card.image_url) {
    return (
      <div
        className={`${className} flex items-center justify-center text-[8px] font-black tracking-[0.18em] text-zinc-700`}
      >
        NO IMAGE
      </div>
    )
  }

  return (
    <div className={className}>
      <Image
        src={card.image_url}
        alt={card.name}
        fill
        sizes={size === 'md' ? '48px' : '40px'}
        className="object-cover"
      />
    </div>
  )
}

function normalizePriceInput(value: string) {
  const numeric = Number(value.replace(/[^\d]/g, ''))
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(99_999_999, Math.floor(numeric)))
}

function newManualUnlistedDraft(localId?: string): ManualUnlistedDraft {
  return {
    localId: localId ?? `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    existingCardId: '',
    cardName: '',
    grade: 'PSA10',
    assessedUnitPrice: '0',
    saveToDb: true,
  }
}

function decisionLabel(decision?: Decision | null) {
  if (decision === 'approved') return '承認'
  if (decision === 'cancelled') return 'キャンセル'
  return '未回答'
}

function decisionClass(decision?: Decision | null) {
  if (decision === 'approved') return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
  if (decision === 'cancelled') return 'border-red-500/40 bg-red-500/15 text-red-200'
  return 'border-zinc-700 bg-zinc-950 text-zinc-400'
}

const STATUS_ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  accepted: '申込内容を確認して受付済みへ',
  waiting_arrival: '受付を完了して到着待ちへ',
  inspecting: '到着を確認したので査定中へ',
  pending_transfer: '振込待ちへ進める',
  completed: '振込完了にする',
}

const STATUS_HELPER_TEXT: Partial<Record<OrderStatus, string>> = {
  inspecting:
    '査定中です。当社査定額を入力して保存すると、お客様対応待ちへ移動します。',
  pending_approval: 'お客様の承認またはキャンセル回答を待っています。',
  completed: 'この注文は完了しています。',
}

function StopIcon({ tooltip }: { tooltip: string }) {
  return (
    <div className="group relative inline-block">
      <span
        className="cursor-help select-none text-base leading-none text-zinc-500"
        aria-label={tooltip}
      >
        ⊘
      </span>
      <div className="pointer-events-none absolute bottom-full right-0 z-20 mb-1.5 hidden whitespace-nowrap rounded-md bg-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-200 shadow-lg group-hover:block">
        {tooltip}
      </div>
    </div>
  )
}

function CardPickerModal({
  cards,
  selectedId,
  onSelect,
  onClose,
}: {
  cards: AssessmentCardOption[]
  selectedId: string
  onSelect: (card: AssessmentCardOption) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [grade, setGrade] = useState<CardPickerGradeFilter>('all')
  const [sort, setSort] = useState<CardPickerSortKey>('name')
  const [direction, setDirection] = useState<CardPickerSortDirection>('asc')
  const [page, setPage] = useState(1)

  const filteredCards = useMemo(() => {
    const tokens = searchTokens(query)

    return [...cards]
      .filter((card) => {
        if (grade !== 'all' && card.grade !== grade) return false
        if (tokens.length === 0) return true

        const haystack = normalizeSearchText(
          [
            card.name,
            card.card_number ?? '',
            card.grade,
            CATEGORY_LABELS[card.category],
            currency(card.buy_price),
          ].join(' ')
        )

        return tokens.every((token) => haystack.includes(token))
      })
      .sort((left, right) => {
        const directionMultiplier = direction === 'asc' ? 1 : -1

        if (sort === 'buy_price') {
          return (left.buy_price - right.buy_price) * directionMultiplier
        }

        const leftValue = sort === 'card_number'
          ? left.card_number ?? ''
          : left[sort]
        const rightValue = sort === 'card_number'
          ? right.card_number ?? ''
          : right[sort]

        return String(leftValue).localeCompare(String(rightValue), 'ja') * directionMultiplier
      })
  }, [cards, direction, grade, query, sort])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCards.length / CARD_PICKER_PAGE_SIZE)
  )
  const currentPage = Math.min(page, totalPages)
  const pageCards = filteredCards.slice(
    (currentPage - 1) * CARD_PICKER_PAGE_SIZE,
    currentPage * CARD_PICKER_PAGE_SIZE
  )

  const updateSort = (nextSort: CardPickerSortKey) => {
    setPage(1)
    if (sort === nextSort) {
      setDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSort(nextSort)
    setDirection(nextSort === 'buy_price' ? 'desc' : 'asc')
  }

  const sortMark = (target: CardPickerSortKey) => {
    if (sort !== target) return ''
    return direction === 'asc' ? ' ↑' : ' ↓'
  }

  const commitPage = (value: string) => {
    const requestedPage = Number.parseInt(value, 10)
    if (!Number.isFinite(requestedPage)) return
    setPage(Math.min(totalPages, Math.max(1, requestedPage)))
  }

  const resetFilters = () => {
    setQuery('')
    setGrade('all')
    setSort('name')
    setDirection('asc')
    setPage(1)
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-picker-title"
    >
      <button
        type="button"
        className="absolute inset-0"
        aria-label="閉じる"
        onClick={onClose}
      />
      <div className="relative flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 text-white shadow-2xl">
        <div className="flex flex-col gap-3 border-b border-zinc-800 px-5 py-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d7b865]">
              Card master
            </p>
            <h2 id="card-picker-title" className="mt-1 text-xl font-black">
              既存カードを選択
            </h2>
            <p className="mt-1 text-sm font-semibold text-zinc-400">
              カード管理と同じ項目で検索し、行をクリックすると選択できます。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-full border border-zinc-700 text-sm font-black hover:bg-zinc-900"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          <div className="grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 md:grid-cols-2 xl:grid-cols-[1.4fr_160px_160px_160px_auto]">
            <label className="block">
              <span className="mb-1 block text-xs font-black text-zinc-400">
                カード名・型番で検索
              </span>
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setPage(1)
                }}
                placeholder="例: ピカチュウ 109"
                className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm font-semibold text-white outline-none placeholder:text-zinc-600 focus:border-[#c9a52e]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-black text-zinc-400">
                グレード
              </span>
              <select
                value={grade}
                onChange={(event) => {
                  setGrade(event.target.value as CardPickerGradeFilter)
                  setPage(1)
                }}
                className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm font-black text-white outline-none focus:border-[#c9a52e]"
              >
                <option value="all">すべて</option>
                {CARD_GRADES.map((cardGrade) => (
                  <option key={cardGrade} value={cardGrade}>
                    {cardGrade}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-black text-zinc-400">
                並び替え
              </span>
              <select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value as CardPickerSortKey)
                  setPage(1)
                }}
                className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm font-black text-white outline-none focus:border-[#c9a52e]"
              >
                <option value="name">カード名</option>
                <option value="card_number">型番</option>
                <option value="grade">グレード</option>
                <option value="buy_price">買取価格</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-black text-zinc-400">
                方向
              </span>
              <select
                value={direction}
                onChange={(event) => {
                  setDirection(event.target.value as CardPickerSortDirection)
                  setPage(1)
                }}
                className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm font-black text-white outline-none focus:border-[#c9a52e]"
              >
                <option value="asc">昇順</option>
                <option value="desc">降順</option>
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={resetFilters}
                className="h-10 w-full rounded-lg border border-zinc-700 px-4 text-xs font-black text-zinc-300 hover:bg-zinc-900"
              >
                クリア
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 text-sm font-black text-zinc-400">
            <p>
              検索結果{' '}
              <span className="text-white">
                {filteredCards.length.toLocaleString('ja-JP')}件
              </span>
            </p>
            {selectedId && (
              <p className="text-xs text-[#d7b865]">現在選択中のカードを強調表示しています</p>
            )}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950">
            <table className="w-full min-w-[960px]">
              <thead className="bg-[#222221]">
                <tr className="text-left text-xs text-zinc-400">
                  <th className="px-4 py-3 font-black">画像</th>
                  <th className="px-4 py-3 font-black">
                    <button
                      type="button"
                      onClick={() => updateSort('name')}
                      className="hover:text-white"
                    >
                      カード名{sortMark('name')}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-black">カテゴリ</th>
                  <th className="px-4 py-3 font-black">
                    <button
                      type="button"
                      onClick={() => updateSort('card_number')}
                      className="hover:text-white"
                    >
                      型番{sortMark('card_number')}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-black">
                    <button
                      type="button"
                      onClick={() => updateSort('grade')}
                      className="hover:text-white"
                    >
                      グレード{sortMark('grade')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right font-black">
                    <button
                      type="button"
                      onClick={() => updateSort('buy_price')}
                      className="hover:text-white"
                    >
                      買取価格{sortMark('buy_price')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right font-black">操作</th>
                </tr>
              </thead>
              <tbody>
                {pageCards.map((card) => {
                  const selected = card.id === selectedId
                  return (
                    <tr
                      key={card.id}
                      tabIndex={0}
                      role="button"
                      aria-pressed={selected}
                      onClick={() => onSelect(card)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onSelect(card)
                        }
                      }}
                      className={[
                        'cursor-pointer border-t border-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#c9a52e]',
                        selected ? 'bg-[#1b1710]' : 'hover:bg-zinc-900',
                      ].join(' ')}
                    >
                      <td className="px-4 py-3">
                        <CardThumb card={card} />
                      </td>
                      <td className="px-4 py-3 text-sm font-black text-white">
                        {card.name}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-black ${categoryBadge(card.category)}`}
                        >
                          {CATEGORY_LABELS[card.category]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-300">
                        {card.card_number ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-300">
                        {card.grade}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-black text-[#f6f0dc]">
                        {currency(card.buy_price)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            onSelect(card)
                          }}
                          className="h-9 rounded-lg bg-red-600 px-4 text-xs font-black text-white hover:bg-red-500"
                        >
                          選択
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {pageCards.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-sm font-semibold text-zinc-500"
                    >
                      該当するカードがありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 text-sm font-black text-zinc-400 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <span>ページ</span>
              <input
                key={currentPage}
                type="number"
                min="1"
                max={totalPages}
                defaultValue={currentPage}
                onBlur={(event) => commitPage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    commitPage(event.currentTarget.value)
                  }
                }}
                className="h-9 w-20 rounded border border-zinc-700 bg-zinc-950 px-3 text-center text-sm font-black text-white outline-none"
                aria-label="現在のページ"
              />
              <span>/ {totalPages}</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded border border-zinc-700 px-3 py-2 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                前へ
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                className="rounded border border-zinc-700 px-3 py-2 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                次へ
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AssessmentEditor({
  orderId,
  status,
  assessmentSavedAt,
  items,
  cardOptions = [],
  nextStatuses = [],
  previousStatuses = [],
}: {
  orderId: string
  status: OrderStatus
  assessmentSavedAt?: string | null
  items: AssessmentEditorItem[]
  cardOptions?: AssessmentCardOption[]
  nextStatuses?: OrderStatus[]
  previousStatuses?: OrderStatus[]
}) {
  const router = useRouter()
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      items
        .filter((item) => item.item_type !== 'unlisted')
        .map((item) => [
          item.id,
          String(item.assessed_unit_price ?? item.unit_price),
        ])
    )
  )
  const [manualUnlistedItems, setManualUnlistedItems] = useState<
    ManualUnlistedDraft[]
  >(() =>
    items
      .filter((item) => item.item_type === 'unlisted')
      .map((item) => newManualUnlistedDraft(item.id))
  )
  const [error, setError] = useState<string>()
  const [success, setSuccess] = useState<string>()
  const [pending, startTransition] = useTransition()
  const [cardPickerTargetId, setCardPickerTargetId] = useState<string | null>(null)
  const editable = canEditOrderAssessment(status, assessmentSavedAt)
  const needsAssessmentRepair = status === 'pending_approval' && !assessmentSavedAt

  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | ''>(
    nextStatuses[0] ?? ''
  )
  const [rollbackSelected, setRollbackSelected] = useState<OrderStatus | ''>(
    previousStatuses[previousStatuses.length - 1] ?? ''
  )
  const [rollbackReason, setRollbackReason] = useState('')
  const listedItems = useMemo(
    () => items.filter((item) => item.item_type !== 'unlisted'),
    [items]
  )
  const unlistedItems = useMemo(
    () => items.filter((item) => item.item_type === 'unlisted'),
    [items]
  )

  const rows = useMemo(
    () =>
      listedItems.map((item) => {
        const assessedUnitPrice = normalizePriceInput(prices[item.id] ?? '0')
        return {
          ...item,
          assessedUnitPrice,
          assessedSubtotal: assessedUnitPrice * item.quantity,
          isReduced: assessedUnitPrice < item.unit_price,
        }
      }),
    [listedItems, prices]
  )
  const manualRows = useMemo(
    () =>
      manualUnlistedItems.map((item) => {
        const assessedUnitPrice = normalizePriceInput(item.assessedUnitPrice)
        return {
          ...item,
          assessedUnitPrice,
          assessedSubtotal: assessedUnitPrice,
        }
      }),
    [manualUnlistedItems]
  )
  const assessedTotal = rows.reduce(
    (sum, item) => sum + item.assessedSubtotal,
    manualRows.reduce((sum, item) => sum + item.assessedSubtotal, 0)
  )
  const originalTotal = items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  )
  const hasUnlistedItems = unlistedItems.length > 0

  const selectExistingCard = (localId: string, cardId: string) => {
    const card = cardOptions.find((option) => option.id === cardId)

    if (!card) {
      updateManualUnlistedItem(localId, {
        existingCardId: '',
        cardName: '',
        grade: 'PSA10',
        assessedUnitPrice: '0',
        saveToDb: true,
      })
      return
    }

    updateManualUnlistedItem(localId, {
      existingCardId: card.id,
      cardName: card.name,
      grade: card.grade,
      assessedUnitPrice: String(card.buy_price),
      saveToDb: false,
    })
  }

  const updateManualUnlistedItem = (
    localId: string,
    patch: Partial<ManualUnlistedDraft>
  ) => {
    setManualUnlistedItems((current) =>
      current.map((item) =>
        item.localId === localId ? { ...item, ...patch } : item
      )
    )
  }

  const handleSaveAssessment = (event: React.FormEvent) => {
    event.preventDefault()
    setError(undefined)
    setSuccess(undefined)

    if (!editable) {
      setError('査定額を変更できるのは査定中の注文のみです')
      return
    }

    if (hasUnlistedItems && manualRows.some((item) => !item.cardName.trim())) {
      setError('リストにない商品のカード名を入力してください')
      return
    }

    startTransition(async () => {
      const result = await saveOrderAssessment(
        orderId,
        rows.map((item) => ({
          itemId: item.id,
          assessedUnitPrice: item.assessedUnitPrice,
        })),
        manualRows.map((item) => ({
          existingCardId: item.existingCardId || null,
          cardName: item.cardName,
          grade: item.grade,
          assessedUnitPrice: item.assessedUnitPrice,
          saveToDb: item.saveToDb,
        }))
      )

      if (result?.error) {
        setError(result.error)
        return
      }

      setSuccess('査定額を保存しました')
      router.refresh()
    })
  }

  const handleStatusUpdate = (event: React.FormEvent) => {
    event.preventDefault()
    setError(undefined)
    setSuccess(undefined)

    if (!selectedStatus) {
      setError('変更先ステータスを選択してください')
      return
    }

    startTransition(async () => {
      const result = await setOrderStatus(orderId, selectedStatus)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccess('ステータスを更新しました')
        router.refresh()
      }
    })
  }

  const handleRollback = (event: React.FormEvent) => {
    event.preventDefault()
    setError(undefined)
    setSuccess(undefined)

    if (!rollbackSelected) {
      setError('戻し先ステータスを選択してください')
      return
    }

    const reason = rollbackReason.trim()
    if (!reason) {
      setError('ステータスを戻す理由を入力してください')
      return
    }

    if (!window.confirm('本当にステータスを戻しますか？')) return

    startTransition(async () => {
      const result = await setOrderStatus(orderId, rollbackSelected, reason)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccess('ステータスを戻しました')
        setRollbackReason('')
        router.refresh()
      }
    })
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">申込カードと当社査定額</h2>
          <p className="mt-1 text-sm text-zinc-400">
            {needsAssessmentRepair
              ? 'お客様対応待ちですが査定額が未保存です。ここで査定額を保存するとユーザー確認へ進められます。'
              : editable
              ? '保存すると注文はお客様対応待ちへ移動し、ユーザーが商品ごとに承認またはキャンセルを選択できます。'
              : '査定結果を確認し、次のステータスへ進めてください。'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right text-sm">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
            <p className="text-xs text-zinc-500">申込時合計</p>
            <p className="font-black text-zinc-200">{currency(originalTotal)}</p>
          </div>
          <div className="rounded-xl border border-[#c9a52e]/40 bg-[#c9a52e]/10 px-3 py-2">
            <p className="text-xs text-[#d7b865]">査定合計</p>
            <p className="font-black text-[#f6f0dc]">{currency(assessedTotal)}</p>
          </div>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-950/50 px-4 py-3 text-sm font-bold text-red-300">
          {error}
        </p>
      )}
      {success && (
        <p className="mb-4 rounded-lg bg-emerald-950/50 px-4 py-3 text-sm font-bold text-emerald-300">
          {success}
        </p>
      )}

      <form onSubmit={handleSaveAssessment} className="space-y-5">
        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="border-b border-zinc-700 text-left text-sm text-zinc-400">
                  <th className="pb-2 font-medium">カード名</th>
                  <th className="pb-2 font-medium">グレード</th>
                  <th className="pb-2 text-right font-medium">数量</th>
                  <th className="pb-2 text-right font-medium">申込時単価</th>
                  <th className="pb-2 text-right font-medium">当社査定額</th>
                  <th className="pb-2 text-right font-medium">査定小計</th>
                  <th className="pb-2 text-center font-medium">減額</th>
                  <th className="pb-2 text-center font-medium">ユーザー回答</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id} className="border-b border-zinc-800 align-top">
                    <td className="py-3 pr-3 text-sm text-white">
                      <span className="font-bold">{item.card_name}</span>
                    </td>
                    <td className="py-3 pr-3 text-sm text-zinc-400">{item.grade}</td>
                    <td className="py-3 pr-3 text-right text-sm text-white">
                      {item.quantity}枚
                    </td>
                    <td className="py-3 pr-3 text-right text-sm text-white">
                      {currency(item.unit_price)}
                    </td>
                    <td className="py-3 pr-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <input
                          inputMode="numeric"
                          value={prices[item.id] ?? ''}
                          disabled={!editable || pending}
                          onChange={(event) =>
                            setPrices((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                          className="h-10 w-32 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-right text-sm font-black text-white outline-none focus:border-[#c9a52e] disabled:cursor-not-allowed disabled:bg-zinc-900 disabled:text-zinc-500"
                        />
                        {!editable && (
                          <StopIcon tooltip="査定中のみ変更できます" />
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-right text-sm font-black text-[#f6f0dc]">
                      {currency(item.assessedSubtotal)}
                    </td>
                    <td className="py-3 pr-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${
                          item.isReduced
                            ? 'bg-red-500/15 text-red-300'
                            : 'bg-emerald-500/15 text-emerald-300'
                        }`}
                      >
                        {item.isReduced ? '減額あり' : '減額なし'}
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${decisionClass(item.customer_decision)}`}
                      >
                        {decisionLabel(item.customer_decision)}
                      </span>
                      {item.customer_decided_at && (
                        <span className="mt-1 block text-[11px] text-zinc-500">
                          {new Date(item.customer_decided_at).toLocaleString('ja-JP')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-500">
            通常の申込カードはありません。
          </p>
        )}

        {hasUnlistedItems && (
          <div className="rounded-2xl border border-[#c9a52e]/30 bg-[#0f0e0b] p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-base font-black text-[#f6f0dc]">
                  リストにない商品の査定依頼
                </h3>
                <p className="mt-1 text-sm font-semibold text-zinc-400">
                  到着した商品を確認し、既存カードの選択または手動入力で査定結果を追加してください。該当カードがない場合はカード0枚のまま保存できます。
                </p>
              </div>
              <span className="rounded-full border border-[#c9a52e]/40 bg-[#c9a52e]/10 px-3 py-1 text-xs font-black text-[#d7b865]">
                {unlistedItems.length}件
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {manualUnlistedItems.length === 0 && (
                <p className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm font-semibold text-zinc-400">
                  追加するカードはありません。このまま保存すると、リストにない商品の依頼表示だけを削除し、査定対象カード0枚としてユーザー側に反映します。
                </p>
              )}
              {manualUnlistedItems.map((item, index) => {
                const assessedUnitPrice = normalizePriceInput(item.assessedUnitPrice)
                const selectedExistingCard = cardOptions.find(
                  (option) => option.id === item.existingCardId
                )
                return (
                  <div
                    key={item.localId}
                    className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3 xl:grid-cols-[minmax(220px,1.4fr)_minmax(220px,1fr)_120px_150px_150px_auto]"
                  >
                    <div className="text-xs font-black text-zinc-500">
                      既存カードから選択
                      <div className="mt-1 min-h-20 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                        {selectedExistingCard ? (
                          <div className="flex gap-3">
                            <CardThumb card={selectedExistingCard} size="md" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-black text-white">
                                {selectedExistingCard.name}
                              </p>
                              <p className="mt-1 text-xs font-semibold text-zinc-400">
                                {[
                                  CATEGORY_LABELS[selectedExistingCard.category],
                                  selectedExistingCard.grade,
                                  selectedExistingCard.card_number || '型番なし',
                                ].join(' / ')}
                              </p>
                              <p className="mt-1 text-xs font-black text-[#f6f0dc]">
                                掲載価格 {currency(selectedExistingCard.buy_price)}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm font-semibold text-zinc-400">
                            手動入力中です。カード管理と同じ一覧から既存カードを検索して選択できます。
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={!editable || pending}
                            onClick={() => setCardPickerTargetId(item.localId)}
                            className="rounded-lg border border-[#c9a52e]/50 px-3 py-2 text-xs font-black text-[#d7b865] hover:bg-[#c9a52e]/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {selectedExistingCard ? '選択変更' : 'カード管理から選択'}
                          </button>
                          {selectedExistingCard && (
                            <button
                              type="button"
                              disabled={!editable || pending}
                              onClick={() => selectExistingCard(item.localId, '')}
                              className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-black text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              手動入力に戻す
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <label className="text-xs font-black text-zinc-500">
                      カード名
                      <input
                        value={item.cardName}
                        disabled={!editable || pending || Boolean(item.existingCardId)}
                        onChange={(event) =>
                          updateManualUnlistedItem(item.localId, {
                            cardName: event.target.value,
                          })
                        }
                        placeholder={`手動追加カード ${index + 1}`}
                        className="mt-1 h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm font-black text-white outline-none focus:border-[#c9a52e] disabled:cursor-not-allowed disabled:text-zinc-500"
                      />
                    </label>
                    <label className="text-xs font-black text-zinc-500">
                      グレード
                      <select
                        value={item.grade}
                        disabled={!editable || pending || Boolean(item.existingCardId)}
                        onChange={(event) =>
                          updateManualUnlistedItem(item.localId, {
                            grade: event.target.value as CardGrade,
                          })
                        }
                        className="mt-1 h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm font-black text-white outline-none focus:border-[#c9a52e] disabled:cursor-not-allowed disabled:text-zinc-500"
                      >
                        {CARD_GRADES.map((grade) => (
                          <option key={grade} value={grade}>
                            {grade}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-black text-zinc-500">
                      当社査定額
                      <input
                        inputMode="numeric"
                        value={item.assessedUnitPrice}
                        disabled={!editable || pending}
                        onChange={(event) =>
                          updateManualUnlistedItem(item.localId, {
                            assessedUnitPrice: event.target.value,
                          })
                        }
                        className="mt-1 h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-right text-sm font-black text-white outline-none focus:border-[#c9a52e] disabled:cursor-not-allowed disabled:text-zinc-500"
                      />
                    </label>
                    {selectedExistingCard ? (
                      <div className="rounded-lg border border-[#c9a52e]/30 bg-[#c9a52e]/10 px-3 py-2 text-sm font-black text-[#d7b865]">
                        <span>登録済みカード</span>
                        <span className="mt-1 block text-[11px] leading-relaxed text-zinc-400">
                          当社査定額を下げてもカードマスタ価格は更新しません。
                        </span>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm font-black text-zinc-200">
                        <input
                          type="checkbox"
                          checked={item.saveToDb}
                          disabled={!editable || pending}
                          onChange={(event) =>
                            updateManualUnlistedItem(item.localId, {
                              saveToDb: event.target.checked,
                            })
                          }
                          className="h-4 w-4 accent-[#c9a52e]"
                        />
                        <span>DBに保存する</span>
                      </label>
                    )}
                    <div className="flex items-end justify-between gap-2 lg:flex-col lg:items-end">
                      <div className="space-y-1 text-right">
                        {selectedExistingCard && (
                          <p className="text-xs font-black text-zinc-500">
                            掲載価格
                            <span className="ml-2 text-sm text-zinc-300">
                              {currency(selectedExistingCard.buy_price)}
                            </span>
                          </p>
                        )}
                        <p className="text-xs font-black text-zinc-500">
                          査定小計
                          <span className="ml-2 text-sm text-[#f6f0dc]">
                            {currency(assessedUnitPrice)}
                          </span>
                        </p>
                        {selectedExistingCard && (
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${
                              assessedUnitPrice < selectedExistingCard.buy_price
                                ? 'bg-red-500/15 text-red-300'
                                : 'bg-emerald-500/15 text-emerald-300'
                            }`}
                          >
                            {assessedUnitPrice < selectedExistingCard.buy_price
                              ? '減額あり'
                              : '減額なし'}
                          </span>
                        )}
                      </div>
                      {editable && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            setManualUnlistedItems((current) =>
                              current.filter((draft) => draft.localId !== item.localId)
                            )
                          }
                          className="rounded-lg border border-red-700 px-3 py-2 text-xs font-black text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                        >
                          除外
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {editable && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    setManualUnlistedItems((current) => [
                      ...current,
                      newManualUnlistedDraft(),
                    ])
                  }
                  className="rounded-xl border border-[#c9a52e]/40 px-4 py-2 text-sm font-black text-[#d7b865] transition-colors hover:bg-[#c9a52e]/10 disabled:opacity-50"
                >
                  カードを追加
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setManualUnlistedItems([])}
                  className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-black text-zinc-300 transition-colors hover:bg-zinc-900 disabled:opacity-50"
                >
                  カード0枚にする
                </button>
              </div>
            )}
          </div>
        )}

        {/* 査定保存ボタン（査定中のみ） */}
        {editable && (
          <div className="flex justify-end border-t border-zinc-800 pt-5">
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-red-500 disabled:opacity-50"
            >
              {pending ? '保存中...' : '査定額を保存してお客様対応待ちへ'}
            </button>
          </div>
        )}
      </form>

      {/* ステータス遷移（査定中以外） */}
      {!editable && (
        <div className="mt-5 space-y-5 border-t border-zinc-800 pt-5">
          {nextStatuses.length > 0 ? (
            <form onSubmit={handleStatusUpdate} className="space-y-3">
              <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                    次のアクション
                  </p>
                  <h3 className="mt-1 text-sm font-black text-white">
                    現在: {ORDER_STATUS_LABELS[status]}
                  </h3>
                  <p className="mt-1 text-xs font-semibold text-zinc-400">
                    次の状態へ進めます。
                  </p>
                </div>
                {nextStatuses.length === 1 ? (
                  <input type="hidden" name="nextStatus" value={selectedStatus} />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {nextStatuses.map((s) => (
                      <label
                        key={s}
                        className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${
                          selectedStatus === s
                            ? 'border-red-500 bg-zinc-800'
                            : 'border-zinc-700 hover:border-zinc-500'
                        }`}
                      >
                        <input
                          type="radio"
                          name="nextStatus"
                          value={s}
                          checked={selectedStatus === s}
                          onChange={() => setSelectedStatus(s)}
                          className="accent-red-600"
                        />
                        <span className="text-xs font-black text-white">
                          {ORDER_STATUS_LABELS[s]}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {selectedStatus && EMAIL_TRIGGER_STATUSES.includes(selectedStatus) && (
                <p className="text-xs font-semibold text-zinc-400">メール送信あり</p>
              )}
              <button
                type="submit"
                disabled={pending || !selectedStatus}
                className="w-full rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {pending
                  ? '更新中...'
                  : selectedStatus
                    ? (STATUS_ACTION_LABELS[selectedStatus] ?? 'ステータスを更新')
                    : 'ステータスを更新'}
              </button>
            </form>
          ) : (
            <p className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-500">
              {STATUS_HELPER_TEXT[status] ?? 'このステータスで実行できる次アクションはありません。'}
            </p>
          )}

          {previousStatuses.length > 0 && (
            <form
              onSubmit={handleRollback}
              className="space-y-3 border-t border-zinc-800 pt-5"
            >
              <h3 className="text-sm font-black text-white">ステータスを戻す</h3>
              <select
                value={rollbackSelected}
                onChange={(event) =>
                  setRollbackSelected(event.target.value as OrderStatus)
                }
                className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm font-black text-white outline-none"
              >
                {previousStatuses.map((s) => (
                  <option key={s} value={s}>
                    {ORDER_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <textarea
                value={rollbackReason}
                onChange={(event) => setRollbackReason(event.target.value)}
                placeholder="戻し理由を入力"
                className="min-h-24 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500"
              />
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-lg border border-red-700 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-950/40 disabled:opacity-50"
              >
                {pending ? '更新中...' : '理由を記録して戻す'}
              </button>
            </form>
          )}
        </div>
      )}

      {cardPickerTargetId && (
        <CardPickerModal
          cards={cardOptions}
          selectedId={
            manualUnlistedItems.find((item) => item.localId === cardPickerTargetId)
              ?.existingCardId ?? ''
          }
          onSelect={(card) => {
            selectExistingCard(cardPickerTargetId, card.id)
            setCardPickerTargetId(null)
          }}
          onClose={() => setCardPickerTargetId(null)}
        />
      )}
    </section>
  )
}
