'use server'

import { createClient } from '@/lib/supabase/server'

export type ForgotPasswordState = {
  error?: string
  success?: boolean
}

export async function forgotPasswordAction(
  _prev: ForgotPasswordState | undefined,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = (formData.get('email') as string).trim()

  if (!email) {
    return { error: 'メールアドレスを入力してください' }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/auth/update-password`,
  })

  if (error) {
    return { error: 'メールの送信に失敗しました。しばらく経ってから再試行してください' }
  }

  return { success: true }
}
