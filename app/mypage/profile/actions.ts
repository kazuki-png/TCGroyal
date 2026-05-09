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

export type ProfileUpdateState = {
  errors?: Record<string, string>
  error?: string
  success?: string
}

type CurrentProfile = {
  id_image_url: string | null
  identity_verified: boolean | null
}

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? '').trim()
}

function validateIdImage(file: File | null, hasIdentityImage: boolean) {
  if (!file || file.size === 0) {
    return hasIdentityImage ? null : '身分証画像をアップロードしてください'
  }

  if (file.size > MAX_ID_IMAGE_SIZE) {
    return '身分証画像は5MB以下にしてください'
  }

  const allowed = /\.(jpe?g|png|heic|heif)$/i
  if (!allowed.test(file.name) && !ALLOWED_ID_IMAGE_TYPES.has(file.type)) {
    return 'JPG・PNG・HEIC の画像をアップロードしてください'
  }

  return null
}

function validateProfile(formData: FormData, hasIdentityImage: boolean) {
  const errors: Record<string, string> = {}
  const requiredFields = [
    ['last_name', '氏名を入力してください'],
    ['last_name_kana', '氏名（カナ）を入力してください'],
    ['email', 'メールアドレスを入力してください'],
    ['email_confirm', 'メールアドレス（確認）を入力してください'],
    ['birthday_year', '生年月日を選択してください'],
    ['birthday_month', '生年月日を選択してください'],
    ['birthday_day', '生年月日を選択してください'],
    ['gender', '性別を選択してください'],
    ['occupation', 'ご職業を選択してください'],
    ['id_type', '身分証を選択してください'],
    ['postal_code', '郵便番号を入力してください'],
    ['address', '住所を入力してください'],
    ['phone', '電話番号を入力してください'],
    ['bank_name', '銀行を選択してください'],
    ['branch_name', '支店を選択してください'],
    ['account_type', '口座種別を選択してください'],
    ['account_number', '口座番号を入力してください'],
    ['account_holder_kana', '口座名義を入力してください'],
  ] as const

  requiredFields.forEach(([name, message]) => {
    if (!value(formData, name)) errors[name] = message
  })

  const email = value(formData, 'email')
  const emailConfirm = value(formData, 'email_confirm')
  const password = String(formData.get('password') ?? '')
  const passwordConfirm = String(formData.get('password_confirm') ?? '')
  const accountNumber = value(formData, 'account_number')
  const file = formData.get('id_image') as File | null
  const idImageError = validateIdImage(file, hasIdentityImage)

  if (email && emailConfirm && email !== emailConfirm) {
    errors.email_confirm = 'メールアドレスが一致しません'
  }

  if (password || passwordConfirm) {
    if (password.length < 8) {
      errors.password = 'パスワードは8文字以上で入力してください'
    }
    if (password !== passwordConfirm) {
      errors.password_confirm = 'パスワードが一致しません'
    }
  }

  if (!formData.get('is_qualified_invoice')) {
    errors.is_qualified_invoice = '適格請求書発行事業者の有無を選択してください'
  }

  if (accountNumber && !/^\d{7}$/.test(accountNumber)) {
    errors.account_number = '口座番号は7桁の数字で入力してください'
  }

  if (idImageError) {
    errors.id_image = idImageError
  }

  return errors
}

export async function updateProfileAction(
  _prev: ProfileUpdateState | undefined,
  formData: FormData
): Promise<ProfileUpdateState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('id_image_url, identity_verified')
    .eq('id', user.id)
    .maybeSingle()

  const current = currentProfile as CurrentProfile | null
  const errors = validateProfile(formData, Boolean(current?.id_image_url))
  if (Object.keys(errors).length > 0) {
    return { errors }
  }

  const email = value(formData, 'email')
  const password = String(formData.get('password') ?? '')
  const authUpdates: { email?: string; password?: string } = {}

  if (email && email !== user.email) authUpdates.email = email
  if (password) authUpdates.password = password

  if (Object.keys(authUpdates).length > 0) {
    const { error: authError } = await supabase.auth.updateUser(authUpdates)
    if (authError) {
      return {
        error: `アカウント情報の更新に失敗しました: ${authError.message}`,
      }
    }
  }

  let idImageUrl = current?.id_image_url ?? null
  let identityVerified = Boolean(current?.identity_verified)
  const file = formData.get('id_image') as File | null

  if (file && file.size > 0) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const newPath = `${user.id}/id_image.${ext}`
    const admin = createAdminClient()

    if (idImageUrl && idImageUrl !== newPath) {
      await admin.storage.from('identity-images').remove([idImageUrl])
    }

    const { error: uploadError } = await admin.storage
      .from('identity-images')
      .upload(newPath, Buffer.from(await file.arrayBuffer()), {
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

    const { data: existingDoc, error: selectError } = await admin
      .from('identity_documents')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (selectError) {
      return {
        errors: {
          id_image: `書類の記録に失敗しました: ${selectError.message}`,
        },
      }
    }

    const docPayload = {
      user_id: user.id,
      storage_path: newPath,
      document_type: value(formData, 'id_type') || null,
      status: 'pending',
      uploaded_at: new Date().toISOString(),
      reviewed_at: null,
      reviewed_by: null,
      deleted_at: null,
    }

    const { error: docError } = existingDoc
      ? await admin.from('identity_documents').update(docPayload).eq('id', existingDoc.id)
      : await admin.from('identity_documents').insert(docPayload)

    if (docError) {
      return {
        errors: {
          id_image: `書類の記録に失敗しました: ${docError.message}`,
        },
      }
    }

    idImageUrl = newPath
    identityVerified = false
  }

  const y = value(formData, 'birthday_year')
  const m = value(formData, 'birthday_month')
  const d = value(formData, 'birthday_day')
  const birthday =
    y && m && d
      ? `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
      : null

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: user.id,
    last_name: value(formData, 'last_name'),
    first_name: '',
    last_name_kana: value(formData, 'last_name_kana'),
    first_name_kana: '',
    birthday,
    gender: value(formData, 'gender'),
    occupation: value(formData, 'occupation'),
    is_qualified_invoice: formData.get('is_qualified_invoice') === 'true',
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
    return {
      error:
        '会員情報の保存に失敗しました。もう一度お試しください。',
    }
  }

  revalidatePath('/mypage/profile')
  revalidatePath('/cart')

  return { success: '保存しました' }
}
