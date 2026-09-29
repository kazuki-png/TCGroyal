import { redirect } from 'next/navigation'
import { requireAdminUser } from '@/lib/admin/authorization'
export const metadata = { title: '管理画面', robots: { index: false, follow: false } }
export default async function MfaPage() {
  await requireAdminUser()
  redirect('/admin')
}
