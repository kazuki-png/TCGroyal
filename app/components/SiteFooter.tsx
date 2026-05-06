import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="w-full bg-zinc-100 px-4 py-5 text-center text-[10px] text-slate-600 dark:bg-[#0c0b09] dark:text-[#5a5243]">
      <div className="mx-auto max-w-3xl">
        <nav className="mb-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px]">
          <Link href="/" className="hover:text-slate-900 dark:hover:text-[#c9a52e]">
            トップ
          </Link>
          <Link href="#" className="hover:text-slate-900 dark:hover:text-[#c9a52e]">
            通販
          </Link>
          <Link href="#" className="hover:text-slate-900 dark:hover:text-[#c9a52e]">
            利用規約
          </Link>
          <Link href="#" className="hover:text-slate-900 dark:hover:text-[#c9a52e]">
            プライバシーポリシー
          </Link>
          <Link href="#" className="hover:text-slate-900 dark:hover:text-[#c9a52e]">
            特商法
          </Link>
        </nav>
        <div className="mb-3 flex items-center justify-center gap-5 text-[11px]">
          <Link href="#" className="hover:text-slate-900 dark:hover:text-[#c9a52e]">
            会社概要
          </Link>
          <Link href="#" aria-label="X" className="text-base hover:text-slate-900 dark:hover:text-[#c9a52e]">
            X
          </Link>
        </div>
        <p>© 2026 TCG Royal All Rights Reserved.</p>
      </div>
    </footer>
  )
}
