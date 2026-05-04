'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { registerAction } from '@/app/register/actions'
import type { RegisterState } from '@/app/register/actions'

// ────────────────────────────────────────────────
// 定数
// ────────────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 1919 }, (_, i) => CURRENT_YEAR - i)
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

const ID_TYPES = [
  '運転免許証',
  'マイナンバーカード',
  'パスポート',
  '健康保険証',
]

// ────────────────────────────────────────────────
// クライアントバリデーション
// ────────────────────────────────────────────────
function validate(fd: FormData): Record<string, string> {
  const errors: Record<string, string> = {}

  const email = (fd.get('email') as string).trim()
  const emailConfirm = (fd.get('email_confirm') as string).trim()
  const password = fd.get('password') as string
  const passwordConfirm = fd.get('password_confirm') as string
  const file = fd.get('id_image') as File | null
  const accountNumber = (fd.get('account_number') as string).trim()
  const agree = fd.get('agree')

  if (email !== emailConfirm) {
    errors.email_confirm = 'メールアドレスが一致しません'
  }
  if (password.length < 8) {
    errors.password = 'パスワードは8文字以上で入力してください'
  }
  if (password !== passwordConfirm) {
    errors.password_confirm = 'パスワードが一致しません'
  }
  if (!file || file.size === 0) {
    errors.id_image = '身分証画像をアップロードしてください'
  } else {
    if (file.size > 5 * 1024 * 1024) {
      errors.id_image = 'ファイルサイズは5MB以下にしてください'
    } else {
      const allowed = /\.(jpe?g|png|heic|heif)$/i
      const allowedMime = ['image/jpeg', 'image/png', 'image/heic', 'image/heif']
      if (!allowed.test(file.name) && !allowedMime.includes(file.type)) {
        errors.id_image = 'JPG・PNG・HEICのみアップロード可能です'
      }
    }
  }
  if (accountNumber && !/^\d{7}$/.test(accountNumber)) {
    errors.account_number = '口座番号は7桁の数字で入力してください'
  }
  if (!agree) {
    errors.agree = '利用規約への同意が必要です'
  }

  return errors
}

// ────────────────────────────────────────────────
// メインコンポーネント
// ────────────────────────────────────────────────
export function RegisterForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [serverState, setServerState] = useState<RegisterState>()
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({})
  const [fileName, setFileName] = useState<string>()
  const [pending, startTransition] = useTransition()

  const allErrors = { ...clientErrors, ...serverState?.errors }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const fd = new FormData(formRef.current!)
    const errs = validate(fd)
    if (Object.keys(errs).length > 0) {
      setClientErrors(errs)
      formRef.current
        ?.querySelector(`[name="${Object.keys(errs)[0]}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setClientErrors({})
    setServerState(undefined)
    startTransition(async () => {
      const result = await registerAction(undefined, fd)
      if (result) {
        setServerState(result)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* サーバーエラー */}
      {serverState?.error && (
        <div className="rounded-xl bg-red-900/40 border border-red-800 px-4 py-3 text-sm text-red-400">
          {serverState.error}
        </div>
      )}

      {/* ── 基本情報 ── */}
      <Section title="基本情報">
        <div className="grid grid-cols-2 gap-3">
          <Field label="姓" name="last_name" required errors={allErrors} />
          <Field label="名" name="first_name" required errors={allErrors} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="姓（カナ）" name="last_name_kana" required placeholder="ヤマダ" errors={allErrors} />
          <Field label="名（カナ）" name="first_name_kana" required placeholder="タロウ" errors={allErrors} />
        </div>
        <Field label="メールアドレス" name="email" type="email" required autoComplete="email" errors={allErrors} />
        <Field label="メールアドレス（確認）" name="email_confirm" type="email" required autoComplete="email" errors={allErrors} />
        <Field label="パスワード（8文字以上）" name="password" type="password" required autoComplete="new-password" errors={allErrors} />
        <Field label="パスワード（確認）" name="password_confirm" type="password" required autoComplete="new-password" errors={allErrors} />

        {/* 生年月日 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">
            生年月日 <Required />
          </label>
          <div className="flex gap-2">
            <SelectInput
              name="birthday_year"
              placeholder="年"
              required
              options={YEARS.map((y) => ({ value: String(y), label: `${y}年` }))}
            />
            <SelectInput
              name="birthday_month"
              placeholder="月"
              required
              options={MONTHS.map((m) => ({ value: String(m), label: `${m}月` }))}
            />
            <SelectInput
              name="birthday_day"
              placeholder="日"
              required
              options={DAYS.map((d) => ({ value: String(d), label: `${d}日` }))}
            />
          </div>
        </div>

        {/* 性別 */}
        <RadioGroup
          label="性別"
          name="gender"
          required
          options={[
            { value: 'male', label: '男性' },
            { value: 'female', label: '女性' },
            { value: 'other', label: 'その他' },
          ]}
        />

        {/* 職業（任意） */}
        <Field label="ご職業（任意）" name="occupation" errors={allErrors} />

        {/* 適格請求書 */}
        <RadioGroup
          label="適格請求書発行事業者"
          name="is_qualified_invoice"
          required
          options={[
            { value: 'true', label: 'はい' },
            { value: 'false', label: 'いいえ' },
          ]}
        />
      </Section>

      {/* ── 本人確認 ── */}
      <Section title="本人確認">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">
            身分証種別 <Required />
          </label>
          <SelectInput
            name="id_type"
            placeholder="選択してください"
            required
            options={ID_TYPES.map((t) => ({ value: t, label: t }))}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">
            身分証画像 <Required />
            <span className="ml-2 text-xs font-normal text-zinc-500">
              JPG / PNG / HEIC・最大5MB
            </span>
          </label>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-600 p-8 text-center hover:border-zinc-400 transition-colors">
            {fileName ? (
              <>
                <p className="text-sm font-medium text-white">{fileName}</p>
                <p className="mt-1 text-xs text-zinc-500">クリックして変更</p>
              </>
            ) : (
              <>
                <svg className="mb-2 h-8 w-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-sm text-zinc-400">クリックしてアップロード</p>
                <p className="mt-1 text-xs text-zinc-600">JPG・PNG・HEIC（最大5MB）</p>
              </>
            )}
            <input
              type="file"
              name="id_image"
              accept=".jpg,.jpeg,.png,.heic,.heif"
              className="hidden"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? undefined)}
            />
          </label>
          {allErrors.id_image && (
            <p className="mt-1.5 text-xs text-red-400">{allErrors.id_image}</p>
          )}
        </div>
      </Section>

      {/* ── ご連絡先 ── */}
      <Section title="ご連絡先">
        <Field label="郵便番号" name="postal_code" required placeholder="1234567" errors={allErrors} />
        <Field label="住所" name="address" required placeholder="東京都○○区△△ 1-1-1" errors={allErrors} />
        <Field label="電話番号" name="phone" type="tel" required placeholder="09012345678" errors={allErrors} />
      </Section>

      {/* ── 振込先情報 ── */}
      <Section title="振込先情報">
        <div className="grid grid-cols-2 gap-3">
          <Field label="銀行名" name="bank_name" required placeholder="○○銀行" errors={allErrors} />
          <Field label="支店名" name="branch_name" required placeholder="△△支店" errors={allErrors} />
        </div>

        <RadioGroup
          label="口座種別"
          name="account_type"
          required
          options={[
            { value: 'ordinary', label: '普通' },
            { value: 'current', label: '当座' },
          ]}
        />

        <Field
          label="口座番号（7桁）"
          name="account_number"
          required
          placeholder="1234567"
          inputMode="numeric"
          maxLength={7}
          errors={allErrors}
        />
        <Field
          label="口座名義（カナ）"
          name="account_holder_kana"
          required
          placeholder="ヤマダ タロウ"
          errors={allErrors}
        />
      </Section>

      {/* ── 同意 ── */}
      <div className="rounded-2xl border border-zinc-700 bg-zinc-800 p-6">
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" name="agree" className="mt-0.5 h-4 w-4 accent-white" />
          <span className="text-sm leading-relaxed text-zinc-400">
            <Link href="/terms" className="text-white underline underline-offset-2 hover:text-zinc-200">
              利用規約
            </Link>
            および
            <Link href="/privacy" className="text-white underline underline-offset-2 hover:text-zinc-200">
              プライバシーポリシー
            </Link>
            に同意して登録します
          </span>
        </label>
        {allErrors.agree && (
          <p className="mt-2 text-xs text-red-400">{allErrors.agree}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-white py-3.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 disabled:opacity-50"
      >
        {pending ? '登録中...' : '利用規約およびプライバシーポリシーに同意して登録'}
      </button>

      <p className="text-center text-sm text-zinc-500">
        すでにアカウントをお持ちの方は{' '}
        <Link href="/login" className="text-white underline underline-offset-2 hover:text-zinc-200">
          ログイン
        </Link>
      </p>
    </form>
  )
}

// ────────────────────────────────────────────────
// 共通サブコンポーネント
// ────────────────────────────────────────────────
function Required() {
  return <span className="text-red-400">*</span>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-700 bg-zinc-800 p-6">
      <h2 className="mb-5 text-lg font-semibold text-white">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
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
  errors,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  placeholder?: string
  autoComplete?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  maxLength?: number
  errors?: Record<string, string>
}) {
  const error = errors?.[name]
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-zinc-300">
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
        className={`w-full rounded-lg border bg-zinc-700 px-4 py-2.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:ring-1 ${
          error
            ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
            : 'border-zinc-600 focus:border-zinc-400 focus:ring-zinc-400'
        }`}
      />
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  )
}

function SelectInput({
  name,
  options,
  placeholder,
  required,
}: {
  name: string
  options: { value: string; label: string }[]
  placeholder?: string
  required?: boolean
}) {
  return (
    <select
      name={name}
      required={required}
      defaultValue=""
      className="w-full rounded-lg border border-zinc-600 bg-zinc-700 px-3 py-2.5 text-sm text-white outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map(({ value, label }) => (
        <option key={value} value={value} className="bg-zinc-800">
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
}: {
  label: string
  name: string
  options: { value: string; label: string }[]
  required?: boolean
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-zinc-300">
        {label} {required && <Required />}
      </label>
      <div className="flex flex-wrap gap-4">
        {options.map(({ value, label }) => (
          <label key={value} className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name={name}
              value={value}
              required={required}
              className="h-4 w-4 accent-white"
            />
            <span className="text-sm text-zinc-300">{label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
