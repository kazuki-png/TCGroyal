import type { ReactNode } from 'react'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'

type LegalSection = {
  title: string
  body?: ReactNode
  items?: ReactNode[]
}

type LegalParagraphKind =
  | 'body'
  | 'heading'
  | 'number'
  | 'subNumber'
  | 'closing'

const numberedParagraphPattern = /^(\d+)\.\s/
const articleHeadingPattern = /^第\d+条/

function opensNumberedSublist(paragraph: string) {
  return (
    paragraph.includes('以下') ||
    paragraph.includes('次の場合') ||
    paragraph.includes('次に掲げる')
  )
}

function getLegalParagraphs(paragraphs: readonly string[]) {
  const hasArticleHeadings = paragraphs.some((paragraph) =>
    articleHeadingPattern.test(paragraph),
  )
  let expectedNumber = 1
  let sublistActive = false
  let sublistLastNumber = 0
  let currentMajorNumber = 0

  return paragraphs.map((paragraph) => {
    if (paragraph === '以上') {
      return { kind: 'closing' as const, paragraph }
    }

    if (articleHeadingPattern.test(paragraph)) {
      expectedNumber = 1
      sublistActive = false
      sublistLastNumber = 0
      currentMajorNumber = 0

      return { kind: 'heading' as const, paragraph }
    }

    const numberedMatch = paragraph.match(numberedParagraphPattern)
    if (!numberedMatch) {
      if (opensNumberedSublist(paragraph)) {
        sublistActive = true
        sublistLastNumber = 0
      }

      return { kind: 'body' as const, paragraph }
    }

    const currentNumber = Number(numberedMatch[1])

    if (sublistActive) {
      if (currentNumber > sublistLastNumber) {
        sublistLastNumber = currentNumber
        const displayedParagraph =
          !hasArticleHeadings && currentMajorNumber > 0
            ? paragraph.replace(
                numberedParagraphPattern,
                `${currentMajorNumber}.${currentNumber} `,
              )
            : paragraph

        return { kind: 'subNumber' as const, paragraph: displayedParagraph }
      }

      sublistActive = false
      sublistLastNumber = 0
    }

    if (!hasArticleHeadings && currentNumber === expectedNumber) {
      currentMajorNumber = currentNumber
      expectedNumber += 1

      return { kind: 'heading' as const, paragraph }
    }

    if (hasArticleHeadings && currentNumber === expectedNumber) {
      expectedNumber += 1

      if (opensNumberedSublist(paragraph)) {
        sublistActive = true
        sublistLastNumber = 0
      }

      return { kind: 'number' as const, paragraph }
    }

    return { kind: 'subNumber' as const, paragraph }
  })
}

function getParagraphClassName(kind: LegalParagraphKind) {
  switch (kind) {
    case 'heading':
      return 'pt-3 text-base font-black text-[#ede8d5] first:pt-0'
    case 'number':
      return 'pl-8 [text-indent:-2rem]'
    case 'subNumber':
      return 'pl-16 [text-indent:-3rem]'
    case 'closing':
      return 'pt-6 text-right font-semibold text-[#ede8d5]'
    default:
      return undefined
  }
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
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#ede8d5]">
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
            <div className="mt-8 space-y-3 rounded-[22px] border border-[#2d2a20] bg-[#171511] p-4 text-left text-sm font-semibold leading-8 text-[#ede8d5] sm:p-6">
              {getLegalParagraphs(paragraphs).map(
                ({ kind, paragraph }, index) => (
                  <p
                    key={`${index}-${paragraph.slice(0, 12)}`}
                    className={getParagraphClassName(kind)}
                  >
                    {paragraph}
                  </p>
                ),
              )}
            </div>
          )}

          {sections.length > 0 && (
            <div className="mt-8 space-y-6">
              {sections.map((section) => (
                <section
                  key={section.title}
                  className="rounded-[22px] border border-[#2d2a20] bg-[#171511] p-4 sm:p-5"
                >
                  <h2 className="text-lg font-black text-[#ede8d5]">
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
