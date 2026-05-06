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
  order_number: string | null
  status: OrderStatus
  total_amount: number
  created_at: string
  order_items: OrderItemRow[] | null
}

function currency(value: number) {
  return `¥${value.toLocaleString('ja-JP')}`
}

export default async function MypageOrdersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, status, total_amount, created_at, order_items(id, card_name, grade, quantity, unit_price)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const rows = (orders ?? []) as OrderRow[]
  const totalAmount = rows.reduce((sum, order) => sum + order.total_amount, 0)
  const activeCount = rows.filter((order) => order.status !== 'completed').length

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[#2d2a20] bg-[#12100c] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#c9a52e]">
              Mail-in Purchase
            </p>
            <h1 className="mt-3 text-2xl font-black text-[#f6f0dc] sm:text-3xl">
              郵送買取一覧
            </h1>
            <p className="mt-2 text-sm font-semibold text-[#8f8369]">
              カートから申し込んだ買取依頼の進行状況を確認できます。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[280px]">
            <div className="rounded-[18px] border border-[#2d2a20] bg-[#0f0e0b] px-4 py-3">
              <p className="text-xs font-bold text-[#8f8369]">進行中</p>
              <p className="mt-1 text-2xl font-black text-[#f6f0dc]">
                {activeCount}
              </p>
            </div>
            <div className="rounded-[18px] border border-[#2d2a20] bg-[#0f0e0b] px-4 py-3">
              <p className="text-xs font-bold text-[#8f8369]">累計申込額</p>
              <p className="mt-1 text-2xl font-black text-[#f6f0dc]">
                {currency(totalAmount)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {rows.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-[#3a3528] bg-[#11100c] px-5 py-12 text-center">
          <p className="text-base font-black text-[#f6f0dc]">
            郵送買取の申し込みはまだありません
          </p>
          <Link
            href="/cart"
            className="mt-5 inline-flex rounded-full bg-[#c9a52e] px-5 py-3 text-sm font-black text-[#0e0c09]"
          >
            買取申込へ
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((order) => {
            const quantity = totalQuantity(order.order_items)
            const status = order.status as OrderStatus

            return (
              <Link
                key={order.id}
                href={`/mypage/orders/${order.id}`}
                className="group block rounded-[24px] border border-[#2d2a20] bg-[#15130f] p-4 transition-all hover:-translate-y-0.5 hover:border-[#c9a52e]/60 hover:bg-[#1b1812] sm:p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-[#f6f0dc]">
                        #{order.order_number ?? order.id.slice(0, 8)}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${customerStatusClass(status)}`}
                      >
                        {customerStatusLabel(status)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[#8f8369]">
                      申込日時 {formatDateTime(order.created_at)}
                    </p>
                  </div>
                  <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-4 sm:min-w-[360px]">
                    <div>
                      <p className="text-xs font-bold text-[#8f8369]">商品数</p>
                      <p className="mt-1 text-lg font-black text-[#f6f0dc]">
                        {quantity}点
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#8f8369]">買取合計額</p>
                      <p className="mt-1 text-lg font-black text-red-300">
                        {currency(order.total_amount)}
                      </p>
                    </div>
                    <span
                      aria-hidden="true"
                      className="grid h-10 w-10 place-items-center rounded-full bg-[#211f18] text-[#c9a52e] transition-transform group-hover:translate-x-1"
                    >
                      →
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
