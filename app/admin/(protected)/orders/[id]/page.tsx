import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { StatusBadge } from '@/app/components/StatusBadge'
import {
  AssessmentEditor,
  type AssessmentCardOption,
  type AssessmentEditorItem,
} from '../AssessmentEditor'
import {
  ORDER_STATUS_LABELS,
  nextOrderStatuses,
  previousOrderStatuses,
} from '@/lib/types'
import type { OrderStatus } from '@/lib/types'

function displayOrderNumber(order: { id: string; order_number?: string | null }) {
  return order.order_number || order.id.slice(0, 8).toUpperCase()
}

function orderActionStatuses(status: OrderStatus) {
  if (
    status === 'inspecting' ||
    status === 'pending_approval' ||
    status === 'completed'
  ) {
    return []
  }

  const nextStatus = nextOrderStatuses(status)[0]
  return nextStatus ? [nextStatus] : []
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const adminClient = createAdminClient()

  const { data: order } = await adminClient
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', id)
    .single()

  if (!order) notFound()

  const { data: authUser } = await adminClient.auth.admin.getUserById(
    order.user_id
  )

  const [{ data: logs }, { data: cardOptions }] = await Promise.all([
    adminClient
      .from('order_status_logs')
      .select('*')
      .eq('order_id', id)
      .order('created_at', { ascending: true }),
    adminClient
      .from('cards')
      .select('id, name, card_number, category, grade, buy_price, image_url')
      .eq('category', 'pokemon')
      .order('name', { ascending: true })
      .limit(5000),
  ])

  const currentStatus = order.status as OrderStatus
  const nextStatuses = orderActionStatuses(currentStatus)
  const previousStatuses = previousOrderStatuses(currentStatus)
  const orderItems = (order.order_items ?? []) as AssessmentEditorItem[]

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/admin/orders"
          className="text-sm font-black text-zinc-400 hover:text-red-500"
        >
          ← 一覧
        </Link>
        <h1 className="text-2xl font-black text-white">
          注文 {displayOrderNumber(order)}
        </h1>
        <StatusBadge status={order.status as OrderStatus} />
      </div>

      <div className="space-y-6">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-1 text-sm font-medium text-zinc-400">申込者</h2>
          <p className="text-white">{authUser?.user?.email ?? '不明'}</p>
        </div>

        <AssessmentEditor
          key={`${order.id}-${currentStatus}`}
          orderId={order.id}
          status={currentStatus}
          assessmentSavedAt={order.assessment_saved_at}
          items={orderItems}
          cardOptions={(cardOptions ?? []) as AssessmentCardOption[]}
          nextStatuses={nextStatuses}
          previousStatuses={previousStatuses}
        />

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">振込先口座</h2>
          <dl className="space-y-2 text-sm">
            {[
              { label: '銀行', value: order.bank_name },
              { label: '支店', value: order.bank_branch },
              { label: '口座番号', value: order.bank_account_no },
              { label: '口座名義', value: order.bank_holder },
            ].map(({ label, value }) => (
              <div key={label} className="flex gap-4">
                <dt className="w-24 text-zinc-500">{label}</dt>
                <dd className="text-white">{value ?? '-'}</dd>
              </div>
            ))}
          </dl>
        </div>

        {logs && logs.length > 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">
              ステータス変更履歴
            </h2>
            <div className="space-y-3">
              {logs.map((log: {
                id: string
                old_status: string | null
                new_status: string
                created_at: string
              }) => (
                <div
                  key={log.id}
                  className="flex items-center gap-3 text-sm text-zinc-400"
                >
                  <span className="text-xs">
                    {new Date(log.created_at).toLocaleString('ja-JP')}
                  </span>
                  <span>
                    {log.old_status
                      ? ORDER_STATUS_LABELS[log.old_status as OrderStatus]
                      : '-'}
                  </span>
                  <span>→</span>
                  <span className="text-white">
                    {ORDER_STATUS_LABELS[log.new_status as OrderStatus]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
