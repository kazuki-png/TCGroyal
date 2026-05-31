import { createAdminClient } from '@/lib/supabase/admin'
import type { Card } from '@/lib/types'
import {
  type CardUserVisibility,
  visiblePriceUpdatedAfter,
} from '@/lib/cards/visibility'
import {
  CardsAdminClient,
  type CardSortDirection,
  type CardSortKey,
  type CardTableFilters,
} from './CardsAdminClient'

type CategoryFilter = 'all' | 'pokemon' | 'onepiece'

const PAGE_SIZE = 20

function normalizeCategory(value: string | string[] | undefined): CategoryFilter {
  const raw = Array.isArray(value) ? value[0] : value
  if (raw === 'pokemon' || raw === 'onepiece') return raw
  return 'all'
}

function normalizePage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const page = Number.parseInt(raw ?? '1', 10)
  return Number.isFinite(page) && page > 0 ? page : 1
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

function normalizeSort(value: string | string[] | undefined): CardSortKey {
  const raw = first(value)
  if (
    raw === 'name' ||
    raw === 'card_number' ||
    raw === 'grade' ||
    raw === 'buy_price' ||
    raw === 'buy_price_updated_at'
  ) {
    return raw
  }
  return 'created_at'
}

function normalizeDirection(value: string | string[] | undefined): CardSortDirection {
  return first(value) === 'asc' ? 'asc' : 'desc'
}

function normalizeVisibility(value: string | string[] | undefined): CardUserVisibility {
  const raw = first(value)
  if (raw === 'visible' || raw === 'hidden') return raw
  return 'all'
}

function normalizePrice(value: string) {
  const price = Number.parseInt(value.replace(/[^\d]/g, ''), 10)
  return Number.isFinite(price) ? price : null
}

export default async function AdminCardsPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string | string[]
    page?: string | string[]
    name?: string | string[]
    card_number?: string | string[]
    grade?: string | string[]
    price_min?: string | string[]
    price_max?: string | string[]
    visibility?: string | string[]
    sort?: string | string[]
    dir?: string | string[]
    saved?: string | string[]
    deleted?: string | string[]
    error?: string | string[]
  }>
}) {
  const params = await searchParams
  const category = normalizeCategory(params.category)
  const page = normalizePage(params.page)
  const filters: CardTableFilters = {
    name: first(params.name).trim(),
    cardNumber: first(params.card_number).trim(),
    grade: first(params.grade).trim(),
    priceMin: first(params.price_min).trim(),
    priceMax: first(params.price_max).trim(),
    visibility: normalizeVisibility(params.visibility),
    sort: normalizeSort(params.sort),
    dir: normalizeDirection(params.dir),
  }
  const priceMin = normalizePrice(filters.priceMin)
  const priceMax = normalizePrice(filters.priceMax)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const admin = createAdminClient()

  let cardsQuery = admin
    .from('cards')
    .select('*', { count: 'exact' })

  if (category !== 'all') cardsQuery = cardsQuery.eq('category', category)
  if (filters.name) cardsQuery = cardsQuery.ilike('name', `%${filters.name}%`)
  if (filters.cardNumber) {
    cardsQuery = cardsQuery.ilike('card_number', `%${filters.cardNumber}%`)
  }
  if (filters.grade) cardsQuery = cardsQuery.eq('grade', filters.grade)
  if (priceMin !== null) cardsQuery = cardsQuery.gte('buy_price', priceMin)
  if (priceMax !== null) cardsQuery = cardsQuery.lte('buy_price', priceMax)
  if (filters.visibility === 'visible') {
    cardsQuery = cardsQuery.gte('buy_price_updated_at', visiblePriceUpdatedAfter())
  }
  if (filters.visibility === 'hidden') {
    cardsQuery = cardsQuery.or(
      `buy_price_updated_at.is.null,buy_price_updated_at.lt.${visiblePriceUpdatedAfter()}`
    )
  }

  cardsQuery = cardsQuery
    .order(filters.sort, { ascending: filters.dir === 'asc' })
    .range(from, to)

  const [cardsResult, allCount, pokemonCount, onepieceCount] = await Promise.all([
    cardsQuery,
    admin.from('cards').select('id', { count: 'exact', head: true }),
    admin
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('category', 'pokemon'),
    admin
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('category', 'onepiece'),
  ])

  const total = cardsResult.count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <CardsAdminClient
      cards={(cardsResult.data ?? []) as Card[]}
      category={category}
      page={Math.min(page, totalPages)}
      totalPages={totalPages}
      counts={{
        all: allCount.count ?? 0,
        pokemon: pokemonCount.count ?? 0,
        onepiece: onepieceCount.count ?? 0,
      }}
      filters={filters}
      saved={first(params.saved) || undefined}
      deleted={first(params.deleted) || undefined}
      error={first(params.error) || undefined}
    />
  )
}
