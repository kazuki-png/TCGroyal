import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Noto_Serif_JP } from 'next/font/google'
import Script from 'next/script'
import { PageViewTracker } from '@/app/components/PageViewTracker'
import { ThemeProvider } from '@/app/components/ThemeProvider'
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

const THEME_SCRIPT = `try{var t=localStorage.getItem('theme')||(window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');document.documentElement.classList.toggle('dark',t==='dark')}catch{}`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="ja"
      className={`${geist.variable} ${notoSerifJP.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased dark:bg-[#111110] dark:text-[#ede8d5]">
        <Script
          id="theme-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
        />
        <ThemeProvider>
          <PageViewTracker />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
