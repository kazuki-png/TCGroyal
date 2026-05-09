import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/app/components/LogoutButton'
import { SiteFooter } from '@/app/components/SiteFooter'
import { SiteHeader } from '@/app/components/SiteHeader'

const navItems = [
  { href: '/mypage', label: 'マイページ' },
  { href: '/mypage/orders', label: '郵送買取一覧' },
  { href: '/mypage/profile', label: '会員情報' },
]

export default async function MypageLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const headersList = await headers()
    const pathname = headersList.get('x-pathname') ?? '/mypage'
    redirect(`/login?next=${encodeURIComponent(pathname)}`)
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0a08] text-[#ede8d5]">
      <SiteHeader
        isAuthenticated
        priorityLogo
        borderClassName="border-b border-[#2d2a20]"
        maxWidthClassName="max-w-6xl"
        nav={
          <nav className="hidden items-center gap-5 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-semibold text-[#8f8369] transition-colors hover:text-[#d7b865]"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/cart"
              className="rounded-full border border-[#c9a52e]/40 bg-[#171511] px-4 py-2 text-sm font-black text-[#c9a52e] transition-colors hover:border-[#d7b865] hover:bg-[#211f18]"
            >
              買取申込
            </Link>
            <LogoutButton />
          </nav>
        }
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-10">
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}
