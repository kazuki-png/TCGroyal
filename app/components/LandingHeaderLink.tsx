import Link from 'next/link'

export function LandingHeaderLink() {
  return (
    <Link
      href="/yuso-kaitori"
      className="inline-flex max-w-[28vw] shrink items-center justify-center truncate rounded-full border border-[#c9a52e]/45 bg-[#1c1b18] px-3 py-2 text-xs font-black text-[#c9a52e] shadow-[inset_0_0_0_1px_rgba(201,165,46,0.08)] transition-colors hover:border-[#d7b865] hover:bg-[#252420] hover:text-[#f1d77a] sm:max-w-none sm:px-4 sm:text-sm"
    >
      初めての方へ
    </Link>
  )
}
