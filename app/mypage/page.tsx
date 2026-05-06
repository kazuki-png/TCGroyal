import Link from 'next/link'
import { logout } from '@/app/actions/auth'

function MenuLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex h-[50px] items-center justify-center rounded-[18px] bg-[#b9b7b7] px-6 text-lg font-black text-zinc-950 transition-colors hover:bg-[#aaa8a8]"
    >
      {children}
    </Link>
  )
}

export default function MypageMenuPage() {
  return (
    <div className="mx-auto w-full max-w-md bg-white px-3 pb-10 pt-2 text-zinc-950 md:max-w-3xl">
      <h1 className="mb-7 text-center text-xl font-black text-zinc-950">
        マイページ
      </h1>
      <div className="space-y-3">
        <MenuLink href="/mypage/profile">会員情報</MenuLink>
        <MenuLink href="/mypage/orders">郵送買取一覧</MenuLink>
        <MenuLink href="/auth/update-password">パスワード変更</MenuLink>
        <form action={logout}>
          <button
            type="submit"
            className="flex h-[50px] w-full items-center justify-center rounded-[18px] bg-[#b9b7b7] px-6 text-lg font-black text-zinc-950 transition-colors hover:bg-[#aaa8a8]"
          >
            ログアウト
          </button>
        </form>
      </div>
    </div>
  )
}
