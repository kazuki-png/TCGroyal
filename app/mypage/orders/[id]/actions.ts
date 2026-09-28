'use server'

import { logSafeError } from '@/lib/security/logging'


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

  const hasCancelledItem = items.some(
    (item) => decisionMap.get(item.id) === 'cancelled'
  )
  const allCancelled =
    items.length > 0 &&
    items.every((item) => decisionMap.get(item.id) === 'cancelled')

  const { error: orderError } = await admin.rpc('decide_order_secure', { p_order_id: orderId, p_actor: user.id, p_decisions: decisions })
  if (orderError) return { error: '注文が更新されました。再読み込みしてお試しください' }

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
        logSafeError
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
    ).catch(logSafeError)
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
  const { error: updateError } = await admin.rpc('transition_order_secure', { p_order_id: orderId, p_expected: currentStatus, p_next: nextStatus, p_actor: user.id, p_note: 'ユーザーが申し込みをキャンセル' })
  if (updateError) return { error: '注文が更新されました。再読み込みしてお試しください' }

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
        logSafeError
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
      logSafeError
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
