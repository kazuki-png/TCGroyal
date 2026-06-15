import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { Noto_Serif_JP } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { TestEnvironmentBadge } from './components/TestEnvironmentBadge'
import { getEnvironmentLabel } from '@/lib/environment'
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
  title: 'TCG ROYAL - PSA10特化郵送買取',
  description: 'トレーディングカードのPSA10特化郵送買取サービス',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const environmentLabel = getEnvironmentLabel()

  return (
    <html
      lang="ja"
      className={`${geist.variable} ${notoSerifJP.variable} dark`}
      style={{ colorScheme: 'dark' }}
      suppressHydrationWarning
    >
      <body className="min-h-screen overflow-x-hidden bg-[#111110] text-[#ede8d5] antialiased">
        {environmentLabel && <TestEnvironmentBadge label={environmentLabel} />}
        <div className={environmentLabel ? 'pt-8 sm:pt-9' : undefined}>
          {children}
        </div>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
