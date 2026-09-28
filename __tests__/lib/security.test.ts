import { describe, expect, it } from 'vitest'
import { checkRateLimit, firstHeaderValue } from '@/lib/security/rateLimit'
import {
  isBlockedHostname,
  isBlockedIpAddress,
  parsePublicHttpUrl,
} from '@/lib/security/safeRemoteFetch'

describe('safe remote fetch guards', () => {
  it.each(['::ffff:7f00:1', '0:0:0:0:0:ffff:7f00:1', '0:0:0:0:0:0:0:1', '64:ff9b::7f00:1', '2002:7f00:1::'])('blocks encoded or translated local addresses %s', address => {
    expect(isBlockedIpAddress(address)).toBe(true)
  })
  it('allows global IPv6', () => expect(isBlockedIpAddress('2606:4700:4700::1111')).toBe(false))
  it('blocks private and metadata IPv4 ranges', () => {
    expect(isBlockedIpAddress('127.0.0.1')).toBe(true)
    expect(isBlockedIpAddress('10.0.0.1')).toBe(true)
    expect(isBlockedIpAddress('172.16.0.1')).toBe(true)
    expect(isBlockedIpAddress('192.168.1.10')).toBe(true)
    expect(isBlockedIpAddress('169.254.169.254')).toBe(true)
  })

  it('allows public IPs', () => {
    expect(isBlockedIpAddress('8.8.8.8')).toBe(false)
    expect(isBlockedIpAddress('1.1.1.1')).toBe(false)
  })

  it('blocks local hostnames and single-label names', () => {
    expect(isBlockedHostname('localhost')).toBe(true)
    expect(isBlockedHostname('service.internal')).toBe(true)
    expect(isBlockedHostname('intranet')).toBe(true)
  })

  it('parses only HTTP(S) URLs', () => {
    expect(parsePublicHttpUrl('https://example.com/image.png')?.hostname).toBe(
      'example.com'
    )
    expect(parsePublicHttpUrl('ftp://example.com/image.png')).toBeNull()
  })
})

describe('rate limiting', () => {
  it('limits repeated requests within a window', () => {
    const scope = `test:${crypto.randomUUID()}`

    expect(
      checkRateLimit(scope, '127.0.0.1', { limit: 2, windowMs: 60_000 })
        .allowed
    ).toBe(true)
    expect(
      checkRateLimit(scope, '127.0.0.1', { limit: 2, windowMs: 60_000 })
        .allowed
    ).toBe(true)
    expect(
      checkRateLimit(scope, '127.0.0.1', { limit: 2, windowMs: 60_000 })
        .allowed
    ).toBe(false)
  })

  it('uses the first forwarded header value', () => {
    expect(firstHeaderValue('203.0.113.10, 10.0.0.1')).toBe('203.0.113.10')
  })
})
