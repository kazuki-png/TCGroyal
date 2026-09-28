'use server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSignupConfirmationEmail } from '@/lib/email/send'
import { logSafeError } from '@/lib/security/logging'
import { checkServerActionRateLimit } from '@/lib/security/serverRateLimit'

export type RegisterState = { errors?: Record<string, string>; error?: string; success?: string }
const schema = z.object({ email: z.email().max(254), password: z.string().min(12).max(128) })
export async function registerAction(_prev: RegisterState | undefined, formData: FormData): Promise<RegisterState> {
  const limit = await checkServerActionRateLimit('action:register', { limit: 5, windowMs: 3600000 })
  if (!limit.allowed) return { error: '登録が多すぎます。時間をおいて再試行してください' }
  const parsed = schema.safeParse({ email: String(formData.get('email') ?? '').trim(), password: formData.get('password') })
  if (!parsed.success) return { error: 'メールアドレスと12文字以上のパスワードを入力してください' }
  if (parsed.data.password !== formData.get('password_confirm')) return { error: 'パスワードが一致しません' }
  const origin = process.env.NEXT_PUBLIC_SITE_URL
  if (!origin || (process.env.NODE_ENV === 'production' && !origin.startsWith('https://'))) return { error: '登録設定を確認中です。時間をおいて再試行してください' }
  // Fail closed if email confirmation is disabled in the Auth project.
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! }, cache: 'no-store', signal: AbortSignal.timeout(5000) })
    if (!response.ok || (await response.json()).mailer_autoconfirm !== false) return { error: '登録設定を確認中です。時間をおいて再試行してください' }
  } catch { return { error: '登録サービスに接続できません。時間をおいて再試行してください' } }
  try {
    // Use the existing transactional mail provider. Never confirm the account here.
    const { data, error } = await createAdminClient().auth.admin.generateLink({ type: 'signup', ...parsed.data })
    if (error && error.code !== 'email_exists' && error.code !== 'user_already_exists') throw new Error('signup')
    if (!error && data?.properties?.hashed_token && !data.user.email_confirmed_at) {
      const confirmation = new URL('/auth/confirm', origin)
      confirmation.searchParams.set('token_hash', data.properties.hashed_token)
      confirmation.searchParams.set('type', 'signup')
      confirmation.searchParams.set('next', '/mypage/profile')
      if (!await sendSignupConfirmationEmail(parsed.data.email, confirmation.toString())) throw new Error('mail')
    }
  } catch {
    logSafeError('Signup confirmation failed')
    return { error: '登録を受け付けられませんでした。時間をおいて再試行してください' }
  }
  return { success: '確認メールを送信しました。メール内のリンクを開き、ログイン後に会員情報と本人確認書類を登録してください。登録済みの場合はログインしてください。' }
}
