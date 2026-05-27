'use client'

import { useSyncExternalStore, type ReactNode } from 'react'

function subscribeToLocationChange(callback: () => void) {
  window.addEventListener('popstate', callback)
  return () => window.removeEventListener('popstate', callback)
}

function currentPathWithSearch() {
  return `${window.location.pathname}${window.location.search}`
}

function serverPathSnapshot() {
  return ''
}

function loginHrefFor(pathWithSearch: string) {
  const pathname = pathWithSearch.split('?')[0] ?? '/'

  if (
    pathname === '/login' ||
    pathname === '/register' ||
    pathname.startsWith('/admin')
  ) {
    return '/login'
  }

  return `/login?next=${encodeURIComponent(pathWithSearch)}`
}

export function LoginLink({
  ariaLabel,
  children,
  className,
}: {
  ariaLabel?: string
  children: ReactNode
  className: string
}) {
  const pathWithSearch = useSyncExternalStore(
    subscribeToLocationChange,
    currentPathWithSearch,
    serverPathSnapshot
  )

  return (
    <a
      href={pathWithSearch ? loginHrefFor(pathWithSearch) : '/login'}
      aria-label={ariaLabel}
      className={className}
    >
      {children}
    </a>
  )
}
