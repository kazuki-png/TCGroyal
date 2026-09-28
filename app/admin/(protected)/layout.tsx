import type { Metadata } from 'next'
import { requireAdminHostForPage } from '@/lib/admin/serverHostAccess'
import { requireAdminUser } from '@/lib/admin/authorization'
import { adminLogout } from '@/app/actions/auth'
import { AdminShell } from './AdminShell'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAdminHostForPage()

  const user = await requireAdminUser()

  const footer = (
    <form action={adminLogout}>
      <button
        type="submit"
        className="h-10 w-full rounded-lg bg-zinc-950 text-sm font-black text-white transition-colors hover:bg-zinc-800"
      >
        ログアウト
      </button>
    </form>
  )

  return (
    <AdminShell userEmail={user.email ?? ''} footer={footer}>
      {children}
    </AdminShell>
  )
}
