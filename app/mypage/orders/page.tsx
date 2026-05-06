import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  customerStatusClass,
  customerStatusLabel,
  formatDateTime,
  totalQuantity,
  type OrderItemRow,
} from './orderDisplay'
import type { OrderStatus } from '@/lib/types'

type OrderRow = {
  id: string
  status: OrderStatus
  total_amount: number
  created_at: string
  order_items: OrderItemRow[] | null
}

export default async function MypageOrdersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: orders } = await supabase
    .from('orders')
    .select('id, status, total_amount, created_at, order_items(id, card_name, grade, quantity, unit_price)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const rows = (orders ?? []) as OrderRow[]

  return (
    <div className="mx-auto w-full max-w-md bg-white px-3 pb-10 pt-2 text-zinc-950 md:max-w-4xl md:px-6">
      <h1 className="mb-7 text-center text-xl font-black text-zinc-950">郵送買取一覧</h1>

      {rows.length === 0 ? (
        <div className="bg-[#b9b7b7] px-4 py-8 text-center text-sm font-black">
          郵送買取申込はまだありません
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((order) => {
            const quantity = totalQuantity(order.order_items)
            const status = order.status as OrderStatus

            return (
              <Link
                key={order.id}
                href={`/mypage/orders/${order.id}`}
                className="block bg-[#b9b7b7] px-3 py-3 transition-opacity hover:opacity-85"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-black">
                    {formatDateTime(order.created_at)}
                  </p>
                  <span
                    className={`shrink-0 px-3 py-0.5 text-xs font-black ${customerStatusClass(status)}`}
                  >
                    {customerStatusLabel(status)}
                  </span>
                </div>
                <div className="mt-6 flex items-center justify-between gap-3 text-sm font-black">
                  <p>
                    {quantity}点　買取申込合計額 ¥
                    {order.total_amount.toLocaleString()}
                  </p>
                  <span aria-hidden="true" className="text-lg leading-none">
                    &gt;
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
