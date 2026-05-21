import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AssessmentDecisionPanel } from './AssessmentDecisionPanel'
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
  assessment_saved_at: string | null
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
    .select('id, order_number, status, total_amount, assessment_saved_at, created_at, order_items(id, card_name, item_type, grade, quantity, unit_price, assessed_unit_price, customer_decision, customer_decided_at, requested_note)')
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
  const assessmentReady =
    Boolean(row.assessment_saved_at) ||
    items.some((item) => Boolean(item.customer_decision))
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

        <AssessmentDecisionPanel
          orderId={row.id}
          status={status}
          assessmentReady={assessmentReady}
          items={items}
        />
      </section>
    </div>
  )
}
