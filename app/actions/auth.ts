'use server'

import { redirect } from 'next/navigation'
import { isAdminHostAllowedFromHeaders } from '@/lib/admin/serverHostAccess'
import { createClient } from '@/lib/supabase/server'
import { checkServerActionRateLimit } from '@/lib/security/serverRateLimit'

export async function login(
  _prevState: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const rateLimit = await checkServerActionRateLimit('action:login', {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  })
  if (!rateLimit.allowed) {
    return { error: 'ログイン試行が多すぎます。しばらく待ってから再度お試しください' }
  }

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'メールアドレスまたはパスワードが正しくありません' }
  }

  redirect('/mypage')
}

export async function adminLogin(
  _prevState: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const rateLimit = await checkServerActionRateLimit('action:admin-login', {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  })
  if (!rateLimit.allowed) {
    return { error: 'ログイン試行が多すぎます。しばらく待ってから再度お試しください' }
  }

  if (!(await isAdminHostAllowedFromHeaders())) {
    return { error: 'このドメインからは管理画面にアクセスできません' }
  }

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.user) {
    return { error: 'メールアドレスまたはパスワードが正しくありません' }
  }

  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', data.user.id)
    .single()

  if (!adminRow) {
    await supabase.auth.signOut()
    return { error: '管理者権限がありません' }
  }

  redirect('/admin')
}

export async function register(
  _prevState: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const lastName = formData.get('last_name') as string
  const firstName = formData.get('first_name') as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { last_name: lastName, first_name: firstName },
    },
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/mypage')
}

export async function logout(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function adminLogout(): Promise<void> {
  if (!(await isAdminHostAllowedFromHeaders())) {
    redirect('/')
  }

  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/admin/login')
}
