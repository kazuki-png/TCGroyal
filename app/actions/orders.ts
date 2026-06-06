'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  logEmailDebug,
  sendAdminOrderNotification,
  sendOrderSubmittedEmail,
  sendStatusEmail,
} from '@/lib/email/send'
import {
  EMAIL_TRIGGER_STATUSES,
  ORDER_STATUSES,
  isBackwardOrderStatusTransition,
  isForwardOrderStatusTransition,
} from '@/lib/types'
import { loadOrderForNotification } from '@/lib/orders/notification'
import {
  cancelReviewCouponEmailForOrder,
  scheduleReviewCouponEmailForCompletedOrder,
} from '@/lib/orders/reviewCouponNotification'
import { checkServerActionRateLimit } from '@/lib/security/serverRateLimit'
import { visiblePriceUpdatedAfter } from '@/lib/cards/visibility'
import {
  recordCouponRedemption,
  validateCouponForUser,
} from '@/lib/coupons'
import type { CartItem, OrderStatus } from '@/lib/types'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const UNLISTED_CARD_ID = 'unlisted-card-request'
const UNLISTED_NOTE = 'リストにない商品の査定依頼'
const DUPLICATE_KEY_ERROR_CODE = '23505'

type AuthoritativeCard = {
  id: string
  name: string
  grade: string
  buy_price: number
  buy_price_updated_at: string | null
}

type PreparedOrderItem = {
  card_id: string | null
  item_type: 'card' | 'unlisted'
  card_name: string
  grade: string
  quantity: number
  unit_price: number
  assessed_unit_price: number
  requested_note: string | null
}

function normalizeQuantity(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(999, Math.max(1, Math.floor(value)))
}

function todayOrderPrefix() {
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return formatter.format(new Date()).replaceAll('/', '')
}

async function nextOrderNumber(
  adminClient: ReturnType<typeof createAdminClient>,
  offset = 0
) {
  const prefix = todayOrderPrefix()
  const { data } = await adminClient
    .from('orders')
    .select('order_number')
    .like('order_number', `${prefix}-%`)
    .order('order_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const latestNumber =
    typeof data?.order_number === 'string'
      ? Number(data.order_number.match(/-(\d+)$/)?.[1] ?? 0)
      : 0
  const nextNumber = latestNumber + 1 + offset

  return `${prefix}-${String(nextNumber).padStart(2, '0')}`
}

export async function createOrder(
  items: CartItem[],
  bankInfo: {
    bank_name: string
    bank_branch: string
    bank_account_no: string
    bank_holder: string
    note?: string
  },
  couponCode?: string
): Promise<{ error?: string; redirectTo?: string; orderNumber?: string }> {
  const rateLimit = await checkServerActionRateLimit('action:create-order', {
    limit: 20,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.allowed) {
    return { error: '申し込みが多すぎます。しばらく待ってから再度お試しください' }
  }

  if (items.length === 0) {
    return { error: 'カードを選択してください' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/cart')
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
        .select('id, name, grade, buy_price, buy_price_updated_at')
        .gte('buy_price_updated_at', visiblePriceUpdatedAfter())
        .in('id', cardIds)
    : { data: [], error: null }

  if (cardsError) {
    return { error: 'カード情報の確認に失敗しました。もう一度お試しください' }
  }

  const cardMap = new Map(
    ((cards ?? []) as AuthoritativeCard[]).map((card) => [card.id, card])
  )

  if (cardMap.size !== cardIds.length) {
    return { error: 'カートに現在取り扱い対象外、または価格更新期限切れのカードが含まれています。カード一覧を更新してください' }
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
      assessed_unit_price: card.buy_price,
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
      assessed_unit_price: 0,
      requested_note: UNLISTED_NOTE,
    })
  }

  const totalAmount = orderItems.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  )
  const couponResult = await validateCouponForUser(
    adminClient,
    user.id,
    couponCode
  )

  if (couponResult.error) {
    return { error: couponResult.error }
  }

  const appliedCoupon = couponResult.coupon
  const couponAmount = appliedCoupon?.amount ?? 0
  const orderTotalAmount = totalAmount + couponAmount

  let order: { id: string; order_number: string } | null = null
  let orderError: { code?: string; message?: string } | null = null

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const orderNumber = await nextOrderNumber(adminClient, attempt)
    const { data, error } = await adminClient
      .from('orders')
      .insert({
        order_number: orderNumber,
        user_id: user.id,
        status: 'unhandled',
        total_amount: orderTotalAmount,
        coupon_id: appliedCoupon?.id ?? null,
        coupon_code: appliedCoupon?.code ?? null,
        coupon_comment: appliedCoupon?.comment ?? null,
        coupon_amount: couponAmount,
        note: bankInfo.note ?? null,
        ...bankInfo,
      })
      .select('id, order_number')
      .single()

    if (!error && data) {
      order = data
      orderError = null
      break
    }

    orderError = error
    if (error?.code !== DUPLICATE_KEY_ERROR_CODE) break
  }

  if (orderError || !order) {
    console.error('createOrder order insert failed', orderError)
    return { error: '注文の作成に失敗しました' }
  }

  if (appliedCoupon) {
    const { error: redemptionError } = await recordCouponRedemption({
      admin: adminClient,
      coupon: appliedCoupon,
      orderId: order.id,
      userId: user.id,
    })

    if (redemptionError) {
      console.error('createOrder coupon redemption failed', redemptionError)
      await adminClient.from('orders').delete().eq('id', order.id)
      return {
        error:
          redemptionError.code === DUPLICATE_KEY_ERROR_CODE
            ? 'このクーポンコードはすでに利用済みです'
            : 'クーポンの適用に失敗しました。もう一度お試しください',
      }
    }
  }

  const { error: itemsError } = await adminClient
    .from('order_items')
    .insert(orderItems.map((item) => ({ ...item, order_id: order.id })))

  if (itemsError) {
    console.error('createOrder item insert failed', itemsError)
    await adminClient.from('orders').delete().eq('id', order.id)
    return { error: '注文明細の作成に失敗しました' }
  }

  const notificationOrder = await loadOrderForNotification(
    adminClient,
    order.id,
    'createOrder'
  )

  if (notificationOrder) {
    logEmailDebug('createOrder-notification-order-loaded', {
      orderId: notificationOrder.id,
      orderNumber: notificationOrder.order_number,
      userId: notificationOrder.user_id,
      hasUserEmail: Boolean(user.email),
      itemCount: notificationOrder.order_items?.length ?? 0,
    })

    if (user.email) {
      logEmailDebug('createOrder-user-email-trigger', {
        orderId: notificationOrder.id,
        orderNumber: notificationOrder.order_number,
        userId: notificationOrder.user_id,
        toEmail: user.email,
      })

      await sendOrderSubmittedEmail(user.email, notificationOrder).catch(
        console.error
      )
    } else {
      logEmailDebug('createOrder-user-email-skipped', {
        orderId: notificationOrder.id,
        orderNumber: notificationOrder.order_number,
        userId: notificationOrder.user_id,
        reason: 'auth user email is empty',
      })
    }

    logEmailDebug('createOrder-admin-email-trigger', {
      orderId: notificationOrder.id,
      orderNumber: notificationOrder.order_number,
      userId: notificationOrder.user_id,
      kind: 'new_order',
    })

    await sendAdminOrderNotification('new_order', notificationOrder).catch(
      console.error
    )
  } else {
    logEmailDebug('createOrder-notification-order-missing', {
      orderId: order.id,
      orderNumber: order.order_number,
      reason: 'order reload returned no rows',
    })
  }

  revalidatePath('/mypage/orders')
  return { redirectTo: '/mypage/orders', orderNumber: order.order_number }
}

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  reason?: string
): Promise<{ error?: string }> {
  const rateLimit = await checkServerActionRateLimit('action:admin-mutation', {
    limit: 300,
    windowMs: 60 * 1000,
  })
  if (!rateLimit.allowed) {
    return { error: 'リクエストが多すぎます。しばらく待ってから再度お試しください' }
  }

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

  if (!ORDER_STATUSES.includes(newStatus)) {
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

  const orderUpdates: Record<string, string | null> = { status: newStatus }
  if (newStatus === 'completed') {
    orderUpdates.completed_at = new Date().toISOString()
  } else if (currentStatus === 'completed') {
    orderUpdates.completed_at = null
  }

  const { error: updateError } = await adminClient
    .from('orders')
    .update(orderUpdates)
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

  const shouldSendUserEmail = EMAIL_TRIGGER_STATUSES.includes(newStatus)
  const shouldSendAdminEmail = newStatus === 'pending_transfer'

  logEmailDebug('updateOrderStatus-email-evaluation', {
    orderId,
    currentStatus,
    newStatus,
    shouldSendUserEmail,
    shouldSendAdminEmail,
  })

  if (shouldSendUserEmail || shouldSendAdminEmail) {
    const notificationOrder = await loadOrderForNotification(
      adminClient,
      orderId,
      'updateOrderStatus'
    )

    if (notificationOrder) {
      logEmailDebug('updateOrderStatus-notification-order-loaded', {
        orderId: notificationOrder.id,
        orderNumber: notificationOrder.order_number,
        userId: notificationOrder.user_id,
        newStatus,
        itemCount: notificationOrder.order_items?.length ?? 0,
      })

      if (shouldSendUserEmail) {
        const { data: authUser } = await adminClient.auth.admin.getUserById(
          notificationOrder.user_id
        )

        if (authUser.user?.email) {
          logEmailDebug('updateOrderStatus-user-email-trigger', {
            orderId: notificationOrder.id,
            orderNumber: notificationOrder.order_number,
            userId: notificationOrder.user_id,
            newStatus,
            toEmail: authUser.user.email,
          })

          await sendStatusEmail(
            authUser.user.email,
            notificationOrder,
            newStatus
          ).catch(console.error)

          if (newStatus === 'completed') {
            await scheduleReviewCouponEmailForCompletedOrder({
              admin: adminClient,
              order: notificationOrder,
              toEmail: authUser.user.email,
              context: 'updateOrderStatus',
            }).catch(console.error)
          }
        } else {
          logEmailDebug('updateOrderStatus-user-email-skipped', {
            orderId: notificationOrder.id,
            orderNumber: notificationOrder.order_number,
            userId: notificationOrder.user_id,
            newStatus,
            reason: 'auth user email is empty',
          })
        }
      }

      if (shouldSendAdminEmail) {
        logEmailDebug('updateOrderStatus-admin-email-trigger', {
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
    } else {
      logEmailDebug('updateOrderStatus-notification-order-missing', {
        orderId,
        newStatus,
        reason: 'order reload returned no rows',
      })
    }
  } else {
    logEmailDebug('updateOrderStatus-email-skipped', {
      orderId,
      currentStatus,
      newStatus,
      reason: 'status has no email trigger',
    })
  }

  if (currentStatus === 'completed' && newStatus !== 'completed') {
    await cancelReviewCouponEmailForOrder({
      admin: adminClient,
      orderId,
      context: 'updateOrderStatus',
    }).catch(console.error)
  }

  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath('/admin/orders')
  revalidatePath('/mypage/orders')
  revalidatePath(`/mypage/orders/${orderId}`)

  return {}
}
