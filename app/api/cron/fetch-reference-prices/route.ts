export const runtime = 'nodejs'

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const functionSecret = process.env.REFERENCE_PRICES_CRON_SECRET
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!functionSecret || !cronSecret || !serviceRoleKey || !supabaseUrl) {
    return Response.json({ error: 'Cron is not configured' }, { status: 503 })
  }

  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/fetch-reference-prices`, {
    method: 'POST',
    signal: AbortSignal.timeout(60000),
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      'x-cron-secret': functionSecret,
    },
  })

  await res.body?.cancel()
  return Response.json({ ok: res.ok, status: res.status }, { status: res.ok ? 200 : 502 })
}
