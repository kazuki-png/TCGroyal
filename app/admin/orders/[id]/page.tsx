import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { StatusBadge } from '@/app/components/StatusBadge'
import { StatusUpdateForm } from './StatusUpdateForm'
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABELS } from '@/lib/types'
import type { OrderStatus } from '@/lib/types'

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

  const { data: logs } = await adminClient
    .from('order_status_logs')
    .select('*')
    .eq('order_id', id)
    .order('created_at', { ascending: true })

  const currentIndex = ORDER_STATUS_FLOW.indexOf(order.status as OrderStatus)
  const nextStatuses = ORDER_STATUS_FLOW.slice(currentIndex + 1)

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/admin/orders"
          className="text-sm text-zinc-400 hover:text-white"
        >
          ← 一覧
        </Link>
        <h1 className="text-2xl font-bold text-white">
          注文 {order.id.slice(0, 8).toUpperCase()}
        </h1>
        <StatusBadge status={order.status as OrderStatus} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-1 text-sm font-medium text-zinc-400">申込者</h2>
            <p className="text-white">{authUser?.user?.email ?? '不明'}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">申込カード</h2>
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700 text-left text-sm text-zinc-400">
                  <th className="pb-2 font-medium">カード名</th>
                  <th className="pb-2 font-medium">グレード</th>
                  <th className="pb-2 text-right font-medium">枚数</th>
                  <th className="pb-2 text-right font-medium">単価</th>
                  <th className="pb-2 text-right font-medium">小計</th>
                </tr>
              </thead>
              <tbody>
                {order.order_items?.map((item: {
                  id: string
                  card_name: string
                  grade: string
                  quantity: number
                  unit_price: number
                }) => (
                  <tr key={item.id} className="border-b border-zinc-800">
                    <td className="py-3 text-sm text-white">{item.card_name}</td>
                    <td className="py-3 text-sm text-zinc-400">{item.grade}</td>
                    <td className="py-3 text-right text-sm text-white">
                      {item.quantity}枚
                    </td>
                    <td className="py-3 text-right text-sm text-white">
                      ¥{item.unit_price.toLocaleString()}
                    </td>
                    <td className="py-3 text-right text-sm font-medium text-white">
                      ¥{(item.unit_price * item.quantity).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="pt-3 text-right text-zinc-400">
                    合計
                  </td>
                  <td className="pt-3 text-right text-lg font-bold text-white">
                    ¥{order.total_amount.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

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

        <div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">
              ステータス変更
            </h2>
            {nextStatuses.length === 0 ? (
              <p className="text-sm text-zinc-500">このステータスは完了です</p>
            ) : (
              <StatusUpdateForm orderId={order.id} nextStatuses={nextStatuses} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
