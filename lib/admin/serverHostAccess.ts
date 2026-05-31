import 'server-only'

import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import {
  getRequestHostFromHeaders,
  isAdminHostAllowed,
} from '@/lib/admin/hostAccess'

export async function isAdminHostAllowedFromHeaders() {
  const requestHeaders = await headers()
  return isAdminHostAllowed(getRequestHostFromHeaders(requestHeaders))
}

export async function requireAdminHostForPage() {
  if (!(await isAdminHostAllowedFromHeaders())) {
    notFound()
  }
}
