export type OrderStatus =
  | 'unhandled'
  | 'accepted'
  | 'waiting_arrival'
  | 'inspecting'
  | 'pending_approval'
  | 'pending_transfer'
  | 'completed'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  unhandled: '未対応',
  accepted: '受付済み',
  waiting_arrival: '到着待ち',
  inspecting: '査定中',
  pending_approval: 'お客様対応待ち',
  pending_transfer: '振込待ち',
  completed: '完了',
}

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'unhandled',
  'accepted',
  'waiting_arrival',
  'inspecting',
  'pending_approval',
  'pending_transfer',
  'completed',
]

export const EMAIL_TRIGGER_STATUSES: OrderStatus[] = [
  'accepted',
  'pending_approval',
  'completed',
]

export function orderStatusIndex(status: OrderStatus) {
  return ORDER_STATUS_FLOW.indexOf(status)
}

export function isForwardOrderStatusTransition(
  currentStatus: OrderStatus,
  newStatus: OrderStatus
) {
  return orderStatusIndex(newStatus) > orderStatusIndex(currentStatus)
}

export function isBackwardOrderStatusTransition(
  currentStatus: OrderStatus,
  newStatus: OrderStatus
) {
  return orderStatusIndex(newStatus) < orderStatusIndex(currentStatus)
}

export function nextOrderStatuses(currentStatus: OrderStatus) {
  const currentIndex = orderStatusIndex(currentStatus)
  return currentIndex >= 0 ? ORDER_STATUS_FLOW.slice(currentIndex + 1) : []
}

export function previousOrderStatuses(currentStatus: OrderStatus) {
  const currentIndex = orderStatusIndex(currentStatus)
  return currentIndex > 0 ? ORDER_STATUS_FLOW.slice(0, currentIndex) : []
}

export interface Card {
  id: string
  card_number: string | null
  name: string
  category: 'pokemon' | 'onepiece'
  grade: 'PSA10' | 'PSA9' | 'PSA8'
  buy_price: number
  image_url: string | null
  buy_price_updated_at: string | null
  created_at: string
  updated_at: string
}

export interface HomepageBanner {
  id: string
  title: string
  image_url: string
  storage_path: string | null
  link_url: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  email: string | null
  last_name: string
  first_name: string
  last_name_kana: string
  first_name_kana: string
  birthday: string | null
  gender: 'male' | 'female' | 'other' | null
  occupation: string | null
  postal_code: string | null
  address: string | null
  phone: string | null
  is_qualified_invoice: boolean
  id_type: string | null
  id_image_url: string | null
  identity_verified: boolean
  bank_name: string | null
  branch_name: string | null
  account_type: 'ordinary' | 'current' | null
  account_number: string | null
  account_holder_kana: string | null
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  order_number: string
  user_id: string
  status: OrderStatus
  total_amount: number
  bank_name: string | null
  bank_branch: string | null
  bank_account_no: string | null
  bank_holder: string | null
  note: string | null
  assessment_saved_at: string | null
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  card_id: string | null
  item_type: 'card' | 'unlisted'
  card_name: string
  grade: string
  quantity: number
  unit_price: number
  assessed_unit_price: number
  customer_decision: 'approved' | 'cancelled' | null
  customer_decided_at: string | null
  requested_note: string | null
  created_at: string
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[]
  profiles?: Pick<Profile, 'last_name' | 'first_name'> & { email?: string }
}

export interface CartItem {
  card: Card
  quantity: number
}

export interface IdentityDocument {
  id: string
  user_id: string
  storage_path: string
  document_type: string | null
  status: 'pending' | 'verified' | 'rejected'
  uploaded_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  deleted_at: string | null
}

export interface IdentityDocumentAccessLog {
  id: string
  document_id: string
  accessed_by: string
  accessed_at: string
  action: 'view' | 'delete' | 'verify' | 'reject'
  reason: string | null
}
