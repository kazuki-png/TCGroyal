type RateLimitBucket = {
  count: number
  resetAt: number
}

type RateLimitOptions = {
  limit: number
  windowMs: number
}

export type RateLimitResult = {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
  retryAfterSeconds: number
}

declare global {
  var __tcgRoyalRateLimitStore: Map<string, RateLimitBucket> | undefined
}

const store = globalThis.__tcgRoyalRateLimitStore ?? new Map<string, RateLimitBucket>()
globalThis.__tcgRoyalRateLimitStore = store

function cleanupExpiredBuckets(now: number) {
  if (store.size < 1000) return

  for (const [key, bucket] of store.entries()) {
    if (bucket.resetAt <= now) {
      store.delete(key)
    }
  }
}

export function firstHeaderValue(value: string | null | undefined) {
  return value?.split(',')[0]?.trim() || null
}

export function getClientIpFromHeaders(headers: Pick<Headers, 'get'>) {
  return (
    firstHeaderValue(headers.get('x-forwarded-for')) ??
    firstHeaderValue(headers.get('x-real-ip')) ??
    firstHeaderValue(headers.get('cf-connecting-ip')) ??
    'unknown'
  )
}

export function checkRateLimit(
  scope: string,
  identifier: string,
  { limit, windowMs }: RateLimitOptions
): RateLimitResult {
  const now = Date.now()
  cleanupExpiredBuckets(now)

  const key = `${scope}:${identifier}`
  const existing = store.get(key)
  const bucket =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + windowMs }

  bucket.count += 1
  store.set(key, bucket)

  const remaining = Math.max(0, limit - bucket.count)
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((bucket.resetAt - now) / 1000)
  )

  return {
    allowed: bucket.count <= limit,
    limit,
    remaining,
    resetAt: bucket.resetAt,
    retryAfterSeconds,
  }
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    'Retry-After': String(result.retryAfterSeconds),
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  }
}

export function rateLimitResponse(result: RateLimitResult) {
  return Response.json(
    { error: 'Too many requests' },
    {
      status: 429,
      headers: rateLimitHeaders(result),
    }
  )
}

export function checkRequestRateLimit(
  request: Request,
  scope: string,
  options: RateLimitOptions
) {
  return checkRateLimit(scope, getClientIpFromHeaders(request.headers), options)
}
