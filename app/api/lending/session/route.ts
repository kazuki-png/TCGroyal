import { isPreviewLendingEnabled, isSameOriginRequest } from '@/lib/lending/local-config'
import { issuePreviewSession } from '@/lib/lending/preview-session'
import { checkWorkflowRateLimit } from '@/lib/lending/workflow-client'
import { getClientIpFromHeaders, rateLimitResponse } from '@/lib/security/rateLimit'

export async function POST(request: Request) {
  if (!isPreviewLendingEnabled()) return new Response(null, { status: 404 })
  if (!isSameOriginRequest(request)) return new Response(null, { status: 403 })
  const rate = await checkWorkflowRateLimit('lending:pair', getClientIpFromHeaders(request.headers), { limit: 10, windowMs: 60000 })
  if (!rate.allowed) return rateLimitResponse(rate)
  let code: unknown
  try {
    const text = await request.text()
    if (text.length > 512) return new Response(null, { status: 413 })
    code = JSON.parse(text).code
  } catch { return new Response(null, { status: 400 }) }
  const session = typeof code === 'string' ? issuePreviewSession(code) : null
  if (!session) return Response.json({ error: 'テスト接続コードを確認してください。' }, { status: 401 })
  return Response.json({ token: session.token, expiresIn: session.expiresIn }, { headers: {
    'Cache-Control': 'private, no-store',
    'Set-Cookie': `${session.cookieName}=${session.token}; HttpOnly; Secure; SameSite=Strict; Path=/api/lending; Max-Age=${session.expiresIn}`,
  } })
}
