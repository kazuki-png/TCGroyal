import { isAdminHostAllowedForRequest } from '@/lib/admin/hostAccess'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  checkRequestRateLimit,
  rateLimitResponse,
} from '@/lib/security/rateLimit'

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
  if (!isAdminHostAllowedForRequest(request)) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const rateLimit = checkRequestRateLimit(request, 'api:admin-reference-export', {
    limit: 30,
    windowMs: 60 * 1000,
  })
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit)
  }

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
  const has_number = searchParams.get('has_number') || ''

  const admin = createAdminClient()

  // db.max-rows の上限を回避するため 1000 件ずつページネーションして全件取得
  const PAGE = 1000
  const rows: Row[] = []
  let from = 0

  while (true) {
    let q = admin
      .from('reference_prices_deduped')
      .select('category, card_name, card_number, grade, price, site_name, fetched_date')
      .eq('fetched_date', date)
      .ilike('grade', 'PSA%')
      .order('price', { ascending: false })
      .range(from, from + PAGE - 1)

    if (category) q = q.eq('category', category)
    if (site) q = q.eq('site_name', site)
    if (card_name) q = q.ilike('card_name', `%${card_name}%`)
    if (card_number) q = q.ilike('card_number', `%${card_number}%`)
    if (grade) q = q.eq('grade', grade)
    if (has_number === '1') q = q.not('card_number', 'is', null)

    const { data, error } = await q
    if (error) return Response.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) break
    rows.push(...(data as Row[]))
    if (data.length < PAGE) break
    from += PAGE
  }

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
