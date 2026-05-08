import type { ReactNode } from 'react'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'

type LegalSection = {
  title: string
  body?: ReactNode
  items?: ReactNode[]
}

export function LegalPage({
  title,
  lead,
  sections = [],
  paragraphs,
}: {
  title: string
  lead?: string
  sections?: LegalSection[]
  paragraphs?: readonly string[]
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#0b0a08] text-[#ede8d5]">
      <SiteHeader isAuthenticated={false} priorityLogo />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <article className="rounded-[28px] border border-[#2d2a20] bg-[#12100c] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#c9a52e]">
            TCG Royal
          </p>
          <h1 className="mt-3 text-3xl font-black text-[#f6f0dc] sm:text-4xl">
            {title}
          </h1>
          {lead && (
            <p className="mt-5 text-sm font-semibold leading-7 text-[#d7ceb8]">
              {lead}
            </p>
          )}

          {paragraphs && (
            <div className="mt-8 space-y-4 rounded-[22px] border border-[#2d2a20] bg-[#171511] p-4 text-sm font-semibold leading-8 text-[#ede8d5] sm:p-5">
              {paragraphs.map((paragraph, index) => {
                const isHeading =
                  /^第\d+条/.test(paragraph) || /^\d+\./.test(paragraph)

                return (
                  <p
                    key={`${index}-${paragraph.slice(0, 12)}`}
                    className={
                      isHeading ? 'font-black text-[#c9a52e]' : undefined
                    }
                  >
                    {paragraph}
                  </p>
                )
              })}
            </div>
          )}

          {sections.length > 0 && (
            <div className="mt-8 space-y-6">
              {sections.map((section) => (
                <section
                  key={section.title}
                  className="rounded-[22px] border border-[#2d2a20] bg-[#171511] p-4 sm:p-5"
                >
                  <h2 className="text-lg font-black text-[#c9a52e]">
                    {section.title}
                  </h2>
                  {section.body && (
                    <div className="mt-3 text-sm font-semibold leading-7 text-[#ede8d5]">
                      {section.body}
                    </div>
                  )}
                  {section.items && (
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm font-semibold leading-7 text-[#ede8d5]">
                      {section.items.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ol>
                  )}
                </section>
              ))}
            </div>
          )}
        </article>
      </main>
      <SiteFooter />
    </div>
  )
}
