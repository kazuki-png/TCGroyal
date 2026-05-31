import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_MAX_REDIRECTS = 3

type FetchPublicUrlOptions = RequestInit & {
  maxRedirects?: number
  timeoutMs?: number
}

function ipv4ToNumber(address: string) {
  const parts = address.split('.').map((part) => Number.parseInt(part, 10))
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return null
  }

  return parts.reduce((result, part) => result * 256 + part, 0)
}

function isIpv4InCidr(address: string, base: string, prefixLength: number) {
  const value = ipv4ToNumber(address)
  const baseValue = ipv4ToNumber(base)
  if (value === null || baseValue === null) return false

  const mask = prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0
  return (value & mask) === (baseValue & mask)
}

export function isBlockedIpAddress(address: string) {
  const normalized = address.toLowerCase()
  const mappedIpv4 = normalized.startsWith('::ffff:')
    ? normalized.slice('::ffff:'.length)
    : null

  if (mappedIpv4 && isIP(mappedIpv4) === 4) {
    return isBlockedIpAddress(mappedIpv4)
  }

  if (isIP(normalized) === 4) {
    return [
      ['0.0.0.0', 8],
      ['10.0.0.0', 8],
      ['100.64.0.0', 10],
      ['127.0.0.0', 8],
      ['169.254.0.0', 16],
      ['172.16.0.0', 12],
      ['192.0.0.0', 24],
      ['192.0.2.0', 24],
      ['192.168.0.0', 16],
      ['198.18.0.0', 15],
      ['198.51.100.0', 24],
      ['203.0.113.0', 24],
      ['224.0.0.0', 4],
      ['240.0.0.0', 4],
    ].some(([base, prefix]) =>
      isIpv4InCidr(normalized, String(base), Number(prefix))
    )
  }

  if (isIP(normalized) === 6) {
    return (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb') ||
      normalized.startsWith('ff') ||
      normalized.startsWith('2001:db8:')
    )
  }

  return true
}

export function parsePublicHttpUrl(value: string | null | undefined) {
  if (!value) return null

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

export function isBlockedHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, '')
  if (!normalized) return true
  if (isIP(normalized)) return isBlockedIpAddress(normalized)

  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal') ||
    normalized.endsWith('.lan') ||
    !normalized.includes('.')
  )
}

export async function assertPublicRemoteUrl(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only HTTP(S) URLs are allowed')
  }

  if (url.username || url.password) {
    throw new Error('URLs with embedded credentials are not allowed')
  }

  if (isBlockedHostname(url.hostname)) {
    throw new Error('Private or internal hostnames are not allowed')
  }

  const records = await lookup(url.hostname, { all: true, verbatim: true })
  if (records.length === 0) {
    throw new Error('URL hostname could not be resolved')
  }

  if (records.some((record) => isBlockedIpAddress(record.address))) {
    throw new Error('Private or internal IP addresses are not allowed')
  }
}

export async function fetchPublicRemoteUrl(
  initialUrl: URL,
  options: FetchPublicUrlOptions = {}
) {
  const {
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    ...init
  } = options
  let url = initialUrl

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    await assertPublicRemoteUrl(url)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        ...init,
        redirect: 'manual',
        signal: controller.signal,
      })

      if (
        response.status >= 300 &&
        response.status < 400 &&
        response.headers.has('location')
      ) {
        if (redirectCount === maxRedirects) {
          throw new Error('Too many redirects')
        }

        url = new URL(response.headers.get('location')!, url)
        continue
      }

      return response
    } finally {
      clearTimeout(timeout)
    }
  }

  throw new Error('Too many redirects')
}
