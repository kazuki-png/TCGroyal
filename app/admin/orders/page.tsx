import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { StatusBadge } from '@/app/components/StatusBadge'
import { ORDER_STATUS_LABELS } from '@/lib/types'
import type { OrderStatus } from '@/lib/types'

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const adminClient = createAdminClient()

  let query = adminClient
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data: orders } = await query

  const counts: Partial<Record<OrderStatus | 'all', number>> = { all: orders?.length ?? 0 }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-white">注文管理</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/admin/orders"
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            !status
              ? 'bg-white text-zinc-900'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }`}
        >
          全て
        </Link>
        {(Object.entries(ORDER_STATUS_LABELS) as [OrderStatus, string][]).map(
          ([s, label]) => (
            <Link
              key={s}
              href={`/admin/orders?status=${s}`}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                status === s
                  ? 'bg-white text-zinc-900'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {label}
            </Link>
          )
        )}
      </div>

      {!orders || orders.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 p-12 text-center text-zinc-500">
          注文がありません
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-800">
          <table className="w-full">
            <thead className="bg-zinc-900">
              <tr className="text-left text-sm text-zinc-400">
                <th className="px-4 py-3 font-medium">申込番号</th>
                <th className="px-4 py-3 font-medium">ステータス</th>
                <th className="px-4 py-3 font-medium">点数</th>
                <th className="px-4 py-3 text-right font-medium">金額</th>
                <th className="px-4 py-3 font-medium">申込日</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className="border-t border-zinc-800 hover:bg-zinc-900 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="text-sm font-mono text-zinc-300 hover:text-white"
                    >
                      {order.id.slice(0, 8).toUpperCase()}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.status as OrderStatus} />
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {order.order_items?.length ?? 0}点
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-white">
                    ¥{order.total_amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {new Date(order.created_at).toLocaleDateString('ja-JP')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
