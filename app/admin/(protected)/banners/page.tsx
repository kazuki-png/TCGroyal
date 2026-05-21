import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/admin'
import { ImageUploadPreviewInput } from '@/components/ImageUploadPreviewInput'
import type { HomepageBanner } from '@/lib/types'
import { AdminFlashMessage } from './AdminFlashMessage'
import { createBanner, deleteBanner, updateBanner } from './actions'
import { DeleteBannerButton } from './DeleteBannerButton'

export default async function AdminBannersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; deleted?: string }>
}) {
  const { error, saved, deleted } = await searchParams
  const admin = createAdminClient()
  const { data } = await admin
    .from('homepage_banners')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  const banners = (data ?? []) as HomepageBanner[]

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">
            バナー設定
          </h1>
          <p className="mt-2 text-sm font-black text-zinc-400">
            トップページのスライドバナーを管理します。
          </p>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-zinc-500">
            推奨サイズ: 2400×900px（8:3）または 1920×720px。画像全体を表示するため、端末によって上下左右に余白が入る場合があります。
          </p>
        </div>
      </div>

      {error && <AdminFlashMessage tone="error">{error}</AdminFlashMessage>}
      {saved && (
        <AdminFlashMessage tone="success">保存しました</AdminFlashMessage>
      )}
      {deleted && (
        <AdminFlashMessage tone="deleted">削除しました</AdminFlashMessage>
      )}

      <form
        action={createBanner}
        className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
      >
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-white">新規追加</h2>
          <p className="mt-1 text-xs font-semibold text-zinc-500">
            重要な文字やロゴは中央寄せにし、画像端から10%程度の余白を確保してください。
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_1fr_120px_auto]">
          <ImageUploadPreviewInput
            name="image"
            label="画像"
            required
            accept="image/png,image/jpeg,image/webp,image/gif"
            previewClassName="relative h-28 w-full overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950"
          />
          <label className="block">
            <span className="mb-1.5 block text-sm text-zinc-400">リンク</span>
            <input
              name="link_url"
              type="text"
              defaultValue="#"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-zinc-400"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-zinc-400">並び順</span>
            <input
              name="sort_order"
              type="number"
              defaultValue={0}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-zinc-400"
            />
          </label>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 pb-2 text-sm text-zinc-300">
              <input
                name="is_active"
                type="checkbox"
                defaultChecked
                className="h-4 w-4 accent-white"
              />
              公開
            </label>
            <button
              type="submit"
              className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-500"
            >
              追加
            </button>
          </div>
        </div>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm text-zinc-400">管理名</span>
          <input
            name="title"
            type="text"
            placeholder="春キャンペーン"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-400"
          />
        </label>
      </form>

      {banners.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-12 text-center text-zinc-500">
          バナーはまだ登録されていません
        </div>
      ) : (
        <div className="space-y-4">
          {banners.map((banner) => (
            <div
              key={banner.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
            >
              <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
                <div className="relative aspect-[16/5] overflow-hidden rounded-xl bg-zinc-950">
                  <Image
                    src={banner.image_url}
                    alt={banner.title || 'バナー'}
                    fill
                    sizes="280px"
                    className="object-contain"
                  />
                </div>
                <form action={updateBanner} className="grid gap-4">
                  <input type="hidden" name="banner_id" value={banner.id} />
                  <div className="grid gap-4 md:grid-cols-[1fr_1fr_100px]">
                    <label className="block">
                      <span className="mb-1.5 block text-sm text-zinc-400">
                        管理名
                      </span>
                      <input
                        name="title"
                        type="text"
                        defaultValue={banner.title}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-zinc-400"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm text-zinc-400">
                        リンク
                      </span>
                      <input
                        name="link_url"
                        type="text"
                        defaultValue={banner.link_url}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-zinc-400"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm text-zinc-400">
                        並び順
                      </span>
                      <input
                        name="sort_order"
                        type="number"
                        defaultValue={banner.sort_order}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-zinc-400"
                      />
                    </label>
                  </div>
                  <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                    <ImageUploadPreviewInput
                      name="image"
                      label="画像を変更"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      currentText="現在の画像を使用"
                      previewClassName="relative h-28 w-full overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950"
                    />
                    <div className="flex items-end gap-4">
                      <label className="flex items-center gap-2 pb-2 text-sm text-zinc-300">
                        <input
                          name="is_active"
                          type="checkbox"
                          defaultChecked={banner.is_active}
                          className="h-4 w-4 accent-white"
                        />
                        公開
                      </label>
                      <button
                        type="submit"
                        className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-500"
                      >
                        保存
                      </button>
                      <DeleteBannerButton action={deleteBanner} />
                    </div>
                  </div>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
