import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  customerStatusClass,
  customerStatusLabel,
  formatDateTime,
  totalQuantity,
  type OrderItemRow,
} from '../orderDisplay'
import type { OrderStatus } from '@/lib/types'

type OrderRow = {
  id: string
  order_number: string | null
  status: OrderStatus
  total_amount: number
  created_at: string
  order_items: OrderItemRow[] | null
}

type StatusLogRow = {
  id: string
  new_status: OrderStatus
  created_at: string
}

function currency(value: number) {
  return `¥${value.toLocaleString('ja-JP')}`
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, status, total_amount, created_at, order_items(id, card_name, item_type, grade, quantity, unit_price, requested_note)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!order) notFound()

  const { data: logs } = await supabase
    .from('order_status_logs')
    .select('id, new_status, created_at')
    .eq('order_id', id)
    .order('created_at', { ascending: true })

  const row = order as OrderRow
  const items = row.order_items ?? []
  const status = row.status as OrderStatus
  const history = [
    {
      id: 'initial',
      label: '受付',
      created_at: row.created_at,
    },
    ...((logs ?? []) as StatusLogRow[]).map((log) => ({
      id: log.id,
      label: customerStatusLabel(log.new_status as OrderStatus),
      created_at: log.created_at,
    })),
  ]

  return (
    <div className="space-y-6">
      <Link
        href="/mypage/orders"
        className="inline-flex items-center gap-2 text-sm font-black text-[#8f8369] transition-colors hover:text-[#d7b865]"
      >
        ← 郵送買取一覧へ戻る
      </Link>

      <section className="rounded-[28px] border border-[#2d2a20] bg-[#12100c] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#c9a52e]">
              Order Detail
            </p>
            <h1 className="mt-3 text-2xl font-black text-[#f6f0dc] sm:text-3xl">
              申込詳細
            </h1>
            <p className="mt-2 text-sm font-semibold text-[#8f8369]">
              注文番号 #{row.order_number ?? row.id.slice(0, 8)}
            </p>
          </div>
          <span
            className={`w-fit rounded-full px-4 py-2 text-sm font-black ${customerStatusClass(status)}`}
          >
            {customerStatusLabel(status)}
          </span>
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['合計数量', `${totalQuantity(items)}点`],
            ['合計金額', currency(row.total_amount)],
            ['受付日時', formatDateTime(row.created_at)],
            ['ステータス', customerStatusLabel(status)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-[18px] border border-[#2d2a20] bg-[#0f0e0b] px-4 py-3"
            >
              <dt className="text-xs font-bold text-[#8f8369]">{label}</dt>
              <dd className="mt-1 break-words text-lg font-black text-[#f6f0dc]">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="rounded-[24px] border border-[#2d2a20] bg-[#15130f] p-5">
          <h2 className="text-lg font-black text-[#f6f0dc]">ステータス履歴</h2>
          <div className="mt-5 space-y-4">
            {history.map((event, index) => (
              <div key={event.id} className="relative pl-6">
                <span className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-[#c9a52e]" />
                {index !== history.length - 1 && (
                  <span className="absolute bottom-[-18px] left-[5px] top-5 w-px bg-[#2d2a20]" />
                )}
                <p className="text-sm font-black text-[#f6f0dc]">
                  {event.label}
                </p>
                <p className="mt-1 text-xs font-semibold text-[#8f8369]">
                  {formatDateTime(event.created_at)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-[#2d2a20] bg-[#15130f]">
          <div className="border-b border-[#2d2a20] px-5 py-4">
            <h2 className="text-lg font-black text-[#f6f0dc]">
              申し込んだカードの内訳
            </h2>
          </div>
          <div className="overflow-hidden">
            <table className="w-full table-fixed text-[10px] text-[#ede8d5] sm:text-sm">
              <colgroup>
                <col className="w-[32%]" />
                <col className="w-[16%]" />
                <col className="w-[12%]" />
                <col className="w-[20%]" />
                <col className="w-[20%]" />
              </colgroup>
              <thead className="bg-[#0f0e0b] text-left text-[10px] font-black uppercase tracking-[0.08em] text-[#c9a52e] sm:text-xs sm:tracking-[0.14em]">
                <tr>
                  <th className="px-2 py-3 sm:px-5">カード名</th>
                  <th className="px-1 py-3 sm:px-5">グレード</th>
                  <th className="px-1 py-3 text-right sm:px-5">数量</th>
                  <th className="px-1 py-3 text-right sm:px-5">
                    <span className="inline-block leading-tight">
                      買取<br className="sm:hidden" />申込額
                    </span>
                  </th>
                  <th className="px-2 py-3 text-right sm:px-5">小計</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2d2a20]">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="break-words px-2 py-4 font-black leading-tight text-[#f6f0dc] sm:px-5">
                      {item.card_name}
                      {item.item_type === 'unlisted' && item.requested_note && (
                        <span className="mt-1 block text-xs font-semibold text-[#8f8369]">
                          {item.requested_note}
                        </span>
                      )}
                    </td>
                    <td className="break-words px-1 py-4 font-semibold text-[#8f8369] sm:px-5">
                      {item.grade}
                    </td>
                    <td className="px-1 py-4 text-right font-black text-[#f6f0dc] sm:px-5">
                      {item.quantity}
                    </td>
                    <td className="whitespace-nowrap px-1 py-4 text-right font-semibold text-[#ede8d5] sm:px-5">
                      {currency(item.unit_price)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-4 text-right font-black text-red-300 sm:px-5">
                      {currency(item.unit_price * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-[#c9a52e]/40 bg-[#0f0e0b]">
                <tr>
                  <td colSpan={4} className="px-2 py-4 text-right font-black text-[#f6f0dc] sm:px-5">
                    合計
                  </td>
                  <td className="whitespace-nowrap px-2 py-4 text-right text-sm font-black text-red-300 sm:px-5 sm:text-lg">
                    {currency(row.total_amount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
