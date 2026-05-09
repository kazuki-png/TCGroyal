import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SiteFooter } from '@/app/components/SiteFooter'
import { SiteHeader } from '@/app/components/SiteHeader'
import { CartHeaderLink } from './CartHeaderLink'
import { CartForm } from './CartForm'
import type { Card, HomepageBanner, Profile } from '@/lib/types'

export default async function CartPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/cart')

  const { data: banners } = await supabase
    .from('homepage_banners')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  const { data: profile } = user
    ? await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    : { data: null }

  return (
    <div className="flex min-h-screen flex-col bg-[#111110] text-[#ede8d5]">
      <SiteHeader
        isAuthenticated={Boolean(user)}
        priorityLogo
        borderClassName="border-b border-[#2d2a20]"
        afterAccount={<CartHeaderLink />}
        nav={user ? (
          <Link href="/mypage" className="hidden text-sm text-zinc-500 hover:text-zinc-900 dark:text-[#7a6e55] dark:hover:text-[#c9a52e] md:inline">
            マイページ
          </Link>
        ) : null}
      />
      <main className="w-full flex-1">
        <CartForm
          cards={[] as Card[]}
          banners={(banners ?? []) as HomepageBanner[]}
          profile={profile as Profile | null}
          userEmail={user?.email ?? null}
        />
      </main>
      <SiteFooter />
    </div>
  )
}
