'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
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

export async function setIdentityStatus(userId: string, verified: boolean) {
  await requireAdmin()

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ identity_verified: verified })
    .eq('id', userId)

  if (error) return { error: '本人確認ステータスの更新に失敗しました' }

  revalidatePath('/admin/users')
  revalidatePath('/mypage/profile')
  return {}
}
