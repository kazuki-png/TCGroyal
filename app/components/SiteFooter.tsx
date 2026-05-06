import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="w-full border-t border-[#2d2a20] bg-[#0c0b09] px-4 py-7 text-center text-[11px] text-[#6f664f]">
      <div className="mx-auto max-w-5xl">
        <nav className="mb-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-semibold">
          <Link href="/" className="transition-colors hover:text-[#c9a52e]">
            トップ
          </Link>
          <Link href="#" className="transition-colors hover:text-[#c9a52e]">
            通販
          </Link>
          <Link href="#" className="transition-colors hover:text-[#c9a52e]">
            利用規約
          </Link>
          <Link href="#" className="transition-colors hover:text-[#c9a52e]">
            プライバシーポリシー
          </Link>
          <Link href="#" className="transition-colors hover:text-[#c9a52e]">
            特商法
          </Link>
        </nav>
        <div className="mb-3 flex items-center justify-center gap-5 font-semibold">
          <Link href="#" className="transition-colors hover:text-[#c9a52e]">
            会社概要
          </Link>
          <Link
            href="#"
            aria-label="X"
            className="text-base transition-colors hover:text-[#c9a52e]"
          >
            X
          </Link>
        </div>
        <p className="text-[10px]">© 2026 TCG Royal All Rights Reserved.</p>
      </div>
    </footer>
  )
}
