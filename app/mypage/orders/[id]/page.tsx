import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/app/components/StatusBadge'
import type { OrderStatus } from '@/lib/types'

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: order } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!order) notFound()

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/mypage" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← 一覧に戻る
        </Link>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold">{order.order_number}</h1>
        <StatusBadge status={order.status as OrderStatus} />
      </div>
      <p className="mb-6 text-sm text-zinc-400">
        {new Date(order.created_at).toLocaleDateString('ja-JP')}
      </p>

      <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">申込カード</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-100 text-left text-sm text-zinc-500">
              <th className="pb-2 font-medium">カード名</th>
              <th className="pb-2 font-medium">グレード</th>
              <th className="pb-2 text-right font-medium">枚数</th>
              <th className="pb-2 text-right font-medium">単価</th>
              <th className="pb-2 text-right font-medium">小計</th>
            </tr>
          </thead>
          <tbody>
            {order.order_items?.map((item: {
              id: string
              card_name: string
              grade: string
              quantity: number
              unit_price: number
            }) => (
              <tr key={item.id} className="border-b border-zinc-50">
                <td className="py-3 text-sm">{item.card_name}</td>
                <td className="py-3 text-sm text-zinc-500">{item.grade}</td>
                <td className="py-3 text-right text-sm">{item.quantity}枚</td>
                <td className="py-3 text-right text-sm">
                  ¥{item.unit_price.toLocaleString()}
                </td>
                <td className="py-3 text-right text-sm font-medium">
                  ¥{(item.unit_price * item.quantity).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="pt-3 text-right font-semibold">
                合計
              </td>
              <td className="pt-3 text-right text-lg font-bold">
                ¥{order.total_amount.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">振込先口座</h2>
        <dl className="space-y-2 text-sm">
          {[
            { label: '銀行', value: order.bank_name },
            { label: '支店', value: order.bank_branch },
            { label: '口座番号', value: order.bank_account_no },
            { label: '口座名義', value: order.bank_holder },
          ].map(({ label, value }) => (
            <div key={label} className="flex gap-4">
              <dt className="w-20 text-zinc-500">{label}</dt>
              <dd className="font-medium">{value ?? '-'}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
