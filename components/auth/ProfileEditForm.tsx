'use client'

import { useEffect, useId, useMemo, useRef, useState, useTransition } from 'react'
import type { FormEvent, InputHTMLAttributes, ReactNode } from 'react'
import {
  updateProfileAction,
  type ProfileUpdateState,
} from '@/app/mypage/profile/actions'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 1919 }, (_, i) => CURRENT_YEAR - i)
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)
const BANK_API_PAGE_SIZE = 500
const BRANCH_API_PAGE_SIZE = 500
const BRANCH_API_MAX_PAGES = 20

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

const OCCUPATIONS = [
  '会社員',
  '会社役員',
  '公務員',
  '団体職員',
  '自営業',
  'パート・アルバイト',
  '学生',
  '主婦（夫）',
  '無職',
  'その他',
]

type Bank = {
  code: string
  name: string
  kana?: string
  hira?: string
  roma?: string
}

type Branch = {
  code: string
  name: string
  kana?: string
  hira?: string
  roma?: string
}

const FALLBACK_BANKS: Bank[] = [
  { code: '0001', name: 'みずほ銀行', kana: 'ミズホ', hira: 'みずほ' },
  { code: '0005', name: '三菱UFJ銀行', kana: 'ミツビシユーエフジェイ', hira: 'みつびしゆーえふじぇい' },
  { code: '0009', name: '三井住友銀行', kana: 'ミツイスミトモ', hira: 'みついすみとも' },
  { code: '0010', name: 'りそな銀行', kana: 'リソナ', hira: 'りそな' },
  { code: '0017', name: '埼玉りそな銀行', kana: 'サイタマリソナ', hira: 'さいたまりそな' },
  { code: '0033', name: 'PayPay銀行', kana: 'ペイペイ', hira: 'ぺいぺい' },
  { code: '0034', name: 'セブン銀行', kana: 'セブン', hira: 'せぶん' },
  { code: '0035', name: 'ソニー銀行', kana: 'ソニー', hira: 'そにー' },
  { code: '0036', name: '楽天銀行', kana: 'ラクテン', hira: 'らくてん' },
  { code: '0038', name: '住信SBIネット銀行', kana: 'スミシンエスビーアイネット', hira: 'すみしんえすびーあいねっと' },
  { code: '0039', name: 'auじぶん銀行', kana: 'エーユージブン', hira: 'えーゆーじぶん' },
  { code: '0040', name: 'イオン銀行', kana: 'イオン', hira: 'いおん' },
  { code: '0116', name: '北海道銀行', kana: 'ホッカイドウ', hira: 'ほっかいどう' },
  { code: '0134', name: '千葉銀行', kana: 'チバ', hira: 'ちば' },
  { code: '0138', name: '横浜銀行', kana: 'ヨコハマ', hira: 'よこはま' },
  { code: '0177', name: '福岡銀行', kana: 'フクオカ', hira: 'ふくおか' },
  { code: '9900', name: 'ゆうちょ銀行', kana: 'ユウチョ', hira: 'ゆうちょ' },
]

const BANK_ALIASES: Record<string, string[]> = {
  '0001': ['mizuho'],
  '0005': ['mufg', 'mitsubishiufj'],
  '0009': ['smbc', 'mitsuisumitomo'],
  '0010': ['resona', 'risona'],
  '0017': ['saitamaresona', 'saitamarisona'],
  '0036': ['rakuten'],
  '0038': ['sbi', 'sumishinsbi'],
  '9900': ['yucho', 'yuucho', 'japanpost'],
}

const FALLBACK_BRANCHES: Record<string, Branch[]> = {
  '0001': [
    { code: '001', name: '東京営業部', kana: 'トウキヨウ', hira: 'とうきよう' },
    { code: '004', name: '丸の内中央支店', kana: 'マルノウチチユウオウ', hira: 'まるのうちちゆうおう' },
  ],
  '0005': [
    { code: '001', name: '本店', kana: 'ホンテン', hira: 'ほんてん' },
    { code: '005', name: '丸の内支店', kana: 'マルノウチ', hira: 'まるのうち' },
  ],
  '0009': [
    { code: '200', name: '本店営業部', kana: 'ホンテン', hira: 'ほんてん' },
    { code: '219', name: '東京中央支店', kana: 'トウキヨウチユウオウ', hira: 'とうきようちゆうおう' },
  ],
  '0010': [
    { code: '100', name: '東京営業部', kana: 'トウキヨウ', hira: 'とうきよう' },
    { code: '101', name: '大阪営業部', kana: 'オオサカ', hira: 'おおさか' },
  ],
  '0036': [
    { code: '201', name: 'ジャズ支店', kana: 'ジヤズ', hira: 'じやず' },
    { code: '202', name: 'ロック支店', kana: 'ロツク', hira: 'ろつく' },
  ],
  '9900': [
    { code: '008', name: '〇〇八店', kana: 'ゼロゼロハチ', hira: 'ぜろぜろはち' },
    { code: '018', name: '〇一八店', kana: 'ゼロイチハチ', hira: 'ぜろいちはち' },
  ],
}

export type ProfileEditInitialData = {
  email: string
  lastName: string
  lastNameKana: string
  birthdayYear: string
  birthdayMonth: string
  birthdayDay: string
  gender: string
  occupation: string
  isQualifiedInvoice: boolean
  idType: string
  hasIdentityImage: boolean
  identityVerified: boolean
  postalCode: string
  address: string
  phone: string
  bankName: string
  branchName: string
  accountType: string
  accountNumber: string
  accountHolderKana: string
}

function normalizeSearch(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s/g, '')
}

function mergeByCode<T extends { code: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.code, item])).values())
}

function normalizeBankResponse(value: unknown): Bank[] {
  if (Array.isArray(value)) return value as Bank[]
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (Array.isArray(record.data)) return record.data as Bank[]
    if (Array.isArray(record.banks)) return record.banks as Bank[]
    if (typeof record.code === 'string' && typeof record.name === 'string') {
      return [record as Bank]
    }
    const keyedBanks = Object.values(record).filter((item): item is Bank => {
      if (!item || typeof item !== 'object') return false
      const bank = item as Record<string, unknown>
      return typeof bank.code === 'string' && typeof bank.name === 'string'
    })
    if (keyedBanks.length > 0) return keyedBanks
  }
  return []
}

function normalizeBranchResponse(value: unknown): Branch[] {
  if (Array.isArray(value)) return value as Branch[]
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (Array.isArray(record.data)) return record.data as Branch[]
    if (Array.isArray(record.branches)) return record.branches as Branch[]
    if (typeof record.code === 'string' && typeof record.name === 'string') {
      return [record as Branch]
    }
    const keyedBranches = Object.values(record).filter((item): item is Branch => {
      if (!item || typeof item !== 'object') return false
      const branch = item as Record<string, unknown>
      return typeof branch.code === 'string' && typeof branch.name === 'string'
    })
    if (keyedBranches.length > 0) return keyedBranches
  }
  return []
}

function localBankSearch(query: string, banks: Bank[] = FALLBACK_BANKS) {
  const q = normalizeSearch(query)
  if (!q) return banks.slice(0, 6)
  return banks.filter((bank) =>
    [
      bank.code,
      bank.name,
      bank.kana,
      bank.hira,
      bank.roma,
      ...(BANK_ALIASES[bank.code] ?? []),
    ].some((value) => normalizeSearch(value).includes(q))
  ).slice(0, 8)
}

function localBranchSearch(
  bankCode: string,
  query: string,
  branches: Branch[] = FALLBACK_BRANCHES[bankCode] ?? []
) {
  const q = normalizeSearch(query)
  if (!q) return branches.slice(0, 6)
  return branches.filter((branch) =>
    [branch.code, branch.name, branch.kana, branch.hira, branch.roma].some((value) =>
      normalizeSearch(value).includes(q)
    )
  )
}

async function fetchBranchCatalog(bankCode: string, signal: AbortSignal) {
  const branches: Branch[] = []

  for (let page = 1; page <= BRANCH_API_MAX_PAGES; page += 1) {
    const response = await fetch(
      `https://bank.teraren.com/banks/${bankCode}/branches.json?page=${page}&per=${BRANCH_API_PAGE_SIZE}`,
      { signal }
    )
    if (!response.ok) throw new Error('Failed to fetch branches')

    const pageBranches = normalizeBranchResponse(await response.json())
    branches.push(...pageBranches)

    if (pageBranches.length < BRANCH_API_PAGE_SIZE) break
  }

  return branches
}

function withCurrent(
  options: { value: string; label: string }[],
  current: string
) {
  if (!current || options.some((option) => option.value === current)) return options
  return [{ value: current, label: current }, ...options]
}

export function ProfileEditForm({
  initialData,
}: {
  initialData: ProfileEditInitialData
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [serverState, setServerState] = useState<ProfileUpdateState>()
  const [fileName, setFileName] = useState<string>()
  const [idImagePreviewUrl, setIdImagePreviewUrl] = useState<string>()
  const [bankQuery, setBankQuery] = useState(initialData.bankName)
  const [bankCatalog, setBankCatalog] = useState<Bank[]>(FALLBACK_BANKS)
  const [selectedBank, setSelectedBank] = useState<Bank>()
  const [bankLoading, setBankLoading] = useState(false)
  const [branchQuery, setBranchQuery] = useState(initialData.branchName)
  const [branchCatalogs, setBranchCatalogs] = useState<Record<string, Branch[]>>({})
  const [selectedBranch, setSelectedBranch] = useState<Branch>()
  const [branchLoading, setBranchLoading] = useState(false)
  const [pending, startTransition] = useTransition()

  const allErrors = serverState?.errors ?? {}
  const bankName = selectedBank?.name ?? bankQuery
  const branchName = selectedBranch?.name ?? branchQuery
  const selectedBankCode = selectedBank?.code
  const visibleBankOptions = useMemo(
    () => localBankSearch(bankQuery, bankCatalog),
    [bankCatalog, bankQuery]
  )
  const visibleBranchOptions = useMemo(() => {
    if (!selectedBankCode) return []
    const catalog = branchCatalogs[selectedBankCode] ?? FALLBACK_BRANCHES[selectedBankCode] ?? []
    return localBranchSearch(selectedBankCode, branchQuery, catalog)
  }, [branchCatalogs, branchQuery, selectedBankCode])

  useEffect(() => {
    return () => {
      if (idImagePreviewUrl) URL.revokeObjectURL(idImagePreviewUrl)
    }
  }, [idImagePreviewUrl])

  useEffect(() => {
    if (!serverState?.success) return
    const timer = window.setTimeout(() => {
      setServerState(undefined)
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [serverState?.success])

  useEffect(() => {
    const controller = new AbortController()

    const timer = window.setTimeout(async () => {
      setBankLoading(true)

      try {
        const response = await fetch(
          `https://bank.teraren.com/banks.json?page=1&per=${BANK_API_PAGE_SIZE}`,
          { signal: controller.signal }
        )
        if (!response.ok) return

        const remoteBanks = normalizeBankResponse(await response.json())
        if (!controller.signal.aborted && remoteBanks.length > 0) {
          setBankCatalog(mergeByCode([...FALLBACK_BANKS, ...remoteBanks]))
        }
      } catch {
        // デフォルト銀行一覧だけで検索を継続する。
      } finally {
        if (!controller.signal.aborted) setBankLoading(false)
      }
    }, 0)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    if (!selectedBankCode) {
      const clearLoadingTimer = window.setTimeout(() => {
        setBranchLoading(false)
      }, 0)
      return () => {
        window.clearTimeout(clearLoadingTimer)
        controller.abort()
      }
    }

    if (branchCatalogs[selectedBankCode]) {
      const clearLoadingTimer = window.setTimeout(() => {
        setBranchLoading(false)
      }, 0)
      return () => {
        window.clearTimeout(clearLoadingTimer)
        controller.abort()
      }
    }

    const fallbackBranches = FALLBACK_BRANCHES[selectedBankCode] ?? []

    const timer = window.setTimeout(async () => {
      setBranchLoading(true)

      try {
        const remoteBranches = await fetchBranchCatalog(selectedBankCode, controller.signal)
        if (!controller.signal.aborted) {
          setBranchCatalogs((current) => {
            if (current[selectedBankCode]) return current
            return {
              ...current,
              [selectedBankCode]: mergeByCode([...fallbackBranches, ...remoteBranches]),
            }
          })
        }
      } catch {
        if (!controller.signal.aborted) {
          setBranchCatalogs((current) => {
            if (current[selectedBankCode]) return current
            return { ...current, [selectedBankCode]: fallbackBranches }
          })
        }
      } finally {
        if (!controller.signal.aborted) setBranchLoading(false)
      }
    }, 0)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [branchCatalogs, selectedBankCode])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const form = formRef.current
    if (!form) return

    const formData = new FormData(form)
    setServerState(undefined)

    startTransition(async () => {
      const result = await updateProfileAction(undefined, formData)
      setServerState(result)

      const firstError = Object.keys(result?.errors ?? {})[0]
      if (firstError) {
        form
          .querySelector(`[name="${firstError}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else if (result?.success) {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    })
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="rounded-[28px] border border-[#2d2a20] bg-[#12100c] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-6"
    >
      {serverState?.error && (
        <div className="mb-4 rounded-[16px] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">
          {serverState.error}
        </div>
      )}
      {serverState?.success && (
        <div className="mb-4 rounded-[16px] border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm font-black text-emerald-300">
          {serverState.success}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="基本情報">
          <Field
            label="氏名"
            name="last_name"
            required
            defaultValue={initialData.lastName}
            placeholder="山田太郎"
            errors={allErrors}
          />
          <Field
            label="氏名（カナ）"
            name="last_name_kana"
            required
            defaultValue={initialData.lastNameKana}
            placeholder="ヤマダタロウ"
            errors={allErrors}
          />
          <Field
            label="メールアドレス"
            name="email"
            type="email"
            required
            defaultValue={initialData.email}
            placeholder="example@tcg-royal.com"
            autoComplete="email"
            errors={allErrors}
          />
          <Field
            label="メールアドレス（確認）"
            name="email_confirm"
            type="email"
            required
            defaultValue={initialData.email}
            placeholder="example@tcg-royal.com"
            autoComplete="email"
            errors={allErrors}
          />
          <Field
            label="新しいパスワード"
            name="password"
            type="password"
            placeholder="変更する場合のみ入力"
            autoComplete="new-password"
            errors={allErrors}
          />
          <Field
            label="新しいパスワード（確認）"
            name="password_confirm"
            type="password"
            placeholder="確認のため再入力してください"
            autoComplete="new-password"
            errors={allErrors}
          />

          <RadioGroup
            label="適格請求書発行事業者"
            name="is_qualified_invoice"
            required
            defaultValue={initialData.isQualifiedInvoice ? 'true' : 'false'}
            options={[
              { value: 'false', label: 'いいえ' },
              { value: 'true', label: 'はい' },
            ]}
            errors={allErrors}
          />

          <div>
            <label className="mb-1.5 block text-xs font-black text-[#d7ceb8]">
              生年月日 <Required />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <SelectInput
                name="birthday_year"
                placeholder="年"
                required
                defaultValue={initialData.birthdayYear}
                options={YEARS.map((year) => ({ value: String(year), label: `${year}年` }))}
              />
              <SelectInput
                name="birthday_month"
                placeholder="月"
                required
                defaultValue={initialData.birthdayMonth}
                options={MONTHS.map((month) => ({ value: String(month), label: `${month}月` }))}
              />
              <SelectInput
                name="birthday_day"
                placeholder="日"
                required
                defaultValue={initialData.birthdayDay}
                options={DAYS.map((day) => ({ value: String(day), label: `${day}日` }))}
              />
            </div>
          </div>

          <RadioGroup
            label="性別"
            name="gender"
            required
            defaultValue={initialData.gender}
            options={[
              { value: 'male', label: '男性' },
              { value: 'female', label: '女性' },
              { value: 'other', label: 'その他' },
            ]}
            errors={allErrors}
          />

          <div>
            <label className="mb-1.5 block text-xs font-black text-[#d7ceb8]">
              ご職業 <Required />
            </label>
            <SelectInput
              name="occupation"
              placeholder="選択してください"
              required
              defaultValue={initialData.occupation}
              options={withCurrent(
                OCCUPATIONS.map((occupation) => ({
                  value: occupation,
                  label: occupation,
                })),
                initialData.occupation
              )}
            />
            {allErrors.occupation && (
              <p className="mt-1 text-[11px] font-semibold text-red-300">
                {allErrors.occupation}
              </p>
            )}
          </div>
        </Section>

        <Section title="身分証">
          <div>
            <label className="mb-1.5 block text-xs font-black text-[#d7ceb8]">
              身分証 <Required />
            </label>
            <SelectInput
              name="id_type"
              placeholder="選択してください"
              required
              defaultValue={initialData.idType}
              options={withCurrent(
                ID_TYPES.map((type) => ({ value: type, label: type })),
                initialData.idType
              )}
            />
            {allErrors.id_type && (
              <p className="mt-1 text-[11px] font-semibold text-red-300">
                {allErrors.id_type}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-black text-[#d7ceb8]">
              身分証画像アップロード <Required />
            </label>
            {idImagePreviewUrl && (
              <div
                className="mb-2 h-40 w-full rounded-[18px] border border-[#3a3528] bg-[#0f0e0b] bg-contain bg-center bg-no-repeat"
                style={{ backgroundImage: `url("${idImagePreviewUrl}")` }}
                aria-label="選択した身分証画像のプレビュー"
              />
            )}
            <label className="flex h-11 cursor-pointer items-center justify-center rounded-[16px] border border-[#3a3528] bg-[#0f0e0b] px-3 text-xs font-black text-[#f6f0dc] transition-colors hover:border-[#c9a52e]/60">
              {fileName ?? (
                initialData.hasIdentityImage
                  ? initialData.identityVerified
                    ? 'アップロード済み / 確認済み'
                    : 'アップロード済み'
                  : '画像を選択'
              )}
              <input
                type="file"
                name="id_image"
                accept=".jpg,.jpeg,.png,.heic,.heif"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  setFileName(file?.name)
                  setIdImagePreviewUrl((previousUrl) => {
                    if (previousUrl) URL.revokeObjectURL(previousUrl)
                    return file ? URL.createObjectURL(file) : undefined
                  })
                }}
              />
            </label>
            {allErrors.id_image && (
              <p className="mt-1 text-[11px] font-semibold text-red-300">
                {allErrors.id_image}
              </p>
            )}
          </div>
        </Section>

        <Section title="ご連絡先">
          <Field
            label="郵便番号"
            name="postal_code"
            required
            defaultValue={initialData.postalCode}
            placeholder="1060032(ハイフンなし)"
            inputMode="numeric"
            errors={allErrors}
          />
          <Field
            label="住所"
            name="address"
            required
            defaultValue={initialData.address}
            placeholder="東京都中央区..."
            errors={allErrors}
          />
          <Field
            label="電話番号"
            name="phone"
            type="tel"
            required
            defaultValue={initialData.phone}
            placeholder="09012345678(ハイフンなし)"
            inputMode="numeric"
            errors={allErrors}
          />
        </Section>

        <Section title="振込先情報">
          <BankSearch
            label="銀行名"
            query={bankQuery}
            setQuery={(nextValue) => {
              setBankQuery(nextValue)
              setSelectedBank(undefined)
              setBranchQuery('')
              setSelectedBranch(undefined)
            }}
            selectedBank={selectedBank}
            setSelectedBank={(bank) => {
              setSelectedBank(bank)
              setBankQuery(`${bank.name} / ${bank.code}`)
              setBranchQuery('')
              setSelectedBranch(undefined)
            }}
            options={visibleBankOptions}
            loading={bankLoading}
            error={allErrors.bank_name}
          />
          <input type="hidden" name="bank_name" value={bankName} />

          <BranchSearch
            label="支店名"
            query={branchQuery}
            setQuery={(nextValue) => {
              setBranchQuery(nextValue)
              setSelectedBranch(undefined)
            }}
            selectedBank={selectedBank}
            selectedBranch={selectedBranch}
            setSelectedBranch={(branch) => {
              setSelectedBranch(branch)
              setBranchQuery(`${branch.name} / ${branch.code}`)
            }}
            options={
              selectedBank ? visibleBranchOptions : []
            }
            loading={branchLoading}
            error={allErrors.branch_name}
          />
          <input type="hidden" name="branch_name" value={branchName} />

          <div>
            <label className="mb-1.5 block text-xs font-black text-[#d7ceb8]">
              口座種別 <Required />
            </label>
            <SelectInput
              name="account_type"
              placeholder="選択してください"
              required
              defaultValue={initialData.accountType}
              options={[
                { value: 'ordinary', label: '普通' },
                { value: 'current', label: '当座' },
              ]}
            />
            {allErrors.account_type && (
              <p className="mt-1 text-[11px] font-semibold text-red-300">
                {allErrors.account_type}
              </p>
            )}
          </div>

          <Field
            label="口座番号"
            name="account_number"
            required
            defaultValue={initialData.accountNumber}
            placeholder="7桁の口座番号を入力"
            inputMode="numeric"
            maxLength={7}
            errors={allErrors}
          />
          <Field
            label="口座名義（カタカナ）"
            name="account_holder_kana"
            required
            defaultValue={initialData.accountHolderKana}
            placeholder="ヤマダタロウ"
            errors={allErrors}
          />
        </Section>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mx-auto mt-6 block h-12 w-full max-w-xl rounded-[18px] bg-[#c9a52e] text-base font-black text-[#0e0c09] shadow-[0_14px_40px_rgba(201,165,46,0.18)] transition-colors hover:bg-[#d7b865] disabled:opacity-50"
      >
        {pending ? '保存中...' : '保存する'}
      </button>
    </form>
  )
}

function Required() {
  return <span className="text-red-300">*</span>
}

function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-[24px] border border-[#2d2a20] bg-[#15130f] p-4">
      <h2 className="mb-4 text-sm font-black text-[#c9a52e]">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function Field({
  label,
  name,
  type = 'text',
  required,
  placeholder,
  autoComplete,
  inputMode,
  maxLength,
  defaultValue,
  errors,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  placeholder?: string
  autoComplete?: string
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode']
  maxLength?: number
  defaultValue?: string
  errors?: Record<string, string>
}) {
  const error = errors?.[name]
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-xs font-black text-[#d7ceb8]">
        {label} {required && <Required />}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        defaultValue={defaultValue}
        className="h-11 w-full rounded-[16px] border border-[#3a3528] bg-[#0f0e0b] px-3 text-sm font-semibold text-[#f6f0dc] outline-none transition-colors placeholder:text-[#5f5748] focus:border-[#c9a52e] focus:ring-2 focus:ring-[#c9a52e]/15"
      />
      {error && <p className="mt-1 text-[11px] font-semibold text-red-300">{error}</p>}
    </div>
  )
}

function SelectInput({
  name,
  options,
  placeholder,
  required,
  defaultValue,
}: {
  name: string
  options: { value: string; label: string }[]
  placeholder?: string
  required?: boolean
  defaultValue?: string
}) {
  return (
    <select
      name={name}
      required={required}
      defaultValue={defaultValue ?? ''}
      className="h-11 w-full rounded-[16px] border border-[#3a3528] bg-[#0f0e0b] px-3 text-sm font-semibold text-[#f6f0dc] outline-none transition-colors focus:border-[#c9a52e] focus:ring-2 focus:ring-[#c9a52e]/15"
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map(({ value, label }) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  )
}

function RadioGroup({
  label,
  name,
  options,
  required,
  defaultValue,
  errors,
}: {
  label: string
  name: string
  options: { value: string; label: string }[]
  required?: boolean
  defaultValue?: string
  errors?: Record<string, string>
}) {
  const error = errors?.[name]

  return (
    <div>
      <p className="mb-1.5 text-xs font-black text-[#d7ceb8]">
        {label} {required && <Required />}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map(({ value, label }) => (
          <label
            key={value}
            className="flex h-11 min-w-[94px] cursor-pointer items-center gap-2 rounded-[16px] border border-[#3a3528] bg-[#0f0e0b] px-3 text-sm font-black text-[#f6f0dc] transition-colors hover:border-[#c9a52e]/60"
          >
            <input
              type="radio"
              name={name}
              value={value}
              required={required}
              defaultChecked={value === defaultValue}
              className="h-4 w-4 accent-[#c9a52e]"
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
      {error && <p className="mt-1 text-[11px] font-semibold text-red-300">{error}</p>}
    </div>
  )
}

function BankSearch({
  label,
  query,
  setQuery,
  selectedBank,
  setSelectedBank,
  options,
  loading,
  error,
}: {
  label: string
  query: string
  setQuery: (value: string) => void
  selectedBank?: Bank
  setSelectedBank: (bank: Bank) => void
  options: Bank[]
  loading: boolean
  error?: string
}) {
  const list = useMemo(() => options.slice(0, 8), [options])
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()

  return (
    <div
      ref={wrapperRef}
      onBlur={(event) => {
        if (!wrapperRef.current?.contains(event.relatedTarget)) {
          setOpen(false)
        }
      }}
    >
      <label className="mb-1.5 block text-xs font-black text-[#d7ceb8]">
        {label} <Required />
      </label>
      <input
        value={query}
        role="combobox"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-autocomplete="list"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setOpen(true)
          setQuery(event.target.value)
        }}
        placeholder="銀行名 / 銀行コードで検索"
        className="h-11 w-full rounded-[16px] border border-[#3a3528] bg-[#0f0e0b] px-3 text-sm font-semibold text-[#f6f0dc] outline-none transition-colors placeholder:text-[#5f5748] focus:border-[#c9a52e] focus:ring-2 focus:ring-[#c9a52e]/15"
      />
      {selectedBank && (
        <p className="mt-1 text-[11px] font-black text-[#8f8369]">
          選択中：{selectedBank.name}（{selectedBank.code}）
        </p>
      )}
      {open && (
        <CandidateList
          id={listboxId}
          emptyText={loading ? '検索中...' : '該当する銀行がありません'}
          items={list.map((bank) => ({
            key: bank.code,
            label: `${bank.name}（${bank.code}）`,
            onClick: () => {
              setSelectedBank(bank)
              setOpen(false)
            },
          }))}
        />
      )}
      {error && <p className="mt-1 text-[11px] font-semibold text-red-300">{error}</p>}
    </div>
  )
}

function BranchSearch({
  label,
  query,
  setQuery,
  selectedBank,
  selectedBranch,
  setSelectedBranch,
  options,
  loading,
  error,
}: {
  label: string
  query: string
  setQuery: (value: string) => void
  selectedBank?: Bank
  selectedBranch?: Branch
  setSelectedBranch: (branch: Branch) => void
  options: Branch[]
  loading: boolean
  error?: string
}) {
  const list = useMemo(() => options.slice(0, 8), [options])
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()

  return (
    <div
      ref={wrapperRef}
      onBlur={(event) => {
        if (!wrapperRef.current?.contains(event.relatedTarget)) {
          setOpen(false)
        }
      }}
    >
      <label className="mb-1.5 block text-xs font-black text-[#d7ceb8]">
        {label} <Required />
      </label>
      <input
        value={query}
        role="combobox"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-autocomplete="list"
        onFocus={() => {
          if (selectedBank) setOpen(true)
        }}
        onChange={(event) => {
          setOpen(true)
          setQuery(event.target.value)
        }}
        disabled={!selectedBank}
        placeholder={selectedBank ? '支店名 / 支店コードで検索' : '銀行を先に選択してください'}
        className="h-11 w-full rounded-[16px] border border-[#3a3528] bg-[#0f0e0b] px-3 text-sm font-semibold text-[#f6f0dc] outline-none transition-colors placeholder:text-[#5f5748] focus:border-[#c9a52e] focus:ring-2 focus:ring-[#c9a52e]/15 disabled:bg-[#171511] disabled:text-[#5f5748]"
      />
      {selectedBranch && (
        <p className="mt-1 text-[11px] font-black text-[#8f8369]">
          選択中：{selectedBranch.name}（{selectedBranch.code}）
        </p>
      )}
      {selectedBank && open && (
        <CandidateList
          id={listboxId}
          emptyText={loading ? '検索中...' : '該当する支店がありません'}
          items={list.map((branch) => ({
            key: branch.code,
            label: `${branch.name}（${branch.code}）`,
            onClick: () => {
              setSelectedBranch(branch)
              setOpen(false)
            },
          }))}
        />
      )}
      {error && <p className="mt-1 text-[11px] font-semibold text-red-300">{error}</p>}
    </div>
  )
}

function CandidateList({
  id,
  items,
  emptyText,
}: {
  id: string
  items: { key: string; label: string; onClick: () => void }[]
  emptyText: string
}) {
  return (
    <div
      id={id}
      role="listbox"
      className="mt-1 max-h-48 overflow-y-auto rounded-[16px] border border-[#3a3528] bg-[#0f0e0b] shadow-[0_18px_50px_rgba(0,0,0,0.35)]"
    >
      {items.length === 0 ? (
        <p className="px-3 py-2 text-xs font-semibold text-[#8f8369]">{emptyText}</p>
      ) : (
        items.map((item) => (
          <button
            key={item.key}
            role="option"
            aria-selected="false"
            type="button"
            onMouseDown={(event) => {
              event.preventDefault()
            }}
            onClick={() => {
              item.onClick()
            }}
            className="block w-full border-b border-[#2d2a20] px-3 py-2 text-left text-xs font-black text-[#f6f0dc] last:border-b-0 hover:bg-[#1b1812]"
          >
            {item.label}
          </button>
        ))
      )}
    </div>
  )
}
