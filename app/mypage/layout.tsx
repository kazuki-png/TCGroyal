import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/app/components/LogoutButton'
import { SiteFooter } from '@/app/components/SiteFooter'
import { SiteHeader } from '@/app/components/SiteHeader'

export default async function MypageLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <SiteHeader
        isAuthenticated
        priorityLogo
        nav={
          <nav className="hidden items-center gap-5 md:flex">
            <Link
              href="/mypage"
              className="text-sm text-zinc-600 hover:text-zinc-900"
            >
              マイページ
            </Link>
            <Link
              href="/mypage/orders"
              className="text-sm text-zinc-600 hover:text-zinc-900"
            >
              郵送買取一覧
            </Link>
            <Link
              href="/mypage/profile"
              className="text-sm text-zinc-600 hover:text-zinc-900"
            >
              会員情報
            </Link>
            <Link
              href="/cart"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              買取申込
            </Link>
            <LogoutButton />
          </nav>
        }
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
      <SiteFooter />
    </div>
  )
}
