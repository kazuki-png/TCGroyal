// Public configuration metadata only; never return keys, tokens or personal data.
export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview') return new Response(null, { status: 404 })
  let supabaseRef: string | null = null
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
    if (url.hostname.endsWith('.supabase.co')) supabaseRef = url.hostname.split('.')[0]
  } catch { /* Report missing configuration without revealing the value. */ }
  return Response.json({ environment: 'preview', supabaseRef }, {
    headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  })
}
