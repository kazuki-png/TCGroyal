import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type Row = {
  category: string
  card_name: string
  card_number: string | null
  grade: string
  price: number
  site_name: string
  fetched_date: string
}

function todayJST() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0]
}

function escapeCsv(value: string | number | null | undefined): string {
  const str = value == null ? '' : String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', user.id)
    .single()
  if (!adminRow) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') || todayJST()
  const category = searchParams.get('category') || ''
  const site = searchParams.get('site') || ''
  const card_name = searchParams.get('card_name') || ''
  const card_number = searchParams.get('card_number') || ''
  const grade = searchParams.get('grade') || ''

  const admin = createAdminClient()
  let query = admin
    .from('reference_prices_deduped')
    .select('category, card_name, card_number, grade, price, site_name, fetched_date')
    .eq('fetched_date', date)
    .order('price', { ascending: false })

  if (category) query = query.eq('category', category)
  if (site) query = query.eq('site_name', site)
  if (card_name) query = query.ilike('card_name', `%${card_name}%`)
  if (card_number) query = query.ilike('card_number', `%${card_number}%`)
  if (grade) query = query.eq('grade', grade)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as Row[]

  const header = 'name,category,card_number,grade,buy_price,image_url'
  const lines = rows.map((r) =>
    [
      escapeCsv(r.card_name),
      escapeCsv(r.category),
      escapeCsv(r.card_number),
      escapeCsv(r.grade),
      escapeCsv(r.price),
      '',
    ].join(',')
  )

  const csv = '﻿' + [header, ...lines].join('\r\n')
  const filename = `reference_prices_${date}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
