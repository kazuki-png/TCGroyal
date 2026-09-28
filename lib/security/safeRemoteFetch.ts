import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_MAX_REDIRECTS = 3
const globalIpv6 = new BlockList()
globalIpv6.addSubnet('2000::', 3, 'ipv6')
const specialIpv6 = new BlockList()
specialIpv6.addSubnet('2001::', 23, 'ipv6')
specialIpv6.addSubnet('2001:db8::', 32, 'ipv6')
specialIpv6.addSubnet('2002::', 16, 'ipv6')
specialIpv6.addSubnet('3fff::', 20, 'ipv6')

type FetchPublicUrlOptions = RequestInit & {
  maxRedirects?: number
  maxBytes?: number
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
    // Restrict to global unicast, excluding transition/documentation ranges.
    // BlockList normalizes expanded IPv6 and hexadecimal IPv4-mapped forms.
    return !globalIpv6.check(normalized, 'ipv6') || specialIpv6.check(normalized, 'ipv6')
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

export async function assertPublicRemoteUrl(url: URL, timeoutMs = DEFAULT_TIMEOUT_MS) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only HTTP(S) URLs are allowed')
  }

  if (url.username || url.password) {
    throw new Error('URLs with embedded credentials are not allowed')
  }

  if (isBlockedHostname(url.hostname)) {
    throw new Error('Private or internal hostnames are not allowed')
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  const records = await Promise.race([
    lookup(url.hostname, { all: true, verbatim: true }),
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('DNS resolution timeout')), Math.max(1, timeoutMs)) }),
  ]).finally(() => clearTimeout(timer))
  if (records.length === 0) {
    throw new Error('URL hostname could not be resolved')
  }

  if (records.some((record) => isBlockedIpAddress(record.address))) {
    throw new Error('Private or internal IP addresses are not allowed')
  }
  return records[0]
}

export async function fetchPublicRemoteUrl(initialUrl: URL, options: FetchPublicUrlOptions = {}) {
  const { maxRedirects = DEFAULT_MAX_REDIRECTS, timeoutMs = DEFAULT_TIMEOUT_MS, maxBytes = 5 * 1024 * 1024 } = options
  let url = initialUrl
  const deadline = Date.now() + timeoutMs
  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    const address = await assertPublicRemoteUrl(url, deadline - Date.now())
    const remaining = deadline - Date.now()
    if (remaining <= 0) throw new Error('Remote image timeout')
    // Connect to the validated address, while preserving TLS certificate validation and Host.
    const response = await new Promise<Response>((resolve, reject) => {
      const transport = url.protocol === 'https:' ? httpsRequest : httpRequest
      const request = transport({ hostname: address.address, family: address.family, servername: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80), path: url.pathname + url.search, method: 'GET', headers: { ...Object.fromEntries(new Headers(options.headers).entries()), host: url.host } }, res => {
        const chunks: Buffer[] = []
        let bytes = 0
        const length = Number(res.headers['content-length'])
        if (Number.isFinite(length) && length > maxBytes) { request.destroy(new Error('Remote image too large')); res.destroy(); return }
        res.on('data', (chunk: Buffer) => { bytes += chunk.length; if (bytes > maxBytes) { request.destroy(new Error('Remote image too large')); res.destroy() } else chunks.push(chunk) })
        res.on('error', reject)
        res.on('end', () => {
          clearTimeout(timer)
          const headers = new Headers()
          for (const [key, value] of Object.entries(res.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
          resolve(new Response([204, 205, 304].includes(res.statusCode ?? 200) ? null : new Uint8Array(Buffer.concat(chunks)), { status: res.statusCode ?? 502, headers }))
        })
      })
      const timer = setTimeout(() => request.destroy(new Error('Remote image timeout')), remaining)
      request.on('error', error => { clearTimeout(timer); reject(error) })
      request.end()
    })
    if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
      if (redirectCount === maxRedirects) throw new Error('Too many redirects')
      url = new URL(response.headers.get('location')!, url)
      continue
    }
    return response
  }
  throw new Error('Too many redirects')
}
