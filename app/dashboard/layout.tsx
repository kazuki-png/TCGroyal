import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/app/components/LogoutButton'
import { SiteFooter } from '@/app/components/SiteFooter'
import { SiteHeader } from '@/app/components/SiteHeader'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#111110] text-[#ede8d5]">
      <SiteHeader
        isAuthenticated
        priorityLogo
        nav={
          <nav className="hidden items-center gap-5 md:flex">
            <Link
              href="/orders/new"
              className="rounded-full bg-[#c9a52e] px-4 py-2 text-sm font-black text-[#0e0c09] transition-colors hover:bg-[#d7b865]"
            >
              買取申込
            </Link>
            <span className="text-sm font-semibold text-[#8f8369]">{user.email}</span>
            <LogoutButton />
          </nav>
        }
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
      <SiteFooter />
    </div>
  )
}
