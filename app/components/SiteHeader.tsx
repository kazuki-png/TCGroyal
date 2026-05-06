import Link from 'next/link'
import type { ReactNode } from 'react'
import { SiteLogo } from './SiteLogo'
import { ThemeToggle } from './ThemeToggle'

function AccountIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      <path d="M12 12a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5Z" />
      <path d="M4.8 20.5a7.2 7.2 0 0 1 14.4 0" />
      <path d="M19 4.75l1.25 1.25L22 3.75" />
    </svg>
  )
}

export function SiteHeader({
  isAuthenticated,
  nav,
  afterAccount,
  maxWidthClassName = 'max-w-5xl',
  borderClassName = 'border-b border-zinc-200',
  priorityLogo = false,
  unauthenticatedAction = 'login',
}: {
  isAuthenticated: boolean
  nav?: ReactNode
  afterAccount?: ReactNode
  maxWidthClassName?: string
  borderClassName?: string
  priorityLogo?: boolean
  unauthenticatedAction?: 'login' | 'account-icon'
}) {
  return (
    <header
      className={`sticky top-0 z-50 w-full bg-white px-4 py-3 dark:bg-[#111110] dark:border-[#2d2a20] ${borderClassName}`}
    >
      <div
        className={`mx-auto flex ${maxWidthClassName} items-center justify-between gap-4`}
      >
        <Link href="/" aria-label="TCG Royal" className="inline-flex shrink-0">
          <SiteLogo priority={priorityLogo} />
        </Link>
        <div className="flex min-w-0 items-center justify-end gap-2">
          {nav}
          <ThemeToggle />
          {isAuthenticated || unauthenticatedAction === 'account-icon' ? (
            <Link
              href={isAuthenticated ? '/mypage' : '/login'}
              aria-label={isAuthenticated ? 'マイページ' : 'ログイン'}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-zinc-950 text-[#d7b865] shadow-[inset_0_0_0_2px_rgba(215,184,101,0.75)] transition-colors hover:bg-zinc-800 dark:bg-[#1c1b18] dark:text-[#c9a52e] dark:shadow-[inset_0_0_0_1px_rgba(201,165,46,0.6)] dark:hover:bg-[#252420]"
            >
              <AccountIcon />
            </Link>
          ) : (
            <Link
              href="/login"
              className="shrink-0 rounded-full bg-zinc-950 px-5 py-2 text-sm font-black text-[#d4c400] shadow-[inset_0_0_0_1px_rgba(212,196,0,0.35)] transition-colors hover:bg-zinc-800 dark:bg-[#1c1b18] dark:text-[#c9a52e] dark:shadow-[inset_0_0_0_1px_rgba(201,165,46,0.4)] dark:hover:bg-[#252420]"
            >
              ログイン
            </Link>
          )}
          {afterAccount}
        </div>
      </div>
    </header>
  )
}
