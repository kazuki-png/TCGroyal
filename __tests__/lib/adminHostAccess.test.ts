import { describe, expect, it } from 'vitest'
import {
  isAdminApiPathname,
  isAdminHostAllowed,
  isAdminPagePathname,
  normalizeAdminHost,
} from '@/lib/admin/hostAccess'

describe('admin host access', () => {
  it('allows all hosts when ADMIN_ALLOWED_HOSTS is not configured', () => {
    expect(isAdminHostAllowed('example.com', '')).toBe(true)
  })

  it('allows exact configured hostnames regardless of case', () => {
    expect(isAdminHostAllowed('Admin.Example.com', 'admin.example.com')).toBe(true)
  })

  it('rejects hosts that are not configured', () => {
    expect(isAdminHostAllowed('www.example.com', 'admin.example.com')).toBe(false)
  })

  it('supports comma-separated hosts and URL-form values', () => {
    expect(
      isAdminHostAllowed(
        'staff.example.com',
        'https://admin.example.com, staff.example.com/admin'
      )
    ).toBe(true)
  })

  it('requires an exact port when the configured host includes one', () => {
    expect(isAdminHostAllowed('localhost:3000', 'localhost:3000')).toBe(true)
    expect(isAdminHostAllowed('localhost:4000', 'localhost:3000')).toBe(false)
  })

  it('uses the first forwarded host header value', () => {
    expect(
      isAdminHostAllowed(
        'admin.example.com, proxy.internal',
        'admin.example.com'
      )
    ).toBe(true)
  })

  it('normalizes hostnames and strips trailing dots', () => {
    expect(normalizeAdminHost('https://Admin.Example.com./admin')).toMatchObject({
      host: 'admin.example.com',
      hostname: 'admin.example.com',
      hasPort: false,
    })
  })
})

describe('admin pathname helpers', () => {
  it('matches admin pages without matching similarly-prefixed public paths', () => {
    expect(isAdminPagePathname('/admin')).toBe(true)
    expect(isAdminPagePathname('/admin/login')).toBe(true)
    expect(isAdminPagePathname('/administrator')).toBe(false)
  })

  it('matches admin API paths', () => {
    expect(isAdminApiPathname('/api/admin/cards/import')).toBe(true)
    expect(isAdminApiPathname('/api/administrator')).toBe(false)
  })
})
