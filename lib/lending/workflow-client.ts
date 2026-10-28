import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { isLocalLendingEnabled, isPreviewLendingEnabled } from './local-config'
import { createHmac } from 'node:crypto'
import { checkSharedRateLimit } from '@/lib/security/sharedRateLimit'
import type { RateLimitResult } from '@/lib/security/rateLimit'

export function createWorkflowClient() {
  if (isPreviewLendingEnabled()) return createClient(
    process.env.LENDING_PREVIEW_SUPABASE_URL!, process.env.LENDING_PREVIEW_SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  if (isLocalLendingEnabled()) return createAdminClient()
  throw Error('Lending environment is disabled')
}
export async function checkWorkflowRateLimit(scope: string, identifier: string, options: { limit: number; windowMs: number }): Promise<RateLimitResult> {
  if (isLocalLendingEnabled()) return checkSharedRateLimit(scope, identifier, options)
  const denied: RateLimitResult = { allowed: false, limit: options.limit, remaining: 0, resetAt: Date.now() + options.windowMs, retryAfterSeconds: Math.ceil(options.windowMs / 1000) }
  if (!isPreviewLendingEnabled()) return denied
  const key = createHmac('sha256', process.env.LENDING_PREVIEW_SESSION_SECRET!).update(`${scope}:${identifier}`).digest('hex')
  try {
    const { data, error } = await createWorkflowClient().rpc('consume_security_rate_limit', { p_key: key, p_limit: options.limit, p_window_ms: options.windowMs })
    return error || !data ? denied : { ...denied, allowed: data.allowed, remaining: data.remaining, resetAt: data.reset_at,
      retryAfterSeconds: Math.max(1, Math.ceil((data.reset_at - Date.now()) / 1000)) }
  } catch { return denied }
}
