import 'server-only'
import { createHmac } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, getClientIpFromHeaders, type RateLimitResult } from './rateLimit'
export { rateLimitResponse } from './rateLimit'

export async function checkSharedRateLimit(scope: string, identifier: string, options: { limit: number; windowMs: number }): Promise<RateLimitResult> {
  if (process.env.NODE_ENV === 'test') return checkRateLimit(scope, identifier, options)
  const denied = { allowed: false, limit: options.limit, remaining: 0, resetAt: Date.now() + options.windowMs, retryAfterSeconds: Math.ceil(options.windowMs / 1000) }
  try {
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!secret) return denied
    const key = createHmac('sha256', secret).update(`${scope}:${identifier}`).digest('hex')
    const { data, error } = await createAdminClient().rpc('consume_security_rate_limit', { p_key: key, p_limit: options.limit, p_window_ms: options.windowMs })
    if (error || !data) return denied
    return { ...denied, allowed: data.allowed, remaining: data.remaining, resetAt: data.reset_at, retryAfterSeconds: Math.max(1, Math.ceil((data.reset_at - Date.now()) / 1000)) }
  } catch { return denied }
}

export function checkRequestRateLimit(request: Request, scope: string, options: { limit: number; windowMs: number }) {
  return checkSharedRateLimit(scope, getClientIpFromHeaders(request.headers), options)
}
