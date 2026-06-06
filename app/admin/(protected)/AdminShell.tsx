'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { SiteLogo } from '@/app/components/SiteLogo'

const NAV_ITEMS = [
  { href: '/admin', label: 'ダッシュボード', match: 'exact' },
  { href: '/admin/orders', label: '取引', match: 'prefix' },
  { href: '/admin/cards', label: 'カード管理', match: 'prefix' },
  { href: '/admin/banners', label: 'バナー管理', match: 'prefix' },
  { href: '/admin/coupons', label: 'クーポン管理', match: 'prefix' },
  { href: '/admin/users', label: 'ユーザー', match: 'prefix' },
  { href: '/admin/reference-prices', label: '参考価格', match: 'prefix' },
] as const

function isActive(pathname: string, href: string, match: 'exact' | 'prefix') {
  if (match === 'exact') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

function SidebarContent({
  userEmail,
  footer,
  onNavigate,
}: {
  userEmail: string
  footer: ReactNode
  onNavigate?: () => void
}) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col border-r border-zinc-800 bg-zinc-950 text-white">
      <div className="flex h-[86px] items-center border-b border-zinc-800 px-6">
        <Link href="/admin" onClick={onNavigate} className="inline-flex items-center gap-3">
          <SiteLogo priority />
          <span className="text-sm font-black text-zinc-400">管理</span>
        </Link>
      </div>

      <nav className="flex-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href, item.match)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={[
                'flex h-[76px] items-center border-b border-zinc-800 px-6 text-lg font-black transition-colors',
                active
                  ? 'bg-[#181818] text-red-500'
                  : 'text-zinc-300 hover:bg-zinc-900 hover:text-white',
              ].join(' ')}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-zinc-800 px-5 py-4">
        <p className="mb-3 truncate text-xs font-semibold text-zinc-500">{userEmail}</p>
        {footer}
      </div>
    </div>
  )
}

export function AdminShell({
  children,
  userEmail,
  footer,
}: {
  children: ReactNode
  userEmail: string
  footer: ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen bg-black text-white">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-0 top-24 z-30 flex h-12 w-10 items-center justify-center rounded-r-xl border border-l-0 border-zinc-600 bg-zinc-950 text-sm font-black text-white shadow-lg md:hidden"
        aria-label="管理メニューを開く"
      >
        &gt;&gt;
      </button>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="管理メニューを閉じる"
            className="absolute inset-0 bg-black/70"
            onClick={() => setOpen(false)}
          />
          <aside className="relative h-full w-[240px] shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 z-10 h-9 w-9 rounded-full bg-zinc-950 text-sm font-black text-white"
              aria-label="閉じる"
            >
              ×
            </button>
            <SidebarContent
              userEmail={userEmail}
              footer={footer}
              onNavigate={() => setOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="min-w-0 md:flex">
        <aside className="hidden min-h-screen w-[230px] shrink-0 md:block">
          <SidebarContent userEmail={userEmail} footer={footer} />
        </aside>
        <main className="min-h-screen min-w-0 flex-1 bg-black px-4 py-6 md:px-8 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  )
}
