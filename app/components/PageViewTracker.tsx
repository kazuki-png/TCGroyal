'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const SESSION_KEY = 'tcg_royal_pv_session_id'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30
const EXCLUDED_PREFIXES = ['/admin', '/api', '/_next']
const ASSET_PATH_PATTERN = /\.(?:png|jpe?g|gif|webp|svg|ico|css|js|map|txt|xml|json)$/i

function createSessionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
}

function getSessionId() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { id?: unknown; expiresAt?: unknown }
        if (
          typeof parsed.id === 'string' &&
          typeof parsed.expiresAt === 'number' &&
          parsed.expiresAt > Date.now()
        ) {
          return parsed.id
        }
      } catch {
        if (/^[a-zA-Z0-9_-]{12,96}$/.test(raw)) {
          window.localStorage.setItem(
            SESSION_KEY,
            JSON.stringify({ id: raw, expiresAt: Date.now() + SESSION_TTL_MS })
          )
          return raw
        }
      }
    }

    const next = createSessionId()
    window.localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ id: next, expiresAt: Date.now() + SESSION_TTL_MS })
    )
    return next
  } catch {
    return createSessionId()
  }
}

function shouldIgnorePath(pathname: string) {
  return (
    EXCLUDED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||
    ASSET_PATH_PATTERN.test(pathname)
  )
}

export function PageViewTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname || shouldIgnorePath(pathname)) return

    try {
      const payload = JSON.stringify({
        path: pathname,
        sessionId: getSessionId(),
      })

      if (navigator.sendBeacon && typeof Blob !== 'undefined') {
        const blob = new Blob([payload], { type: 'application/json' })
        navigator.sendBeacon('/api/page-view', blob)
        return
      }

      void fetch('/api/page-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => undefined)
    } catch {
      // PV計測はUI操作を妨げない。
    }
  }, [pathname])

  return null
}
