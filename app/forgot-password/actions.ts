'use server'

import { headers } from 'next/headers'
import { sendPasswordResetEmail } from '@/lib/email/send'
import { createAdminClient } from '@/lib/supabase/admin'

export type ForgotPasswordState = {
  error?: string
  success?: boolean
}

type HeaderReader = {
  get(name: string): string | null
}

function normalizeOrigin(value: string | null | undefined) {
  const trimmed = value?.trim().replace(/\/+$/, '')
  if (!trimmed) return null

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`

  try {
    return new URL(withProtocol).origin
  } catch {
    return null
  }
}

function isLocalOrigin(origin: string) {
  try {
    const { hostname } = new URL(origin)
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  } catch {
    return false
  }
}

function originFromHeaders(headerList: HeaderReader) {
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host')
  if (!host) return null

  const protocol =
    headerList.get('x-forwarded-proto') ??
    (host.includes('localhost') || host.startsWith('127.') ? 'http' : 'https')

  return normalizeOrigin(`${protocol}://${host}`)
}

async function publicSiteUrl() {
  const headerOrigin = originFromHeaders(await headers())
  if (headerOrigin && !isLocalOrigin(headerOrigin)) return headerOrigin

  const configuredOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL)
  if (configuredOrigin && !isLocalOrigin(configuredOrigin)) {
    return configuredOrigin
  }

  const vercelProductionOrigin = normalizeOrigin(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
  )
  if (vercelProductionOrigin) return vercelProductionOrigin

  const vercelOrigin = normalizeOrigin(process.env.VERCEL_URL)
  if (vercelOrigin) return vercelOrigin

  if (configuredOrigin && process.env.NODE_ENV !== 'production') {
    return configuredOrigin
  }

  if (headerOrigin && process.env.NODE_ENV !== 'production') {
    return headerOrigin
  }

  return null
}

export async function forgotPasswordAction(
  _prev: ForgotPasswordState | undefined,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = (formData.get('email') as string).trim()

  if (!email) {
    return { error: 'メールアドレスを入力してください' }
  }

  const siteUrl = await publicSiteUrl()
  if (!siteUrl) {
    console.error('[password-reset] public site URL could not be resolved')
    return { error: 'メール送信設定に不備があります。時間をおいて再度お試しください' }
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[password-reset] SUPABASE_SERVICE_ROLE_KEY is not configured')
    return { error: 'メール送信設定に不備があります。時間をおいて再度お試しください' }
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('[password-reset] RESEND_API_KEY is not configured')
    return { error: 'メール送信設定に不備があります。時間をおいて再度お試しください' }
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
  })

  const tokenHash = data?.properties?.hashed_token

  if (error || !tokenHash) {
    console.error('[password-reset] recovery link generation failed', {
      message: error?.message,
      status: error?.status,
      hasTokenHash: Boolean(tokenHash),
    })
    return { error: 'メールの送信に失敗しました。しばらく経ってから再試行してください' }
  }

  const resetUrl = new URL('/auth/confirm', siteUrl)
  resetUrl.searchParams.set('token_hash', tokenHash)
  resetUrl.searchParams.set('type', 'recovery')
  resetUrl.searchParams.set('next', '/auth/update-password')

  try {
    const sent = await sendPasswordResetEmail(email, resetUrl.toString())
    if (!sent) {
      return { error: 'メール送信設定に不備があります。時間をおいて再度お試しください' }
    }
  } catch (sendError) {
    console.error('[password-reset] custom email send failed', sendError)
    return { error: 'メールの送信に失敗しました。しばらく経ってから再試行してください' }
  }

  return { success: true }
}
