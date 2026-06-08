import Image from 'next/image'
import Link from 'next/link'

export function Header() {
  return (
    <header className="bg-[var(--lp-background)]">
      <div className="flex w-full items-center justify-center pb-25 pt-30 max-md:pb-25 max-md:pt-30">
        <Link href="/" className="relative block h-[40px] w-[250px]">
          <Image
            src="/lp/images/logo.png"
            alt="TCG ROYAL"
            fill
            sizes="(max-width: 768px) 300px, 323px"
            className="object-contain"
            priority
          />
        </Link>
      </div>
    </header>
  )
}
