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
  totalQuantity: number
}

type Comparison = {
  label: string
  value: string
  tone: 'positive' | 'negative' | 'neutral'
}

const RANGE_OPTIONS: { key: RangeKey; label: string; shortLabel: string; days: number }[] = [
  { key: 'today', label: '今日', shortLabel: '今日', days: 1 },
  { key: '7d', label: '過去7日', shortLabel: '7日', days: 7 },
  { key: '30d', label: '過去30日', shortLabel: '30日', days: 30 },
]

const ACTIVE_STATUSES = ORDER_STATUS_FLOW.filter(
  (status) => status !== 'completed' && status !== 'cancelled'
) as OrderStatus[]

const STATUS_ACCENTS: Record<OrderStatus, string> = {
  unhandled: 'bg-red-500',
  accepted: 'bg-amber-400',
  waiting_arrival: 'bg-orange-400',
  inspecting: 'bg-sky-400',
  pending_approval: 'bg-fuchsia-400',
  pending_transfer: 'bg-emerald-400',
  completed: 'bg-lime-400',
  cancelled: 'bg-zinc-500',
}

function resolveRange(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  return RANGE_OPTIONS.find((option) => option.key === raw) ?? RANGE_OPTIONS[0]
}

function currentPeriod(days: number) {
  const [year, month, day] = tokyoDayKey(new Date()).split('-').map(Number)
  const start = new Date()
  start.setTime(Date.UTC(year, month - 1, day - (days - 1), -9, 0, 0, 0))
  return { start, end: new Date() }
}

function tokyoDayKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day}`
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

function formatFullDate(date: Date) {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
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

function compare(current: number, previous: number): Pick<Comparison, 'value' | 'tone'> {
  if (previous === 0) {
    if (current === 0) return { value: '0%', tone: 'neutral' }
    return { value: '新規', tone: 'positive' }
  }

  const diff = ((current - previous) / previous) * 100
  const rounded = Math.round(diff)
  if (rounded === 0) return { value: '0%', tone: 'neutral' }
  return {
    value: `${rounded > 0 ? '+' : ''}${rounded}%`,
    tone: rounded > 0 ? 'positive' : 'negative',
  }
}

function comparisonRows(
  current: number,
  previousDay: number,
  previousWeek: number,
  previousMonth: number
): Comparison[] {
  return [
    { label: '前日比', ...compare(current, previousDay) },
    { label: '先週比', ...compare(current, previousWeek) },
    { label: '先月比', ...compare(current, previousMonth) },
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

  const rows = ((orders ?? []) as DashboardOrder[]).filter(
    (order) => order.status !== 'cancelled'
  )
  const totalAmount = rows.reduce((sum, order) => sum + (order.total_amount ?? 0), 0)
  const totalQuantity = quantityTotal(rows)

  return {
    orderCount: rows.length,
    totalAmount,
    averageUnitPrice: totalQuantity > 0 ? Math.round(totalAmount / totalQuantity) : 0,
    totalQuantity,
  }
}

function ComparisonPills({ comparisons }: { comparisons: Comparison[] }) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-1.5">
      {comparisons.map((comparison) => (
        <div key={comparison.label} className="rounded-md bg-black/35 px-2 py-1.5">
          <p className="text-[9px] font-black text-zinc-500">{comparison.label}</p>
          <p
            className={[
              'mt-0.5 text-xs font-black',
              comparison.tone === 'positive'
                ? 'text-emerald-400'
                : comparison.tone === 'negative'
                  ? 'text-red-400'
                  : 'text-zinc-300',
            ].join(' ')}
          >
            {comparison.value}
          </p>
        </div>
      ))}
    </div>
  )
}

function MetricCard({
  label,
  value,
  description,
  comparisons,
  accentClassName,
}: {
  label: string
  value: string
  description: string
  comparisons?: Comparison[]
  accentClassName: string
}) {
  return (
    <section className="relative min-h-[154px] overflow-hidden rounded-lg border border-zinc-800 bg-[#151515] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.34)]">
      <div className={`absolute left-0 top-0 h-1 w-full ${accentClassName}`} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">
            {label}
          </p>
          <p className="mt-2 break-words text-[28px] font-black leading-none text-white">
            {value}
          </p>
        </div>
        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${accentClassName}`} />
      </div>
      <p className="mt-2 text-[11px] font-semibold text-zinc-500">
        {description}
      </p>
      {comparisons && <ComparisonPills comparisons={comparisons} />}
    </section>
  )
}

function StatusPanel({
  statusCounts,
}: {
  statusCounts: Map<OrderStatus, number>
}) {
  const maxCount = Math.max(1, ...ACTIVE_STATUSES.map((status) => statusCounts.get(status) ?? 0))
  const activeTotal = ACTIVE_STATUSES.reduce(
    (sum, status) => sum + (statusCounts.get(status) ?? 0),
    0
  )

  return (
    <section className="rounded-lg border border-zinc-800 bg-[#151515] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.34)]">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">
            Open Orders
          </p>
          <h2 className="mt-1 text-lg font-black text-white">ステータス別件数</h2>
        </div>
        <p className="text-right text-2xl font-black text-white">
          {activeTotal.toLocaleString('ja-JP')}
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {ACTIVE_STATUSES.map((status) => {
          const count = statusCounts.get(status) ?? 0
          const width = `${Math.max(6, Math.round((count / maxCount) * 100))}%`
          return (
            <div key={status}>
              <div className="mb-1.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${STATUS_ACCENTS[status]}`} />
                  <span className="text-xs font-black text-zinc-300">
                    {ORDER_STATUS_LABELS[status]}
                  </span>
                </div>
                <span className="font-mono text-xs font-black text-white">
                  {count.toLocaleString('ja-JP')}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-black">
                <div className={`h-full rounded-full ${STATUS_ACCENTS[status]}`} style={{ width }} />
              </div>
            </div>
          )
        })}
      </div>
    </section>
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
      admin
        .from('orders')
        .select('status')
        .neq('status', 'completed')
        .neq('status', 'cancelled'),
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
    <div className="space-y-4">
      <section className="rounded-lg border border-zinc-800 bg-[#121212] px-4 py-4 shadow-[0_18px_48px_rgba(0,0,0,0.32)] md:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#c9a52e]">
              TCG Royal Admin
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-normal text-white md:text-4xl">
              ダッシュボード
            </h1>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-zinc-400">
              <span className="rounded-full border border-zinc-800 bg-black px-3 py-1">
                {formatFullDate(new Date())}
              </span>
              <span className="rounded-full border border-zinc-800 bg-black px-3 py-1">
                集計期間 {formatPeriod(period)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {RANGE_OPTIONS.map((option) => {
              const active = option.key === selectedRange.key
              return (
                <Link
                  key={option.key}
                  href={`/admin?range=${option.key}`}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'h-9 rounded-md border px-3 text-xs font-black leading-[34px] transition-colors',
                    active
                      ? 'border-[#c9a52e] bg-[#c9a52e] text-black'
                      : 'border-zinc-800 bg-black text-zinc-400 hover:border-zinc-600 hover:text-white',
                  ].join(' ')}
                >
                  {option.label}
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        <MetricCard
          label="New Orders"
          value={current.orderCount.toLocaleString('ja-JP')}
          description="指定期間内の新規申し込み数"
          accentClassName="bg-red-500"
          comparisons={comparisonRows(
            current.orderCount,
            previousDay.orderCount,
            previousWeek.orderCount,
            previousMonth.orderCount
          )}
        />
        <MetricCard
          label="Buy Amount"
          value={currency(current.totalAmount)}
          description="指定期間内の買取申込合計額"
          accentClassName="bg-[#c9a52e]"
          comparisons={comparisonRows(
            current.totalAmount,
            previousDay.totalAmount,
            previousWeek.totalAmount,
            previousMonth.totalAmount
          )}
        />
        <MetricCard
          label="Avg Unit"
          value={currency(current.averageUnitPrice)}
          description={`${current.totalQuantity.toLocaleString('ja-JP')}点の平均単価`}
          accentClassName="bg-emerald-400"
          comparisons={comparisonRows(
            current.averageUnitPrice,
            previousDay.averageUnitPrice,
            previousWeek.averageUnitPrice,
            previousMonth.averageUnitPrice
          )}
        />
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-lg border border-zinc-800 bg-[#151515] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.34)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">
                Period Overview
              </p>
              <h2 className="mt-1 text-xl font-black text-white">取引サマリー</h2>
            </div>
            <Link
              href="/admin/orders"
              className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-700 px-3 text-xs font-black text-zinc-300 transition-colors hover:border-[#c9a52e] hover:text-[#c9a52e]"
            >
              取引を見る
            </Link>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {[
              ['商品数', `${current.totalQuantity.toLocaleString('ja-JP')}点`],
              ['平均注文額', currency(current.orderCount > 0 ? Math.round(current.totalAmount / current.orderCount) : 0)],
              ['期間', selectedRange.shortLabel],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-zinc-800 bg-black px-3 py-3">
                <p className="text-xs font-black text-zinc-500">{label}</p>
                <p className="mt-1.5 text-xl font-black text-white">{value}</p>
              </div>
            ))}
          </div>

        </section>

        <StatusPanel statusCounts={statusCounts} />
      </div>
    </div>
  )
}
