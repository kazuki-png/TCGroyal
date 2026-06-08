'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  logEmailDebug,
  sendAdminOrderNotification,
  sendStatusEmail,
} from '@/lib/email/send'
import { loadOrderForNotification } from '@/lib/orders/notification'
import type { OrderStatus } from '@/lib/types'

type CustomerDecision = 'approved' | 'cancelled'

type DecisionUpdate = {
  itemId: string
  decision: CustomerDecision
}

function isCustomerDecision(value: unknown): value is CustomerDecision {
  return value === 'approved' || value === 'cancelled'
}

export async function submitAssessmentDecision(
  orderId: string,
  decisions: DecisionUpdate[]
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'ログインが必要です' }
  }

  if (!Array.isArray(decisions)) {
    return { error: '承認またはキャンセルを選択してください' }
  }

  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('id, user_id, status, assessment_saved_at, coupon_amount, order_items(id, quantity, unit_price, assessed_unit_price)')
    .eq('id', orderId)
    .single()

  if (!order || order.user_id !== user.id) {
    return { error: '注文が見つかりません' }
  }

  const currentStatus = order.status as OrderStatus
  if (currentStatus !== 'pending_approval') {
    return { error: '現在この注文は査定結果を確定できません' }
  }

  if (!order.assessment_saved_at) {
    return { error: '当社査定額の保存をお待ちください' }
  }

  const items = (order.order_items ?? []) as {
    id: string
    quantity: number
    unit_price: number
    assessed_unit_price: number | null
  }[]
  const decisionMap = new Map(decisions.map((item) => [item.itemId, item.decision]))

  if (items.length > 0 && decisionMap.size !== items.length) {
    return { error: 'すべての商品について承認またはキャンセルを選択してください' }
  }

  if (items.some((item) => !isCustomerDecision(decisionMap.get(item.id)))) {
    return { error: 'すべての商品について承認またはキャンセルを選択してください' }
  }

  const now = new Date().toISOString()

  for (const item of items) {
    const decision = decisionMap.get(item.id)!
    const { error } = await admin
      .from('order_items')
      .update({
        customer_decision: decision,
        customer_decided_at: now,
      })
      .eq('order_id', orderId)
      .eq('id', item.id)

    if (error) {
      console.error('submitAssessmentDecision item update failed', error)
      return { error: '査定結果の確定に失敗しました' }
    }
  }

  const approvedItemsTotal = items.reduce((sum, item) => {
    if (decisionMap.get(item.id) !== 'approved') return sum
    return sum + item.quantity * (item.assessed_unit_price ?? item.unit_price)
  }, 0)
  const hasCancelledItem = items.some(
    (item) => decisionMap.get(item.id) === 'cancelled'
  )
  const allCancelled =
    items.length > 0 &&
    items.every((item) => decisionMap.get(item.id) === 'cancelled')

  const nextStatus: OrderStatus = allCancelled ? 'cancelled' : 'pending_transfer'
  const couponAmount =
    allCancelled || items.length === 0
      ? 0
      : Math.max(0, Number(order.coupon_amount ?? 0))
  const finalTotal = approvedItemsTotal + couponAmount
  const { error: orderError } = await admin
    .from('orders')
    .update({
      status: nextStatus,
      total_amount: finalTotal,
    })
    .eq('id', orderId)

  if (orderError) {
    console.error('submitAssessmentDecision order update failed', orderError)
    return { error: '注文ステータスの更新に失敗しました' }
  }

  await admin.from('order_status_logs').insert({
    order_id: orderId,
    old_status: currentStatus,
    new_status: nextStatus,
    changed_by: user.id,
    note: allCancelled
      ? 'ユーザーが査定結果をすべてキャンセル'
      : items.length === 0
        ? 'ユーザーがカード0枚の査定結果を確認'
        : 'ユーザーが査定結果を確定',
  })

  const notificationOrder = await loadOrderForNotification(
    admin,
    orderId,
    'submitAssessmentDecision'
  )

  if (notificationOrder) {
    const kind = hasCancelledItem ? 'cancellation' : 'assessment_approved'

    if (allCancelled && user.email) {
      logEmailDebug('submitAssessmentDecision-user-cancel-email-trigger', {
        orderId: notificationOrder.id,
        orderNumber: notificationOrder.order_number,
        userId: notificationOrder.user_id,
        toEmail: user.email,
      })

      await sendStatusEmail(user.email, notificationOrder, 'cancelled').catch(
        console.error
      )
    }

    logEmailDebug('submitAssessmentDecision-admin-email-trigger', {
      orderId: notificationOrder.id,
      orderNumber: notificationOrder.order_number,
      userId: notificationOrder.user_id,
      kind,
      hasCancelledItem,
    })

    await sendAdminOrderNotification(
      kind,
      notificationOrder
    ).catch(console.error)
  } else {
    logEmailDebug('submitAssessmentDecision-notification-order-missing', {
      orderId,
      reason: 'order reload returned no rows',
    })
  }

  revalidatePath('/mypage/orders')
  revalidatePath(`/mypage/orders/${orderId}`)
  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)

  return {}
}

export async function cancelOrder(
  orderId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'ログインが必要です' }
  }

  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('id, user_id, status')
    .eq('id', orderId)
    .single()

  if (!order || order.user_id !== user.id) {
    return { error: '注文が見つかりません' }
  }

  const currentStatus = order.status as OrderStatus
  if (currentStatus === 'cancelled') {
    return { error: 'この注文はすでにキャンセル済みです' }
  }

  if (currentStatus === 'completed') {
    return { error: '振り込み完了後の注文はキャンセルできません' }
  }

  const nextStatus: OrderStatus = 'cancelled'
  const { error: updateError } = await admin
    .from('orders')
    .update({ status: nextStatus })
    .eq('id', orderId)

  if (updateError) {
    console.error('cancelOrder order update failed', updateError)
    return { error: 'キャンセル処理に失敗しました' }
  }

  await admin.from('order_status_logs').insert({
    order_id: orderId,
    old_status: currentStatus,
    new_status: nextStatus,
    changed_by: user.id,
    note: 'ユーザーが申し込みをキャンセル',
  })

  const notificationOrder = await loadOrderForNotification(
    admin,
    orderId,
    'cancelOrder'
  )

  if (notificationOrder) {
    if (user.email) {
      logEmailDebug('cancelOrder-user-email-trigger', {
        orderId: notificationOrder.id,
        orderNumber: notificationOrder.order_number,
        userId: notificationOrder.user_id,
        toEmail: user.email,
      })

      await sendStatusEmail(user.email, notificationOrder, nextStatus).catch(
        console.error
      )
    } else {
      logEmailDebug('cancelOrder-user-email-skipped', {
        orderId: notificationOrder.id,
        orderNumber: notificationOrder.order_number,
        userId: notificationOrder.user_id,
        reason: 'auth user email is empty',
      })
    }

    await sendAdminOrderNotification('cancellation', notificationOrder).catch(
      console.error
    )
  } else {
    logEmailDebug('cancelOrder-notification-order-missing', {
      orderId,
      reason: 'order reload returned no rows',
    })
  }

  revalidatePath('/mypage/orders')
  revalidatePath(`/mypage/orders/${orderId}`)
  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)

  return {}
}
