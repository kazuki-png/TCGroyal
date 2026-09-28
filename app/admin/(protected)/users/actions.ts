'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdminUser } from '@/lib/admin/authorization'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkServerActionRateLimit } from '@/lib/security/serverRateLimit'

async function requireAdmin() {
  const rateLimit = await checkServerActionRateLimit('action:admin-mutation', { limit: 300, windowMs: 60000 })
  if (!rateLimit.allowed) redirect('/admin')
  return requireAdminUser(true)
}

export async function setIdentityStatus(userId: string, verified: boolean) {
  const adminUser = await requireAdmin()
  const admin = createAdminClient()

  if (typeof verified !== 'boolean') return { error: '不正なステータスです' }
  const { error } = await admin.rpc('review_identity_document', { p_user_id: userId, p_reviewer: adminUser.id, p_verified: verified })
  if (error) return { error: '本人確認ステータスを更新できません。書類を確認してください' }

  revalidatePath('/admin/users')
  revalidatePath('/mypage/profile')
  return {}
}
