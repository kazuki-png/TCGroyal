// Local development requires a loopback database. Hosted Preview is gated separately.
export function isLocalLendingEnabled(env: Record<string, string | undefined> = process.env) {
  if (env.LENDING_WORKFLOW_ENABLED !== 'true' || env.NODE_ENV === 'production' || env.VERCEL) return false
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? '')
    return url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      && !url.username && !url.password
  } catch { return false }
}
export function isLoopbackRequest(url: string) {
  try { return ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname) }
  catch { return false }
}

export function isPreviewLendingEnabled(env: Record<string, string | undefined> = process.env) {
  if (env.VERCEL_ENV !== 'preview' || env.LENDING_WORKFLOW_ENABLED !== 'true') return false
  const ref = env.LENDING_PREVIEW_DB_REF ?? ''
  if (!/^[a-z]{20}$/.test(ref) || ['upmodzdzowehzfdquxir', 'beavxtmhwctptgaehvty'].includes(ref)) return false
  return env.LENDING_PREVIEW_SUPABASE_URL === `https://${ref}.supabase.co`
    && !!env.LENDING_PREVIEW_SUPABASE_SERVICE_ROLE_KEY
    && (env.LENDING_PREVIEW_SESSION_SECRET?.length ?? 0) >= 32
    && /^[a-f0-9]{64}$/.test(env.LENDING_PREVIEW_CUSTOMER_CODE_HASH ?? '')
    && /^[a-f0-9]{64}$/.test(env.LENDING_PREVIEW_ADMIN_CODE_HASH ?? '')
    && env.LENDING_PREVIEW_ADMIN_CODE_HASH !== env.LENDING_PREVIEW_CUSTOMER_CODE_HASH
    && /^[a-f0-9-]{36}$/.test(env.LENDING_PREVIEW_CUSTOMER_ID ?? '')
    && /^[a-f0-9-]{36}$/.test(env.LENDING_PREVIEW_ADMIN_ID ?? '')
    && env.LENDING_PREVIEW_CUSTOMER_ID !== env.LENDING_PREVIEW_ADMIN_ID
}

export function isLendingEnabled() { return isLocalLendingEnabled() || isPreviewLendingEnabled() }

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    const parsed = new URL(origin)
    const url = new URL(request.url)
    // Next's local server may normalize request.url to localhost. Host is the
    // browser-facing authority; never trust forwarded-host for this comparison.
    return origin === parsed.origin && parsed.host === (request.headers.get('host') ?? url.host)
      && parsed.protocol === url.protocol
  } catch { return false }
}
