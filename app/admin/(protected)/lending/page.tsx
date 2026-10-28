import Link from 'next/link'
import {isPreviewLendingEnabled} from '@/lib/lending/local-config'
import { requireAdminUser } from '@/lib/admin/authorization'
import { createAdminClient } from '@/lib/supabase/admin'
import { LendingPreview } from './LendingPreview'

export default async function LendingPage() {
  await requireAdminUser()
  const { data, error } = await createAdminClient().from('cards')
    .select('public_uid,name,card_number,category,grade,buy_price,buy_price_updated_at')
    .eq('grade', 'PSA10').in('category', ['pokemon', 'onepiece'])
    .gt('buy_price', 0).order('buy_price', { ascending: false }).limit(200)
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-sm font-semibold text-amber-400">TCG ROYAL / 担保査定</p>
        <h1 className="mt-2 text-2xl font-black">融資額の概算プレビュー</h1>
        <p className="mt-3 text-sm leading-7 text-zinc-400">
          PSA10の掲載価格とTCG ROYALの買取価格で参考額を計算します。
          商品の対応付け・現物・本人確認は別途審査が必要です。
        </p>
      </div>
      {isPreviewLendingEnabled()&&<Link className="inline-block rounded-lg bg-amber-200 px-4 py-3 font-bold text-black" href="/lending#support-cases">個別見積もり案件の管理・手動登録</Link>}
      {error ? <p role="alert" className="text-red-400">カード一覧を取得できません。</p>
        : <LendingPreview cards={data ?? []} />}
    </div>
  )
}
