'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendStatusEmail } from '@/lib/email/send'
import {
  EMAIL_TRIGGER_STATUSES,
  ORDER_STATUS_FLOW,
  isBackwardOrderStatusTransition,
  isForwardOrderStatusTransition,
} from '@/lib/types'
import type { CartItem, OrderStatus, OrderWithItems } from '@/lib/types'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const UNLISTED_CARD_ID = 'unlisted-card-request'
const UNLISTED_NOTE = 'リストにない商品の査定依頼'

type AuthoritativeCard = {
  id: string
  name: string
  grade: string
  buy_price: number
}

type PreparedOrderItem = {
  card_id: string | null
  item_type: 'card' | 'unlisted'
  card_name: string
  grade: string
  quantity: number
  unit_price: number
  requested_note: string | null
}

function normalizeQuantity(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(999, Math.max(1, Math.floor(value)))
}

export async function createOrder(
  items: CartItem[],
  bankInfo: {
    bank_name: string
    bank_branch: string
    bank_account_no: string
    bank_holder: string
  }
): Promise<{ error?: string; redirectTo?: string }> {
  if (items.length === 0) {
    return { error: 'カードを選択してください' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const requestedCardQuantities = new Map<string, number>()
  let hasUnlistedItem = false

  for (const item of items) {
    const cardId = item.card?.id
    const quantity = normalizeQuantity(item.quantity)

    if (!cardId || quantity <= 0) {
      return { error: 'カートの内容が正しくありません' }
    }

    if (cardId.startsWith('sample-')) {
      return { error: 'サンプルカードは申し込みできません。カード一覧を更新してください' }
    }

    if (cardId === UNLISTED_CARD_ID) {
      hasUnlistedItem = true
      continue
    }

    if (!UUID_PATTERN.test(cardId)) {
      return { error: 'カートに不正なカードが含まれています' }
    }

    requestedCardQuantities.set(
      cardId,
      (requestedCardQuantities.get(cardId) ?? 0) + quantity
    )
  }

  const adminClient = createAdminClient()
  const cardIds = [...requestedCardQuantities.keys()]
  const { data: cards, error: cardsError } = cardIds.length
    ? await adminClient
        .from('cards')
        .select('id, name, grade, buy_price')
        .in('id', cardIds)
    : { data: [], error: null }

  if (cardsError) {
    return { error: 'カード情報の確認に失敗しました。もう一度お試しください' }
  }

  const cardMap = new Map(
    ((cards ?? []) as AuthoritativeCard[]).map((card) => [card.id, card])
  )

  if (cardMap.size !== cardIds.length) {
    return { error: 'カートに現在取り扱いのないカードが含まれています' }
  }

  const orderItems: PreparedOrderItem[] = cardIds.map((cardId) => {
    const card = cardMap.get(cardId)!
    const quantity = requestedCardQuantities.get(cardId) ?? 1
    return {
      card_id: card.id,
      item_type: 'card',
      card_name: card.name,
      grade: card.grade,
      quantity,
      unit_price: card.buy_price,
      requested_note: null,
    }
  })

  if (hasUnlistedItem) {
    orderItems.push({
      card_id: null,
      item_type: 'unlisted',
      card_name: 'リストにない商品',
      grade: '未確定',
      quantity: 1,
      unit_price: 0,
      requested_note: UNLISTED_NOTE,
    })
  }

  const totalAmount = orderItems.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  )

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: user.id,
      status: 'unhandled',
      total_amount: totalAmount,
      ...bankInfo,
    })
    .select()
    .single()

  if (orderError || !order) {
    return { error: '注文の作成に失敗しました' }
  }

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems.map((item) => ({ ...item, order_id: order.id })))

  if (itemsError) {
    return { error: '注文明細の作成に失敗しました' }
  }

  revalidatePath('/mypage/orders')
  return { redirectTo: '/mypage/orders' }
}

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  reason?: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: '認証が必要です' }
  }

  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', user.id)
    .single()

  if (!adminRow) {
    return { error: '管理者権限が必要です' }
  }

  if (!ORDER_STATUS_FLOW.includes(newStatus)) {
    return { error: '不正なステータスです' }
  }

  const adminClient = createAdminClient()

  const { data: currentOrder } = await adminClient
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .single()

  if (!currentOrder) {
    return { error: '注文が見つかりません' }
  }

  const currentStatus = currentOrder.status as OrderStatus
  const rollbackReason = reason?.trim()

  if (currentStatus === newStatus) {
    return {}
  }

  if (
    isBackwardOrderStatusTransition(currentStatus, newStatus) &&
    !rollbackReason
  ) {
    return { error: 'ステータスを戻す場合は理由を入力してください' }
  }

  if (
    !isForwardOrderStatusTransition(currentStatus, newStatus) &&
    !isBackwardOrderStatusTransition(currentStatus, newStatus)
  ) {
    return { error: '無効なステータス変更です' }
  }

  const { error: updateError } = await adminClient
    .from('orders')
    .update({ status: newStatus })
    .eq('id', orderId)

  if (updateError) {
    return { error: 'ステータスの更新に失敗しました' }
  }

  await adminClient.from('order_status_logs').insert({
    order_id: orderId,
    old_status: currentStatus,
    new_status: newStatus,
    changed_by: user.id,
    note: rollbackReason || null,
  })

  if (EMAIL_TRIGGER_STATUSES.includes(newStatus)) {
    const { data: orderWithItems } = await adminClient
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .single()

    if (orderWithItems) {
      const { data: authUser } = await adminClient.auth.admin.getUserById(
        orderWithItems.user_id
      )

      if (authUser.user?.email) {
        await sendStatusEmail(
          authUser.user.email,
          orderWithItems as unknown as OrderWithItems,
          newStatus
        ).catch(console.error)
      }
    }
  }

  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath('/admin/orders')

  return {}
}
