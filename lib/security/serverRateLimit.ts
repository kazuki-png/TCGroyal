import 'server-only'

import { headers } from 'next/headers'
import {
  checkRateLimit,
  getClientIpFromHeaders,
  type RateLimitResult,
} from '@/lib/security/rateLimit'

type ServerActionRateLimitOptions = {
  limit: number
  windowMs: number
}

export async function checkServerActionRateLimit(
  scope: string,
  options: ServerActionRateLimitOptions
): Promise<RateLimitResult> {
  const requestHeaders = await headers()
  return checkRateLimit(
    scope,
    getClientIpFromHeaders(requestHeaders),
    options
  )
}
