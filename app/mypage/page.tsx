import Link from 'next/link'
import { logout } from '@/app/actions/auth'
import { createClient } from '@/lib/supabase/server'

const menuItems = [
  {
    href: '/mypage/profile',
    title: '会員情報',
    description: '登録情報、本人確認、振込先を確認・更新',
  },
  {
    href: '/mypage/orders',
    title: '郵送買取一覧',
    description: '申し込み状況と査定額を確認',
  },
  {
    href: '/auth/update-password',
    title: 'パスワード変更',
    description: 'ログイン用パスワードを再設定',
  },
]

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}

export default async function MypageMenuPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase
        .from('profiles')
        .select('last_name, first_name, identity_verified')
        .eq('id', user.id)
        .maybeSingle()
    : { data: null }

  const displayName = [profile?.last_name, profile?.first_name]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[28px] border border-[#2d2a20] bg-[#12100c] px-5 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:px-8 sm:py-8">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#d7b865]/70 to-transparent" />
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#c9a52e]">
          My Page
        </p>
        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-black text-[#f6f0dc] sm:text-3xl">
              {displayName ? `${displayName} 様` : 'マイページ'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#8f8369]">
              郵送買取の申し込み状況、登録情報、振込先をここから管理できます。
            </p>
          </div>
          <span
            className={`inline-flex w-fit rounded-full px-4 py-2 text-xs font-black ${
              profile?.identity_verified
                ? 'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-300/30'
                : 'bg-red-400/15 text-red-300 ring-1 ring-red-300/30'
            }`}
          >
            {profile?.identity_verified ? '本人確認済み' : '本人確認 未確認'}
          </span>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group min-h-[172px] rounded-[24px] border border-[#2d2a20] bg-[#15130f] p-5 transition-all hover:-translate-y-0.5 hover:border-[#c9a52e]/60 hover:bg-[#1b1812] hover:shadow-[0_18px_60px_rgba(0,0,0,0.35)]"
          >
            <div className="flex h-full flex-col justify-between gap-6">
              <div>
                <h2 className="text-xl font-black text-[#f6f0dc]">
                  {item.title}
                </h2>
                <p className="mt-3 text-sm font-semibold leading-6 text-[#8f8369]">
                  {item.description}
                </p>
              </div>
              <div className="flex items-center justify-between text-[#c9a52e]">
                <span className="text-xs font-black uppercase tracking-[0.18em]">
                  Open
                </span>
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#211f18] transition-transform group-hover:translate-x-1">
                  <ArrowIcon />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <form action={logout}>
        <button
          type="submit"
          className="w-full rounded-[20px] border border-[#2d2a20] bg-[#0f0e0b] px-5 py-4 text-sm font-black text-[#8f8369] transition-colors hover:border-red-400/40 hover:text-red-300 md:w-auto md:min-w-48"
        >
          ログアウト
        </button>
      </form>
    </div>
  )
}
