import { redirect } from 'next/navigation'
import { getAdminAccess } from '@/lib/admin/authorization'
import { MfaForm } from './MfaForm'
export const metadata = { title: '二段階認証', robots: { index: false, follow: false } }
export default async function MfaPage() {
  if (!(await getAdminAccess(false, false))) redirect('/admin/login')
  if (await getAdminAccess()) redirect('/admin')
  return <main className="mx-auto max-w-lg p-8"><h1 className="mb-6 text-2xl font-bold">管理者の二段階認証</h1><MfaForm /></main>
}
