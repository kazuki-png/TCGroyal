import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/app/components/StatusBadge'
import type { OrderStatus } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: orders } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">買取申込一覧</h1>
        <Link
          href="/orders/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          新規申込
        </Link>
      </div>

      {!orders || orders.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center">
          <p className="text-zinc-500">まだ買取申込がありません</p>
          <Link
            href="/orders/new"
            className="mt-4 inline-block rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-700"
          >
            最初の申込をする
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="block rounded-2xl border border-zinc-200 bg-white p-6 hover:border-zinc-400 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-zinc-400 mb-1">
                    申込番号: {order.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="font-semibold text-zinc-900">
                    ¥{order.total_amount.toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {order.order_items?.length ?? 0}点
                  </p>
                </div>
                <div className="text-right">
                  <StatusBadge status={order.status as OrderStatus} />
                  <p className="mt-2 text-xs text-zinc-400">
                    {new Date(order.created_at).toLocaleDateString('ja-JP')}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
