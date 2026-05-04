import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/app/components/LogoutButton'

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
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight">
            TCG Royal
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href="/mypage"
              className="text-sm text-zinc-600 hover:text-zinc-900"
            >
              申込一覧
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
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  )
}
