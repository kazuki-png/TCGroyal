import { requireAdminHostForPage } from '@/lib/admin/serverHostAccess'

export default async function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAdminHostForPage()

  return children
}
