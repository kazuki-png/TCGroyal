import type { OrderStatus } from '@/lib/types'

export const CUSTOMER_STATUS_LABELS: Record<OrderStatus, string> = {
  unhandled: '受付',
  accepted: '受付',
  waiting_arrival: '到着待ち',
  inspecting: '査定中',
  pending_approval: '承認待ち',
  pending_transfer: '振込待ち',
  completed: '振り込み完了',
}

export function customerStatusLabel(status: OrderStatus) {
  return CUSTOMER_STATUS_LABELS[status]
}

export function customerStatusClass(status: OrderStatus) {
  return status === 'completed'
    ? 'bg-emerald-400 text-[#06160c] ring-1 ring-emerald-200/40'
    : 'bg-red-500 text-white ring-1 ring-red-200/30'
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export type OrderItemRow = {
  id: string
  card_name: string
  item_type?: 'card' | 'unlisted'
  grade: string
  quantity: number
  unit_price: number
  requested_note?: string | null
}

export function totalQuantity(items: OrderItemRow[] | null | undefined) {
  return (items ?? []).reduce((sum, item) => sum + item.quantity, 0)
}
