'use client'

import Image, { type StaticImageData } from 'next/image'
import Link from 'next/link'
import {
  type FormEvent,
  type HTMLAttributes,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import { createOrder } from '@/app/actions/orders'
import { HomeBannerCarousel } from '@/app/components/HomeBannerCarousel'
import { updateCheckoutProfileAction } from './actions'
import {
  CART_OPEN_REQUEST_EVENT,
  CART_TOTAL_QUANTITY_EVENT,
} from './CartHeaderLink'
import type { Card, CartItem, HomepageBanner, Profile } from '@/lib/types'

type Category = 'pokemon' | 'onepiece'
type SortKey = 'price-desc' | 'price-asc' | 'name'
type ViewMode = 'catalog' | 'cart' | 'confirm' | 'complete'
type CheckoutInfo = {
  lastName: string
  lastNameKana: string
  email: string
  idType: string
  postalCode: string
  address: string
  phone: string
  bankName: string
  branchName: string
  accountType: '' | 'ordinary' | 'current'
  accountNumber: string
  accountHolderKana: string
}

const FLOW_URL = 'https://www.notion.so/'
const CART_STORAGE_KEY = 'tcg_royal_purchase_cart'
const CARDS_PER_PAGE = 12

const ID_TYPES = [
  '運転免許証',
  '各種健康保険証',
  'パスポート',
  '住民基本台帳カード',
  'マイナンバーカード',
  '在留カード',
  '特別永住者証明書',
  'その他',
]

const CHECKOUT_FIELD_LABELS: Record<keyof CheckoutInfo, string> = {
  lastName: '氏名',
  lastNameKana: '氏名（カナ）',
  email: 'メールアドレス',
  idType: '身分証',
  postalCode: '郵便番号',
  address: '住所',
  phone: '電話番号',
  bankName: '銀行名',
  branchName: '支店名',
  accountType: '口座種別',
  accountNumber: '口座番号',
  accountHolderKana: '口座名義',
}

const CATEGORY_LABEL: Record<Category, string> = {
  pokemon: 'ポケモン',
  onepiece: 'ワンピース',
}

const SORT_LABEL: Record<SortKey, string> = {
  'price-desc': '価格が高い順',
  'price-asc': '価格が低い順',
  name: '名前順',
}

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

function toKatakana(value: string) {
  return value.replace(/[\u3041-\u3096]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) + 0x60)
  )
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u3041-\u3096]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) + 0x60)
    )
    .replace(/[\s#\-_/]/g, '')
}

function matchesKeyword(card: Card, keyword: string) {
  const tokens = keyword
    .normalize('NFKC')
    .toLowerCase()
    .split(/\s+/)
    .map((token) => toKatakana(token.trim()))
    .filter(Boolean)

  if (tokens.length === 0) return true

  const name = normalizeText(card.name)
  const number = normalizeText(card.card_number)
  const combined = normalizeText(`${card.name}${card.card_number ?? ''}`)
  const numberParts = (card.card_number ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .flatMap((part) => part.split(/[^\dA-Za-z]+/))
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

  return null
}

function imageSourceUrl(src: StaticImageData | string | null) {
  if (!src) return null
  return typeof src === 'string' ? src : src.src
}

function lowResolutionPreviewUrl(src: StaticImageData | string) {
  const url = imageSourceUrl(src)
  if (!url) return ''
  if (
    url.startsWith('blob:') ||
    url.startsWith('data:') ||
    url.startsWith('/_next/image')
  ) {
    return url
  }

  const params = new URLSearchParams({
    q: '55',
    url,
    w: '384',
  })

  return `/_next/image?${params.toString()}`
}

function cssImageUrl(url: string) {
  return `url(${JSON.stringify(url)})`
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
    <div className="flex h-full w-full items-center justify-center rounded-lg bg-[#1e1c17]">
      <span className="text-[10px] font-black tracking-[0.22em] text-[#4a4233]">
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
      className="relative h-[178px] w-[124px] shrink-0 overflow-hidden rounded-lg border border-[#2d2a20] bg-[#1e1c17] shadow-[0_12px_28px_rgba(0,0,0,0.28)] sm:h-[210px] sm:w-[146px]"
      aria-label={`${alt}を拡大表示`}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          decoding="async"
          loading="lazy"
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
    <div className="flex h-10 w-[124px] items-center justify-between rounded-xl border border-[#2d2a20] bg-[#1c1b18] px-3 text-sm font-semibold text-[#ede8d5] shadow-sm">
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
          type="button"
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
          type="button"
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
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className={`${navBtn} border-r`}
          >
            <span aria-hidden="true">‹</span>
            前へ
          </button>
          {items.map((item, index) =>
            item === 'ellipsis' ? (
              <span
                key={`ellipsis-${index}`}
                className="flex h-12 min-w-12 items-center justify-center px-3 text-sm text-[#5a5243]"
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
                    ? 'border-x border-[#c9a52e] bg-[#0e0c09] font-black text-[#c9a52e]'
                    : 'font-medium text-[#7a6e55] hover:bg-[#252420]',
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

function accountTypeLabel(value: Profile['account_type'] | '') {
  if (value === 'ordinary') return '普通'
  if (value === 'current') return '当座'
  return null
}

function checkoutInfoFromProfile(
  profile: Profile | null,
  userEmail: string | null
): CheckoutInfo {
  return {
    lastName: [profile?.last_name, profile?.first_name].filter(Boolean).join(' '),
    lastNameKana: [profile?.last_name_kana, profile?.first_name_kana]
      .filter(Boolean)
      .join(' '),
    email: profile?.email ?? userEmail ?? '',
    idType: profile?.id_type ?? '',
    postalCode: profile?.postal_code ?? '',
    address: profile?.address ?? '',
    phone: profile?.phone ?? '',
    bankName: profile?.bank_name ?? '',
    branchName: profile?.branch_name ?? '',
    accountType: profile?.account_type ?? '',
    accountNumber: profile?.account_number ?? '',
    accountHolderKana: profile?.account_holder_kana ?? '',
  }
}

function normalizeField(value: string) {
  return value.normalize('NFKC').trim()
}

function changedCheckoutLabels(
  saved: CheckoutInfo,
  current: CheckoutInfo,
  idImageFile: File | null
) {
  const changed = (Object.keys(CHECKOUT_FIELD_LABELS) as (keyof CheckoutInfo)[])
    .filter((key) => normalizeField(saved[key]) !== normalizeField(current[key]))
    .map((key) => CHECKOUT_FIELD_LABELS[key])

  if (idImageFile) changed.push('身分証画像')

  return changed
}

function checkoutProfileFormData(info: CheckoutInfo, idImageFile: File | null) {
  const formData = new FormData()
  formData.set('last_name', info.lastName)
  formData.set('last_name_kana', info.lastNameKana)
  formData.set('email', info.email)
  formData.set('id_type', info.idType)
  formData.set('postal_code', info.postalCode)
  formData.set('address', info.address)
  formData.set('phone', info.phone)
  formData.set('bank_name', info.bankName)
  formData.set('branch_name', info.branchName)
  formData.set('account_type', info.accountType)
  formData.set('account_number', info.accountNumber)
  formData.set('account_holder_kana', info.accountHolderKana)
  if (idImageFile) formData.set('id_image', idImageFile)
  return formData
}

function validateCheckoutInfo(
  info: CheckoutInfo,
  hasIdentityImage: boolean,
  idImageFile: File | null
) {
  const required: [keyof CheckoutInfo, string][] = [
    ['lastName', '氏名を入力してください'],
    ['lastNameKana', '氏名（カナ）を入力してください'],
    ['email', 'メールアドレスを入力してください'],
    ['idType', '身分証を選択してください'],
    ['postalCode', '郵便番号を入力してください'],
    ['address', '住所を入力してください'],
    ['phone', '電話番号を入力してください'],
    ['bankName', '銀行名を入力してください'],
    ['branchName', '支店名を入力してください'],
    ['accountType', '口座種別を選択してください'],
    ['accountNumber', '口座番号を入力してください'],
    ['accountHolderKana', '口座名義を入力してください'],
  ]

  const missing = required.find(([key]) => !info[key].trim())
  if (missing) return missing[1]

  if (!hasIdentityImage && !idImageFile) {
    return '身分証画像をアップロードしてください'
  }

  if (!/^\d{7}$/.test(info.accountNumber.trim())) {
    return '口座番号は7桁の数字で入力してください'
  }

  return null
}

function orderItemsTotal(cart: CartItem[]) {
  return cart.reduce(
    (sum, item) => sum + item.card.buy_price * item.quantity,
    0
  )
}

function checkoutSnapshotNote(info: CheckoutInfo) {
  return [
    '買取申込時の依頼者情報',
    `氏名: ${info.lastName}`,
    `氏名（カナ）: ${info.lastNameKana}`,
    `メールアドレス: ${info.email}`,
    `身分証: ${info.idType}`,
    `住所: 〒${info.postalCode} ${info.address}`,
    `電話番号: ${info.phone}`,
    `振込先: ${info.bankName} / ${info.branchName} / ${accountTypeLabel(info.accountType) ?? '-'} / ${info.accountNumber} / ${info.accountHolderKana}`,
    '発送先: 【ダミー】後日共有される正式な発送先へ差し替え予定',
    '注意事項: 【ダミー】後日共有される正式な注意事項へ差し替え予定',
  ].join('\n')
}

function CheckoutField({
  label,
  value,
  onChange,
  required,
  type = 'text',
  placeholder,
  inputMode,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  type?: string
  placeholder?: string
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black text-[#d7ceb8]">
        {label} {required && <span className="text-red-300">*</span>}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        placeholder={placeholder}
        inputMode={inputMode}
        className="h-11 w-full rounded-[16px] border border-[#3a3528] bg-[#0f0e0b] px-3 text-sm font-semibold text-[#f6f0dc] outline-none transition-colors placeholder:text-[#5f5748] focus:border-[#c9a52e] focus:ring-2 focus:ring-[#c9a52e]/15"
      />
    </label>
  )
}

function CheckoutSelect({
  label,
  value,
  onChange,
  options,
  required,
  placeholder = '選択してください',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  required?: boolean
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black text-[#d7ceb8]">
        {label} {required && <span className="text-red-300">*</span>}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="h-11 w-full rounded-[16px] border border-[#3a3528] bg-[#0f0e0b] px-3 text-sm font-semibold text-[#f6f0dc] outline-none transition-colors focus:border-[#c9a52e] focus:ring-2 focus:ring-[#c9a52e]/15"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
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
  const [asyncCards, setAsyncCards] = useState<Card[]>(() => cards)
  const [cardsLoading, setCardsLoading] = useState(cards.length === 0)
  const [cardsError, setCardsError] = useState<string>()
  const availableCards = asyncCards
  const hasRegisteredCards = availableCards.length > 0
  const initialCheckoutInfo = useMemo(
    () => checkoutInfoFromProfile(profile, userEmail),
    [profile, userEmail]
  )
  const [viewMode, setViewMode] = useState<ViewMode>('catalog')
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartLoaded, setCartLoaded] = useState(false)
  const [checkoutInfo, setCheckoutInfo] = useState<CheckoutInfo>(
    () => initialCheckoutInfo
  )
  const [savedCheckoutInfo, setSavedCheckoutInfo] = useState<CheckoutInfo>(
    () => initialCheckoutInfo
  )
  const [hasIdentityImage, setHasIdentityImage] = useState(
    Boolean(profile?.id_image_url)
  )
  const [idImageFile, setIdImageFile] = useState<File | null>(null)
  const [idImageFileName, setIdImageFileName] = useState('')
  const [profileUpdateModal, setProfileUpdateModal] = useState<{
    changes: string[]
  }>()
  const [agreementChecked, setAgreementChecked] = useState(false)
  const [completedOrderNumber, setCompletedOrderNumber] = useState<string>()
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
    thumbnailSrc: string
  }>()
  const [previewStatus, setPreviewStatus] = useState<
    'loading' | 'loaded' | 'error'
  >('loading')
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
  const totalAmount = orderItemsTotal(cart)
  const unlistedInCart = cart.some((item) => item.card.id === UNLISTED_CARD.id)

  const getSelectedQuantity = (cardId: string) => selectedQuantities[cardId] ?? 1

  const openPreview = (src: StaticImageData | string, alt: string) => {
    setPreview({
      alt,
      src,
      thumbnailSrc: lowResolutionPreviewUrl(src),
    })
    setPreviewStatus('loading')
  }

  const updateCheckoutInfo = (key: keyof CheckoutInfo, value: string) => {
    setCheckoutInfo((current) => ({ ...current, [key]: value }))
  }

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

  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/cards', {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('カード一覧の取得に失敗しました')
        }

        return (await response.json()) as Card[]
      })
      .then((nextCards) => {
        setAsyncCards(Array.isArray(nextCards) ? nextCards : [])
        setCardsError(undefined)
      })
      .catch((fetchError: unknown) => {
        if (
          fetchError instanceof DOMException &&
          fetchError.name === 'AbortError'
        ) {
          return
        }

        setCardsError('カード一覧の読み込みに失敗しました。時間をおいて再読み込みしてください。')
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCardsLoading(false)
        }
      })

    return () => controller.abort()
  }, [])

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

  const showCartTop = () => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  const handleProceedToConfirm = () => {
    setError(undefined)
    if (cart.length === 0) {
      setError('カードを追加してください')
      return
    }

    const validationError = validateCheckoutInfo(
      checkoutInfo,
      hasIdentityImage,
      idImageFile
    )
    if (validationError) {
      setError(validationError)
      return
    }

    const changes = changedCheckoutLabels(
      savedCheckoutInfo,
      checkoutInfo,
      idImageFile
    )
    if (changes.length > 0) {
      setProfileUpdateModal({ changes })
      return
    }

    setAgreementChecked(false)
    setViewMode('confirm')
    showCartTop()
  }

  const handleProfileUpdateChoice = (choice: 'yes' | 'no' | 'cancel') => {
    setError(undefined)

    if (choice === 'cancel') {
      setProfileUpdateModal(undefined)
      setViewMode('cart')
      showCartTop()
      return
    }

    if (choice === 'no') {
      setProfileUpdateModal(undefined)
      setAgreementChecked(false)
      setViewMode('confirm')
      showCartTop()
      return
    }

    startTransition(async () => {
      const res = await updateCheckoutProfileAction(
        checkoutProfileFormData(checkoutInfo, idImageFile)
      )

      if (res?.error || res?.errors) {
        const firstFieldError = res.errors
          ? Object.values(res.errors)[0]
          : undefined
        setError(res.error ?? firstFieldError ?? '保存済みデータの更新に失敗しました')
        setProfileUpdateModal(undefined)
        setViewMode('cart')
        showCartTop()
        return
      }

      setSavedCheckoutInfo(checkoutInfo)
      if (idImageFile) setHasIdentityImage(true)
      setIdImageFile(null)
      setIdImageFileName('')
      setProfileUpdateModal(undefined)
      setAgreementChecked(false)
      setViewMode('confirm')
      showCartTop()
    })
  }

  const handleFinalSubmit = () => {
    setError(undefined)
    if (!agreementChecked) {
      setError('注意事項への同意が必要です')
      return
    }
    if (cart.length === 0) {
      setError('カードを追加してください')
      setViewMode('cart')
      return
    }

    startTransition(async () => {
      const res = await createOrder(cart, {
        bank_name: checkoutInfo.bankName,
        bank_branch: checkoutInfo.branchName,
        bank_account_no: checkoutInfo.accountNumber,
        bank_holder: checkoutInfo.accountHolderKana,
        note: checkoutSnapshotNote(checkoutInfo),
      })
      if (res?.error) {
        setError(res.error)
        return
      }

      clearStoredCart()
      setCart([])
      setSelectedQuantities({})
      setCompletedOrderNumber(res?.orderNumber)
      setViewMode('complete')
      showCartTop()
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
          className="rounded-full border border-[#2d2a20] px-3 py-1 text-xs font-black text-[#c9a52e] transition-colors hover:bg-[#1c1b18]"
        >
          商品を探す
        </button>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {cart.length === 0 ? (
          <p className="rounded-2xl border border-[#2d2a20] bg-[#15130f] p-8 text-center text-sm font-semibold text-[#7a6e55] shadow-[0_14px_38px_rgba(0,0,0,0.28)] lg:col-span-2">
            カートに商品がありません
          </p>
        ) : (
          cart.map((item) => {
            if (item.card.id === UNLISTED_CARD.id) {
              return (
                <div
                  key={item.card.id}
                  className="rounded-2xl border border-[#2d2a20] bg-[linear-gradient(180deg,#1b1812_0%,#12100c_100%)] p-4 shadow-[0_18px_46px_rgba(0,0,0,0.38)]"
                >
                  <div className="flex gap-3">
                    <div className="h-[178px] w-[124px] shrink-0 rounded-lg bg-[#1e1c17] sm:h-[210px] sm:w-[146px]" />
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
                className="rounded-2xl border border-[#2d2a20] bg-[linear-gradient(180deg,#1b1812_0%,#12100c_100%)] p-4 shadow-[0_18px_46px_rgba(0,0,0,0.38)]"
              >
                <div className="flex gap-3">
                  <CardImage
                    src={imageSrc}
                    alt={item.card.name}
                    onClick={
                      imageSrc
                        ? () => openPreview(imageSrc, item.card.name)
                        : undefined
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="grid grid-cols-[1fr_auto] items-start gap-x-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[#ede8d5]">
                          {item.card.name}
                        </p>
                        <span className="mt-1 inline-flex rounded-full bg-[#2d2a20] px-4 py-2 text-xs font-black text-[#c9a52e]">
                          {item.card.grade}
                        </span>
                      </div>
                      <div className="pt-6 text-sm font-medium text-[#7a6e55]">
                        <p>型番</p>
                        <p className="max-w-[72px] truncate text-xs text-[#5a5243]">
                          {item.card.card_number ?? '-'}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 whitespace-nowrap text-2xl font-black leading-none text-red-400 sm:text-3xl">
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
        <form
          onSubmit={(event) => {
            event.preventDefault()
            handleProceedToConfirm()
          }}
          className="mt-8 space-y-5"
        >
          <section className="rounded-[24px] border border-[#2d2a20] bg-[#15130f] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
            <div className="mb-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8f8369]">
                Requester
              </p>
              <h2 className="mt-1 text-xl font-black text-[#f6f0dc]">
                依頼者情報
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <CheckoutField
                label="氏名"
                value={checkoutInfo.lastName}
                onChange={(value) => updateCheckoutInfo('lastName', value)}
                required
                placeholder="山田太郎"
              />
              <CheckoutField
                label="氏名（カナ）"
                value={checkoutInfo.lastNameKana}
                onChange={(value) => updateCheckoutInfo('lastNameKana', value)}
                required
                placeholder="ヤマダタロウ"
              />
              <CheckoutField
                label="メールアドレス"
                value={checkoutInfo.email}
                onChange={(value) => updateCheckoutInfo('email', value)}
                required
                type="email"
                placeholder="example@tcg-royal.jp"
              />
              <CheckoutSelect
                label="身分証"
                value={checkoutInfo.idType}
                onChange={(value) => updateCheckoutInfo('idType', value)}
                required
                options={ID_TYPES.map((type) => ({ value: type, label: type }))}
              />
              <div className="md:col-span-2">
                <span className="mb-1 block text-xs font-black text-[#d7ceb8]">
                  身分証画像アップロード <span className="text-red-300">*</span>
                </span>
                <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-[16px] border border-[#3a3528] bg-[#0f0e0b] px-3 text-center text-xs font-black text-[#d7ceb8] transition-colors hover:border-[#c9a52e]/60 hover:text-[#c9a52e]">
                  {idImageFileName ||
                    (hasIdentityImage
                      ? 'アップロード済み。変更する場合は画像を選択'
                      : '画像を選択')}
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.heic,.heif"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null
                      setIdImageFile(file)
                      setIdImageFileName(file?.name ?? '')
                    }}
                  />
                </label>
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-[#2d2a20] bg-[#15130f] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
            <h2 className="mb-4 text-xl font-black text-[#f6f0dc]">
              ご連絡先
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              <CheckoutField
                label="郵便番号"
                value={checkoutInfo.postalCode}
                onChange={(value) => updateCheckoutInfo('postalCode', value)}
                required
                placeholder="1060032"
                inputMode="numeric"
              />
              <div className="md:col-span-2">
                <CheckoutField
                  label="住所"
                  value={checkoutInfo.address}
                  onChange={(value) => updateCheckoutInfo('address', value)}
                  required
                  placeholder="東京都中央区..."
                />
              </div>
              <CheckoutField
                label="電話番号"
                value={checkoutInfo.phone}
                onChange={(value) => updateCheckoutInfo('phone', value)}
                required
                placeholder="09012345678"
                inputMode="numeric"
              />
            </div>
          </section>

          <section className="rounded-[24px] border border-[#2d2a20] bg-[#15130f] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
            <h2 className="mb-4 text-xl font-black text-[#f6f0dc]">
              振込先情報
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <CheckoutField
                label="銀行名"
                value={checkoutInfo.bankName}
                onChange={(value) => updateCheckoutInfo('bankName', value)}
                required
                placeholder="銀行名"
              />
              <CheckoutField
                label="支店名"
                value={checkoutInfo.branchName}
                onChange={(value) => updateCheckoutInfo('branchName', value)}
                required
                placeholder="支店名"
              />
              <CheckoutSelect
                label="口座種別"
                value={checkoutInfo.accountType}
                onChange={(value) =>
                  updateCheckoutInfo('accountType', value)
                }
                required
                options={[
                  { value: 'ordinary', label: '普通' },
                  { value: 'current', label: '当座' },
                ]}
              />
              <CheckoutField
                label="口座番号"
                value={checkoutInfo.accountNumber}
                onChange={(value) => updateCheckoutInfo('accountNumber', value)}
                required
                placeholder="7桁の口座番号"
                inputMode="numeric"
              />
              <div className="md:col-span-2">
                <CheckoutField
                  label="口座名義（カタカナ）"
                  value={checkoutInfo.accountHolderKana}
                  onChange={(value) =>
                    updateCheckoutInfo('accountHolderKana', value)
                  }
                  required
                  placeholder="ヤマダタロウ"
                />
              </div>
            </div>
          </section>

          <button
            type="submit"
            disabled={pending}
            className="mx-auto block h-12 w-full max-w-sm rounded-[18px] bg-[#c9a52e] text-base font-black text-[#0e0c09] shadow-[0_14px_40px_rgba(201,165,46,0.18)] transition-colors hover:bg-[#d7b865] disabled:opacity-50"
          >
            {pending ? '確認中...' : '次へ'}
          </button>
        </form>
      )}
    </div>
  )

  const renderConfirmView = () => (
    <div className="mx-auto max-w-4xl py-5">
      <button
        type="button"
        onClick={() => {
          setViewMode('cart')
          showCartTop()
        }}
        className="mb-4 rounded-full border border-[#2d2a20] px-4 py-2 text-xs font-black text-[#c9a52e] transition-colors hover:bg-[#1c1b18]"
      >
        カートに戻る
      </button>

      <div className="rounded-[28px] border border-[#2d2a20] bg-[#12100c] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-6">
        <p className="text-center text-xs font-black uppercase tracking-[0.22em] text-[#c9a52e]">
          Final Check
        </p>
        <h1 className="mt-2 text-center text-2xl font-black text-[#f6f0dc]">
          最終確認
        </h1>

        <section className="mt-6 overflow-hidden rounded-[20px] border border-[#2d2a20] bg-[#171511]">
          <div className="overflow-hidden">
            <table className="w-full table-fixed text-left text-[10px] text-[#ede8d5] sm:text-sm">
              <colgroup>
                <col className="w-[38%]" />
                <col className="w-[13%]" />
                <col className="w-[24%]" />
                <col className="w-[25%]" />
              </colgroup>
              <thead className="bg-[#211f18] text-[10px] font-black text-[#c9a52e] sm:text-xs">
                <tr>
                  <th className="px-2 py-3 sm:px-4">カード名</th>
                  <th className="px-1 py-3 text-center sm:px-4">数量</th>
                  <th className="px-1 py-3 text-right sm:px-4">
                    <span className="inline-block leading-tight">
                      買取<br className="sm:hidden" />申込額
                    </span>
                  </th>
                  <th className="px-2 py-3 text-right sm:px-4">小計</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item) => (
                  <tr key={item.card.id} className="border-t border-[#2d2a20]">
                    <td className="break-words px-2 py-3 font-black leading-tight text-[#f6f0dc] sm:px-4">
                      {item.card.name}
                      <span className="mt-1 block text-[10px] text-[#8f8369] sm:text-xs">
                        {item.card.grade}
                      </span>
                    </td>
                    <td className="px-1 py-3 text-center font-black text-[#f6f0dc] sm:px-4">
                      {item.quantity}
                    </td>
                    <td className="whitespace-nowrap px-1 py-3 text-right font-semibold text-[#ede8d5] sm:px-4">
                      ¥{item.card.buy_price.toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-right font-black text-[#c9a52e] sm:px-4">
                      ¥{(item.card.buy_price * item.quantity).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-[#2d2a20] bg-[#211f18]">
                <tr>
                  <td className="px-2 py-3 text-right text-xs font-black text-[#8f8369] sm:px-4" colSpan={3}>
                    合計
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 text-right text-sm font-black text-[#f6f0dc] sm:px-4 sm:text-base">
                    ¥{totalAmount.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <section className="rounded-[20px] border border-[#2d2a20] bg-[#171511] p-4">
            <h2 className="text-base font-black text-[#f6f0dc]">
              依頼者情報
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              {[
                ['氏名', checkoutInfo.lastName],
                ['メールアドレス', checkoutInfo.email],
                ['住所', `〒${checkoutInfo.postalCode} ${checkoutInfo.address}`],
                ['電話番号', checkoutInfo.phone],
                [
                  '振込先',
                  `${checkoutInfo.bankName} / ${checkoutInfo.branchName} / ${accountTypeLabel(checkoutInfo.accountType) ?? '-'} / ${checkoutInfo.accountNumber} / ${checkoutInfo.accountHolderKana}`,
                ],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[14px] bg-[#0f0e0b] px-3 py-2">
                  <dt className="text-xs font-black text-[#8f8369]">{label}</dt>
                  <dd className="mt-1 break-words font-semibold text-[#ede8d5]">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="space-y-4">
            <section className="rounded-[20px] border border-[#2d2a20] bg-[#171511] p-4">
              <h2 className="text-base font-black text-[#f6f0dc]">
                発送先
              </h2>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-[#d7ceb8]">
                【ダミー】発送先情報は後日共有予定です。現在は確認用の仮文言です。
              </p>
            </section>
            <section className="rounded-[20px] border border-[#2d2a20] bg-[#171511] p-4">
              <h2 className="text-base font-black text-[#f6f0dc]">
                注意事項
              </h2>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-[#d7ceb8]">
                【ダミー】注意事項は後日共有予定です。正式な運用文言に差し替える前提の仮表示です。
              </p>
            </section>
          </div>
        </div>

        <label className="mt-6 flex items-start gap-3 rounded-[18px] border border-[#2d2a20] bg-[#0f0e0b] p-4 text-sm font-black leading-relaxed text-[#d7ceb8]">
          <input
            type="checkbox"
            checked={agreementChecked}
            onChange={(event) => setAgreementChecked(event.target.checked)}
            className="mt-1 h-4 w-4 accent-[#c9a52e]"
          />
          <span>
            上記の発送先・注意事項の内容を理解し、すべての条件に同意のうえ、買取申込みを行います。
          </span>
        </label>

        {error && (
          <p className="mt-4 rounded-[16px] border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleFinalSubmit}
          disabled={pending}
          className="mt-5 h-12 w-full rounded-[18px] bg-[#16a9f2] text-base font-black text-white shadow-[0_14px_40px_rgba(22,169,242,0.2)] transition-colors hover:bg-[#34b6f5] disabled:opacity-50"
        >
          {pending ? '送信中...' : '買取申込を依頼する'}
        </button>
      </div>
    </div>
  )

  const renderCompleteView = () => (
    <div className="mx-auto max-w-2xl py-8">
      <section className="rounded-[28px] border border-[#2d2a20] bg-[#12100c] px-5 py-12 text-center shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:px-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#c9a52e]">
          Accepted
        </p>
        <h1 className="mt-3 text-2xl font-black leading-snug text-[#f6f0dc]">
          買取申込を受け付けました。
        </h1>
        {completedOrderNumber && (
          <p className="mt-4 inline-flex rounded-full border border-[#2d2a20] bg-[#0f0e0b] px-4 py-2 text-sm font-black text-[#c9a52e]">
            注文番号：{completedOrderNumber}
          </p>
        )}
        <p className="mx-auto mt-6 max-w-md text-sm font-semibold leading-relaxed text-[#d7ceb8]">
          弊社スタッフにて内容を確認いたしますので、必ず弊社からの買取申込承認メールをご確認のうえ、商品を発送してください。
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href="/mypage/orders"
            className="flex h-12 items-center justify-center rounded-[18px] bg-[#c9a52e] text-sm font-black text-[#0e0c09] transition-colors hover:bg-[#d7b865]"
          >
            郵送買取一覧へ
          </Link>
          <Link
            href="/"
            className="flex h-12 items-center justify-center rounded-[18px] border border-[#3a3528] bg-[#0f0e0b] text-sm font-black text-[#d7ceb8] transition-colors hover:border-[#c9a52e]/60 hover:text-[#c9a52e]"
          >
            トップへ戻る
          </Link>
        </div>
      </section>
    </div>
  )

  const renderCatalogView = () => (
    <>
      {hasRegisteredCards && (
        <div
          className={[
            'sticky top-[69px] z-30 border-b border-[#2d2a20] bg-[#111110]/95 py-3 backdrop-blur transition-all duration-200',
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
                    ? 'bg-[#c9a52e] text-[#0e0c09] shadow-[0_8px_20px_rgba(201,165,46,0.18)]'
                    : 'bg-[#252420] text-[#8f8369] hover:bg-[#2e2b25] hover:text-[#d7ceb8]'
                }`}
              >
                {CATEGORY_LABEL[item]}
              </button>
            ))}
          </div>
        </div>
      )}

      <HomeBannerCarousel banners={banners} fallback="cart-message" />

      <div className="space-y-5 py-5" ref={listTopRef}>
        {hasRegisteredCards && (
          <>
            <div className="grid gap-3 md:grid-cols-[auto_1fr] md:items-center">
              <Link
                href={FLOW_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center rounded-full border border-[#2d2a20] bg-[#1c1b18] px-4 text-sm font-black text-[#c9a52e] underline underline-offset-2 transition-colors hover:border-[#c9a52e]/50 hover:bg-[#252420]"
              >
                ? 買取の流れについて
              </Link>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="h-10 flex-1 rounded-full border border-[#2d2a20] bg-[#1c1b18] px-3 text-sm font-black text-[#ede8d5] outline-none transition-colors focus:border-[#c9a52e]"
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
                className="h-11 min-w-0 flex-1 rounded-[14px] border border-[#2d2a20] bg-[#1c1b18] px-3 text-sm font-semibold text-[#ede8d5] outline-none placeholder:text-[#5a5243] transition-colors focus:border-[#c9a52e]"
              />
              <button
                type="submit"
                className="h-11 w-20 rounded-[14px] bg-[#c9a52e] text-sm font-black text-[#0e0c09] transition-colors hover:bg-[#d7b865]"
              >
                検索
              </button>
            </form>
          </>
        )}

        {hasRegisteredCards && (
          <div
            aria-live="polite"
            className="rounded-2xl border border-[#2d2a20] bg-[#15130f] px-4 py-3 text-sm shadow-[0_14px_38px_rgba(0,0,0,0.28)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-black text-[#ede8d5]">
                検索結果 {filteredCards.length.toLocaleString('ja-JP')}件 / 全{availableCards.length.toLocaleString('ja-JP')}件
              </p>
              {hasSearchConditions && (
                <button
                  type="button"
                  onClick={clearSearchConditions}
                  className="rounded-full border border-[#4a4233] px-3 py-1 text-xs font-black text-[#c9a52e] transition-colors hover:bg-[#252420]"
                >
                  条件クリア
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-[#7a6e55]">
              <span className="rounded-full bg-[#252420] px-3 py-1">
                カテゴリ: {activeCategoryText}
              </span>
              <span className="rounded-full bg-[#252420] px-3 py-1">
                並び順: {SORT_LABEL[sort]}
              </span>
              {appliedKeyword && (
                <span className="rounded-full bg-[#252420] px-3 py-1">
                  検索語: {appliedKeyword}
                </span>
              )}
            </div>
          </div>
        )}

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

        {cardsLoading && (
          <div className="rounded-2xl border border-[#2d2a20] bg-[#15130f] px-4 py-3 text-sm font-black text-[#d7ceb8]">
            カード一覧を読み込み中...
          </div>
        )}

        {cardsError && !cardsLoading && (
          <p className="rounded-2xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm font-black text-red-200">
            {cardsError}
          </p>
        )}

        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns:
              'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
          }}
        >
        <div className="rounded-2xl border border-[#2d2a20] bg-[linear-gradient(180deg,#1b1812_0%,#12100c_100%)] p-4 shadow-[0_18px_46px_rgba(0,0,0,0.38)] transition-colors hover:border-[#4a4233]">
          <div className="flex gap-3">
            <div className="h-[178px] w-[124px] shrink-0 rounded-lg bg-[#1e1c17] sm:h-[210px] sm:w-[146px]" />
            <div className="flex min-w-0 flex-1 flex-col">
              <h2 className="text-center text-xl font-black leading-tight text-[#ede8d5]">
                リストにない商品はこちら
              </h2>
              <p className="mt-3 text-xs font-medium leading-relaxed text-[#7a6e55]">
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
              className="rounded-2xl border border-[#2d2a20] bg-[linear-gradient(180deg,#1b1812_0%,#12100c_100%)] p-4 shadow-[0_18px_46px_rgba(0,0,0,0.38)] transition-colors hover:border-[#4a4233]"
            >
              <div className="flex gap-3">
                <CardImage
                  src={imageSrc}
                  alt={card.name}
                  onClick={
                    imageSrc
                      ? () => openPreview(imageSrc, card.name)
                      : undefined
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="grid grid-cols-[1fr_auto] items-start gap-x-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[#ede8d5]">
                        {card.name}
                      </p>
                      <span className="mt-1 inline-flex rounded-full bg-[#2d2a20] px-4 py-2 text-xs font-black text-[#c9a52e]">
                        {card.grade}
                      </span>
                    </div>
                    <div className="pt-6 text-sm font-medium text-[#7a6e55]">
                      <p>型番</p>
                      <p className="max-w-[72px] truncate text-xs text-[#5a5243]">
                        {card.card_number ?? '-'}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 whitespace-nowrap text-2xl font-black leading-none text-red-400 sm:text-3xl">
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

        {hasRegisteredCards && filteredCards.length === 0 && (
          <div className="py-8 text-center text-sm text-[#7a6e55]">
            <p className="font-black text-[#ede8d5]">
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
    <div className="mx-auto w-full max-w-6xl px-4 pb-10 text-[#ede8d5] sm:px-6">
      {viewMode === 'cart'
        ? renderCartView()
        : viewMode === 'confirm'
          ? renderConfirmView()
          : viewMode === 'complete'
            ? renderCompleteView()
            : renderCatalogView()}

      {totalQuantity > 0 && viewMode === 'catalog' && (
        <div className="sticky bottom-4 z-20 mx-auto max-w-xl rounded-2xl border border-[#2d2a20] bg-[#1c1b18] p-3 shadow-[0_18px_50px_rgba(0,0,0,0.42)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-black">
              <div className="relative">
                <CartIcon />
                <span className="absolute -bottom-1 -right-2 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-black leading-none text-white ring-2 ring-[#1c1b18]">
                  {totalQuantity}
                </span>
              </div>
              <span>{totalQuantity}点</span>
            </div>
            <button
              type="button"
              onClick={() => setViewMode('cart')}
              className="rounded-xl bg-[#c9a52e] px-5 py-3 text-sm font-black text-[#0e0c09] transition-colors hover:bg-[#d7b865]"
            >
              カートを見る
            </button>
          </div>
        </div>
      )}

      {profileUpdateModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        >
          <div className="w-full max-w-md rounded-[28px] border border-[#2d2a20] bg-[#12100c] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#c9a52e]">
              Profile Update
            </p>
            <h2 className="mt-2 text-xl font-black text-[#f6f0dc]">
              保存済みデータを更新しますか？
            </h2>
            <p className="mt-4 text-sm font-semibold leading-relaxed text-[#d7ceb8]">
              {profileUpdateModal.changes.join('、')}
              が変更されています。保存済みのデータをアップデートしますか？
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => handleProfileUpdateChoice('yes')}
                className="h-11 rounded-[16px] bg-[#c9a52e] text-sm font-black text-[#0e0c09] transition-colors hover:bg-[#d7b865] disabled:opacity-50"
              >
                はい
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => handleProfileUpdateChoice('no')}
                className="h-11 rounded-[16px] border border-[#3a3528] bg-[#0f0e0b] text-sm font-black text-[#d7ceb8] transition-colors hover:border-[#c9a52e]/60 hover:text-[#c9a52e] disabled:opacity-50"
              >
                いいえ
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => handleProfileUpdateChoice('cancel')}
                className="h-11 rounded-[16px] border border-[#3a3528] bg-[#0f0e0b] text-sm font-black text-[#8f8369] transition-colors hover:bg-[#1c1b18] disabled:opacity-50"
              >
                キャンセル
              </button>
            </div>
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
            className="absolute right-4 top-4 rounded-full bg-[#1c1b18] px-3 py-1 text-sm font-black text-[#c9a52e]"
            onClick={() => setPreview(undefined)}
          >
            閉じる
          </button>
          <div
            className="relative aspect-[5/7] max-w-sm overflow-hidden rounded-2xl border border-[#2d2a20] bg-[#11100d] shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
            style={{
              width: 'min(92vw, calc(86vh * 5 / 7), 420px)',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            {preview.thumbnailSrc && (
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-contain bg-center bg-no-repeat"
                style={{
                  backgroundImage: cssImageUrl(preview.thumbnailSrc),
                }}
              />
            )}
            <Image
              key={imageSourceUrl(preview.src)}
              src={preview.src}
              alt={preview.alt}
              fill
              unoptimized
              sizes="(max-width: 640px) 92vw, 420px"
              onError={() => setPreviewStatus('error')}
              onLoad={() => setPreviewStatus('loaded')}
              className={`object-contain transition-opacity duration-200 ${
                previewStatus === 'loaded' ? 'opacity-100' : 'opacity-0'
              }`}
            />
            {previewStatus === 'loading' && (
              <div className="absolute inset-x-4 bottom-4 rounded-full bg-black/65 px-4 py-2 text-center text-xs font-black text-[#ede8d5]">
                高画質画像を読み込み中...
              </div>
            )}
            {previewStatus === 'error' && (
              <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-black/70 px-4 py-3 text-center text-xs font-black leading-relaxed text-[#ede8d5]">
                高画質画像を読み込めませんでした。プレビュー画像を表示しています。
              </div>
            )}
          </div>
        </div>
      )}

      <ScrollToTopButton />
    </div>
  )
}
