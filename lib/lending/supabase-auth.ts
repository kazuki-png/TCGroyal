import 'server-only'
import { createWorkflowClient } from './workflow-client'
import { isAdministrativeRole } from '@/lib/admin/roles'

// Pin verification to the same database used by the lending workflow. Never
// accept client-supplied IDs or user_metadata as an authorization decision.
export async function readSupabaseLendingActor(token: string) {
  try {
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    if (claims.iss !== `${process.env.LENDING_PREVIEW_SUPABASE_URL}/auth/v1`) return null
    const db = createWorkflowClient()
    const { data: { user }, error } = await db.auth.getUser(token)
    if (error || !user || user.is_anonymous || user.role !== 'authenticated' || !user.email_confirmed_at
      || !/^[a-f0-9-]{36}$/i.test(user.id)) return null
    if (user.factors?.some(factor => factor.status === 'verified')) {
      if (claims.aal !== 'aal2') return null;
    }
    const admin = await db.from('admin_users').select('role').eq('id', user.id).maybeSingle()
    if (admin.error) return null
    return { id: user.id, role: isAdministrativeRole(admin.data?.role) ? 'admin' : 'customer', demo: false, authProvider: 'supabase', email: user.email ?? '' } as const
  } catch { return null }
}
