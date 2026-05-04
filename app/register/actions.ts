'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

export type RegisterState = {
  errors?: Record<string, string>
  error?: string
}

export async function registerAction(
  _prev: RegisterState | undefined,
  formData: FormData
): Promise<RegisterState> {
  const admin = createAdminClient()

  const email = (formData.get('email') as string).trim()
  const password = formData.get('password') as string

  // Supabase Auth でユーザー作成
  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

  if (authError || !authData.user) {
    const msg = authError?.message ?? ''
    if (msg.toLowerCase().includes('already')) {
      return { error: 'このメールアドレスはすでに登録されています' }
    }
    return { error: `ユーザー登録に失敗しました: ${msg}` }
  }

  const userId = authData.user.id

  // 身分証画像アップロード
  let idImageUrl: string | null = null
  const file = formData.get('id_image') as File | null
  if (file && file.size > 0) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${userId}/id_image.${ext}`
    const { error: uploadError } = await admin.storage
      .from('identity-images')
      .upload(path, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type || 'image/jpeg',
        upsert: true,
      })
    if (!uploadError) {
      idImageUrl = path
    }
  }

  // 生年月日を組み立て
  const y = formData.get('birthday_year') as string
  const m = formData.get('birthday_month') as string
  const d = formData.get('birthday_day') as string
  const birthday =
    y && m && d
      ? `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
      : null

  // profiles upsert
  const { error: profileError } = await admin.from('profiles').upsert({
    id: userId,
    last_name: (formData.get('last_name') as string).trim(),
    first_name: (formData.get('first_name') as string).trim(),
    last_name_kana: (formData.get('last_name_kana') as string).trim(),
    first_name_kana: (formData.get('first_name_kana') as string).trim(),
    birthday,
    gender: formData.get('gender') as string,
    occupation: (formData.get('occupation') as string | null)?.trim() || null,
    is_qualified_invoice: formData.get('is_qualified_invoice') === 'true',
    id_type: formData.get('id_type') as string,
    id_image_url: idImageUrl,
    postal_code: (formData.get('postal_code') as string).trim(),
    address: (formData.get('address') as string).trim(),
    phone: (formData.get('phone') as string).trim(),
    bank_name: (formData.get('bank_name') as string).trim(),
    branch_name: (formData.get('branch_name') as string).trim(),
    account_type: formData.get('account_type') as string,
    account_number: (formData.get('account_number') as string).trim(),
    account_holder_kana: (formData.get('account_holder_kana') as string).trim(),
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(userId)
    return { error: 'プロフィールの保存に失敗しました。もう一度お試しください' }
  }

  redirect('/login?registered=1')
}
