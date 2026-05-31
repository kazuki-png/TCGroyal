'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { checkServerActionRateLimit } from '@/lib/security/serverRateLimit'

function safeLoginDestination(value: string) {
  if (!value.startsWith('/') || value.startsWith('//')) {
    return '/mypage'
  }

  const pathname = value.split('?')[0]
  if (pathname === '/login' || pathname === '/register') {
    return '/mypage'
  }

  return value
}

export async function loginAction(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const rateLimit = await checkServerActionRateLimit('action:login', {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  })
  if (!rateLimit.allowed) {
    return { error: 'ログイン試行が多すぎます。しばらく待ってから再度お試しください' }
  }

  const email = (formData.get('email') as string).trim()
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'メールアドレスまたはパスワードが正しくありません' }
  }

  const next = (formData.get('next') as string | null)?.trim() ?? ''
  redirect(safeLoginDestination(next))
}
