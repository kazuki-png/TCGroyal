export const runtime = 'edge'

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!cronSecret || !serviceRoleKey || !supabaseUrl) {
    return Response.json({ error: 'Cron is not configured' }, { status: 503 })
  }

  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/fetch-reference-prices`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  })

  const body = await res.text()
  return Response.json({ ok: res.ok, status: res.status, body })
}
