import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/types'

type RangeKey = 'today' | '7d' | '30d'

type DashboardOrderItem = {
  quantity: number | null
}

type DashboardOrder = {
  id: string
  status: OrderStatus
  total_amount: number | null
  created_at: string
  order_items: DashboardOrderItem[] | null
}

type Summary = {
  orderCount: number
  totalAmount: number
  averageUnitPrice: number
  pvCount: number | null
  totalQuantity: number
}

const RANGE_OPTIONS: { key: RangeKey; label: string; days: number }[] = [
  { key: 'today', label: '今日', days: 1 },
  { key: '7d', label: '過去7日', days: 7 },
  { key: '30d', label: '過去30日', days: 30 },
]

const ACTIVE_STATUSES = ORDER_STATUS_FLOW.filter(
  (status) => status !== 'completed'
) as OrderStatus[]

function resolveRange(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  return RANGE_OPTIONS.find((option) => option.key === raw) ?? RANGE_OPTIONS[0]
}

function currentPeriod(days: number) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (days - 1))
  return { start, end: new Date() }
}

function shiftedPeriod(period: { start: Date; end: Date }, days: number, months = 0) {
  const start = new Date(period.start)
  const end = new Date(period.end)
  if (months) {
    start.setMonth(start.getMonth() - months)
    end.setMonth(end.getMonth() - months)
  }
  if (days) {
    start.setDate(start.getDate() - days)
    end.setDate(end.getDate() - days)
  }
  return { start, end }
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
  }).format(date)
}

function formatPeriod(period: { start: Date; end: Date }) {
  return `${formatDate(period.start)} - ${formatDate(period.end)}`
}

function currency(value: number) {
  return `¥${value.toLocaleString('ja-JP')}`
}

function quantityTotal(orders: DashboardOrder[]) {
  return orders.reduce((sum, order) => {
    return sum + (order.order_items ?? []).reduce((itemSum, item) => {
      return itemSum + (item.quantity ?? 0)
    }, 0)
  }, 0)
}

function compareLabel(current: number, previous: number) {
  if (previous === 0) return current === 0 ? '0%' : '新規'
  const diff = ((current - previous) / previous) * 100
  const sign = diff > 0 ? '+' : ''
  return `${sign}${Math.round(diff)}%`
}

function comparisonRows(
  current: number,
  previousDay: number,
  previousWeek: number,
  previousMonth: number
) {
  return [
    { label: '前日比', value: compareLabel(current, previousDay) },
    { label: '先週比', value: compareLabel(current, previousWeek) },
    { label: '先月比', value: compareLabel(current, previousMonth) },
  ]
}

async function loadSummary(
  admin: ReturnType<typeof createAdminClient>,
  period: { start: Date; end: Date }
): Promise<Summary> {
  const { data: orders } = await admin
    .from('orders')
    .select('id, status, total_amount, created_at, order_items(quantity)')
    .gte('created_at', period.start.toISOString())
    .lt('created_at', period.end.toISOString())

  const rows = (orders ?? []) as DashboardOrder[]
  const totalAmount = rows.reduce((sum, order) => sum + (order.total_amount ?? 0), 0)
  const totalQuantity = quantityTotal(rows)

  return {
    orderCount: rows.length,
    totalAmount,
    averageUnitPrice: totalQuantity > 0 ? Math.round(totalAmount / totalQuantity) : 0,
    pvCount: null,
    totalQuantity,
  }
}

function MetricCard({
  label,
  value,
  comparisons,
  note,
}: {
  label: string
  value: string
  comparisons: { label: string; value: string }[]
  note?: string
}) {
  return (
    <div className="min-h-[184px] rounded-lg bg-[#222221] px-5 py-5 text-white">
      <p className="text-sm font-black text-zinc-400">{label}</p>
      <p className="mt-4 break-words text-3xl font-black tracking-normal">{value}</p>
      {note && <p className="mt-2 text-xs font-black text-zinc-500">{note}</p>}
      <div className="mt-4 grid gap-2 text-xs font-black">
        {comparisons.map((comparison) => (
          <p key={comparison.label} className="flex justify-between gap-3">
            <span className="text-zinc-500">{comparison.label}</span>
            <span
              className={
                comparison.value.startsWith('-')
                  ? 'text-red-400'
                  : 'text-emerald-500'
              }
            >
              {comparison.value}
            </span>
          </p>
        ))}
      </div>
    </div>
  )
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>
}) {
  const params = await searchParams
  const selectedRange = resolveRange(params.range)
  const admin = createAdminClient()
  const period = currentPeriod(selectedRange.days)
  const previousDayPeriod = shiftedPeriod(period, 1)
  const previousWeekPeriod = shiftedPeriod(period, 7)
  const previousMonthPeriod = shiftedPeriod(period, 0, 1)

  const [current, previousDay, previousWeek, previousMonth, activeOrders] =
    await Promise.all([
      loadSummary(admin, period),
      loadSummary(admin, previousDayPeriod),
      loadSummary(admin, previousWeekPeriod),
      loadSummary(admin, previousMonthPeriod),
      admin.from('orders').select('status').neq('status', 'completed'),
    ])

  const statusCounts = new Map<OrderStatus, number>(
    ACTIVE_STATUSES.map((status) => [status, 0])
  )

  ;((activeOrders.data ?? []) as { status: OrderStatus }[]).forEach((order) => {
    if (statusCounts.has(order.status)) {
      statusCounts.set(order.status, (statusCounts.get(order.status) ?? 0) + 1)
    }
  })

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="bg-zinc-950 px-5 py-6 text-white md:px-8 md:py-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-black">ダッシュボード</h1>
            <p className="mt-3 text-sm font-black text-zinc-400">
              {selectedRange.label} / {formatPeriod(period)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {RANGE_OPTIONS.map((option) => {
              const active = option.key === selectedRange.key
              return (
                <Link
                  key={option.key}
                  href={`/admin?range=${option.key}`}
                  className={[
                    'rounded-xl border px-4 py-3 text-sm font-black transition-colors',
                    active
                      ? 'border-red-500 bg-red-600 text-white'
                      : 'border-zinc-700 text-zinc-300 hover:bg-zinc-900',
                  ].join(' ')}
                >
                  {option.label}
                </Link>
              )
            })}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="新規申し込み数"
            value={current.orderCount.toLocaleString('ja-JP')}
            comparisons={comparisonRows(
              current.orderCount,
              previousDay.orderCount,
              previousWeek.orderCount,
              previousMonth.orderCount
            )}
          />
          <MetricCard
            label="買取総額"
            value={currency(current.totalAmount)}
            comparisons={comparisonRows(
              current.totalAmount,
              previousDay.totalAmount,
              previousWeek.totalAmount,
              previousMonth.totalAmount
            )}
          />
          <MetricCard
            label="平均単価"
            value={currency(current.averageUnitPrice)}
            note={`${current.totalQuantity.toLocaleString('ja-JP')}点で算出`}
            comparisons={comparisonRows(
              current.averageUnitPrice,
              previousDay.averageUnitPrice,
              previousWeek.averageUnitPrice,
              previousMonth.averageUnitPrice
            )}
          />
          <MetricCard
            label="総PV"
            value="Vercel"
            note="Web Analyticsで計測中"
            comparisons={[]}
          />
        </div>
      </section>

      <section className="bg-[#252523] px-6 py-7 text-white">
        <h2 className="mb-8 text-2xl font-black">ステータス別件数</h2>
        <dl className="space-y-6">
          {ACTIVE_STATUSES.map((status) => (
            <div key={status} className="flex items-center justify-between gap-4">
              <dt className="text-lg font-black text-zinc-300">
                {ORDER_STATUS_LABELS[status]}
              </dt>
              <dd className="text-2xl font-black">
                {(statusCounts.get(status) ?? 0).toLocaleString('ja-JP')}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
