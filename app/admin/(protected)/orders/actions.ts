'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  logEmailDebug,
  sendAdminOrderNotification,
  sendStatusEmail,
} from '@/lib/email/send'
import { loadOrderForNotification } from '@/lib/orders/notification'
import {
  EMAIL_TRIGGER_STATUSES,
  ORDER_STATUS_FLOW,
  canEditOrderAssessment,
  isBackwardOrderStatusTransition,
  isForwardOrderStatusTransition,
} from '@/lib/types'
import type { OrderStatus } from '@/lib/types'

type AssessmentUpdate = {
  itemId: string
  assessedUnitPrice: number
}

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/admin/login')

  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', user.id)
    .single()

  if (!adminRow) redirect('/admin/login')

  return user
}

function normalizePrice(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(99_999_999, Math.floor(value)))
}

async function notifyStatusChange(
  admin: ReturnType<typeof createAdminClient>,
  orderId: string,
  status: OrderStatus
) {
  const shouldSendUserEmail = EMAIL_TRIGGER_STATUSES.includes(status)
  const shouldSendAdminEmail = status === 'pending_transfer'

  logEmailDebug('adminOrders-notifyStatusChange-evaluation', {
    orderId,
    status,
    shouldSendUserEmail,
    shouldSendAdminEmail,
  })

  if (!shouldSendUserEmail && !shouldSendAdminEmail) {
    logEmailDebug('adminOrders-notifyStatusChange-skipped', {
      orderId,
      status,
      reason: 'status has no email trigger',
    })
    return
  }

  const notificationOrder = await loadOrderForNotification(
    admin,
    orderId,
    'adminOrders-notifyStatusChange'
  )
  if (!notificationOrder) {
    logEmailDebug('adminOrders-notification-order-missing', {
      orderId,
      status,
      reason: 'order reload returned no rows',
    })
    return
  }

  logEmailDebug('adminOrders-notification-order-loaded', {
    orderId: notificationOrder.id,
    orderNumber: notificationOrder.order_number,
    userId: notificationOrder.user_id,
    status,
    itemCount: notificationOrder.order_items?.length ?? 0,
  })

  if (shouldSendUserEmail) {
    const { data: authUser } = await admin.auth.admin.getUserById(
      notificationOrder.user_id
    )

    if (authUser.user?.email) {
      logEmailDebug('adminOrders-user-email-trigger', {
        orderId: notificationOrder.id,
        orderNumber: notificationOrder.order_number,
        userId: notificationOrder.user_id,
        status,
        toEmail: authUser.user.email,
      })

      await sendStatusEmail(
        authUser.user.email,
        notificationOrder,
        status
      ).catch(console.error)
    } else {
      logEmailDebug('adminOrders-user-email-skipped', {
        orderId: notificationOrder.id,
        orderNumber: notificationOrder.order_number,
        userId: notificationOrder.user_id,
        status,
        reason: 'auth user email is empty',
      })
    }
  }

  if (shouldSendAdminEmail) {
    logEmailDebug('adminOrders-admin-email-trigger', {
      orderId: notificationOrder.id,
      orderNumber: notificationOrder.order_number,
      userId: notificationOrder.user_id,
      kind: 'assessment_approved',
    })

    await sendAdminOrderNotification(
      'assessment_approved',
      notificationOrder
    ).catch(console.error)
  }
}

export async function saveOrderAssessment(
  orderId: string,
  updates: AssessmentUpdate[]
) {
  const user = await requireAdmin()

  if (!Array.isArray(updates) || updates.length === 0) {
    return { error: '査定額を入力してください' }
  }

  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('id, user_id, status, assessment_saved_at, order_items(id, quantity, unit_price)')
    .eq('id', orderId)
    .single()

  if (!order) return { error: '注文が見つかりません' }

  const currentStatus = order.status as OrderStatus
  if (!canEditOrderAssessment(currentStatus, order.assessment_saved_at)) {
    return { error: '査定額を変更できるのは査定中の注文のみです' }
  }

  const items = (order.order_items ?? []) as {
    id: string
    quantity: number
    unit_price: number
  }[]
  const itemMap = new Map(items.map((item) => [item.id, item]))
  const normalizedUpdates = updates.map((update) => ({
    itemId: update.itemId,
    assessedUnitPrice: normalizePrice(update.assessedUnitPrice),
  }))
  const updateIds = new Set(normalizedUpdates.map((update) => update.itemId))

  if (
    normalizedUpdates.length !== itemMap.size ||
    updateIds.size !== itemMap.size
  ) {
    return { error: 'すべての商品に査定額を入力してください' }
  }

  if (normalizedUpdates.some((update) => !itemMap.has(update.itemId))) {
    return { error: '注文に含まれない商品が指定されています' }
  }

  for (const update of normalizedUpdates) {
    const { error } = await admin
      .from('order_items')
      .update({
        assessed_unit_price: update.assessedUnitPrice,
        customer_decision: null,
        customer_decided_at: null,
      })
      .eq('order_id', orderId)
      .eq('id', update.itemId)

    if (error) {
      console.error('saveOrderAssessment item update failed', error)
      return { error: '査定額の保存に失敗しました' }
    }
  }

  const assessedTotal = normalizedUpdates.reduce((sum, update) => {
    const item = itemMap.get(update.itemId)!
    return sum + item.quantity * update.assessedUnitPrice
  }, 0)
  const nextStatus: OrderStatus = 'pending_approval'

  const { error: orderError } = await admin
    .from('orders')
    .update({
      status: nextStatus,
      total_amount: assessedTotal,
      assessment_saved_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  if (orderError) {
    console.error('saveOrderAssessment order update failed', orderError)
    return { error: '注文ステータスの更新に失敗しました' }
  }

  await admin.from('order_status_logs').insert({
    order_id: orderId,
    old_status: currentStatus,
    new_status: nextStatus,
    changed_by: user.id,
    note: '査定額を保存',
  })

  await notifyStatusChange(admin, orderId, nextStatus)

  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath('/mypage/orders')
  revalidatePath(`/mypage/orders/${orderId}`)

  return {}
}

export async function setOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  reason?: string
) {
  const user = await requireAdmin()

  if (!ORDER_STATUS_FLOW.includes(newStatus)) {
    return { error: '不正なステータスです' }
  }

  const admin = createAdminClient()
  const { data: currentOrder } = await admin
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .single()

  if (!currentOrder) return { error: '注文が見つかりません' }
  const currentStatus = currentOrder.status as OrderStatus
  const rollbackReason = reason?.trim()

  if (currentStatus === newStatus) return {}

  if (newStatus === 'pending_approval') {
    return { error: 'お客様対応待ちへ進めるには査定額を保存してください' }
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

  const { error } = await admin
    .from('orders')
    .update({ status: newStatus })
    .eq('id', orderId)

  if (error) return { error: 'ステータスの更新に失敗しました' }

  await admin.from('order_status_logs').insert({
    order_id: orderId,
    old_status: currentStatus,
    new_status: newStatus,
    changed_by: user.id,
    note: rollbackReason || null,
  })

  await notifyStatusChange(admin, orderId, newStatus)

  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath('/mypage/orders')

  return {}
}
