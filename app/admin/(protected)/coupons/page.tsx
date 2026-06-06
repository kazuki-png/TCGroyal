import { createAdminClient } from '@/lib/supabase/admin'
import { createCoupon, deleteCoupon, updateCoupon } from './actions'
import { DeleteCouponButton } from './DeleteCouponButton'

type CouponRow = {
  id: string
  code: string
  amount: number
  comment: string | null
  one_use_per_user: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

type RedemptionRow = {
  coupon_id: string
}

function currency(value: number) {
  return `¥${value.toLocaleString('ja-JP')}`
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  type = 'text',
  required,
}: {
  label: string
  name: string
  defaultValue?: string | number
  placeholder?: string
  type?: string
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-black text-zinc-400">
        {label}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm font-semibold text-white outline-none placeholder:text-zinc-600 focus:border-[#c9a52e]"
      />
    </label>
  )
}

function CheckboxField({
  name,
  label,
  defaultChecked,
}: {
  name: string
  label: string
  defaultChecked?: boolean
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300">
      <input
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="h-4 w-4 accent-[#c9a52e]"
      />
      {label}
    </label>
  )
}

function FlashMessage({
  error,
  saved,
  deleted,
}: {
  error?: string
  saved?: string
  deleted?: string
}) {
  if (error) {
    return (
      <p className="mb-6 rounded-xl border border-red-900 bg-red-950/50 px-4 py-3 text-sm font-semibold text-red-200">
        {error}
      </p>
    )
  }

  if (deleted) {
    return (
      <p className="mb-6 rounded-xl border border-red-900 bg-red-950/50 px-4 py-3 text-sm font-semibold text-red-200">
        削除しました
      </p>
    )
  }

  if (saved) {
    return (
      <p className="mb-6 rounded-xl border border-emerald-900 bg-emerald-950/50 px-4 py-3 text-sm font-semibold text-emerald-200">
        保存しました
      </p>
    )
  }

  return null
}

export default async function AdminCouponsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; deleted?: string }>
}) {
  const { error, saved, deleted } = await searchParams
  const admin = createAdminClient()
  const [{ data: coupons }, { data: redemptions }] = await Promise.all([
    admin
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false }),
    admin.from('coupon_redemptions').select('coupon_id'),
  ])

  const couponRows = (coupons ?? []) as CouponRow[]
  const redemptionCounts = new Map<string, number>()
  ;((redemptions ?? []) as RedemptionRow[]).forEach((redemption) => {
    redemptionCounts.set(
      redemption.coupon_id,
      (redemptionCounts.get(redemption.coupon_id) ?? 0) + 1
    )
  })

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#c9a52e]">
          Coupon
        </p>
        <h1 className="mt-2 text-2xl font-black text-white">
          クーポンコード管理
        </h1>
        <p className="mt-2 text-sm font-semibold text-zinc-400">
          郵送買取の最終確認画面で使える固定額増額クーポンを管理します。
        </p>
      </div>

      <FlashMessage error={error} saved={saved} deleted={deleted} />

      <form
        action={createCoupon}
        className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
      >
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-black text-white">新規追加</h2>
            <p className="mt-1 text-sm font-semibold text-zinc-500">
              入力したコード・コメント・増額金額はユーザー側にも表示されます。
            </p>
          </div>
          <button
            type="submit"
            className="h-11 rounded-lg bg-red-600 px-6 text-sm font-black text-white transition-colors hover:bg-red-500"
          >
            追加
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_180px_1.8fr]">
          <Field
            label="クーポンコード"
            name="code"
            placeholder="REVIEW500"
            required
          />
          <Field
            label="増額金額"
            name="amount"
            type="number"
            placeholder="500"
            required
          />
          <label className="block">
            <span className="mb-1.5 block text-sm font-black text-zinc-400">
              コメント
            </span>
            <textarea
              name="comment"
              rows={3}
              placeholder="Xレビュー投稿特典"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-semibold text-white outline-none placeholder:text-zinc-600 focus:border-[#c9a52e]"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-4">
          <CheckboxField
            name="one_use_per_user"
            label="1ユーザー1回のみ利用可能にする"
          />
          <CheckboxField name="is_active" label="有効" defaultChecked />
        </div>
      </form>

      {couponRows.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-12 text-center text-zinc-500">
          クーポンはまだ登録されていません
        </div>
      ) : (
        <div className="space-y-4">
          {couponRows.map((coupon) => (
            <section
              key={coupon.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
            >
              <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black text-white">
                      {coupon.code}
                    </h2>
                    <span
                      className={[
                        'rounded-full px-3 py-1 text-xs font-black',
                        coupon.is_active
                          ? 'bg-emerald-500/15 text-emerald-200'
                          : 'bg-zinc-700 text-zinc-300',
                      ].join(' ')}
                    >
                      {coupon.is_active ? '有効' : '停止中'}
                    </span>
                    {coupon.one_use_per_user && (
                      <span className="rounded-full bg-[#c9a52e]/15 px-3 py-1 text-xs font-black text-[#d7b865]">
                        1ユーザー1回
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-zinc-400">
                    利用回数 {redemptionCounts.get(coupon.id) ?? 0}回 / 増額{' '}
                    {currency(coupon.amount)}
                  </p>
                </div>
                <p className="text-xs font-semibold text-zinc-500 lg:text-right">
                  作成 {formatDateTime(coupon.created_at)}
                  <br />
                  更新 {formatDateTime(coupon.updated_at)}
                </p>
              </div>

              <form action={updateCoupon} className="grid gap-4">
                <input type="hidden" name="coupon_id" value={coupon.id} />
                <div className="grid gap-4 lg:grid-cols-[1fr_180px_1.8fr]">
                  <Field
                    label="クーポンコード"
                    name="code"
                    defaultValue={coupon.code}
                    required
                  />
                  <Field
                    label="増額金額"
                    name="amount"
                    type="number"
                    defaultValue={coupon.amount}
                    required
                  />
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-black text-zinc-400">
                      コメント
                    </span>
                    <textarea
                      name="comment"
                      rows={3}
                      defaultValue={coupon.comment ?? ''}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-[#c9a52e]"
                    />
                  </label>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-4">
                    <CheckboxField
                      name="one_use_per_user"
                      label="1ユーザー1回のみ利用可能にする"
                      defaultChecked={coupon.one_use_per_user}
                    />
                    <CheckboxField
                      name="is_active"
                      label="有効"
                      defaultChecked={coupon.is_active}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="h-10 rounded-lg bg-red-600 px-5 text-sm font-black text-white transition-colors hover:bg-red-500"
                    >
                      保存
                    </button>
                    <DeleteCouponButton action={deleteCoupon} />
                  </div>
                </div>
              </form>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
