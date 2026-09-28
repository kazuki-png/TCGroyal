'use server'

import { logSafeError } from '@/lib/security/logging'


import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdminUser } from '@/lib/admin/authorization'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkServerActionRateLimit } from '@/lib/security/serverRateLimit'
import {
  logEmailDebug,
  sendAdminOrderNotification,
  sendStatusEmail,
} from '@/lib/email/send'
import { loadOrderForNotification } from '@/lib/orders/notification'
import {
  cancelReviewCouponEmailForOrder,
  scheduleReviewCouponEmailForCompletedOrder,
} from '@/lib/orders/reviewCouponNotification'
import { recordCouponRedemptionForCompletedOrder } from '@/lib/coupons'
import {
  EMAIL_TRIGGER_STATUSES,
  ORDER_STATUSES,
  canEditOrderAssessment,
  isBackwardOrderStatusTransition,
  isForwardOrderStatusTransition,
} from '@/lib/types'
import type { OrderStatus } from '@/lib/types'

type AssessmentUpdate = {
  itemId: string
  assessedUnitPrice: number
}

type CardGrade = 'PSA10' | 'PSA9' | 'PSA8'

type ManualUnlistedAssessment = {
  existingCardId?: string | null
  cardName: string
  grade: CardGrade
  assessedUnitPrice: number
  saveToDb: boolean
}

const CARD_GRADES: CardGrade[] = ['PSA10', 'PSA9', 'PSA8']

async function requireAdmin() {
  const rateLimit = await checkServerActionRateLimit('action:admin-mutation', { limit: 300, windowMs: 60000 })
  if (!rateLimit.allowed) redirect('/admin')
  return requireAdminUser()
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
      ).catch(logSafeError)

      if (status === 'completed') {
        await scheduleReviewCouponEmailForCompletedOrder({
          admin,
          order: notificationOrder,
          toEmail: authUser.user.email,
          context: 'adminOrders-notifyStatusChange',
        }).catch(logSafeError)
      }
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
    ).catch(logSafeError)
  }
}

export async function saveOrderAssessment(
  orderId: string,
  updates: AssessmentUpdate[],
  manualUnlistedItems: ManualUnlistedAssessment[] = []
) {
  const user = await requireAdmin()

  const rawUpdates = Array.isArray(updates) ? updates : []
  const rawManualItems = Array.isArray(manualUnlistedItems)
    ? manualUnlistedItems
    : []

  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('id, user_id, status, assessment_saved_at, coupon_amount, order_items(id, quantity, unit_price, item_type)')
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
    item_type: 'card' | 'unlisted'
  }[]
  const listedItems = items.filter((item) => item.item_type !== 'unlisted')
  const unlistedItems = items.filter((item) => item.item_type === 'unlisted')
  const itemMap = new Map(listedItems.map((item) => [item.id, item]))
  const normalizedUpdates = rawUpdates.map((update) => ({
    itemId: update.itemId,
    assessedUnitPrice: normalizePrice(update.assessedUnitPrice),
  }))
  const updateIds = new Set(normalizedUpdates.map((update) => update.itemId))

  if (
    normalizedUpdates.length !== listedItems.length ||
    updateIds.size !== listedItems.length
  ) {
    return { error: 'すべての商品に査定額を入力してください' }
  }

  if (normalizedUpdates.some((update) => !itemMap.has(update.itemId))) {
    return { error: '注文に含まれない商品が指定されています' }
  }

  const normalizedManualItems = rawManualItems.map((item) => ({
    existingCardId: item.existingCardId?.trim() || null,
    cardName: item.cardName.trim(),
    grade: item.grade,
    assessedUnitPrice: normalizePrice(item.assessedUnitPrice),
    saveToDb: item.saveToDb !== false,
  }))

  if (
    listedItems.length === 0 &&
    unlistedItems.length === 0 &&
    normalizedManualItems.length === 0
  ) {
    return { error: '査定額を入力してください' }
  }

  if (unlistedItems.length === 0 && normalizedManualItems.length > 0) {
    return { error: 'リストにない商品の査定依頼がないため手動追加できません' }
  }

  if (
    normalizedManualItems.some((item) => !item.existingCardId && !item.cardName)
  ) {
    return { error: '手動追加するカード名を入力してください' }
  }

  if (
    normalizedManualItems.some(
      (item) => !item.existingCardId && !CARD_GRADES.includes(item.grade)
    )
  ) {
    return { error: '手動追加するカードのグレードを選択してください' }
  }

  const existingCardIds = Array.from(
    new Set(
      normalizedManualItems
        .map((item) => item.existingCardId)
        .filter((id): id is string => Boolean(id))
    )
  )
  const { data: existingCards, error: existingCardsError } =
    existingCardIds.length > 0
      ? await admin
          .from('cards')
          .select('id, name, grade, buy_price')
          .in('id', existingCardIds)
      : { data: [], error: null }

  if (existingCardsError) {
    logSafeError('saveOrderAssessment existing card load failed')
    return { error: '既存カードの確認に失敗しました' }
  }

  const existingCardMap = new Map(
    ((existingCards ?? []) as {
      id: string
      name: string
      grade: CardGrade
      buy_price: number
    }[]).map((card) => [card.id, card])
  )

  if (existingCardMap.size !== existingCardIds.length) {
    return { error: '選択された既存カードが見つかりません' }
  }

  const nextStatus: OrderStatus = 'pending_approval'
  const { error: assessmentError } = await admin.rpc('save_assessment_secure', { p_order_id: orderId, p_actor: user.id, p_expected: currentStatus, p_updates: normalizedUpdates, p_manual: normalizedManualItems })
  if (assessmentError) return { error: '査定を保存できません。注文を再読み込みしてお試しください' }

  await notifyStatusChange(admin, orderId, nextStatus)

  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath('/mypage/orders')
  revalidatePath(`/mypage/orders/${orderId}`)
  revalidatePath('/cart')
  revalidatePath('/')

  return {}
}

export async function setOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  reason?: string
) {
  const user = await requireAdmin()

  if (!ORDER_STATUSES.includes(newStatus)) {
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

  if (currentStatus === 'completed' && newStatus === 'cancelled') {
    return { error: '振り込み完了後の注文はキャンセルできません' }
  }

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
    newStatus !== 'cancelled' &&
    !isForwardOrderStatusTransition(currentStatus, newStatus) &&
    !isBackwardOrderStatusTransition(currentStatus, newStatus)
  ) {
    return { error: '無効なステータス変更です' }
  }

  const { error } = await admin.rpc('transition_order_secure', { p_order_id: orderId, p_expected: currentStatus, p_next: newStatus, p_actor: user.id, p_note: rollbackReason || null })
  if (error) return { error: '注文が更新されました。再読み込みしてお試しください' }

  if (newStatus === 'completed') {
    const redemptionResult = await recordCouponRedemptionForCompletedOrder(
      admin,
      orderId
    )
    if (redemptionResult.error) {
      logSafeError('adminOrders-setOrderStatus coupon redemption failed', {
        orderId,
        error: redemptionResult.error,
      })
    }
  }

  await notifyStatusChange(admin, orderId, newStatus)

  if (currentStatus === 'completed' && newStatus !== 'completed') {
    await cancelReviewCouponEmailForOrder({
      admin,
      orderId,
      context: 'adminOrders-setOrderStatus',
    }).catch(logSafeError)
  }

  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath('/mypage/orders')

  return {}
}
