'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isAdminHostAllowedFromHeaders } from '@/lib/admin/serverHostAccess'
import { checkServerActionRateLimit } from '@/lib/security/serverRateLimit'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { normalizeCouponCode } from '@/lib/coupons'

const DUPLICATE_KEY_ERROR_CODE = '23505'

async function requireAdmin() {
  const rateLimit = await checkServerActionRateLimit('action:admin-mutation', {
    limit: 300,
    windowMs: 60 * 1000,
  })

  if (!rateLimit.allowed) redirect('/admin')
  if (!(await isAdminHostAllowedFromHeaders())) redirect('/')

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
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

function amount(formData: FormData) {
  const value = Number.parseInt(text(formData, 'amount').replace(/[^\d]/g, ''), 10)
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function redirectCoupons(
  messageKey: 'saved' | 'deleted' | 'error',
  message = '1'
): never {
  redirect(`/admin/coupons?${messageKey}=${encodeURIComponent(message)}`)
}

function couponPayload(formData: FormData) {
  const code = normalizeCouponCode(text(formData, 'code'))
  const couponAmount = amount(formData)

  if (!code) redirectCoupons('error', 'クーポンコードを入力してください')
  if (couponAmount <= 0) redirectCoupons('error', '増額金額を入力してください')

  return {
    code,
    amount: couponAmount,
    comment: text(formData, 'comment'),
    one_use_per_user: formData.get('one_use_per_user') === 'on',
    is_active: formData.get('is_active') === 'on',
  }
}

export async function createCoupon(formData: FormData) {
  await requireAdmin()

  const admin = createAdminClient()
  const { error } = await admin.from('coupons').insert(couponPayload(formData))

  if (error) {
    if (error.code === DUPLICATE_KEY_ERROR_CODE) {
      redirectCoupons('error', '同じクーポンコードがすでに登録されています')
    }
    redirectCoupons('error', `クーポンの保存に失敗しました: ${error.message}`)
  }

  revalidatePath('/admin/coupons')
  redirectCoupons('saved')
}

export async function updateCoupon(formData: FormData) {
  await requireAdmin()

  const couponId = text(formData, 'coupon_id')
  if (!couponId) redirectCoupons('error', '更新するクーポンが見つかりません')

  const admin = createAdminClient()
  const { error } = await admin
    .from('coupons')
    .update(couponPayload(formData))
    .eq('id', couponId)

  if (error) {
    if (error.code === DUPLICATE_KEY_ERROR_CODE) {
      redirectCoupons('error', '同じクーポンコードがすでに登録されています')
    }
    redirectCoupons('error', `クーポンの更新に失敗しました: ${error.message}`)
  }

  revalidatePath('/admin/coupons')
  redirectCoupons('saved')
}

export async function deleteCoupon(formData: FormData) {
  await requireAdmin()

  const couponId = text(formData, 'coupon_id')
  if (!couponId) redirectCoupons('error', '削除するクーポンが見つかりません')

  const admin = createAdminClient()
  const { error } = await admin.from('coupons').delete().eq('id', couponId)

  if (error) {
    redirectCoupons('error', `クーポンの削除に失敗しました: ${error.message}`)
  }

  revalidatePath('/admin/coupons')
  redirectCoupons('deleted')
}
