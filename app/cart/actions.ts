'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

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

  if (!user) redirect('/login')

  const errors = validateCheckoutProfile(formData)
  if (Object.keys(errors).length > 0) {
    return { errors }
  }

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('id_image_url, identity_verified')
    .eq('id', user.id)
    .maybeSingle()

  const email = value(formData, 'email')
  if (email && email !== user.email) {
    const { error: authError } = await supabase.auth.updateUser({ email })
    if (authError) {
      return {
        error: `メールアドレスの更新に失敗しました: ${authError.message}`,
      }
    }
  }

  let idImageUrl =
    (currentProfile as { id_image_url?: string | null } | null)?.id_image_url ??
    null
  let identityVerified = Boolean(
    (currentProfile as { identity_verified?: boolean | null } | null)
      ?.identity_verified
  )
  const file = formData.get('id_image') as File | null

  if (file && file.size > 0) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${user.id}/id_image.${ext}`
    const admin = createAdminClient()
    const { error: uploadError } = await admin.storage
      .from('identity-images')
      .upload(path, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type || 'image/jpeg',
        upsert: true,
      })

    if (uploadError) {
      return {
        errors: {
          id_image: `身分証画像のアップロードに失敗しました: ${uploadError.message}`,
        },
      }
    }

    idImageUrl = path
    identityVerified = false
  }

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: user.id,
    email,
    last_name: value(formData, 'last_name'),
    first_name: '',
    last_name_kana: value(formData, 'last_name_kana'),
    first_name_kana: '',
    id_type: value(formData, 'id_type'),
    id_image_url: idImageUrl,
    identity_verified: identityVerified,
    postal_code: value(formData, 'postal_code'),
    address: value(formData, 'address'),
    phone: value(formData, 'phone'),
    bank_name: value(formData, 'bank_name'),
    branch_name: value(formData, 'branch_name'),
    account_type: value(formData, 'account_type'),
    account_number: value(formData, 'account_number'),
    account_holder_kana: value(formData, 'account_holder_kana'),
  })

  if (profileError) {
    return { error: '保存済みデータの更新に失敗しました。もう一度お試しください。' }
  }

  revalidatePath('/cart')
  revalidatePath('/mypage/profile')

  return { success: '保存しました' }
}
