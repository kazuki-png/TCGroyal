import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/types'
import { AdminOrdersTable, type AdminOrderRow } from './AdminOrdersTable'
import type {
  AssessmentCardOption,
  AssessmentEditorItem,
} from './AssessmentEditor'

type OrderRow = {
  id: string
  order_number: string | null
  user_id: string
  status: OrderStatus
  total_amount: number | null
  assessment_saved_at: string | null
  bank_name: string | null
  bank_branch: string | null
  bank_account_no: string | null
  bank_holder: string | null
  created_at: string
  updated_at: string
  order_items: AssessmentEditorItem[] | null
}

type ProfileRow = {
  id: string
  email: string | null
  last_name: string | null
  first_name: string | null
}

function displayOrderNumber(order: OrderRow) {
  return order.order_number || order.id.slice(0, 8).toUpperCase()
}

function displayName(profile: ProfileRow | undefined) {
  return [profile?.last_name, profile?.first_name].filter(Boolean).join(' ') || '未設定'
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const admin = createAdminClient()

  let query = admin
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (status) query = query.eq('status', status)

  const [{ data: orders }, { data: cardOptions }] = await Promise.all([
    query,
    admin
      .from('cards')
      .select('id, name, card_number, category, grade, buy_price, image_url')
      .order('name', { ascending: true })
      .limit(5000),
  ])
  const orderRows = (orders ?? []) as OrderRow[]
  const userIds = Array.from(new Set(orderRows.map((order) => order.user_id)))
  const { data: profiles } = userIds.length > 0
    ? await admin
        .from('profiles')
        .select('id, email, last_name, first_name')
        .in('id', userIds)
    : { data: [] }

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile as ProfileRow]))
  const rows: AdminOrderRow[] = orderRows.map((order) => ({
    id: order.id,
    orderNumber: displayOrderNumber(order),
    status: order.status,
    assessmentSavedAt: order.assessment_saved_at,
    totalAmount: order.total_amount ?? 0,
    itemCount: order.order_items?.length ?? 0,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    userName: displayName(profileMap.get(order.user_id)),
    userEmail: profileMap.get(order.user_id)?.email ?? '-',
    bankName: order.bank_name ?? '',
    bankBranch: order.bank_branch ?? '',
    bankAccountNo: order.bank_account_no ?? '',
    bankHolder: order.bank_holder ?? '',
    items: order.order_items ?? [],
  }))

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black text-white">取引</h1>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/orders"
          className={`rounded-full px-4 py-1.5 text-sm font-black transition-colors ${
            !status
              ? 'bg-red-600 text-white'
              : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
          }`}
        >
          全て
        </Link>
        {(Object.entries(ORDER_STATUS_LABELS) as [OrderStatus, string][]).map(
          ([key, label]) => (
            <Link
              key={key}
              href={`/admin/orders?status=${key}`}
              className={`rounded-full px-4 py-1.5 text-sm font-black transition-colors ${
                status === key
                  ? 'bg-red-600 text-white'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              {label}
            </Link>
          )
        )}
      </div>

      <AdminOrdersTable
        rows={rows}
        cardOptions={(cardOptions ?? []) as AssessmentCardOption[]}
      />
    </div>
  )
}
