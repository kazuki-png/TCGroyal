import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types'

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const p = profile as Profile | null

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">会員情報</h1>

      <div className="space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">基本情報</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex gap-4">
              <dt className="w-32 text-zinc-500">メールアドレス</dt>
              <dd className="font-medium">{user.email}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-32 text-zinc-500">氏名</dt>
              <dd className="font-medium">
                {p?.last_name && p?.first_name
                  ? `${p.last_name} ${p.first_name}`
                  : '未設定'}
              </dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-32 text-zinc-500">氏名（カナ）</dt>
              <dd className="font-medium">
                {p?.last_name_kana && p?.first_name_kana
                  ? `${p.last_name_kana} ${p.first_name_kana}`
                  : '未設定'}
              </dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-32 text-zinc-500">生年月日</dt>
              <dd className="font-medium">{p?.birthday ?? '未設定'}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-32 text-zinc-500">電話番号</dt>
              <dd className="font-medium">{p?.phone ?? '未設定'}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-32 text-zinc-500">住所</dt>
              <dd className="font-medium">
                {p?.postal_code && p?.address
                  ? `〒${p.postal_code} ${p.address}`
                  : '未設定'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">振込先口座</h2>
          <dl className="space-y-3 text-sm">
            {[
              { label: '銀行', value: p?.bank_name },
              { label: '支店', value: p?.branch_name },
              { label: '口座種別', value: p?.account_type === 'ordinary' ? '普通' : p?.account_type === 'current' ? '当座' : null },
              { label: '口座番号', value: p?.account_number },
              { label: '口座名義（カナ）', value: p?.account_holder_kana },
            ].map(({ label, value }) => (
              <div key={label} className="flex gap-4">
                <dt className="w-32 text-zinc-500">{label}</dt>
                <dd className="font-medium">{value ?? '未設定'}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">本人確認</h2>
          <div className="flex items-center gap-3">
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                p?.identity_verified
                  ? 'bg-green-100 text-green-700'
                  : 'bg-zinc-100 text-zinc-500'
              }`}
            >
              {p?.identity_verified ? '確認済み' : '未確認'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
