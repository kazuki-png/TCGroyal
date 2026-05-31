'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isAdminHostAllowedFromHeaders } from '@/lib/admin/serverHostAccess'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  if (!(await isAdminHostAllowedFromHeaders())) {
    redirect('/')
  }

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

  return user
}

export async function setIdentityStatus(userId: string, verified: boolean) {
  const adminUser = await requireAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('profiles')
    .update({ identity_verified: verified })
    .eq('id', userId)

  if (error) return { error: '本人確認ステータスの更新に失敗しました' }

  // identity_documents のステータスを同期し、閲覧ログを記録する
  const { data: doc } = await admin
    .from('identity_documents')
    .select('id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (doc) {
    await admin
      .from('identity_documents')
      .update({
        status: verified ? 'verified' : 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUser.id,
      })
      .eq('id', doc.id)

    await admin.from('identity_document_access_logs').insert({
      document_id: doc.id,
      accessed_by: adminUser.id,
      action: verified ? 'verify' : 'reject',
    })
  }

  revalidatePath('/admin/users')
  revalidatePath('/mypage/profile')
  return {}
}
