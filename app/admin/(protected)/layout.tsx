import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { adminLogout } from '@/app/actions/auth'
import { AdminShell } from './AdminShell'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', user.id)
    .single()

  if (!adminRow) {
    await supabase.auth.signOut()
    redirect('/admin/login')
  }

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
