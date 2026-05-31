import { isAdminHostAllowedForRequest } from '@/lib/admin/hostAccess'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  checkRequestRateLimit,
  rateLimitResponse,
} from '@/lib/security/rateLimit'

const SIGNED_URL_EXPIRY_SECONDS = 5 * 60 // 5分

async function requireKycReviewer() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!adminRow || adminRow.role !== 'kyc_reviewer') return null
  return user
}

// GET: 短時間 signed URL を発行して返す（URLはDBに保存しない）
export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  if (!isAdminHostAllowedForRequest(request)) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const rateLimit = checkRequestRateLimit(request, 'api:admin-kyc-view', {
    limit: 60,
    windowMs: 60 * 1000,
  })
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit)
  }

  const reviewer = await requireKycReviewer()
  if (!reviewer) {
    return Response.json({ error: '閲覧権限がありません' }, { status: 403 })
  }

  const { documentId } = await params
  const admin = createAdminClient()

  const { data: doc } = await admin
    .from('identity_documents')
    .select('id, user_id, storage_path, deleted_at')
    .eq('id', documentId)
    .maybeSingle()

  if (!doc) {
    return Response.json({ error: '書類が見つかりません' }, { status: 404 })
  }

  if (doc.deleted_at) {
    return Response.json({ error: 'この書類は削除されています' }, { status: 410 })
  }

  // 閲覧ログを記録してから signed URL を発行
  await admin.from('identity_document_access_logs').insert({
    document_id: doc.id,
    accessed_by: reviewer.id,
    action: 'view',
  })

  const { data: signedData, error: signedError } = await admin.storage
    .from('identity-images')
    .createSignedUrl(doc.storage_path, SIGNED_URL_EXPIRY_SECONDS)

  if (signedError || !signedData?.signedUrl) {
    return Response.json({ error: 'URLの発行に失敗しました' }, { status: 500 })
  }

  // signed URL はレスポンスに含めるのみ。DBには保存しない。
  return Response.json({ url: signedData.signedUrl })
}

// DELETE: ストレージから原本を削除し、メタデータを論理削除する
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  if (!isAdminHostAllowedForRequest(request)) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const rateLimit = checkRequestRateLimit(request, 'api:admin-kyc-delete', {
    limit: 20,
    windowMs: 60 * 1000,
  })
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit)
  }

  const reviewer = await requireKycReviewer()
  if (!reviewer) {
    return Response.json({ error: '操作権限がありません' }, { status: 403 })
  }

  const { documentId } = await params
  const admin = createAdminClient()

  const { data: doc } = await admin
    .from('identity_documents')
    .select('id, user_id, storage_path, deleted_at')
    .eq('id', documentId)
    .maybeSingle()

  if (!doc) {
    return Response.json({ error: '書類が見つかりません' }, { status: 404 })
  }

  if (doc.deleted_at) {
    return Response.json({ error: 'この書類はすでに削除されています' }, { status: 410 })
  }

  // ストレージから原本削除（ファイルが既に存在しない場合もエラーにしない）
  await admin.storage.from('identity-images').remove([doc.storage_path])

  const now = new Date().toISOString()

  // メタデータを論理削除
  await admin
    .from('identity_documents')
    .update({ deleted_at: now })
    .eq('id', doc.id)

  // プロフィールの id_image_url をクリア
  await admin
    .from('profiles')
    .update({ id_image_url: null })
    .eq('id', doc.user_id)

  // 削除ログを記録
  await admin.from('identity_document_access_logs').insert({
    document_id: doc.id,
    accessed_by: reviewer.id,
    action: 'delete',
  })

  return Response.json({ success: true })
}
