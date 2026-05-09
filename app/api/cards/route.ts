import { createClient } from '@/lib/supabase/server'

const DEFAULT_LIMIT = 12

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10)))
  const category = searchParams.get('category') ?? ''
  const sort = searchParams.get('sort') ?? 'price-desc'
  const q = searchParams.get('q')?.trim() ?? ''

  const supabase = await createClient()

  let query = supabase
    .from('cards')
    .select('id,name,category,card_number,grade,buy_price,image_url,created_at,updated_at', { count: 'exact' })

  if (category) {
    const cats = category.split(',').filter(Boolean)
    if (cats.length === 1) {
      query = query.eq('category', cats[0])
    }
  }

  if (q) {
    query = query.or(`name.ilike.%${q}%,card_number.ilike.%${q}%`)
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
