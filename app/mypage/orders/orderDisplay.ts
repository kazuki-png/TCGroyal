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
    ? 'bg-[#a7e8ad] text-zinc-950'
    : 'bg-[#ffb3b8] text-zinc-950'
}

export function formatDateTime(value: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(value))

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${map.month}/${map.day}/${map.year} ${map.hour}:${map.minute}`
}

export type OrderItemRow = {
  id: string
  card_name: string
  grade: string
  quantity: number
  unit_price: number
}

export function totalQuantity(items: OrderItemRow[] | null | undefined) {
  return (items ?? []).reduce((sum, item) => sum + item.quantity, 0)
}
