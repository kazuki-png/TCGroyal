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
  order_number: string
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
    .select('id, order_number, status, total_amount, created_at, order_items(id, card_name, grade, quantity, unit_price)')
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
    <div className="mx-auto w-full max-w-md bg-white px-5 pb-10 pt-2 text-zinc-950 md:max-w-4xl">
      <h1 className="mb-5 text-center text-xl font-black">申込詳細</h1>

      <section className="space-y-3 text-base font-black">
        <div className="grid grid-cols-[110px_1fr] items-center gap-2">
          <span>ステータス</span>
          <span
            className={`px-4 py-2 text-center text-sm font-black ${customerStatusClass(status)}`}
          >
            {customerStatusLabel(status)}
          </span>
        </div>
        <p>注文番号：#{row.order_number}</p>
        <p>合計数量：{totalQuantity(items)}</p>
        <p className="text-sm">合計金額：¥{row.total_amount.toLocaleString()}</p>
        <p className="text-sm">受付日時：{formatDateTime(row.created_at)}</p>
      </section>

      <section className="mt-4 bg-[#b9b7b7] px-3 py-3">
        <h2 className="mb-3 text-sm font-black">ステータス履歴</h2>
        <div className="space-y-3 text-sm font-black">
          {history.map((event) => (
            <div
              key={event.id}
              className="grid grid-cols-[1fr_auto] items-center gap-4"
            >
              <span>{formatDateTime(event.created_at)}</span>
              <span>{event.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 bg-[#b9b7b7] px-2 py-3">
        <h2 className="sr-only">申し込んだカードの内訳</h2>
        <table className="w-full text-[10px] font-black">
          <thead>
            <tr className="text-left">
              <th className="pb-3">カード名</th>
              <th className="pb-3 text-center">数量</th>
              <th className="pb-3 text-right">買取申込額</th>
              <th className="pb-3 text-right">小計</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className="py-2 pr-2">{item.card_name}</td>
                <td className="py-2 text-center">{item.quantity}</td>
                <td className="py-2 text-right">
                  {item.unit_price.toLocaleString()}
                </td>
                <td className="py-2 text-right">
                  {(item.unit_price * item.quantity).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="pt-6 text-right">
                合計
              </td>
              <td className="pt-6 text-right">
                {row.total_amount.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>
    </div>
  )
}
