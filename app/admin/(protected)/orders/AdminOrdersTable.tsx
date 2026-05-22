'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setOrderStatus } from './actions'
import {
  AssessmentEditor,
  type AssessmentEditorItem,
} from './AssessmentEditor'
import {
  ORDER_STATUS_LABELS,
  nextOrderStatuses,
  type OrderStatus,
} from '@/lib/types'

export type AdminOrderRow = {
  id: string
  orderNumber: string
  status: OrderStatus
  assessmentSavedAt: string | null
  totalAmount: number
  itemCount: number
  createdAt: string
  updatedAt: string
  userName: string
  userEmail: string
  bankName: string
  bankBranch: string
  bankAccountNo: string
  bankHolder: string
  items: AssessmentEditorItem[]
}

function currency(value: number) {
  return `¥${value.toLocaleString('ja-JP')}`
}

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.max(0, Math.floor(diff / 60000))
  if (minutes < 1) return 'たった今'
  if (minutes < 60) return `${minutes}分前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}時間前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}日前`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}か月前`
  return `${Math.floor(months / 12)}年前`
}

function StatusSelect({ order }: { order: AdminOrderRow }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const nextStatus = orderActionStatuses(order.status)[0]
  const availableStatuses = nextStatus
    ? [order.status, nextStatus]
    : [order.status]

  return (
    <select
      value={order.status}
      disabled={pending}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      onChange={(event) => {
        const next = event.target.value as OrderStatus
        startTransition(async () => {
          const result = await setOrderStatus(order.id, next)
          if (!result?.error) {
            router.refresh()
          }
        })
      }}
      className="h-9 rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-xs font-black text-white outline-none disabled:opacity-50"
    >
      {availableStatuses.map((nextStatus) => (
        <option key={nextStatus} value={nextStatus}>
          {ORDER_STATUS_LABELS[nextStatus]}
        </option>
      ))}
    </select>
  )
}

function orderActionStatuses(status: OrderStatus) {
  if (
    status === 'inspecting' ||
    status === 'pending_approval' ||
    status === 'completed'
  ) {
    return []
  }

  const nextStatus = nextOrderStatuses(status)[0]
  return nextStatus ? [nextStatus] : []
}

export function AdminOrdersTable({ rows }: { rows: AdminOrderRow[] }) {
  const [selectedId, setSelectedId] = useState(rows[0]?.id ?? '')
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0]

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-12 text-center text-zinc-500">
        注文がありません
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 text-white">
        <table className="w-full min-w-[900px]">
          <thead className="bg-zinc-900">
            <tr className="text-left text-sm text-zinc-400">
              <th className="px-4 py-3 font-black">注文番号</th>
              <th className="px-4 py-3 font-black">ステータス</th>
              <th className="px-4 py-3 font-black">ユーザー</th>
              <th className="px-4 py-3 font-black">商品数</th>
              <th className="px-4 py-3 text-right font-black">金額</th>
              <th className="px-4 py-3 font-black">申込日</th>
              <th className="px-4 py-3 font-black">最終更新</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((order) => {
              const selectedRow = order.id === selectedId
              return (
                <tr
                  key={order.id}
                  tabIndex={0}
                  role="button"
                  aria-pressed={selectedRow}
                  onClick={() => setSelectedId(order.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedId(order.id)
                    }
                  }}
                  className={[
                    'cursor-pointer border-t border-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-500',
                    selectedRow ? 'bg-[#181818]' : 'hover:bg-zinc-900',
                  ].join(' ')}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-black text-white">
                      {order.orderNumber}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusSelect order={order} />
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-zinc-300">
                    {order.userName}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {order.itemCount}点
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-black text-white">
                    {currency(order.totalAmount)}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {new Date(order.createdAt).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {relativeTime(order.updatedAt)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-white">
            <h2 className="text-lg font-black">取引詳細</h2>
            <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
              <div>
                <dt className="text-zinc-500">注文番号</dt>
                <dd className="mt-1 font-black">{selected.orderNumber}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">ユーザー名</dt>
                <dd className="mt-1 font-black">{selected.userName}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">メールアドレス</dt>
                <dd className="mt-1 break-all font-black">{selected.userEmail}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">振込先</dt>
                <dd className="mt-1 font-black">
                  {[selected.bankName, selected.bankBranch, selected.bankAccountNo, selected.bankHolder]
                    .filter(Boolean)
                    .join(' / ') || '-'}
                </dd>
              </div>
            </dl>
          </section>

          <AssessmentEditor
            key={`${selected.id}-${selected.status}`}
            orderId={selected.id}
            status={selected.status}
            assessmentSavedAt={selected.assessmentSavedAt}
            items={selected.items}
            nextStatuses={orderActionStatuses(selected.status)}
          />
        </div>
      )}
    </div>
  )
}
