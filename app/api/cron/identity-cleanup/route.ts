import { createAdminClient } from '@/lib/supabase/admin'
import { ownsIdentityPath } from '@/lib/identity/documents'
export const runtime = 'nodejs'
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  const { data: jobs, error } = await admin.rpc('claim_identity_cleanup_jobs')
  if (error) return Response.json({ error: 'Cleanup unavailable' }, { status: 503 })
  let failures = 0
  for (const job of jobs ?? []) {
    if (!ownsIdentityPath(job.user_id, job.storage_path)) { failures++; continue }
    const { error: removeError } = await admin.storage.from('identity-images').remove([job.storage_path])
    if (removeError) { failures++; continue }
    const { error: finishError } = await admin.from('identity_cleanup_jobs').delete().eq('id', job.id).eq('claimed_at', job.claimed_at)
    if (finishError) failures++
  }
  await admin.from('security_rate_limits').delete().lt('reset_at', new Date(Date.now() - 86400000).toISOString())
  return Response.json({ processed: (jobs ?? []).length, failures }, { status: failures ? 503 : 200, headers: { 'Cache-Control': 'no-store' } })
}
