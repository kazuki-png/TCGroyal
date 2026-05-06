'use client'

import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'

export function AdminFlashMessage({
  children,
  tone,
}: {
  children: ReactNode
  tone: 'deleted' | 'error' | 'success'
}) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (tone === 'error') return

    const timer = window.setTimeout(() => {
      router.replace(pathname, { scroll: false })
    }, 2500)

    return () => window.clearTimeout(timer)
  }, [pathname, router, tone])

  const className =
    tone === 'error'
      ? 'mb-6 rounded-xl border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-200'
      : tone === 'deleted'
        ? 'mb-6 rounded-xl border border-red-900 bg-red-950/50 px-4 py-3 text-sm font-semibold text-red-200'
        : 'mb-6 rounded-xl border border-emerald-900 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-200'

  return <p className={className}>{children}</p>
}
