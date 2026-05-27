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
    .select('id, user_id, status, assessment_saved_at, order_items(id, quantity, unit_price, item_type)')
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
    console.error('saveOrderAssessment existing card load failed', existingCardsError)
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

  const insertedManualItems: {
    cardName: string
    grade: CardGrade
    assessedUnitPrice: number
    unitPrice: number
    cardId: string | null
  }[] = []

  for (const manualItem of normalizedManualItems) {
    let cardId: string | null = null
    let cardName = manualItem.cardName
    let grade = manualItem.grade
    let unitPrice = manualItem.assessedUnitPrice

    if (manualItem.existingCardId) {
      const existingCard = existingCardMap.get(manualItem.existingCardId)
      if (!existingCard) {
        return { error: '選択された既存カードが見つかりません' }
      }

      cardId = existingCard.id
      cardName = existingCard.name
      grade = existingCard.grade
      // 登録済みカードは掲載価格を申込時価格として残し、カードマスタ価格は更新しない。
      unitPrice = existingCard.buy_price
    }

    if (!manualItem.existingCardId && manualItem.saveToDb) {
      const { data: card, error: cardError } = await admin
        .from('cards')
        .insert({
          name: cardName,
          category: 'pokemon',
          card_number: null,
          grade,
          buy_price: manualItem.assessedUnitPrice,
          image_url: null,
        })
        .select('id')
        .single()

      if (cardError || !card) {
        console.error('saveOrderAssessment manual card insert failed', cardError)
        return { error: '手動追加カードのDB保存に失敗しました' }
      }

      cardId = card.id as string
    }

    insertedManualItems.push({
      cardName,
      grade,
      assessedUnitPrice: manualItem.assessedUnitPrice,
      unitPrice,
      cardId,
    })
  }

  if (insertedManualItems.length > 0) {
    const { error: insertError } = await admin.from('order_items').insert(
      insertedManualItems.map((item) => ({
        order_id: orderId,
        card_id: item.cardId,
        item_type: 'card',
        card_name: item.cardName,
        grade: item.grade,
        quantity: 1,
        unit_price: item.unitPrice,
        assessed_unit_price: item.assessedUnitPrice,
        customer_decision: null,
        customer_decided_at: null,
        requested_note: item.cardId
          ? 'リストにない商品の査定依頼から既存カードを追加'
          : 'リストにない商品の査定依頼から手動追加',
      }))
    )

    if (insertError) {
      console.error('saveOrderAssessment manual order item insert failed', insertError)
      return { error: '手動追加カードの明細作成に失敗しました' }
    }

  }

  if (unlistedItems.length > 0) {
    const { error: deleteError } = await admin
      .from('order_items')
      .delete()
      .eq('order_id', orderId)
      .eq('item_type', 'unlisted')

    if (deleteError) {
      console.error('saveOrderAssessment unlisted placeholder delete failed', deleteError)
      return { error: 'リストにない商品の表示削除に失敗しました' }
    }
  }

  const listedAssessedTotal = normalizedUpdates.reduce((sum, update) => {
    const item = itemMap.get(update.itemId)!
    return sum + item.quantity * update.assessedUnitPrice
  }, 0)
  const manualAssessedTotal = insertedManualItems.reduce(
    (sum, item) => sum + item.assessedUnitPrice,
    0
  )
  const assessedTotal = listedAssessedTotal + manualAssessedTotal
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
