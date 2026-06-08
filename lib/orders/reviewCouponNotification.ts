import {
  cancelScheduledEmail,
  logEmailDebug,
  sendReviewCouponEmail,
} from '@/lib/email/send'
import type { createAdminClient } from '@/lib/supabase/admin'
import type { OrderWithItems } from '@/lib/types'

const REVIEW_COUPON_DELAY_MS = 24 * 60 * 60 * 1000
const MIN_SCHEDULE_DELAY_MS = 60 * 1000

type AdminClient = ReturnType<typeof createAdminClient>

type ReviewCouponOrder = OrderWithItems & {
  completed_at?: string | null
  review_request_email_scheduled_at?: string | null
  review_request_email_sent_at?: string | null
  review_request_email_resend_id?: string | null
}

function customerName(order: OrderWithItems) {
  return [order.profiles?.last_name, order.profiles?.first_name]
    .filter(Boolean)
    .join(' ')
}

function scheduledAtForCompletedOrder(order: ReviewCouponOrder) {
  const completedAt = order.completed_at
    ? new Date(order.completed_at).getTime()
    : Date.now()
  const target = Number.isFinite(completedAt)
    ? completedAt + REVIEW_COUPON_DELAY_MS
    : Date.now() + REVIEW_COUPON_DELAY_MS
  const safeTarget = Math.max(target, Date.now() + MIN_SCHEDULE_DELAY_MS)

  return new Date(safeTarget).toISOString()
}

export async function scheduleReviewCouponEmailForCompletedOrder({
  admin,
  order,
  toEmail,
  context,
}: {
  admin: AdminClient
  order: OrderWithItems
  toEmail: string
  context: string
}) {
  const reviewOrder = order as ReviewCouponOrder

  if (reviewOrder.status !== 'completed') return

  if (
    reviewOrder.review_request_email_scheduled_at ||
    reviewOrder.review_request_email_sent_at ||
    reviewOrder.review_request_email_resend_id
  ) {
    logEmailDebug('review-coupon-schedule-skipped', {
      context,
      orderId: reviewOrder.id,
      orderNumber: reviewOrder.order_number,
      userId: reviewOrder.user_id,
      reason: 'already scheduled or sent',
    })
    return
  }

  const { data: otherCompletedOrders, error: otherCompletedError } = await admin
    .from('orders')
    .select('id')
    .eq('user_id', reviewOrder.user_id)
    .eq('status', 'completed')
    .neq('id', reviewOrder.id)
    .limit(1)

  if (otherCompletedError) {
    logEmailDebug('review-coupon-first-user-check-failed', {
      context,
      orderId: reviewOrder.id,
      orderNumber: reviewOrder.order_number,
      userId: reviewOrder.user_id,
      error: otherCompletedError,
    })
    return
  }

  if ((otherCompletedOrders ?? []).length > 0) {
    logEmailDebug('review-coupon-schedule-skipped', {
      context,
      orderId: reviewOrder.id,
      orderNumber: reviewOrder.order_number,
      userId: reviewOrder.user_id,
      reason: 'user already has completed order',
    })
    return
  }

  const scheduledAt = scheduledAtForCompletedOrder(reviewOrder)

  logEmailDebug('review-coupon-schedule-start', {
    context,
    orderId: reviewOrder.id,
    orderNumber: reviewOrder.order_number,
    userId: reviewOrder.user_id,
    scheduledAt,
    toEmail,
  })

  const resendEmailId = await sendReviewCouponEmail(
    toEmail,
    customerName(reviewOrder),
    scheduledAt
  )

  if (!resendEmailId) {
    logEmailDebug('review-coupon-schedule-missing-email-id', {
      context,
      orderId: reviewOrder.id,
      orderNumber: reviewOrder.order_number,
      userId: reviewOrder.user_id,
      scheduledAt,
      reason: 'resend did not return an email id',
    })
    return
  }

  const { error: updateError } = await admin
    .from('orders')
    .update({
      review_request_email_scheduled_at: scheduledAt,
      review_request_email_resend_id: resendEmailId,
    })
    .eq('id', reviewOrder.id)
    .is('review_request_email_scheduled_at', null)

  if (updateError) {
    logEmailDebug('review-coupon-schedule-record-failed', {
      context,
      orderId: reviewOrder.id,
      orderNumber: reviewOrder.order_number,
      userId: reviewOrder.user_id,
      scheduledAt,
      resendEmailId,
      error: updateError,
    })
    return
  }

  logEmailDebug('review-coupon-schedule-succeeded', {
    context,
    orderId: reviewOrder.id,
    orderNumber: reviewOrder.order_number,
    userId: reviewOrder.user_id,
    scheduledAt,
    resendEmailId,
  })
}

export async function cancelReviewCouponEmailForOrder({
  admin,
  orderId,
  context,
}: {
  admin: AdminClient
  orderId: string
  context: string
}) {
  const { data: order, error } = await admin
    .from('orders')
    .select(
      'id, order_number, user_id, review_request_email_scheduled_at, review_request_email_resend_id, review_request_email_sent_at'
    )
    .eq('id', orderId)
    .maybeSingle()

  if (error || !order) {
    logEmailDebug('review-coupon-cancel-order-load-failed', {
      context,
      orderId,
      error,
      hasOrder: Boolean(order),
    })
    return
  }

  const scheduledAt = order.review_request_email_scheduled_at as string | null
  const resendEmailId = order.review_request_email_resend_id as string | null

  if (!scheduledAt || !resendEmailId) {
    logEmailDebug('review-coupon-cancel-skipped', {
      context,
      orderId: order.id,
      orderNumber: order.order_number,
      userId: order.user_id,
      reason: 'no scheduled email',
    })
    return
  }

  const cancelled = await cancelScheduledEmail(resendEmailId, {
    emailType: 'review_coupon',
    context,
    orderId: order.id,
    orderNumber: order.order_number,
    userId: order.user_id,
  })

  if (!cancelled) return

  const { error: updateError } = await admin
    .from('orders')
    .update({
      review_request_email_scheduled_at: null,
      review_request_email_resend_id: null,
    })
    .eq('id', order.id)

  if (updateError) {
    logEmailDebug('review-coupon-cancel-record-failed', {
      context,
      orderId: order.id,
      orderNumber: order.order_number,
      userId: order.user_id,
      resendEmailId,
      error: updateError,
    })
    return
  }

  logEmailDebug('review-coupon-cancel-succeeded', {
    context,
    orderId: order.id,
    orderNumber: order.order_number,
    userId: order.user_id,
    resendEmailId,
  })
}
