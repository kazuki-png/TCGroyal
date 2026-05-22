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

type ResolvedSiteUrl = {
  url: string
  source: string
}

function normalizeOrigin(value: string | null | undefined) {
  const trimmed = value?.trim().replace(/\/+$/, '')
  if (!trimmed) return null

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`

  try {
    const url = new URL(withProtocol)
    if (url.hostname === '0.0.0.0') {
      url.hostname = 'localhost'
    }
    return url.origin
  } catch {
    return null
  }
}

function isLocalOrigin(origin: string) {
  try {
    const { hostname } = new URL(origin)
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1'
    )
  } catch {
    return false
  }
}

function originFromHeaders(headerList: HeaderReader) {
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host')
  if (!host) return null

  const protocol =
    headerList.get('x-forwarded-proto') ??
    (host.includes('localhost') ||
    host.startsWith('127.') ||
    host.startsWith('0.0.0.0')
      ? 'http'
      : 'https')

  return normalizeOrigin(`${protocol}://${host}`)
}

function firstUsableOrigin(
  candidates: Array<[string, string | null]>,
  allowLocal: boolean
): ResolvedSiteUrl | null {
  for (const [source, origin] of candidates) {
    if (!origin) continue
    if (allowLocal || !isLocalOrigin(origin)) {
      return { url: origin, source }
    }
  }

  return null
}

async function publicSiteUrl(): Promise<ResolvedSiteUrl | null> {
  const headerOrigin = originFromHeaders(await headers())
  const resetOrigin = normalizeOrigin(process.env.PASSWORD_RESET_SITE_URL)
  const configuredOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL)
  const vercelProductionOrigin = normalizeOrigin(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
  )
  const vercelOrigin = normalizeOrigin(process.env.VERCEL_URL)

  const canonical = firstUsableOrigin(
    [
      ['PASSWORD_RESET_SITE_URL', resetOrigin],
      ['NEXT_PUBLIC_SITE_URL', configuredOrigin],
      ['VERCEL_PROJECT_PRODUCTION_URL', vercelProductionOrigin],
      ['VERCEL_URL', vercelOrigin],
      ['request_headers', headerOrigin],
    ],
    false
  )

  if (canonical) {
    return canonical
  }

  if (process.env.NODE_ENV !== 'production') {
    return firstUsableOrigin(
      [
        ['PASSWORD_RESET_SITE_URL', resetOrigin],
        ['NEXT_PUBLIC_SITE_URL', configuredOrigin],
        ['request_headers', headerOrigin],
      ],
      true
    )
  }

  return null
}

function isUserNotFoundError(error: { message?: string; status?: number } | null) {
  if (!error) return false
  return (
    error.status === 404 ||
    /user.*not.*found|not.*found|no.*user/i.test(error.message ?? '')
  )
}

export async function forgotPasswordAction(
  _prev: ForgotPasswordState | undefined,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = (formData.get('email') as string).trim()

  if (!email) {
    return { error: 'メールアドレスを入力してください' }
  }

  const resolvedSiteUrl = await publicSiteUrl()
  if (!resolvedSiteUrl) {
    console.error('[password-reset] public site URL could not be resolved')
    return { error: 'メール送信設定に不備があります。時間をおいて再度お試しください' }
  }

  const resetBaseUrl = resolvedSiteUrl.url

  console.info('[password-reset] request received', {
    emailDomain: email.split('@')[1] ?? null,
    siteUrlOrigin: resetBaseUrl,
    siteUrlSource: resolvedSiteUrl.source,
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasResendApiKey: Boolean(process.env.RESEND_API_KEY),
    hasResendFromEmail: Boolean(process.env.RESEND_FROM_EMAIL?.trim()),
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  })

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[password-reset] SUPABASE_SERVICE_ROLE_KEY is not configured')
    return { error: 'メール送信設定に不備があります。管理者にお問い合わせください' }
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('[password-reset] RESEND_API_KEY is not configured')
    return { error: 'メール送信設定に不備があります。管理者にお問い合わせください' }
  }

  const supabase = createAdminClient()
  const redirectTo = new URL('/auth/update-password', resetBaseUrl).toString()

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  })

  const tokenHash = data?.properties?.hashed_token

  if (error || !tokenHash) {
    console.error('[password-reset] recovery link generation failed', {
      message: error?.message,
      status: error?.status,
      hasTokenHash: Boolean(tokenHash),
    })

    if (isUserNotFoundError(error ?? null)) {
      console.info('[password-reset] no auth user found; returning success to avoid account enumeration', {
        emailDomain: email.split('@')[1] ?? null,
      })
      return { success: true }
    }

    return { error: 'リセットリンクの作成に失敗しました。しばらく経ってから再試行してください' }
  }

  console.info('[password-reset] recovery link generated', {
    emailDomain: email.split('@')[1] ?? null,
    hasTokenHash: Boolean(tokenHash),
    hasActionLink: Boolean(data?.properties?.action_link),
    redirectToOrigin: new URL(redirectTo).origin,
  })

  const resetUrl = new URL('/auth/confirm', resetBaseUrl)
  resetUrl.searchParams.set('token_hash', tokenHash)
  resetUrl.searchParams.set('type', 'recovery')
  resetUrl.searchParams.set('next', '/auth/update-password')

  try {
    const sent = await sendPasswordResetEmail(email, resetUrl.toString())
    if (!sent) {
      console.error('[password-reset] custom email sender returned false')
      return { error: 'メールの送信に失敗しました。しばらく経ってから再試行してください' }
    }
  } catch (sendError) {
    console.error('[password-reset] custom email send failed', sendError)
    return { error: 'メールの送信に失敗しました。しばらく経ってから再試行してください' }
  }

  console.info('[password-reset] custom password reset email sent', {
    emailDomain: email.split('@')[1] ?? null,
    resetUrlOrigin: resetUrl.origin,
  })

  return { success: true }
}
