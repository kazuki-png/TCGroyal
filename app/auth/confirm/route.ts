import type { EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
])

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/'
  }

  return value
}

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return Boolean(value && EMAIL_OTP_TYPES.has(value as EmailOtpType))
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = safeNextPath(searchParams.get('next'))
  const redirectTo = request.nextUrl.clone()

  if (redirectTo.hostname === '0.0.0.0') {
    redirectTo.hostname = 'localhost'
  }

  redirectTo.pathname = next
  redirectTo.search = ''

  console.info('[auth-confirm] request received', {
    hasTokenHash: Boolean(tokenHash),
    type,
    next,
  })

  if (tokenHash && isEmailOtpType(type)) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })

    if (!error) {
      console.info('[auth-confirm] verifyOtp succeeded', { type, next })
      return NextResponse.redirect(redirectTo)
    }

    console.error('[auth-confirm] verifyOtp failed', {
      type,
      message: error.message,
      status: error.status,
    })
  }

  redirectTo.pathname = '/login'
  redirectTo.searchParams.set('error', 'auth_confirmation_failed')
  return NextResponse.redirect(redirectTo)
}
