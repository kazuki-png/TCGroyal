import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const DUPLICATE_WINDOW_SECONDS = 30
const EXCLUDED_PREFIXES = ['/admin', '/api', '/_next']
const ASSET_PATH_PATTERN = /\.(?:png|jpe?g|gif|webp|svg|ico|css|js|map|txt|xml|json)$/i

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

export async function POST(request: NextRequest) {
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
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
