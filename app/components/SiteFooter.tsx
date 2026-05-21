import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="w-full border-t border-[#2d2a20] bg-[#0c0b09] px-4 py-4 text-[11px] text-[#6f664f]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 md:flex-row">
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-semibold md:justify-start">
          <Link href="/" className="transition-colors hover:text-[#c9a52e]">
            トップ
          </Link>
          <Link href="#" className="transition-colors hover:text-[#c9a52e]">
            通販
          </Link>
          <Link href="/terms" className="transition-colors hover:text-[#c9a52e]">
            利用規約
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-[#c9a52e]">
            プライバシーポリシー
          </Link>
          <Link href="/tokusho" className="transition-colors hover:text-[#c9a52e]">
            特商法
          </Link>
          <Link href="/company" className="transition-colors hover:text-[#c9a52e]">
            会社概要
          </Link>
          <Link
            href="#"
            aria-label="X"
            className="text-base transition-colors hover:text-[#c9a52e]"
          >
            X
          </Link>
        </nav>
        <p className="shrink-0 text-[10px] font-semibold text-[#5d543f]">
          © 2026 TCG Royal All Rights Reserved.
        </p>
      </div>
    </footer>
  )
}
