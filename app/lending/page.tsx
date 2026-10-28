import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { isLendingEnabled, isPreviewLendingEnabled } from '@/lib/lending/local-config'
import { LendingWorkspace } from './LendingWorkspace'

export const metadata = { title: 'TCG ROYAL | カード担保融資', robots: { index: false, follow: false } }
export default async function LendingWorkspacePage() {
  await headers()
  if (!isLendingEnabled()) notFound()
  return <LendingWorkspace demo={!isPreviewLendingEnabled() && process.env.LENDING_LOCAL_DEMO === 'true'} preview={isPreviewLendingEnabled()} />
}
