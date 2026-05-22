import { createClient } from '@/lib/supabase/server'

const DEFAULT_LIMIT = 12
const SEARCH_TOKEN_LIMIT = 6

function normalizeSearchToken(value: string) {
  return value
    .normalize('NFKC')
    .trim()
    .replace(/[,%()_]/g, ' ')
    .replace(/\s+/g, ' ')
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10)))
  const sort = searchParams.get('sort') ?? 'price-desc'
  const q = searchParams.get('q')?.trim() ?? ''

  const supabase = await createClient()

  let query = supabase
    .from('cards')
    .select('id,name,category,card_number,grade,buy_price,image_url,created_at,updated_at', { count: 'exact' })

  query = query.eq('category', 'pokemon')

  if (q) {
    const tokens = q
      .split(/\s+/)
      .map(normalizeSearchToken)
      .filter(Boolean)
      .slice(0, SEARCH_TOKEN_LIMIT)
    for (const token of tokens) {
      query = query.or(`name.ilike.%${token}%,card_number.ilike.%${token}%`)
    }
  }

  if (sort === 'price-asc') {
    query = query.order('buy_price', { ascending: true })
  } else if (sort === 'name') {
    query = query.order('name', { ascending: true })
  } else {
    query = query.order('buy_price', { ascending: false })
  }

  const offset = (page - 1) * limit
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ data: data ?? [], total: count ?? 0 })
}
