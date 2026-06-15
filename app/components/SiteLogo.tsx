import Image from 'next/image'
import bannerImage from '@/app/assets/banner.png'
import { BRAND_NAME } from '@/lib/brand'

type SiteLogoProps = {
  className?: string
  priority?: boolean
}

export function SiteLogo({ className, priority = false }: SiteLogoProps) {
  return (
    <Image
      src={bannerImage}
      alt={BRAND_NAME}
      priority={priority}
      className={['block h-[38px] w-[135px] rounded-sm object-cover', className]
        .filter(Boolean)
        .join(' ')}
    />
  )
}
