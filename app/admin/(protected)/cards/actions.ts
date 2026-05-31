'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isAdminHostAllowedFromHeaders } from '@/lib/admin/serverHostAccess'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const CARD_BUCKET = 'card-images'
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
])

type CardCategory = 'pokemon' | 'onepiece'
type CardGrade = 'PSA10' | 'PSA9' | 'PSA8'

async function requireAdmin() {
  if (!(await isAdminHostAllowedFromHeaders())) {
    redirect('/')
  }

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
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

function normalizeCategory(value: string): CardCategory {
  return value === 'onepiece' ? 'onepiece' : 'pokemon'
}

function normalizeGrade(value: string): CardGrade {
  if (value === 'PSA9' || value === 'PSA8') return value
  return 'PSA10'
}

function normalizePrice(value: string) {
  const price = Number.parseInt(value.replace(/[^\d]/g, ''), 10)
  return Number.isFinite(price) ? price : 0
}

function redirectCards(messageKey: 'saved' | 'deleted' | 'error', message = '1'): never {
  redirect(`/admin/cards?${messageKey}=${encodeURIComponent(message)}`)
}

function normalizedImageType(value: string | null) {
  const type = value?.split(';')[0]?.trim().toLowerCase() ?? ''
  return ALLOWED_IMAGE_TYPES.has(type) ? type : null
}

function imageExtensionFromType(contentType: string) {
  const byType: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }
  return byType[contentType] ?? null
}

function imageTypeFromUrl(url: URL) {
  const extension = url.pathname.split('.').pop()?.toLowerCase()
  const byExtension: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
  }
  return extension ? byExtension[extension] ?? null : null
}

function imageExtension(file: File) {
  const byType = imageExtensionFromType(file.type)
  if (byType) return byType
  const extension = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  return ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension)
    ? extension
    : 'jpg'
}

function validateImage(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return 'PNG、JPEG、WebP、GIF の画像を選択してください'
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return '画像サイズは5MB以下にしてください'
  }
  return null
}

async function ensureCardBucket(admin: ReturnType<typeof createAdminClient>) {
  const { error: getError } = await admin.storage.getBucket(CARD_BUCKET)
  if (!getError) return

  const { error: createError } = await admin.storage.createBucket(CARD_BUCKET, {
    public: true,
    fileSizeLimit: MAX_IMAGE_SIZE,
    allowedMimeTypes: Array.from(ALLOWED_IMAGE_TYPES),
  })

  if (createError && !createError.message.toLowerCase().includes('already')) {
    redirectCards('error', `画像保存用Bucketの作成に失敗しました: ${createError.message}`)
  }
}

async function uploadCardImage(
  admin: ReturnType<typeof createAdminClient>,
  file: File
) {
  const validation = validateImage(file)
  if (validation) redirectCards('error', validation)

  return uploadCardImageBuffer(
    admin,
    Buffer.from(await file.arrayBuffer()),
    file.type,
    imageExtension(file)
  )
}

async function uploadCardImageBuffer(
  admin: ReturnType<typeof createAdminClient>,
  buffer: Buffer,
  contentType: string,
  extension = imageExtensionFromType(contentType) ?? 'jpg'
) {
  await ensureCardBucket(admin)

  const storagePath = `cards/${crypto.randomUUID()}.${extension}`
  const { error } = await admin.storage
    .from(CARD_BUCKET)
    .upload(storagePath, buffer, {
      contentType,
      upsert: false,
    })

  if (error) redirectCards('error', `画像のアップロードに失敗しました: ${error.message}`)

  const {
    data: { publicUrl },
  } = admin.storage.from(CARD_BUCKET).getPublicUrl(storagePath)

  return publicUrl
}

function parseWebUrl(value: string | null) {
  if (!value) return null

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

async function uploadRemoteCardImage(
  admin: ReturnType<typeof createAdminClient>,
  imageUrl: string
) {
  const url = parseWebUrl(imageUrl)
  if (!url) return imageUrl

  let response: Response
  try {
    response = await fetch(url, { redirect: 'follow' })
  } catch {
    redirectCards('error', `画像URLの取得に失敗しました: ${imageUrl}`)
  }

  if (!response.ok) {
    redirectCards('error', `画像URLの取得に失敗しました: ${imageUrl} (${response.status})`)
  }

  const contentLength = Number.parseInt(response.headers.get('content-length') ?? '0', 10)
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_SIZE) {
    redirectCards('error', `画像URLのファイルサイズは5MB以下にしてください: ${imageUrl}`)
  }

  const contentType =
    normalizedImageType(response.headers.get('content-type')) ?? imageTypeFromUrl(url)
  if (!contentType) {
    redirectCards('error', `画像URLはPNG、JPEG、WebP、GIFのみ対応しています: ${imageUrl}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength > MAX_IMAGE_SIZE) {
    redirectCards('error', `画像URLのファイルサイズは5MB以下にしてください: ${imageUrl}`)
  }

  return uploadCardImageBuffer(admin, buffer, contentType)
}

function cardPayload(formData: FormData) {
  return {
    name: text(formData, 'name'),
    category: normalizeCategory(text(formData, 'category')),
    card_number: text(formData, 'card_number') || null,
    grade: normalizeGrade(text(formData, 'grade')),
    buy_price: normalizePrice(text(formData, 'buy_price')),
  }
}

export async function createCard(formData: FormData) {
  await requireAdmin()
  const payload = cardPayload(formData)
  if (!payload.name) redirectCards('error', 'カード名を入力してください')

  const admin = createAdminClient()
  const file = formData.get('image') as File | null
  let imageUrl: string | null = text(formData, 'image_url') || null

  if (file && file.size > 0) {
    imageUrl = await uploadCardImage(admin, file)
  }

  const { error } = await admin.from('cards').insert({
    ...payload,
    image_url: imageUrl,
  })

  if (error) redirectCards('error', `カードの追加に失敗しました: ${error.message}`)

  revalidatePath('/admin/cards')
  revalidatePath('/cart')
  redirectCards('saved')
}

export async function updateCard(formData: FormData) {
  await requireAdmin()
  const cardId = text(formData, 'card_id')
  if (!cardId) redirectCards('error', '更新するカードが見つかりません')

  const payload: Record<string, string | number | null> = cardPayload(formData)
  const admin = createAdminClient()
  const file = formData.get('image') as File | null

  if (file && file.size > 0) {
    payload.image_url = await uploadCardImage(admin, file)
  } else if (text(formData, 'image_url')) {
    payload.image_url = text(formData, 'image_url')
  }

  const { error } = await admin.from('cards').update(payload).eq('id', cardId)
  if (error) redirectCards('error', `カードの更新に失敗しました: ${error.message}`)

  revalidatePath('/admin/cards')
  revalidatePath('/cart')
  redirectCards('saved')
}

export async function deleteCard(formData: FormData) {
  await requireAdmin()
  const cardId = text(formData, 'card_id')
  if (!cardId) redirectCards('error', '削除するカードが見つかりません')

  const admin = createAdminClient()
  const { error } = await admin.from('cards').delete().eq('id', cardId)
  if (error) redirectCards('error', `カードの削除に失敗しました: ${error.message}`)

  revalidatePath('/admin/cards')
  revalidatePath('/cart')
  redirectCards('deleted')
}

function parseCsvLine(line: string) {
  const cells: string[] = []
  let current = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (char === '"' && quoted && next === '"') {
      current += '"'
      index += 1
      continue
    }
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (char === ',' && !quoted) {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += char
  }

  cells.push(current.trim())
  return cells
}

export async function importCardsCsv(formData: FormData) {
  await requireAdmin()
  const file = formData.get('csv') as File | null
  if (!file || file.size === 0) redirectCards('error', 'CSVファイルを選択してください')

  const body = await file.text()
  const lines = body.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) redirectCards('error', 'CSVに取り込む行がありません')

  const headers = parseCsvLine(lines[0]).map((header) => header.trim())
  const parsedRows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    const record = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']))
    return {
      name: record.name || record.card_name || record['カード名'] || '',
      category: normalizeCategory(record.category || record['カテゴリ'] || ''),
      card_number: record.card_number || record.number || record['型番'] || null,
      grade: normalizeGrade(record.grade || record['グレード'] || ''),
      buy_price: normalizePrice(record.buy_price || record.price || record['買取価格'] || ''),
      image_url: record.image_url || record['画像URL'] || null,
    }
  }).filter((row) => row.name)

  if (parsedRows.length === 0) redirectCards('error', '取り込めるカードがありません')

  const admin = createAdminClient()
  const rows = []
  for (const row of parsedRows) {
    rows.push({
      ...row,
      image_url: row.image_url
        ? await uploadRemoteCardImage(admin, row.image_url)
        : null,
    })
  }

  const { error } = await admin.from('cards').insert(rows)
  if (error) redirectCards('error', `CSV取込に失敗しました: ${error.message}`)

  revalidatePath('/admin/cards')
  revalidatePath('/cart')
  redirectCards('saved')
}
