import Link from 'next/link'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { HomeBannerCarousel } from './components/HomeBannerCarousel'
import { HomeCardSection } from './components/HomeCardSection'
import { SiteFooter } from './components/SiteFooter'
import { SiteHeader } from './components/SiteHeader'
import type { Card, HomepageBanner } from '@/lib/types'

const LINE_ASSESSMENT_URL = 'https://lin.ee/Q6CsfJkl'

function LineIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 48"
      className="h-12 w-12"
    >
      <rect width="48" height="48" rx="10" fill="#06C755" />
      <path
        d="M38 22.4c0-7.1-6.3-12.9-14-12.9s-14 5.8-14 12.9c0 6.3 5 11.6 11.8 12.7.5.1 1.1.3 1.2.8.1.4.1 1 0 1.4l-.2 1.3c-.1.4-.3 1.6 1.2.9 1.5-.6 7.9-4.7 10.8-8 2-2.2 3.2-5.3 3.2-9.1Z"
        fill="#fff"
      />
      <path
        d="M17.3 25.9h-3.4v-7.1h1.5v5.7h1.9v1.4Zm2.7 0h-1.5v-7.1H20v7.1Zm7.3 0h-1.4l-3-4.1v4.1h-1.5v-7.1h1.4l3 4.1v-4.1h1.5v7.1Zm6.1-5.7h-3.1v1.3h2.8v1.4h-2.8v1.6h3.1v1.4h-4.6v-7.1h4.6v1.4Z"
        fill="#06C755"
      />
    </svg>
  )
}

function CartPurchaseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 48"
      className="h-12 w-12"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="3"
    >
      <path d="M7 10h5l4 24h23l4-17H16" />
      <path d="M18 22h22" />
      <path d="M21 17v17" />
      <path d="M29 17v17" />
      <circle cx="20" cy="40" r="2.7" fill="currentColor" stroke="none" />
      <circle cx="36" cy="40" r="2.7" fill="currentColor" stroke="none" />
    </svg>
  )
}


function ActionLink({
  href,
  className,
  icon,
  children,
}: {
  href: string
  className: string
  icon?: ReactNode
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className={`relative flex min-h-[104px] items-center gap-5 rounded-2xl border px-6 py-5 text-xl font-black shadow-sm transition-transform hover:-translate-y-0.5 sm:min-h-[124px] sm:px-7 sm:text-2xl lg:min-h-[136px] ${className}`}
    >
      {icon}
      <span>{children}</span>
    </Link>
  )
}


export default async function HomePage() {
  const hasSupabaseConfig = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  let user = null
  let banners: HomepageBanner[] = []
  let cards: Card[] = []

  if (hasSupabaseConfig) {
    const supabase = await createClient()
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser()

    user = currentUser

    const [{ data: bannerRows }, { data: cardRows }] = await Promise.all([
      supabase
        .from('homepage_banners')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false }),
      supabase
        .from('cards')
        .select('*')
        .order('buy_price', { ascending: false })
        .limit(32),
    ])

    banners = (bannerRows ?? []) as HomepageBanner[]
    cards = (cardRows ?? []) as Card[]
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#111110] text-[#ede8d5]">
      <SiteHeader
        isAuthenticated={Boolean(user)}
        borderClassName="border-b border-[#2d2a20]"
        priorityLogo
      />

      <HomeBannerCarousel banners={banners} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-9">
        <div className="grid gap-4 md:grid-cols-2">
          <ActionLink
            href="/cart"
            className="border-[#a99512] bg-[linear-gradient(135deg,#e3cf42_0%,#c2aa10_58%,#a48906_100%)] text-zinc-950 shadow-[0_12px_26px_rgba(142,119,12,0.2)]"
            icon={<CartPurchaseIcon />}
          >
            カート買取
          </ActionLink>
          <ActionLink
            href={LINE_ASSESSMENT_URL}
            className="border-[#8ddba8] bg-[linear-gradient(135deg,#f7fff8_0%,#dff7e6_48%,#bceccd_100%)] text-[#063d20] shadow-[0_12px_26px_rgba(24,128,67,0.14)]"
            icon={<LineIcon />}
          >
            LINE査定
          </ActionLink>
        </div>
        <HomeCardSection cards={cards} />
      </main>

      <SiteFooter />
    </div>
  )
}
