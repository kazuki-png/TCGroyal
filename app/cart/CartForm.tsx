'use client'

import Image, { type StaticImageData } from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import { createOrder } from '@/app/actions/orders'
import kangaskhanImage from '@/app/assets/kangaskhan.png'
import { HomeBannerCarousel } from '@/app/components/HomeBannerCarousel'
import {
  CART_OPEN_REQUEST_EVENT,
  CART_TOTAL_QUANTITY_EVENT,
} from './CartHeaderLink'
import type { Card, CartItem, HomepageBanner, Profile } from '@/lib/types'

type Category = 'pokemon' | 'onepiece'
type SortKey = 'price-desc' | 'price-asc' | 'name'
type ViewMode = 'catalog' | 'cart'

const FLOW_URL = 'https://www.notion.so/'
const CART_STORAGE_KEY = 'tcg_royal_purchase_cart'
const CARDS_PER_PAGE = 12

const CATEGORY_LABEL: Record<Category, string> = {
  pokemon: 'ポケモン',
  onepiece: 'ワンピース',
}

const SORT_LABEL: Record<SortKey, string> = {
  'price-desc': '価格が高い順',
  'price-asc': '価格が低い順',
  name: '名前順',
}

const SAMPLE_CARDS: Card[] = [
  {
    id: 'sample-kangaskhan-pokemon',
    card_number: '109/244',
    name: 'ガルーラ',
    category: 'pokemon',
    grade: 'PSA10',
    buy_price: 160000,
    image_url: null,
    created_at: '',
    updated_at: '',
  },
  {
    id: 'sample-onepiece-card',
    card_number: 'OP01-001',
    name: 'ONE PIECE サンプルカード',
    category: 'onepiece',
    grade: 'PSA10',
    buy_price: 98000,
    image_url: null,
    created_at: '',
    updated_at: '',
  },
]

const UNLISTED_CARD: Card = {
  id: 'unlisted-card-request',
  card_number: null,
  name: 'リストにない商品',
  category: 'pokemon',
  grade: 'PSA10',
  buy_price: 0,
  image_url: null,
  created_at: '',
  updated_at: '',
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s#\-_/]/g, '')
}

function matchesKeyword(card: Card, keyword: string) {
  const tokens = keyword
    .normalize('NFKC')
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)

  if (tokens.length === 0) return true

  const name = normalizeText(card.name)
  const number = normalizeText(card.card_number)
  const combined = normalizeText(`${card.name}${card.card_number ?? ''}`)
  const numberParts = (card.card_number ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .split(/[^\dA-Za-z]+/)
    .filter(Boolean)

  return tokens.every((token) => {
    const normalizedToken = normalizeText(token)
    return (
      name.includes(normalizedToken) ||
      number.includes(normalizedToken) ||
      combined.includes(normalizedToken) ||
      numberParts.some((part) => part.includes(normalizedToken))
    )
  })
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

function cardImageSource(
  card: Card,
  repeatedImageUrls: Set<string>
): StaticImageData | string | null {
  const normalizedUrl = normalizeImageUrl(card.image_url)
  if (card.image_url && normalizedUrl && !repeatedImageUrls.has(normalizedUrl)) {
    return card.image_url
  }

  if (card.id.startsWith('sample-')) return kangaskhanImage

  return null
}

function imageSourceUrl(src: StaticImageData | string | null) {
  if (!src) return null
  return typeof src === 'string' ? src : src.src
}

function getPaginationItems(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  if (current <= 3) return [1, 2, 3, 'ellipsis', total]
  if (current >= total - 2) return [1, 'ellipsis', total - 2, total - 1, total]
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total]
}

function readStoredCart() {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CartItem[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item) => {
      return (
        item?.card &&
        typeof item.card.id === 'string' &&
        typeof item.card.name === 'string' &&
        typeof item.quantity === 'number' &&
        item.quantity > 0
      )
    })
  } catch {
    return []
  }
}

function writeStoredCart(cart: CartItem[]) {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
  } catch {
    // カートの主状態はReact stateに残るので、保存失敗は無視する。
  }
}

function clearStoredCart() {
  try {
    window.localStorage.removeItem(CART_STORAGE_KEY)
  } catch {
    // カートの主状態はReact stateに残るので、削除失敗は無視する。
  }
}

function CartIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 40 40"
      className="h-9 w-9"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.6"
    >
      <path d="M5 8h4l3 19h20l3-14H12" />
      <path d="M14 18h19" />
      <path d="M17 13v14" />
      <path d="M24 13v14" />
      <circle cx="16" cy="34" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="31" cy="34" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

function CardPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-lg bg-zinc-100 dark:bg-[#1e1c17]">
      <span className="text-[10px] font-black tracking-[0.22em] text-zinc-300 dark:text-[#4a4233]">
        NO IMAGE
      </span>
    </div>
  )
}

function CardImage({
  src,
  alt,
  onClick,
}: {
  src: StaticImageData | string | null
  alt: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!src}
      className="relative h-[178px] w-[124px] shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 shadow-sm dark:border-[#2d2a20] dark:bg-[#1e1c17] sm:h-[210px] sm:w-[146px]"
      aria-label={`${alt}を拡大表示`}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(min-width: 640px) 146px, 124px"
          className="object-contain"
        />
      ) : (
        <CardPlaceholder />
      )}
    </button>
  )
}

function QuantityControl({
  quantity,
  onDecrement,
  onIncrement,
}: {
  quantity: number
  onDecrement: () => void
  onIncrement: () => void
}) {
  return (
    <div className="flex h-10 w-[124px] items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold shadow-sm dark:border-[#2d2a20] dark:bg-[#1c1b18] dark:text-[#ede8d5]">
      <button
        type="button"
        onClick={onDecrement}
        className="text-lg leading-none"
        aria-label="数量を減らす"
      >
        -
      </button>
      <span>{quantity || 1}</span>
      <button
        type="button"
        onClick={onIncrement}
        className="text-lg leading-none"
        aria-label="数量を増やす"
      >
        +
      </button>
    </div>
  )
}

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  if (totalPages <= 1) return null

  const items = getPaginationItems(page, totalPages)

  return (
    <nav
      aria-label="ページネーション"
      className="mt-8 flex justify-center"
    >
      <div className="inline-flex overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-[#2d2a20] dark:bg-[#1c1b18]">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="flex h-12 items-center gap-1 border-r border-zinc-200 px-5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-300 dark:border-[#2d2a20] dark:text-[#7a6e55] dark:hover:bg-[#252420] dark:disabled:text-[#3a3628]"
        >
          <span aria-hidden="true">‹</span>
          前へ
        </button>
        {items.map((item, index) =>
          item === 'ellipsis' ? (
            <span
              key={`ellipsis-${index}`}
              className="flex h-12 min-w-12 items-center justify-center px-3 text-sm text-zinc-500 dark:text-[#5a5243]"
            >
              ...
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-current={item === page ? 'page' : undefined}
              className={[
                'h-12 min-w-12 px-4 text-sm transition-colors',
                item === page
                  ? 'border-x border-zinc-950 bg-white font-black text-zinc-950 dark:border-[#c9a52e] dark:bg-[#0e0c09] dark:text-[#c9a52e]'
                  : 'font-medium text-zinc-700 hover:bg-zinc-50 dark:text-[#7a6e55] dark:hover:bg-[#252420]',
              ].join(' ')}
            >
              {item}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="flex h-12 items-center gap-1 border-l border-zinc-200 px-5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-300 dark:border-[#2d2a20] dark:text-[#7a6e55] dark:hover:bg-[#252420] dark:disabled:text-[#3a3628]"
        >
          次へ
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </nav>
  )
}

function ScrollToTopButton() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 420)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="ページ最上部へ戻る"
      className={[
        'fixed bottom-6 right-5 z-50 grid h-12 w-12 place-items-center rounded-full bg-zinc-950 text-white shadow-lg transition-all hover:bg-zinc-800 dark:bg-[#c9a52e] dark:text-[#0e0c09] dark:hover:bg-[#d4b73f]',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
      ].join(' ')}
    >
      <span aria-hidden="true" className="text-xl font-black">↑</span>
    </button>
  )
}

function present(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : '未登録'
}

function accountTypeLabel(value: Profile['account_type']) {
  if (value === 'ordinary') return '普通'
  if (value === 'current') return '当座'
  return null
}

function fullName(profile: Profile | null) {
  if (!profile) return '未登録'
  return present([profile.last_name, profile.first_name].filter(Boolean).join(' '))
}

function addressLine(profile: Profile | null) {
  if (!profile) return '未登録'
  const postalCode = profile.postal_code ? `〒${profile.postal_code}` : ''
  return present([postalCode, profile.address].filter(Boolean).join(' '))
}

function identityUploadInfo(profile: Profile | null) {
  if (!profile) return '未登録'
  if (!profile.id_image_url) return '未アップロード'

  const idType = profile.id_type || '身分証'
  return profile.identity_verified
    ? `${idType} / アップロード済み / 確認済み`
    : `${idType} / アップロード済み`
}

function bankInfo(profile: Profile | null) {
  if (!profile) return '未登録'

  const values = [
    profile.bank_name,
    profile.branch_name,
    accountTypeLabel(profile.account_type),
    profile.account_number,
    profile.account_holder_kana,
  ].filter(Boolean)

  return values.length > 0 ? values.join(' / ') : '未登録'
}

function RequesterInfoSummary({
  profile,
  userEmail,
  pending,
  onSubmit,
}: {
  profile: Profile | null
  userEmail: string | null
  pending: boolean
  onSubmit: () => void
}) {
  const fields = [
    { label: '氏名', value: fullName(profile) },
    { label: 'メールアドレス', value: present(userEmail) },
    { label: '身分証のアップロード情報', value: identityUploadInfo(profile) },
    { label: '住所', value: addressLine(profile) },
    { label: '電話番号', value: present(profile?.phone) },
    { label: '振込先', value: bankInfo(profile) },
  ]

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
      className="space-y-3 pt-5"
    >
      <h2 className="text-lg font-semibold">依頼者情報</h2>
      <dl className="space-y-2">
        {fields.map((field) => (
          <div
            key={field.label}
            className="rounded-[14px] border border-zinc-200 bg-white px-3 py-2 shadow-sm dark:border-[#2d2a20] dark:bg-[#1c1b18]"
          >
            <dt className="text-xs font-black text-zinc-600">{field.label}</dt>
            <dd className="mt-1 break-words text-sm font-semibold text-zinc-950 dark:text-[#ede8d5]">
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-[14px] bg-black text-base font-black text-[#d4c400] disabled:opacity-50"
      >
        {pending ? '申込中...' : '申込へ進む'}
      </button>
    </form>
  )
}

export function CartForm({
  cards,
  banners,
  profile,
  userEmail,
}: {
  cards: Card[]
  banners: HomepageBanner[]
  profile: Profile | null
  userEmail: string | null
}) {
  const router = useRouter()
  const availableCards = cards.length > 0 ? cards : SAMPLE_CARDS
  const [viewMode, setViewMode] = useState<ViewMode>('catalog')
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartLoaded, setCartLoaded] = useState(false)
  const [enabledCategories, setEnabledCategories] = useState<Record<Category, boolean>>({
    pokemon: true,
    onepiece: true,
  })
  const [sort, setSort] = useState<SortKey>('price-desc')
  const [keyword, setKeyword] = useState('')
  const [submittedKeyword, setSubmittedKeyword] = useState('')
  const pageSignature = `${enabledCategories.pokemon ? 'pokemon' : ''}:${enabledCategories.onepiece ? 'onepiece' : ''}:${sort}:${submittedKeyword}`
  const [pagination, setPagination] = useState(() => ({
    page: 1,
    signature: pageSignature,
  }))
  const [categoryControlsVisible, setCategoryControlsVisible] = useState(true)
  const [selectedQuantities, setSelectedQuantities] = useState<
    Record<string, number>
  >({})
  const [preview, setPreview] = useState<{
    src: StaticImageData | string
    alt: string
  }>()
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [pending, startTransition] = useTransition()
  const lastScrollYRef = useRef(0)
  const listTopRef = useRef<HTMLDivElement>(null)

  const repeatedImageUrls = useMemo(() => duplicatedImageUrls(availableCards), [availableCards])

  const filteredCards = useMemo(() => {
    const result = availableCards
      .filter((card) => enabledCategories[card.category as Category])
      .filter((card) => matchesKeyword(card, submittedKeyword))

    return [...result].sort((a, b) => {
      if (sort === 'price-desc') return b.buy_price - a.buy_price
      if (sort === 'price-asc') return a.buy_price - b.buy_price
      return a.name.localeCompare(b.name, 'ja')
    })
  }, [availableCards, enabledCategories, sort, submittedKeyword])

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / CARDS_PER_PAGE))
  const currentPage =
    pagination.signature === pageSignature
      ? Math.min(pagination.page, totalPages)
      : 1
  const displayCards = useMemo(
    () =>
      filteredCards.slice(
        (currentPage - 1) * CARDS_PER_PAGE,
        currentPage * CARDS_PER_PAGE
      ),
    [currentPage, filteredCards]
  )
  const displayImageUrls = useMemo(
    () =>
      Array.from(
        new Set(
          displayCards
            .map((card) => imageSourceUrl(cardImageSource(card, repeatedImageUrls)))
            .filter((src): src is string => Boolean(src))
        )
      ),
    [displayCards, repeatedImageUrls]
  )
  const activeCategoryLabels = (['pokemon', 'onepiece'] as Category[])
    .filter((category) => enabledCategories[category])
    .map((category) => CATEGORY_LABEL[category])
  const activeCategoryText =
    activeCategoryLabels.length > 0 ? activeCategoryLabels.join('・') : 'なし'
  const appliedKeyword = submittedKeyword.trim()
  const hasSearchConditions =
    appliedKeyword.length > 0 ||
    activeCategoryLabels.length !== 2 ||
    sort !== 'price-desc'

  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0)
  const unlistedInCart = cart.some((item) => item.card.id === UNLISTED_CARD.id)

  const getSelectedQuantity = (cardId: string) => selectedQuantities[cardId] ?? 1

  const setSelectedQuantity = (cardId: string, quantity: number) => {
    setSelectedQuantities((prev) => ({
      ...prev,
      [cardId]: Math.max(1, quantity),
    }))
  }

  const addToCart = (card: Card, quantityToAdd = getSelectedQuantity(card.id)) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.card.id === card.id)

      if (existing && card.id === UNLISTED_CARD.id) return prev

      if (existing) {
        return prev.map((item) =>
          item.card.id === card.id
            ? { ...item, quantity: item.quantity + quantityToAdd }
            : item
        )
      }

      return [...prev, { card, quantity: quantityToAdd }]
    })

    setSelectedQuantity(card.id, 1)
    setNotice(`${card.name}をカートに追加しました`)
  }

  const removeFromCart = (cardId: string) => {
    setCart((prev) => prev.filter((item) => item.card.id !== cardId))
  }

  const updateCartQuantity = (cardId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cardId)
      return
    }

    setCart((prev) =>
      prev.map((item) =>
        item.card.id === cardId ? { ...item, quantity } : item
      )
    )
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCart(readStoredCart())
      setCartLoaded(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!cartLoaded) return
    writeStoredCart(cart)
  }, [cart, cartLoaded])

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(CART_TOTAL_QUANTITY_EVENT, { detail: totalQuantity })
    )
  }, [totalQuantity])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(undefined), 1800)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSubmittedKeyword(keyword.trim())
    }, 180)

    return () => window.clearTimeout(timer)
  }, [keyword])

  useEffect(() => {
    const preloadedImages = displayImageUrls.map((src) => {
      const image = new window.Image()
      image.decoding = 'async'
      image.src = src
      return image
    })

    return () => {
      preloadedImages.forEach((image) => {
        image.onload = null
        image.onerror = null
      })
    }
  }, [displayImageUrls])

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

  useEffect(() => {
    const openCart = () => {
      setViewMode('cart')
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
    }

    window.addEventListener(CART_OPEN_REQUEST_EVENT, openCart)
    return () => window.removeEventListener(CART_OPEN_REQUEST_EVENT, openCart)
  }, [])

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmittedKeyword(keyword.trim())
  }

  const toggleCategory = (category: Category) => {
    setEnabledCategories((current) => ({
      ...current,
      [category]: !current[category],
    }))
  }

  const clearSearchConditions = () => {
    setKeyword('')
    setSubmittedKeyword('')
    setEnabledCategories({ pokemon: true, onepiece: true })
    setSort('price-desc')
    setPagination({ page: 1, signature: '' })
  }

  const handlePageChange = (nextPage: number) => {
    const safePage = Math.min(totalPages, Math.max(1, nextPage))
    setPagination({ page: safePage, signature: pageSignature })
    window.requestAnimationFrame(() => {
      listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const handleSubmit = () => {
    setError(undefined)
    if (cart.length === 0) {
      setError('カードを追加してください')
      return
    }

    startTransition(async () => {
      const res = await createOrder(cart, {
        bank_name: profile?.bank_name ?? '',
        bank_branch: profile?.branch_name ?? '',
        bank_account_no: profile?.account_number ?? '',
        bank_holder: profile?.account_holder_kana ?? '',
      })
      if (res?.error) {
        setError(res.error)
        return
      }

      clearStoredCart()
      setCart([])
      setSelectedQuantities({})
      setViewMode('catalog')
      router.push(res?.redirectTo ?? '/mypage/orders')
    })
  }

  const renderCartView = () => (
    <div className="py-5">
      <h1 className="text-center text-xl font-black">カート</h1>
      <div className="mt-4 flex items-center justify-between">
        <h2 className="text-base font-black">買取申込リスト</h2>
        <button
          type="button"
          onClick={() => setViewMode('catalog')}
          className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-black text-zinc-700 dark:border-[#2d2a20] dark:text-[#c9a52e]"
        >
          商品を探す
        </button>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {cart.length === 0 ? (
          <p className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm font-semibold text-zinc-500 shadow-sm dark:border-[#2d2a20] dark:bg-[#1c1b18] dark:text-[#7a6e55] lg:col-span-2">
            カートに商品がありません
          </p>
        ) : (
          cart.map((item) => {
            if (item.card.id === UNLISTED_CARD.id) {
              return (
                <div
                  key={item.card.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_12px_34px_rgba(24,24,27,0.08)] dark:border-[#2d2a20] dark:bg-[#1c1b18] dark:shadow-[0_12px_34px_rgba(0,0,0,0.5)]"
                >
                  <div className="flex gap-3">
                    <div className="h-[178px] w-[124px] shrink-0 rounded-lg bg-zinc-100 dark:bg-[#1e1c17] sm:h-[210px] sm:w-[146px]" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <h3 className="text-center text-xl font-black leading-tight">
                        リストにない商品は
                        <br />
                        こちら
                      </h3>
                      <p className="mt-2 text-xs font-medium leading-relaxed">
                        リストにない商品や、商品名が分からない場合はこちら。
                        <br />
                        1点カートに追加するだけで、まとめてお申し込みいただけます。
                      </p>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.card.id)}
                        className="mt-auto self-end rounded-xl bg-red-600 px-8 py-2 text-sm font-black text-white shadow-sm"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              )
            }

            const imageSrc = cardImageSource(item.card, repeatedImageUrls)

            return (
              <div
                key={item.card.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_12px_34px_rgba(24,24,27,0.08)] dark:border-[#2d2a20] dark:bg-[#1c1b18] dark:shadow-[0_12px_34px_rgba(0,0,0,0.5)]"
              >
                <div className="flex gap-3">
                  <CardImage
                    src={imageSrc}
                    alt={item.card.name}
                    onClick={
                      imageSrc
                        ? () => setPreview({ src: imageSrc, alt: item.card.name })
                        : undefined
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="grid grid-cols-[1fr_auto] items-start gap-x-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-zinc-950 dark:text-[#ede8d5]">
                          {item.card.name}
                        </p>
                        <span className="mt-1 inline-flex rounded-full bg-black px-4 py-2 text-xs font-black text-[#d4c400] dark:bg-[#2d2a20] dark:text-[#c9a52e]">
                          {item.card.grade}
                        </span>
                      </div>
                      <div className="pt-6 text-sm font-medium text-zinc-800 dark:text-[#7a6e55]">
                        <p>型番</p>
                        <p className="max-w-[72px] truncate text-xs text-zinc-500 dark:text-[#5a5243]">
                          {item.card.card_number ?? '-'}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 whitespace-nowrap text-2xl font-black leading-none text-red-600 sm:text-3xl">
                      ¥{item.card.buy_price.toLocaleString()}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <QuantityControl
                        quantity={item.quantity}
                        onDecrement={() =>
                          updateCartQuantity(item.card.id, item.quantity - 1)
                        }
                        onIncrement={() =>
                          updateCartQuantity(item.card.id, item.quantity + 1)
                        }
                      />
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.card.id)}
                        className="h-10 flex-1 rounded-xl bg-red-600 text-sm font-black text-white shadow-sm"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
          {error}
        </p>
      )}

      {cart.length > 0 && (
        <RequesterInfoSummary
          profile={profile}
          userEmail={userEmail}
          pending={pending}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  )

  const renderCatalogView = () => (
    <>
      <div
        className={[
          'sticky top-[69px] z-30 border-b border-zinc-200 bg-white/95 py-3 backdrop-blur transition-all duration-200 dark:border-[#2d2a20] dark:bg-[#111110]/95',
          categoryControlsVisible
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-full opacity-0',
        ].join(' ')}
      >
        <div className="grid grid-cols-2 gap-2">
          {(['pokemon', 'onepiece'] as Category[]).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={enabledCategories[item]}
              onClick={() => toggleCategory(item)}
              className={`h-10 rounded-full text-sm font-black transition-colors ${
                enabledCategories[item]
                  ? 'bg-[#c6b600] text-zinc-950 dark:bg-[#c9a52e] dark:text-[#0e0c09]'
                  : 'bg-zinc-200 text-zinc-400 dark:bg-[#252420] dark:text-[#5a5243]'
              }`}
            >
              {CATEGORY_LABEL[item]}
            </button>
          ))}
        </div>
      </div>

      <HomeBannerCarousel banners={banners} fallback="cart-message" />

      <div className="space-y-5 py-5" ref={listTopRef}>
        <div className="grid gap-3 md:grid-cols-[auto_1fr] md:items-center">
          <Link
            href={FLOW_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center rounded-full border border-sky-200 bg-sky-50 px-4 text-sm font-black text-sky-700 underline underline-offset-2 dark:border-[#2d2a20] dark:bg-[#1c1b18] dark:text-[#c9a52e]"
          >
            ? 買取の流れについて
          </Link>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="h-10 flex-1 rounded-full border border-zinc-200 bg-white px-3 text-sm font-black outline-none dark:border-[#2d2a20] dark:bg-[#1c1b18] dark:text-[#ede8d5]"
            aria-label="並び替え"
          >
            <option value="price-desc">価格が高い順</option>
            <option value="price-asc">価格が低い順</option>
            <option value="name">名前順</option>
          </select>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="名前・番号で検索"
            className="h-11 min-w-0 flex-1 rounded-[14px] border border-zinc-200 bg-white px-3 text-sm font-semibold outline-none placeholder:text-zinc-400 dark:border-[#2d2a20] dark:bg-[#1c1b18] dark:text-[#ede8d5] dark:placeholder:text-[#5a5243]"
          />
          <button
            type="submit"
            className="h-11 w-20 rounded-[14px] bg-black text-sm font-black text-[#d4c400]"
          >
            検索
          </button>
        </form>

        <div
          aria-live="polite"
          className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-[#2d2a20] dark:bg-[#1c1b18]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-black text-zinc-950 dark:text-[#ede8d5]">
              検索結果 {filteredCards.length.toLocaleString('ja-JP')}件 / 全{availableCards.length.toLocaleString('ja-JP')}件
            </p>
            {hasSearchConditions && (
              <button
                type="button"
                onClick={clearSearchConditions}
                className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-black text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-[#4a4233] dark:text-[#c9a52e] dark:hover:bg-[#252420]"
              >
                条件クリア
              </button>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-zinc-600 dark:text-[#7a6e55]">
            <span className="rounded-full bg-zinc-100 px-3 py-1 dark:bg-[#252420]">
              カテゴリ: {activeCategoryText}
            </span>
            <span className="rounded-full bg-zinc-100 px-3 py-1 dark:bg-[#252420]">
              並び順: {SORT_LABEL[sort]}
            </span>
            {appliedKeyword && (
              <span className="rounded-full bg-zinc-100 px-3 py-1 dark:bg-[#252420]">
                検索語: {appliedKeyword}
              </span>
            )}
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
            {error}
          </p>
        )}

        {notice && (
          <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-black text-sky-700">
            {notice}
          </p>
        )}

        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns:
              'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
          }}
        >
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_12px_34px_rgba(24,24,27,0.08)] dark:border-[#2d2a20] dark:bg-[#1c1b18] dark:shadow-[0_12px_34px_rgba(0,0,0,0.5)]">
          <div className="flex gap-3">
            <div className="h-[178px] w-[124px] shrink-0 rounded-lg bg-zinc-100 sm:h-[210px] sm:w-[146px] dark:bg-[#1e1c17]" />
            <div className="flex min-w-0 flex-1 flex-col">
              <h2 className="text-center text-xl font-black leading-tight text-zinc-950 dark:text-[#ede8d5]">
                リストにない商品はこちら
              </h2>
              <p className="mt-3 text-xs font-medium leading-relaxed text-zinc-700 dark:text-[#7a6e55]">
                リストにない商品や商品名が分からない場合は、この項目を1点カートに追加するだけでまとめてお申し込みいただけます。
              </p>
              <button
                type="button"
                onClick={() => addToCart(UNLISTED_CARD, 1)}
                disabled={unlistedInCart}
                className={`mt-auto self-end rounded-xl px-8 py-2 text-sm font-black text-white shadow-sm ${
                  unlistedInCart ? 'bg-zinc-500' : 'bg-[#16a9f2]'
                }`}
              >
                {unlistedInCart ? '追加済み' : '追加'}
              </button>
            </div>
          </div>
        </div>

        {displayCards.map((card) => {
          const quantity = getSelectedQuantity(card.id)
          const imageSrc = cardImageSource(card, repeatedImageUrls)

          return (
            <div
              key={card.id}
              className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_12px_34px_rgba(24,24,27,0.08)] dark:border-[#2d2a20] dark:bg-[#1c1b18] dark:shadow-[0_12px_34px_rgba(0,0,0,0.5)]"
            >
              <div className="flex gap-3">
                <CardImage
                  src={imageSrc}
                  alt={card.name}
                  onClick={
                    imageSrc
                      ? () => setPreview({ src: imageSrc, alt: card.name })
                      : undefined
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="grid grid-cols-[1fr_auto] items-start gap-x-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-zinc-950 dark:text-[#ede8d5]">
                        {card.name}
                      </p>
                      <span className="mt-1 inline-flex rounded-full bg-black px-4 py-2 text-xs font-black text-[#d4c400] dark:bg-[#2d2a20] dark:text-[#c9a52e]">
                        {card.grade}
                      </span>
                    </div>
                    <div className="pt-6 text-sm font-medium text-zinc-800 dark:text-[#7a6e55]">
                      <p>型番</p>
                      <p className="max-w-[72px] truncate text-xs text-zinc-500 dark:text-[#5a5243]">
                        {card.card_number ?? '-'}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 whitespace-nowrap text-2xl font-black leading-none text-red-600 sm:text-3xl">
                    ¥{card.buy_price.toLocaleString()}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <QuantityControl
                      quantity={quantity}
                      onDecrement={() =>
                        setSelectedQuantity(card.id, quantity - 1)
                      }
                      onIncrement={() =>
                        setSelectedQuantity(card.id, quantity + 1)
                      }
                    />
                    <button
                      type="button"
                      onClick={() => addToCart(card)}
                      className="h-10 flex-1 rounded-xl bg-[#16a9f2] text-sm font-black text-white shadow-sm"
                    >
                      追加
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        </div>

        {filteredCards.length === 0 && (
          <div className="py-8 text-center text-sm text-zinc-500 dark:text-[#7a6e55]">
            <p className="font-black text-zinc-700 dark:text-[#ede8d5]">
              該当するカードがありません
            </p>
            <p className="mt-2">
              検索語またはカテゴリを変更してください。
            </p>
          </div>
        )}

        <Pagination
          page={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      </div>
    </>
  )

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-10 text-zinc-950 dark:text-[#ede8d5] sm:px-6">
      {viewMode === 'cart' ? renderCartView() : renderCatalogView()}

      {totalQuantity > 0 && viewMode === 'catalog' && (
        <div className="sticky bottom-4 z-20 mx-auto max-w-xl rounded-2xl border border-zinc-200 bg-white p-3 shadow-[0_18px_50px_rgba(24,24,27,0.16)] dark:border-[#2d2a20] dark:bg-[#1c1b18]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-black">
              <div className="relative">
                <CartIcon />
                <span className="absolute -bottom-1 -right-2 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-black leading-none text-white ring-2 ring-white">
                  {totalQuantity}
                </span>
              </div>
              <span>{totalQuantity}点</span>
            </div>
            <button
              type="button"
              onClick={() => setViewMode('cart')}
              className="rounded-xl bg-black px-5 py-3 text-sm font-black text-[#d4c400]"
            >
              カートを見る
            </button>
          </div>
        </div>
      )}

      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-5"
          onClick={() => setPreview(undefined)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white px-3 py-1 text-sm font-black text-zinc-950 dark:bg-[#1c1b18] dark:text-[#c9a52e]"
            onClick={() => setPreview(undefined)}
          >
            閉じる
          </button>
          <div
            className="relative aspect-[5/7] max-w-sm"
            style={{
              width: 'min(92vw, calc(86vh * 5 / 7), 420px)',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              src={preview.src}
              alt={preview.alt}
              fill
              unoptimized
              sizes="(max-width: 640px) 92vw, 420px"
              className="object-contain"
            />
          </div>
        </div>
      )}

      <ScrollToTopButton />
    </div>
  )
}
