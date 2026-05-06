'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const BANNER_BUCKET = 'site-banners'
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
])

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', user.id)
    .single()

  if (!adminRow) {
    redirect('/admin/login')
  }
}

function redirectWithError(message: string): never {
  redirect(`/admin/banners?error=${encodeURIComponent(message)}`)
}

function redirectWithSaved(): never {
  redirect('/admin/banners?saved=1')
}

function getString(formData: FormData, key: string) {
  return ((formData.get(key) as string | null) ?? '').trim()
}

function getSortOrder(formData: FormData) {
  const value = Number.parseInt(getString(formData, 'sort_order'), 10)
  return Number.isFinite(value) ? value : 0
}

function getImageExtension(file: File) {
  const byType: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }

  if (byType[file.type]) return byType[file.type]

  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension)
    ? extension
    : 'png'
}

function validateBannerImage(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return 'PNG、JPEG、WebP、GIF の画像を選択してください'
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return '画像サイズは5MB以下にしてください'
  }

  return null
}

async function uploadBannerImage(
  admin: ReturnType<typeof createAdminClient>,
  file: File
) {
  const validationError = validateBannerImage(file)
  if (validationError) redirectWithError(validationError)

  const extension = getImageExtension(file)
  const storagePath = `homepage/${crypto.randomUUID()}.${extension}`
  const { error: uploadError } = await admin.storage
    .from(BANNER_BUCKET)
    .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    redirectWithError(`画像のアップロードに失敗しました: ${uploadError.message}`)
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(BANNER_BUCKET).getPublicUrl(storagePath)

  return { publicUrl, storagePath }
}

export async function createBanner(formData: FormData) {
  await requireAdmin()

  const file = formData.get('image') as File | null
  if (!file || file.size === 0) {
    redirectWithError('バナー画像を選択してください')
  }

  const admin = createAdminClient()
  const { publicUrl, storagePath } = await uploadBannerImage(admin, file)

  const { error } = await admin.from('homepage_banners').insert({
    title: getString(formData, 'title'),
    image_url: publicUrl,
    storage_path: storagePath,
    link_url: getString(formData, 'link_url') || '#',
    sort_order: getSortOrder(formData),
    is_active: formData.get('is_active') === 'on',
  })

  if (error) {
    await admin.storage.from(BANNER_BUCKET).remove([storagePath])
    redirectWithError(`バナーの保存に失敗しました: ${error.message}`)
  }

  revalidatePath('/')
  revalidatePath('/admin/banners')
  redirectWithSaved()
}

export async function updateBanner(formData: FormData) {
  await requireAdmin()

  const bannerId = getString(formData, 'banner_id')
  if (!bannerId) {
    redirectWithError('更新するバナーが見つかりません')
  }

  const admin = createAdminClient()
  const { data: existingBanner } = await admin
    .from('homepage_banners')
    .select('storage_path')
    .eq('id', bannerId)
    .single()

  if (!existingBanner) {
    redirectWithError('更新するバナーが見つかりません')
  }

  const updates: Record<string, string | number | boolean | null> = {
    title: getString(formData, 'title'),
    link_url: getString(formData, 'link_url') || '#',
    sort_order: getSortOrder(formData),
    is_active: formData.get('is_active') === 'on',
  }

  let newStoragePath: string | null = null
  const file = formData.get('image') as File | null

  if (file && file.size > 0) {
    const uploaded = await uploadBannerImage(admin, file)
    updates.image_url = uploaded.publicUrl
    updates.storage_path = uploaded.storagePath
    newStoragePath = uploaded.storagePath
  }

  const { error } = await admin
    .from('homepage_banners')
    .update(updates)
    .eq('id', bannerId)

  if (error) {
    if (newStoragePath) {
      await admin.storage.from(BANNER_BUCKET).remove([newStoragePath])
    }
    redirectWithError(`バナーの更新に失敗しました: ${error.message}`)
  }

  if (newStoragePath && existingBanner.storage_path) {
    await admin.storage.from(BANNER_BUCKET).remove([existingBanner.storage_path])
  }

  revalidatePath('/')
  revalidatePath('/admin/banners')
  redirectWithSaved()
}

export async function deleteBanner(formData: FormData) {
  await requireAdmin()

  const bannerId = getString(formData, 'banner_id')
  if (!bannerId) {
    redirectWithError('削除するバナーが見つかりません')
  }

  const admin = createAdminClient()
  const { data: existingBanner } = await admin
    .from('homepage_banners')
    .select('storage_path')
    .eq('id', bannerId)
    .single()

  const { error } = await admin
    .from('homepage_banners')
    .delete()
    .eq('id', bannerId)

  if (error) {
    redirectWithError(`バナーの削除に失敗しました: ${error.message}`)
  }

  if (existingBanner?.storage_path) {
    await admin.storage.from(BANNER_BUCKET).remove([existingBanner.storage_path])
  }

  revalidatePath('/')
  revalidatePath('/admin/banners')
  redirectWithSaved()
}
