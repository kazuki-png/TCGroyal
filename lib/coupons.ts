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
  }

  return { coupon }
}

export async function recordCouponRedemption({
  admin,
  coupon,
  orderId,
  userId,
}: {
  admin: AdminClient
  coupon: AppliedCoupon
  orderId: string
  userId: string
}) {
  return admin.from('coupon_redemptions').insert({
    coupon_id: coupon.id,
    user_id: userId,
    order_id: orderId,
    one_use_per_user: coupon.one_use_per_user,
  })
}
