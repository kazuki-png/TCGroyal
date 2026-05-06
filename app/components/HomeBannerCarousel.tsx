'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { TouchEvent } from 'react'
import type { HomepageBanner } from '@/lib/types'

export function HomeBannerCarousel({
  banners,
  fallback = 'brand',
}: {
  banners: HomepageBanner[]
  fallback?: 'brand' | 'cart-message'
}) {
  const activeBanners = useMemo(
    () => banners.filter((banner) => banner.is_active && banner.image_url),
    [banners]
  )
  const [currentIndex, setCurrentIndex] = useState(0)
  const touchStartXRef = useRef<number | null>(null)
  const didSwipeRef = useRef(false)

  const moveBanner = (offset: number) => {
    setCurrentIndex((index) => {
      const next = index + offset
      return (next + activeBanners.length) % activeBanners.length
    })
  }

  useEffect(() => {
    if (activeBanners.length <= 1) return

    const timer = window.setInterval(() => {
      setCurrentIndex((index) => (index + 1) % activeBanners.length)
    }, 4200)

    return () => window.clearInterval(timer)
  }, [activeBanners.length])

  if (activeBanners.length === 0) {
    if (fallback === 'cart-message') {
      return (
        <section className="w-full border-b border-zinc-200 bg-white px-5 py-8 text-center text-base font-medium leading-relaxed text-zinc-950 sm:py-10 sm:text-lg dark:border-[#2d2a20] dark:bg-[#111110] dark:text-[#ede8d5]">
          こちらは、管理画面で設定したバナー
          <br />
          をスライドショー形式で表示する仕様
          <br />
          とする。
        </section>
      )
    }

    return (
      <section className="w-full border-b border-zinc-200 bg-white px-6 py-10 text-center sm:py-14 dark:border-[#2d2a20] dark:bg-[#111110]">
        <p className="text-2xl font-semibold tracking-wide text-zinc-900 sm:text-3xl dark:font-serif dark:tracking-widest dark:text-[#c9a52e]">
          TCG Royal
        </p>
        <p className="mt-2 text-sm text-zinc-600 sm:text-base dark:text-[#7a6e55]">PSA鑑定カード 郵送買取</p>
      </section>
    )
  }

  const normalizedIndex = currentIndex % activeBanners.length
  const banner = activeBanners[normalizedIndex]
  const isExternal = /^https?:\/\//.test(banner.link_url)

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (activeBanners.length <= 1) return
    touchStartXRef.current = event.touches[0]?.clientX ?? null
    didSwipeRef.current = false
  }

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const startX = touchStartXRef.current
    const endX = event.changedTouches[0]?.clientX
    touchStartXRef.current = null

    if (
      activeBanners.length <= 1 ||
      startX === null ||
      typeof endX !== 'number'
    ) {
      return
    }

    const diff = endX - startX
    if (Math.abs(diff) < 44) return

    didSwipeRef.current = true
    moveBanner(diff < 0 ? 1 : -1)
    window.setTimeout(() => {
      didSwipeRef.current = false
    }, 250)
  }

  return (
    <section className="w-full border-b border-zinc-100 bg-white dark:border-[#2d2a20] dark:bg-[#111110]">
      <div
        className="relative min-h-[240px] touch-pan-y select-none overflow-hidden sm:min-h-[360px] lg:min-h-[440px]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <Link
          href={banner.link_url || '#'}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noreferrer' : undefined}
          className="absolute inset-0 block"
          onClick={(event) => {
            if (didSwipeRef.current) {
              event.preventDefault()
            }
          }}
        >
          <Image
            src={banner.image_url}
            alt={banner.title || 'TCG Royal banner'}
            fill
            priority={normalizedIndex === 0}
            sizes="100vw"
            className="object-cover"
          />
        </Link>
        {activeBanners.length > 1 && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
            {activeBanners.map((item, index) => (
              <button
                key={item.id}
                type="button"
                aria-label={`${index + 1}枚目のバナーを表示`}
                onClick={() => setCurrentIndex(index)}
                className={`h-1.5 rounded-full transition-all ${
                  index === normalizedIndex
                    ? 'w-5 bg-white'
                    : 'w-1.5 bg-white/60 hover:bg-white'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
