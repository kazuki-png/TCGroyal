import { createClient } from '@/lib/supabase/server'
import { SiteFooter } from '@/app/components/SiteFooter'
import { SiteHeader } from '@/app/components/SiteHeader'
import { UpdatePasswordForm } from './UpdatePasswordForm'

export default async function UpdatePasswordPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <SiteHeader
        isAuthenticated={Boolean(user)}
        priorityLogo
        breadcrumbs={[
          { href: '/', label: 'トップ' },
          { label: 'パスワード変更' },
        ]}
      />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              新しいパスワードの設定
            </h1>
            <p className="mt-2 text-zinc-400">TCG Royal</p>
          </div>

          <UpdatePasswordForm />
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
