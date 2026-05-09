import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/types'
import { KycDocumentActions } from './KycDocumentActions'
import { UserIdentitySelect } from './UserIdentitySelect'

type IdentityFilter = 'all' | 'verified' | 'unverified'

type ProfileRow = {
  id: string
  email: string | null
  last_name: string | null
  first_name: string | null
  last_name_kana: string | null
  first_name_kana: string | null
  postal_code: string | null
  address: string | null
  phone: string | null
  bank_name: string | null
  branch_name: string | null
  account_number: string | null
  account_holder_kana: string | null
  identity_verified: boolean | null
  created_at: string
}

type OrderRow = {
  id: string
  order_number: string | null
  user_id: string
  status: OrderStatus
  total_amount: number | null
  created_at: string
}

type DocRow = {
  id: string
  user_id: string
  status: string
  deleted_at: string | null
}

const PAGE_SIZE = 30

const FILTERS: { key: IdentityFilter; label: string }[] = [
  { key: 'all', label: '全員' },
  { key: 'verified', label: '本人確認済み' },
  { key: 'unverified', label: '未確認' },
]

function normalizeFilter(value: string | string[] | undefined): IdentityFilter {
  const raw = Array.isArray(value) ? value[0] : value
  if (raw === 'verified' || raw === 'unverified') return raw
  return 'all'
}

function normalizePage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const page = Number.parseInt(raw ?? '1', 10)
  return Number.isFinite(page) && page > 0 ? page : 1
}

function displayName(profile: ProfileRow) {
  return [profile.last_name, profile.first_name].filter(Boolean).join(' ') || '未設定'
}

function bankInfo(profile: ProfileRow) {
  return [profile.bank_name, profile.branch_name, profile.account_number, profile.account_holder_kana]
    .filter(Boolean)
    .join(' / ') || '-'
}

function addressInfo(profile: ProfileRow) {
  return [profile.postal_code ? `〒${profile.postal_code}` : '', profile.address]
    .filter(Boolean)
    .join(' ') || '-'
}

function orderNumber(order: OrderRow | undefined) {
  if (!order) return '-'
  return order.order_number || order.id.slice(0, 8).toUpperCase()
}

function currency(value: number) {
  return `¥${value.toLocaleString('ja-JP')}`
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[]; page?: string | string[] }>
}) {
  const params = await searchParams
  const filter = normalizeFilter(params.status)
  const requestedPage = normalizePage(params.page)
  const from = (requestedPage - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const admin = createAdminClient()

  // 現在ログイン中の管理者の role を確認する
  const supabase = await createClient()
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()
  const { data: adminRow } = currentUser
    ? await supabase
        .from('admin_users')
        .select('role')
        .eq('id', currentUser.id)
        .single()
    : { data: null }
  const isKycReviewer = adminRow?.role === 'kyc_reviewer'

  let profileQuery = admin
    .from('profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filter === 'verified') profileQuery = profileQuery.eq('identity_verified', true)
  if (filter === 'unverified') profileQuery = profileQuery.eq('identity_verified', false)

  const { data: profiles, count } = await profileQuery
  const rows = (profiles ?? []) as ProfileRow[]
  const userIds = rows.map((profile) => profile.id)
  const total = count ?? rows.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(requestedPage, totalPages)
  if (requestedPage > totalPages && total > 0) {
    redirect(`/admin/users?status=${filter}&page=${totalPages}`)
  }

  const [{ data: orders }, { data: docs }] = await Promise.all([
    userIds.length > 0
      ? admin
          .from('orders')
          .select('id, order_number, user_id, status, total_amount, created_at')
          .in('user_id', userIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    // kyc_reviewer のみ書類メタデータを取得する
    isKycReviewer && userIds.length > 0
      ? admin
          .from('identity_documents')
          .select('id, user_id, status, deleted_at')
          .in('user_id', userIds)
      : Promise.resolve({ data: [] }),
  ])

  const ordersByUser = new Map<string, OrderRow[]>()
  ;((orders ?? []) as OrderRow[]).forEach((order) => {
    const current = ordersByUser.get(order.user_id) ?? []
    current.push(order)
    ordersByUser.set(order.user_id, current)
  })

  // 削除済みでない書類のみ表示
  const docByUser = new Map<string, DocRow>()
  ;((docs ?? []) as DocRow[]).forEach((doc) => {
    if (!doc.deleted_at) docByUser.set(doc.user_id, doc)
  })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <Link
            key={item.key}
            href={`/admin/users?status=${item.key}`}
            className={[
              'rounded-full px-4 py-1.5 text-sm font-black transition-colors',
              filter === item.key
                ? 'bg-red-600 text-white'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800',
            ].join(' ')}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {isKycReviewer && (
        <p className="rounded-lg border border-yellow-800 bg-yellow-900/20 px-3 py-2 text-xs font-black text-yellow-400">
          KYC審査者として閲覧しています。書類の確認・削除が可能です。閲覧ログが記録されます。
        </p>
      )}

      <div className="overflow-x-auto bg-zinc-950 text-white">
        {rows.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm font-black text-zinc-500">
            ユーザーがありません
          </div>
        ) : (
          <table className="w-full min-w-[1180px]">
            <thead className="bg-[#222221]">
              <tr className="text-left text-xs text-zinc-400">
                <th className="px-4 py-3 font-black">氏名</th>
                <th className="px-4 py-3 font-black">メール</th>
                <th className="px-4 py-3 font-black">電話</th>
                <th className="px-4 py-3 font-black">住所</th>
                <th className="px-4 py-3 font-black">振込先</th>
                <th className="px-4 py-3 text-right font-black">取引数</th>
                <th className="px-4 py-3 text-right font-black">累計買取申込額</th>
                <th className="px-4 py-3 font-black">直近の取引内容</th>
                <th className="px-4 py-3 font-black">本人確認</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((profile) => {
                const userOrders = ordersByUser.get(profile.id) ?? []
                const latest = userOrders[0]
                const totalAmount = userOrders.reduce((sum, order) => sum + (order.total_amount ?? 0), 0)
                const doc = docByUser.get(profile.id)
                return (
                  <tr key={profile.id} className="border-t border-zinc-800 align-top">
                    <td className="px-4 py-3 text-sm font-black">
                      <p>{displayName(profile)}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {[profile.last_name_kana, profile.first_name_kana].filter(Boolean).join(' ')}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-300">
                      {profile.email ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-300">
                      {profile.phone ?? '-'}
                    </td>
                    <td className="max-w-[220px] px-4 py-3 text-sm text-zinc-300">
                      {addressInfo(profile)}
                    </td>
                    <td className="max-w-[240px] px-4 py-3 text-sm text-zinc-300">
                      {bankInfo(profile)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-black">
                      {userOrders.length.toLocaleString('ja-JP')}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-black">
                      {currency(totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-300">
                      {latest ? (
                        <div>
                          <p className="font-black text-white">{orderNumber(latest)}</p>
                          <p className="mt-1">
                            {currency(latest.total_amount ?? 0)} / {ORDER_STATUS_LABELS[latest.status]}
                          </p>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <UserIdentitySelect
                        userId={profile.id}
                        verified={Boolean(profile.identity_verified)}
                      />
                      {isKycReviewer && doc && (
                        <KycDocumentActions documentId={doc.id} />
                      )}
                      {isKycReviewer && !doc && (
                        <p className="mt-1 text-[11px] text-zinc-600">書類未提出</p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-400">
        <p>
          {total.toLocaleString('ja-JP')}件中 {rows.length === 0 ? 0 : from + 1}
          -{Math.min(from + rows.length, total)}件を表示
        </p>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/users?status=${filter}&page=${Math.max(1, page - 1)}`}
            aria-disabled={page <= 1}
            className={[
              'rounded-lg border border-zinc-700 px-3 py-2 font-black transition-colors',
              page <= 1
                ? 'pointer-events-none text-zinc-700'
                : 'text-white hover:bg-zinc-900',
            ].join(' ')}
          >
            前へ
          </Link>
          <span className="font-black text-white">
            {page} / {totalPages}
          </span>
          <Link
            href={`/admin/users?status=${filter}&page=${Math.min(totalPages, page + 1)}`}
            aria-disabled={page >= totalPages}
            className={[
              'rounded-lg border border-zinc-700 px-3 py-2 font-black transition-colors',
              page >= totalPages
                ? 'pointer-events-none text-zinc-700'
                : 'text-white hover:bg-zinc-900',
            ].join(' ')}
          >
            次へ
          </Link>
        </div>
      </div>
    </div>
  )
}
