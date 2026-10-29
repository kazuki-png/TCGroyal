import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isLocalLendingEnabled, isLoopbackRequest, isPreviewLendingEnabled } from './local-config'
import { readPreviewActor } from './preview-session'
import { verifyFirebasePhone } from './firebase-auth'
import { createWorkflowClient } from './workflow-client'
import { readSupabaseLendingActor } from './supabase-auth'
import { isAdministrativeRole } from '@/lib/admin/roles'

export const DEMO_CUSTOMER_ID = '10000000-0000-4000-8000-000000000001'
export const DEMO_ADMIN_ID = '10000000-0000-4000-8000-000000000002'

export interface WorkflowActor { id:string; role:'admin'|'customer'; demo:boolean; authProvider?:'supabase'|'firebase'|'fixture'; email?:string }
export async function getWorkflowActor(request: Request):Promise<WorkflowActor|null> {
  if (isPreviewLendingEnabled()) {
    const fixture=readPreviewActor(request)
    if(fixture)return fixture
    const token=request.headers.get('authorization')?.match(/^Bearer ([\w.-]+)$/)?.[1]
    if(!token||token.length>10000||token.split('.').length!==3)return null
    const supabase = await readSupabaseLendingActor(token)
    if (supabase) return supabase
    try {
      const verified=await verifyFirebasePhone(token)
      const {data,error}=await createWorkflowClient().from('lending_firebase_accounts').select('user_id,phone')
        .eq('subject_hash',verified.subjectHash).eq('user_id',verified.userId).maybeSingle()
      if(error||!data||data.phone!==verified.phone)return null
      return {id:data.user_id as string,role:'customer',demo:true} as const
    }catch{return null}
  }
  // Must run BEFORE constructing any database client or authenticating.
  if (!isLocalLendingEnabled() || !isLoopbackRequest(request.url)
    || !isLoopbackRequest(`http://${request.headers.get('host') ?? new URL(request.url).host}`)) return null
  const demo = process.env.LENDING_LOCAL_DEMO === 'true'
  if (demo) {
    const role = request.headers.get('x-lending-demo-role') === 'admin' ? 'admin' : 'customer'
    return { id: role === 'admin' ? DEMO_ADMIN_ID : DEMO_CUSTOMER_ID, role, demo } as const
  }
  const client = await createClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) return null
  const { data } = await createAdminClient().from('admin_users').select('role').eq('id', user.id).maybeSingle()
  return { id: user.id, role: isAdministrativeRole(data?.role) ? 'admin' : 'customer', demo } as const
}
