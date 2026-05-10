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

  const admin = createAdminClient()

  // フィルター選択肢を実データから取得
  const [{ data: gradeRows }, { data: siteRows }] = await Promise.all([
    admin.from('reference_prices').select('grade').order('grade'),
    admin.from('reference_prices').select('site_name').order('site_name'),
  ])
  const grades = [...new Set((gradeRows ?? []).map((r: { grade: string }) => r.grade))].filter(Boolean).sort()
  const sites = [...new Set((siteRows ?? []).map((r: { site_name: string }) => r.site_name))].filter(Boolean).sort()

  let query = admin
    .from('reference_prices_deduped')
    .select('id, category, card_name, card_number, grade, price, site_name, fetched_date', {
      count: 'exact',
    })
    .eq('fetched_date', date)
    .order('price', { ascending: false })

  if (category) query = query.eq('category', category)
  if (site) query = query.eq('site_name', site)
  if (card_name) query = query.ilike('card_name', `%${card_name}%`)
  if (card_number) query = query.ilike('card_number', `%${card_number}%`)
  if (grade) query = query.eq('grade', grade)

  const { data: records, count } = await query
  const rows = (records ?? []) as ReferencePriceRow[]

  const exportParams = new URLSearchParams({ date })
  if (category) exportParams.set('category', category)
  if (site) exportParams.set('site', site)
  if (card_name) exportParams.set('card_name', card_name)
  if (card_number) exportParams.set('card_number', card_number)
  if (grade) exportParams.set('grade', grade)

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
