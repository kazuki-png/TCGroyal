import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Supabase Auth コールバック
// Supabase Dashboard > Authentication > URL Configuration で
// Site URL と Redirect URLs に本番ドメインを設定すること
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  if (requestUrl.hostname === '0.0.0.0') {
    requestUrl.hostname = 'localhost'
  }

  const { searchParams, origin } = requestUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
