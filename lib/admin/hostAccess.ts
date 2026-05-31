export const ADMIN_ALLOWED_HOSTS_ENV = 'ADMIN_ALLOWED_HOSTS'

type NormalizedHost = {
  host: string
  hostname: string
  hasPort: boolean
}

function hasProtocol(value: string) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value)
}

function firstHeaderValue(value: string | null | undefined) {
  return value?.split(',')[0]?.trim() ?? ''
}

function normalizeHostname(hostname: string) {
  return hostname.trim().toLowerCase().replace(/\.$/, '')
}

export function normalizeAdminHost(
  value: string | null | undefined
): NormalizedHost | null {
  const raw = firstHeaderValue(value)
  if (!raw) return null

  const candidate = hasProtocol(raw) ? raw : `https://${raw.replace(/^\/\//, '')}`

  try {
    const url = new URL(candidate)
    const hostname = normalizeHostname(url.hostname)
    if (!hostname) return null

    return {
      host: url.port ? `${hostname}:${url.port}` : hostname,
      hostname,
      hasPort: Boolean(url.port),
    }
  } catch {
    return null
  }
}

export function getConfiguredAdminHosts(
  allowedHostsValue = process.env[ADMIN_ALLOWED_HOSTS_ENV]
) {
  return (allowedHostsValue ?? '')
    .split(',')
    .map((value) => normalizeAdminHost(value))
    .filter((host): host is NormalizedHost => Boolean(host))
}

export function hasAdminHostRestriction(
  allowedHostsValue = process.env[ADMIN_ALLOWED_HOSTS_ENV]
) {
  return (allowedHostsValue ?? '').split(',').some((value) => value.trim())
}

export function isAdminHostAllowed(
  requestHostValue: string | null | undefined,
  allowedHostsValue = process.env[ADMIN_ALLOWED_HOSTS_ENV]
) {
  if (!hasAdminHostRestriction(allowedHostsValue)) {
    return true
  }

  const requestHost = normalizeAdminHost(requestHostValue)
  if (!requestHost) return false

  const allowedHosts = getConfiguredAdminHosts(allowedHostsValue)
  if (allowedHosts.length === 0) return false

  return allowedHosts.some((allowedHost) =>
    allowedHost.hasPort
      ? requestHost.host === allowedHost.host
      : requestHost.hostname === allowedHost.hostname
  )
}

export function getRequestHostFromHeaders(headers: Pick<Headers, 'get'>) {
  return headers.get('host') ?? headers.get('x-forwarded-host')
}

export function getRequestHostFromRequest(request: Request) {
  const headerHost = getRequestHostFromHeaders(request.headers)
  if (headerHost) return headerHost

  try {
    return new URL(request.url).host
  } catch {
    return null
  }
}

export function isAdminHostAllowedForRequest(request: Request) {
  return isAdminHostAllowed(getRequestHostFromRequest(request))
}

export function isAdminPagePathname(pathname: string) {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

export function isAdminApiPathname(pathname: string) {
  return pathname === '/api/admin' || pathname.startsWith('/api/admin/')
}
