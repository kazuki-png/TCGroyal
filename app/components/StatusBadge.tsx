import { ORDER_STATUS_LABELS } from '@/lib/types'
import type { OrderStatus } from '@/lib/types'

const COLOR_MAP: Record<OrderStatus, string> = {
  unhandled: 'bg-zinc-100 text-zinc-700',
  accepted: 'bg-blue-100 text-blue-700',
  waiting_arrival: 'bg-amber-100 text-amber-700',
  inspecting: 'bg-purple-100 text-purple-700',
  pending_approval: 'bg-orange-100 text-orange-700',
  pending_transfer: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-zinc-200 text-zinc-700',
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${COLOR_MAP[status]}`}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  )
}
