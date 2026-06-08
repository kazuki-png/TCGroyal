import type { Metadata } from 'next'
import { Cta } from '@/app/components/landing/Cta'
import { Difference } from '@/app/components/landing/Difference'
import { Faq } from '@/app/components/landing/Faq'
import { Fv } from '@/app/components/landing/Fv'
import { Price } from '@/app/components/landing/Price'
import { Reason } from '@/app/components/landing/Reason'
import { Solution } from '@/app/components/landing/Solution'
import { Steps } from '@/app/components/landing/Steps'
import { getLandingPageData } from '@/lib/landing/getLandingPageData'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'TCG ROYAL 郵送買取 LP',
  description:
    'PSA10特化の高価郵送買取。送料無料、最短当日査定・振込のTCG ROYALランディングページ。',
}

export default async function LandingPage() {
  const data = await getLandingPageData()

  return (
    <main className="landing-page min-h-screen">
      <Fv fv={data.fv} />
      <Solution content={data.solution} />
      <Reason reasons={data.fiveReasons} />
      <Price content={data.whyHighPrice} />
      <Difference content={data.difference} />
      <Steps steps={data.fiveSteps} />
      <Faq items={data.faq} />
      <Cta content={data.cta} />
    </main>
  )
}
