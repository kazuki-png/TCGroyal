import { getAdminAccess } from '@/lib/admin/authorization'
import { createAdminClient } from '@/lib/supabase/admin'
import { ownsIdentityPath } from '@/lib/identity/documents'
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/security/sharedRateLimit'

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } })
type Context = { params: Promise<{ documentId: string }> }

export async function GET(request: Request, { params }: Context) {
  const access = await getAdminAccess(true)
  if (!access) return json({ error: '本人確認の審査権限と二段階認証が必要です' }, 403)
  const limit = await checkRequestRateLimit(request, 'kyc:view', { limit: 60, windowMs: 60000 })
  if (!limit.allowed) return rateLimitResponse(limit)
  const admin = createAdminClient()
  const { documentId } = await params
  const { data: doc, error } = await admin.from('identity_documents').select('id,user_id,storage_path,deleted_at,deletion_requested_at').eq('id', documentId).maybeSingle()
  if (error) return json({ error: '書類情報の取得に失敗しました' }, 503)
  if (!doc) return json({ error: '書類が見つかりません' }, 404)
  if (doc.deleted_at || doc.deletion_requested_at) return json({ error: '削除済みまたは削除処理中です' }, 410)
  if (!ownsIdentityPath(doc.user_id, doc.storage_path)) return json({ error: '書類の参照情報が不正です' }, 409)
  const { error: auditError } = await admin.from('identity_document_access_logs').insert({ document_id: doc.id, accessed_by: access.user.id, action: 'view', reason: 'signed_url_requested' })
  if (auditError) return json({ error: '監査記録を保存できないため閲覧できません' }, 503)
  const { data, error: signError } = await admin.storage.from('identity-images').createSignedUrl(doc.storage_path, 60)
  if (signError || !data?.signedUrl) return json({ error: '画像の取得に失敗しました' }, 503)
  return json({ url: data.signedUrl })
}

export async function DELETE(request: Request, { params }: Context) {
  const access = await getAdminAccess(true)
  if (!access) return json({ error: '本人確認の審査権限と二段階認証が必要です' }, 403)
  const origin = request.headers.get('origin')
  if (!origin || origin !== new URL(request.url).origin) return json({ error: '不正な送信元です' }, 403)
  const limit = await checkRequestRateLimit(request, 'kyc:delete', { limit: 20, windowMs: 60000 })
  if (!limit.allowed) return rateLimitResponse(limit)
  const admin = createAdminClient()
  const { documentId } = await params
  const { data: doc, error } = await admin.rpc('begin_identity_deletion', { p_document_id: documentId, p_reviewer: access.user.id })
  if (error || !doc) return json({ error: '削除を開始できません' }, 409)
  if (doc.deleted_at) return json({ success: true })
  if (!ownsIdentityPath(doc.user_id, doc.storage_path)) return json({ error: '書類の参照情報が不正です' }, 409)
  const { error: removeError } = await admin.storage.from('identity-images').remove([doc.storage_path])
  if (removeError) return json({ error: '原本を削除できませんでした。再度削除を実行してください' }, 503)
  const { error: finishError } = await admin.rpc('finish_identity_deletion', { p_document_id: documentId, p_reviewer: access.user.id, p_path: doc.storage_path })
  if (finishError) return json({ error: '削除記録の保存に失敗しました。再度削除を実行してください' }, 503)
  return json({ success: true })
}
