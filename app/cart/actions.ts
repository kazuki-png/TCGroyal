'use server'

import { saveIdentityImage } from '@/lib/identity/documents'
import { checkServerActionRateLimit } from '@/lib/security/serverRateLimit'
import { checkSharedRateLimit } from '@/lib/security/sharedRateLimit'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { validateCouponForUser, type AppliedCoupon } from '@/lib/coupons'

const MAX_ID_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_ID_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
])

export type CheckoutProfileUpdateState = {
  error?: string
  errors?: Record<string, string>
  success?: string
}

export type CouponApplyState = {
  error?: string
  coupon?: AppliedCoupon
}

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? '').trim()
}

function validateIdImage(file: File | null) {
  if (!file || file.size === 0) return null

  if (file.size > MAX_ID_IMAGE_SIZE) {
    return '身分証画像は5MB以下にしてください'
  }

  const allowed = /\.(jpe?g|png|heic|heif)$/i
  if (!allowed.test(file.name) && !ALLOWED_ID_IMAGE_TYPES.has(file.type)) {
    return 'JPG・PNG・HEIC の画像をアップロードしてください'
  }

  return null
}

function validateCheckoutProfile(formData: FormData) {
  const errors: Record<string, string> = {}
  const requiredFields = [
    ['last_name', '氏名を入力してください'],
    ['last_name_kana', '氏名（カナ）を入力してください'],
    ['email', 'メールアドレスを入力してください'],
    ['id_type', '身分証を選択してください'],
    ['postal_code', '郵便番号を入力してください'],
    ['address', '住所を入力してください'],
    ['phone', '電話番号を入力してください'],
    ['bank_name', '銀行名を入力してください'],
    ['branch_name', '支店名を入力してください'],
    ['account_type', '口座種別を選択してください'],
    ['account_number', '口座番号を入力してください'],
    ['account_holder_kana', '口座名義を入力してください'],
  ] as const

  requiredFields.forEach(([name, message]) => {
    if (!value(formData, name)) errors[name] = message
  })

  const accountNumber = value(formData, 'account_number')
  if (accountNumber && !/^\d{7}$/.test(accountNumber)) {
    errors.account_number = '口座番号は7桁の数字で入力してください'
  }

  const file = formData.get('id_image') as File | null
  const idImageError = validateIdImage(file)
  if (idImageError) errors.id_image = idImageError

  return errors
}

export async function updateCheckoutProfileAction(
  formData: FormData
): Promise<CheckoutProfileUpdateState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email_confirmed_at) redirect('/login')
  const ipLimit = await checkServerActionRateLimit('action:profile', { limit: 20, windowMs: 3600000 })
  const userLimit = await checkSharedRateLimit('profile:user', user.id, { limit: 20, windowMs: 3600000 })
  if (!ipLimit.allowed || !userLimit.allowed) return { error: '更新が多すぎます。時間をおいて再試行してください' }

  const errors = validateCheckoutProfile(formData)
  if (Object.keys(errors).length > 0) {
    return { errors }
  }

  const email = value(formData, 'email')
  if (email && email !== user.email) {
    const { error: authError } = await supabase.auth.updateUser({ email })
    if (authError) {
      return {
        error: `メールアドレスの更新に失敗しました: ${authError.message}`,
      }
    }
  }

  const file = formData.get('id_image')
  if (file instanceof File && file.size > 0) {
    try { await saveIdentityImage(user.id, file, value(formData, 'id_type')) }
    catch (error) { return { error: error instanceof Error ? error.message : '書類の保存に失敗しました' } }
  }

  const { error: profileError } = await createAdminClient().from('profiles').update({
    last_name: value(formData, 'last_name'),
    first_name: '',
    last_name_kana: value(formData, 'last_name_kana'),
    first_name_kana: '',
    id_type: value(formData, 'id_type'),
    postal_code: value(formData, 'postal_code'),
    address: value(formData, 'address'),
    phone: value(formData, 'phone'),
    bank_name: value(formData, 'bank_name'),
    branch_name: value(formData, 'branch_name'),
    account_type: value(formData, 'account_type'),
    account_number: value(formData, 'account_number'),
    account_holder_kana: value(formData, 'account_holder_kana'),
  }).eq('id', user.id)

  if (profileError) {
    return { error: '保存済みデータの更新に失敗しました。もう一度お試しください。' }
  }

  revalidatePath('/cart')
  revalidatePath('/mypage/profile')

  return { success: '保存しました' }
}

export async function applyCouponCodeAction(
  code: string
): Promise<CouponApplyState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email_confirmed_at) {
    return { error: 'クーポンを利用するにはログインが必要です' }
  }

  const limit = await checkSharedRateLimit('coupon:user', user.id, { limit: 20, windowMs: 60000 })
  if (!limit.allowed || typeof code !== 'string' || code.length > 100) return { error: '時間をおいて再試行してください' }
  const result = await validateCouponForUser(
    createAdminClient(),
    user.id,
    code
  )

  if (result.error) return { error: result.error }
  if (!result.coupon) return { error: 'クーポンコードを入力してください' }

  return { coupon: result.coupon }
}
