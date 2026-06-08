import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

export type AppliedCoupon = {
  id: string
  code: string
  amount: number
  comment: string
  one_use_per_user: boolean
}

type CouponRow = {
  id: string
  code: string
  amount: number
  comment: string | null
  one_use_per_user: boolean
  is_active: boolean
}

const DUPLICATE_KEY_ERROR_CODE = '23505'
const IN_PROGRESS_COUPON_ORDER_MESSAGE =
  'このクーポンを使用した申込中の買取があります。'

export function normalizeCouponCode(value: string | null | undefined) {
  return (value ?? '').trim().toUpperCase()
}

function toAppliedCoupon(row: CouponRow): AppliedCoupon {
  return {
    id: row.id,
    code: row.code,
    amount: Math.max(0, Math.floor(Number(row.amount) || 0)),
    comment: row.comment ?? '',
    one_use_per_user: Boolean(row.one_use_per_user),
  }
}

export async function validateCouponForUser(
  admin: AdminClient,
  userId: string,
  rawCode: string | null | undefined
): Promise<{ coupon: AppliedCoupon | null; error?: string }> {
  const code = normalizeCouponCode(rawCode)
  if (!code) return { coupon: null }

  const { data, error } = await admin
    .from('coupons')
    .select('id, code, amount, comment, one_use_per_user, is_active')
    .ilike('code', code)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error('validateCouponForUser coupon load failed', error)
    return { coupon: null, error: 'クーポンコードの確認に失敗しました' }
  }

  if (!data) {
    return { coupon: null, error: '有効なクーポンコードが見つかりません' }
  }

  const coupon = toAppliedCoupon(data as CouponRow)
  if (coupon.amount <= 0) {
    return { coupon: null, error: 'このクーポンは現在利用できません' }
  }

  if (coupon.one_use_per_user) {
    const { data: redemption, error: redemptionError } = await admin
      .from('coupon_redemptions')
      .select('id')
      .eq('coupon_id', coupon.id)
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()

    if (redemptionError) {
      console.error('validateCouponForUser redemption load failed', redemptionError)
      return { coupon: null, error: 'クーポン利用状況の確認に失敗しました' }
    }

    if (redemption) {
      return {
        coupon: null,
        error: 'このクーポンコードはすでに利用済みです',
      }
    }

    const { data: inProgressOrder, error: inProgressOrderError } = await admin
      .from('orders')
      .select('id')
      .eq('coupon_id', coupon.id)
      .eq('user_id', userId)
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .limit(1)
      .maybeSingle()

    if (inProgressOrderError) {
      console.error(
        'validateCouponForUser in-progress order load failed',
        inProgressOrderError
      )
      return { coupon: null, error: 'クーポン利用状況の確認に失敗しました' }
    }

    if (inProgressOrder) {
      return {
        coupon: null,
        error: IN_PROGRESS_COUPON_ORDER_MESSAGE,
      }
    }
  }

  return { coupon }
}

export async function recordCouponRedemptionForCompletedOrder(
  admin: AdminClient,
  orderId: string
): Promise<{ error?: string }> {
  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('id, user_id, coupon_id, status')
    .eq('id', orderId)
    .maybeSingle()

  if (orderError) {
    console.error('recordCouponRedemptionForCompletedOrder order load failed', {
      orderId,
      error: orderError,
    })
    return { error: 'クーポン利用済み記録の確認に失敗しました' }
  }

  if (!order || order.status !== 'completed' || !order.coupon_id) {
    return {}
  }

  const { data: coupon, error: couponError } = await admin
    .from('coupons')
    .select('id, one_use_per_user')
    .eq('id', order.coupon_id)
    .maybeSingle()

  if (couponError) {
    console.error('recordCouponRedemptionForCompletedOrder coupon load failed', {
      orderId,
      couponId: order.coupon_id,
      error: couponError,
    })
    return { error: 'クーポン利用済み記録の確認に失敗しました' }
  }

  if (!coupon?.one_use_per_user) {
    return {}
  }

  const { error: redemptionError } = await admin
    .from('coupon_redemptions')
    .insert({
      coupon_id: order.coupon_id,
      user_id: order.user_id,
      order_id: order.id,
      one_use_per_user: true,
    })

  if (!redemptionError || redemptionError.code === DUPLICATE_KEY_ERROR_CODE) {
    return {}
  }

  console.error(
    'recordCouponRedemptionForCompletedOrder redemption insert failed',
    {
      orderId,
      couponId: order.coupon_id,
      userId: order.user_id,
      error: redemptionError,
    }
  )

  return { error: 'クーポン利用済み記録に失敗しました' }
}
