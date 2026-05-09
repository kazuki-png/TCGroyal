import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Noto_Serif_JP } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const notoSerifJP = Noto_Serif_JP({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-noto-serif',
  display: 'swap',
  preload: false,
})

export const metadata: Metadata = {
  title: 'TCG Royal - 郵送トレカ買取',
  description: 'ポケモンカード・ワンピースカードの郵送買取サービス',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="ja"
      className={`${geist.variable} ${notoSerifJP.variable} dark`}
      style={{ colorScheme: 'dark' }}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-[#111110] text-[#ede8d5] antialiased">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
