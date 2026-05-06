import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const DUPLICATE_WINDOW_SECONDS = 30
const RATE_LIMIT_WINDOW_SECONDS = 60
const RATE_LIMIT_MAX_EVENTS = 45
const EXCLUDED_PREFIXES = ['/admin', '/api', '/_next']
const ASSET_PATH_PATTERN = /\.(?:png|jpe?g|gif|webp|svg|ico|css|js|map|txt|xml|json)$/i
const BOT_USER_AGENT_PATTERN =
  /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|twitterbot|linkedinbot|discordbot|whatsapp|telegrambot|pinterest|semrush|ahrefs|petalbot|baiduspider|yandex|duckduckbot|curl|wget|python-requests|httpclient|headlesschrome|phantomjs|lighthouse/i

type PageViewPayload = {
  path?: unknown
  sessionId?: unknown
}

function normalizePath(value: unknown) {
  if (typeof value !== 'string') return null
  const path = value.trim().slice(0, 512)
  if (!path.startsWith('/')) return null
  if (path.startsWith('//')) return null
  return path
}

function normalizeSessionId(value: unknown) {
  if (typeof value !== 'string') return null
  const sessionId = value.trim().slice(0, 96)
  if (!/^[a-zA-Z0-9_-]{12,96}$/.test(sessionId)) return null
  return sessionId
}

function shouldIgnorePath(path: string) {
  return (
    EXCLUDED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)) ||
    ASSET_PATH_PATTERN.test(path)
  )
}

function shouldIgnoreUserAgent(userAgent: string | null) {
  if (!userAgent) return true
  return BOT_USER_AGENT_PATTERN.test(userAgent)
}

export async function POST(request: NextRequest) {
  const start = Date.now()
  let payload: PageViewPayload

  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const path = normalizePath(payload.path)
  const sessionId = normalizeSessionId(payload.sessionId)

  if (!path || !sessionId) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  if (shouldIgnorePath(path)) {
    return NextResponse.json({ ok: true, ignored: true })
  }

  if (shouldIgnoreUserAgent(request.headers.get('user-agent'))) {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - DUPLICATE_WINDOW_SECONDS * 1000).toISOString()
  const { data: duplicate } = await admin
    .from('page_views')
    .select('id')
    .eq('path', path)
    .eq('session_id', sessionId)
    .gte('created_at', cutoff)
    .limit(1)
    .maybeSingle()

  if (duplicate) {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  const rateLimitCutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000).toISOString()
  const { count: recentCount, error: rateLimitError } = await admin
    .from('page_views')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .gte('created_at', rateLimitCutoff)

  if (rateLimitError) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'page_view_rate_limit_check_failed',
      route: '/api/page-view',
      path,
      ms: Date.now() - start,
      error: rateLimitError.message,
    }))
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  if ((recentCount ?? 0) >= RATE_LIMIT_MAX_EVENTS) {
    return NextResponse.json({ ok: true, rateLimited: true })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await admin.from('page_views').insert({
    path,
    session_id: sessionId,
    user_id: user?.id ?? null,
  })

  if (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'page_view_insert_failed',
      route: '/api/page-view',
      path,
      ms: Date.now() - start,
      error: error.message,
    }))
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  const { error: aggregateError } = await admin.rpc(
    'increment_page_view_daily_count',
    { p_path: path }
  )

  if (aggregateError) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'page_view_aggregate_failed',
      route: '/api/page-view',
      path,
      ms: Date.now() - start,
      error: aggregateError.message,
    }))
  }

  return NextResponse.json({ ok: true })
}
