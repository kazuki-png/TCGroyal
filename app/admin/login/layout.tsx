import type { Metadata } from 'next'
import { requireAdminHostForPage } from '@/lib/admin/serverHostAccess'

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

export default async function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAdminHostForPage()

  return children
}
