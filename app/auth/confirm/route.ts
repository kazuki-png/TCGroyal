import { logSafeError } from '@/lib/security/logging'

import { safeLocalPath } from '@/lib/security/redirect'
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

const safeNextPath = (value: unknown) => safeLocalPath(value, "/")

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

  const destination = new URL(next, redirectTo.origin)
  redirectTo.pathname = destination.pathname
  redirectTo.search = destination.search

  if (tokenHash && isEmailOtpType(type)) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })

    if (!error) {
      return NextResponse.redirect(redirectTo)
    }

    logSafeError('[auth-confirm] verifyOtp failed', {
      type,
      message: error.message,
      status: error.status,
    })
  }

  redirectTo.pathname = '/login'
  redirectTo.searchParams.set('error', 'auth_confirmation_failed')
  return NextResponse.redirect(redirectTo)
}
