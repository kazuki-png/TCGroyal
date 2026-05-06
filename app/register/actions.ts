'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_ID_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_ID_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
])

export type RegisterState = {
  errors?: Record<string, string>
  error?: string
}

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? '').trim()
}

function validateIdImage(file: File | null) {
  if (!file || file.size === 0) {
    return '身分証画像をアップロードしてください'
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

export async function registerAction(
  _prev: RegisterState | undefined,
  formData: FormData
): Promise<RegisterState> {
  const admin = createAdminClient()
  const email = value(formData, 'email')
  const password = String(formData.get('password') ?? '')
  const file = formData.get('id_image') as File | null
  const imageError = validateIdImage(file)

  if (imageError) {
    return { errors: { id_image: imageError } }
  }

  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

  if (authError || !authData.user) {
    const message = authError?.message ?? ''
    if (message.toLowerCase().includes('already')) {
      return { error: 'このメールアドレスはすでに登録されています' }
    }
    return { error: `ユーザー登録に失敗しました: ${message}` }
  }

  const userId = authData.user.id
  let idImageUrl: string | null = null

  if (file && file.size > 0) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${userId}/id_image.${ext}`
    const { error: uploadError } = await admin.storage
      .from('identity-images')
      .upload(path, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type || 'image/jpeg',
        upsert: true,
      })

    if (uploadError) {
      await admin.auth.admin.deleteUser(userId)
      return {
        errors: {
          id_image: `身分証画像のアップロードに失敗しました: ${uploadError.message}`,
        },
      }
    }

    idImageUrl = path
  }

  const y = value(formData, 'birthday_year')
  const m = value(formData, 'birthday_month')
  const d = value(formData, 'birthday_day')
  const birthday =
    y && m && d
      ? `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
      : null

  const { error: profileError } = await admin.from('profiles').upsert({
    id: userId,
    email,
    last_name: value(formData, 'last_name'),
    first_name: value(formData, 'first_name'),
    last_name_kana: value(formData, 'last_name_kana'),
    first_name_kana: value(formData, 'first_name_kana'),
    birthday,
    gender: value(formData, 'gender'),
    occupation: value(formData, 'occupation') || null,
    is_qualified_invoice: formData.get('is_qualified_invoice') === 'true',
    id_type: value(formData, 'id_type'),
    id_image_url: idImageUrl,
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
    await admin.auth.admin.deleteUser(userId)
    return {
      error:
        'プロフィールの保存に失敗しました。もう一度お試しください。',
    }
  }

  redirect('/login?registered=1')
}
