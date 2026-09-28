import 'server-only'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { createAdminClient } from '@/lib/supabase/admin'

export function ownsIdentityPath(userId: string, path: string) {
  return path.startsWith(`${userId}/`) && !path.includes('..') && !path.includes(String.fromCharCode(92)) && path.split('/').length === 2
}

export async function saveIdentityImage(userId: string, file: File, documentType: string) {
  if (!(file instanceof File) || file.size === 0 || file.size > 5 * 1024 * 1024) throw new Error('画像は5MB以下で選択してください')
  let image: Buffer
  try {
    const decoder = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 24_000_000, animated: false, failOn: 'warning' })
    const metadata = await decoder.metadata()
    if (!['jpeg', 'png', 'heif'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1) throw new Error('format')
    image = await decoder.rotate().jpeg({ quality: 90 }).toBuffer()
    if (image.byteLength > 5 * 1024 * 1024) throw new Error('size')
  } catch { throw new Error('画像を読み取れません。JPGまたはPNGで保存して再度選択してください') }
  const admin = createAdminClient()
  const { data: previous, error: readError } = await admin.from('identity_documents').select('storage_path, deletion_requested_at, deleted_at').eq('user_id', userId).maybeSingle()
  if (readError || (previous?.deletion_requested_at && !previous.deleted_at)) throw new Error('書類を更新できません。時間をおいて再試行してください')
  const path = `${userId}/${randomUUID()}.jpg`
  // Record cleanup before upload. Failed and interrupted uploads remain recoverable.
  const { error: jobError } = await admin.from('identity_cleanup_jobs').insert({ user_id: userId, storage_path: path, available_at: new Date(Date.now() + 86400000).toISOString() })
  if (jobError) throw new Error('書類の保存準備に失敗しました')
  const { error: uploadError } = await admin.storage.from('identity-images').upload(path, image, { contentType: 'image/jpeg', cacheControl: '0', upsert: false })
  if (uploadError) throw new Error('書類の保存に失敗しました')
  const { error } = await admin.rpc('commit_identity_document', { p_user_id: userId, p_path: path, p_type: documentType.slice(0, 100), p_expected_path: previous?.storage_path ?? null })
  if (error) throw new Error('書類が更新されました。画面を再読み込みしてお試しください')
  return path
}
