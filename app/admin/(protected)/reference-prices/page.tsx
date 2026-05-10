import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type ReferencePriceRow = {
  id: string
  category: 'pokemon' | 'onepiece'
  card_name: string
  card_number: string | null
  grade: string
  price: number
  site_name: string
  fetched_date: string
}

const CATEGORY_LABELS: Record<string, string> = {
  pokemon: 'ポケモン',
  onepiece: 'ワンピース',
}

function todayJST() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0]
}

function normalize(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? (v[0] ?? '') : (v ?? '')).trim()
}

function currency(v: number) {
  return `¥${v.toLocaleString('ja-JP')}`
}

export default async function ReferencePricesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[]>>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', user.id)
    .single()
  if (!adminRow) redirect('/admin/login')

  const params = await searchParams
  const date = normalize(params.date) || todayJST()
  const category = normalize(params.category)
  const site = normalize(params.site)
  const card_name = normalize(params.card_name)
  const card_number = normalize(params.card_number)
  const grade = normalize(params.grade)
  const has_number = normalize(params.has_number) // '1' = 型番ありのみ

  const admin = createAdminClient()

  // フィルター選択肢を DISTINCT ビューから取得（行制限を回避）
  const [{ data: gradeRows }, { data: siteRows }] = await Promise.all([
    admin.from('reference_price_distinct_grades').select('grade'),
    admin.from('reference_price_distinct_sites').select('site_name'),
  ])
  const grades = (gradeRows ?? []).map((r: { grade: string }) => r.grade).filter(Boolean)
  const sites = (siteRows ?? []).map((r: { site_name: string }) => r.site_name).filter(Boolean)

  // db.max-rows の上限を回避するため 1000 件ずつページネーションして全件取得
  const PAGE = 1000
  const rows: ReferencePriceRow[] = []
  let from = 0

  while (true) {
    let q = admin
      .from('reference_prices_deduped')
      .select('id, category, card_name, card_number, grade, price, site_name, fetched_date')
      .eq('fetched_date', date)
      .order('price', { ascending: false })
      .range(from, from + PAGE - 1)

    if (category) q = q.eq('category', category)
    if (site) q = q.eq('site_name', site)
    if (card_name) q = q.ilike('card_name', `%${card_name}%`)
    if (card_number) q = q.ilike('card_number', `%${card_number}%`)
    if (grade) q = q.eq('grade', grade)
    if (has_number === '1') q = q.not('card_number', 'is', null)

    const { data } = await q
    if (!data || data.length === 0) break
    rows.push(...(data as ReferencePriceRow[]))
    if (data.length < PAGE) break
    from += PAGE
  }

  const count = rows.length

  const exportParams = new URLSearchParams({ date })
  if (category) exportParams.set('category', category)
  if (site) exportParams.set('site', site)
  if (card_name) exportParams.set('card_name', card_name)
  if (card_number) exportParams.set('card_number', card_number)
  if (grade) exportParams.set('grade', grade)
  if (has_number) exportParams.set('has_number', has_number)

  const inputClass =
    'rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500'
  const selectClass =
    'rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-zinc-500'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-black">参考価格</h1>
        <a
          href={`/api/admin/reference-prices/export?${exportParams}`}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-black text-white transition-colors hover:bg-zinc-700"
        >
          CSVエクスポート
        </a>
      </div>

      {/* フィルターフォーム */}
      <form method="GET" className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-black text-zinc-400">取得日</label>
          <input
            type="date"
            name="date"
            defaultValue={date}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-black text-zinc-400">カテゴリ</label>
          <select name="category" defaultValue={category} className={selectClass}>
            <option value="">すべて</option>
            <option value="pokemon">ポケモン</option>
            <option value="onepiece">ワンピース</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-black text-zinc-400">型番</label>
          <select name="has_number" defaultValue={has_number} className={selectClass}>
            <option value="">すべて</option>
            <option value="1">型番ありのみ</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-black text-zinc-400">ショップ</label>
          <select name="site" defaultValue={site} className={selectClass}>
            <option value="">すべて</option>
            {sites.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-black text-zinc-400">グレード</label>
          <select name="grade" defaultValue={grade} className={selectClass}>
            <option value="">すべて</option>
            {grades.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-black text-zinc-400">カード名</label>
          <input
            type="text"
            name="card_name"
            defaultValue={card_name}
            placeholder="カード名で絞り込む"
            className={`${inputClass} w-44`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-black text-zinc-400">型番</label>
          <input
            type="text"
            name="card_number"
            defaultValue={card_number}
            placeholder="型番で絞り込む"
            className={`${inputClass} w-36`}
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-black text-white transition-colors hover:bg-red-500"
          >
            絞り込む
          </button>
          <a
            href="/admin/reference-prices"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-black text-zinc-400 transition-colors hover:bg-zinc-900"
          >
            リセット
          </a>
        </div>
      </form>

      <p className="text-sm text-zinc-400">
        {(count ?? rows.length).toLocaleString('ja-JP')}件
      </p>

      <div className="overflow-x-auto bg-zinc-950">
        {rows.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm font-black text-zinc-500">
            データがありません
          </p>
        ) : (
          <table className="w-full min-w-[760px] text-white">
            <thead className="bg-[#222221]">
              <tr className="text-left text-xs text-zinc-400">
                <th className="px-4 py-3 font-black">カード名</th>
                <th className="px-4 py-3 font-black">型番</th>
                <th className="px-4 py-3 font-black">グレード</th>
                <th className="px-4 py-3 font-black">カテゴリ</th>
                <th className="px-4 py-3 text-right font-black">参考価格</th>
                <th className="px-4 py-3 font-black">ショップ</th>
                <th className="px-4 py-3 font-black">取得日</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-zinc-800 hover:bg-zinc-900">
                  <td className="px-4 py-3 text-sm font-black">{row.card_name}</td>
                  <td className="px-4 py-3 text-sm text-zinc-400">{row.card_number ?? '-'}</td>
                  <td className="px-4 py-3 text-sm text-zinc-300">{row.grade}</td>
                  <td className="px-4 py-3 text-sm text-zinc-300">
                    {CATEGORY_LABELS[row.category] ?? row.category}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-black text-red-400">
                    {currency(row.price)}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-300">{row.site_name}</td>
                  <td className="px-4 py-3 text-sm text-zinc-400">{row.fetched_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
