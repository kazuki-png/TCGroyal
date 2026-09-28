import 'server-only'

import { checkSharedRateLimit } from './sharedRateLimit'
import { headers } from 'next/headers'
import {
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
  return checkSharedRateLimit(
    scope,
    getClientIpFromHeaders(requestHeaders),
    options
  )
}
