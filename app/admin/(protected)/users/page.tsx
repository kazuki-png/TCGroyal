import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/types'
import { UserIdentitySelect } from './UserIdentitySelect'

type IdentityFilter = 'all' | 'verified' | 'unverified'

type ProfileRow = {
  id: string
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
  searchParams: Promise<{ status?: string | string[] }>
}) {
  const params = await searchParams
  const filter = normalizeFilter(params.status)
  const admin = createAdminClient()

  let profileQuery = admin
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(80)

  if (filter === 'verified') profileQuery = profileQuery.eq('identity_verified', true)
  if (filter === 'unverified') profileQuery = profileQuery.eq('identity_verified', false)

  const { data: profiles } = await profileQuery
  const rows = (profiles ?? []) as ProfileRow[]
  const userIds = rows.map((profile) => profile.id)
  const [{ data: orders }, authUsers] = await Promise.all([
    userIds.length > 0
      ? admin
          .from('orders')
          .select('id, order_number, user_id, status, total_amount, created_at')
          .in('user_id', userIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    Promise.all(
      userIds.map(async (userId) => {
        const { data } = await admin.auth.admin.getUserById(userId)
        return [userId, data.user?.email ?? '-'] as const
      })
    ),
  ])

  const ordersByUser = new Map<string, OrderRow[]>()
  ;((orders ?? []) as OrderRow[]).forEach((order) => {
    const current = ordersByUser.get(order.user_id) ?? []
    current.push(order)
    ordersByUser.set(order.user_id, current)
  })
  const emailMap = new Map(authUsers)

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
                const total = userOrders.reduce((sum, order) => sum + (order.total_amount ?? 0), 0)
                return (
                  <tr key={profile.id} className="border-t border-zinc-800 align-top">
                    <td className="px-4 py-3 text-sm font-black">
                      <p>{displayName(profile)}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {[profile.last_name_kana, profile.first_name_kana].filter(Boolean).join(' ')}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-300">
                      {emailMap.get(profile.id) ?? '-'}
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
                      {currency(total)}
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
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
