import 'server-only'
import { redirect } from 'next/navigation'
import { isAdminHostAllowedFromHeaders } from './serverHostAccess'
import { createClient } from '@/lib/supabase/server'

export async function getAdminAccess(kyc = false) {
  if (!(await isAdminHostAllowedFromHeaders())) return null
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user || !user.email_confirmed_at) return null
  const { data: row } = await supabase.from('admin_users').select('id, role').eq('id', user.id).maybeSingle()
  if (!row || (kyc && row.role !== 'kyc_reviewer')) return null
  return { user, supabase, role: row.role as string }
}

export async function requireAdminUser(kyc = false) {
  const access = await getAdminAccess(kyc)
  if (access) return access.user
  redirect('/admin/login')
}
