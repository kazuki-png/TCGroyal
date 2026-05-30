import type { createAdminClient } from '@/lib/supabase/admin'

const CARD_BUCKET = 'card-images'
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const REMOTE_IMAGE_TIMEOUT_MS = 15000
const REMOTE_IMAGE_DOWNLOAD_DELAY_MS = 300
const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
])

type AdminClient = ReturnType<typeof createAdminClient>
type CardCategory = 'pokemon' | 'onepiece'
type CardGrade = 'PSA10' | 'PSA9' | 'PSA8'

type ParsedCardRow = {
  csvLine: number
  name: string
  category: CardCategory
  card_number: string | null
  grade: CardGrade
  buy_price: number
  image_url: string | null
}

type InsertCardRow = Omit<ParsedCardRow, 'csvLine'>

export type CsvImportOptions = {
  updateExisting?: boolean
  insertNew?: boolean
  downloadImages?: boolean
}

const DEFAULT_CSV_IMPORT_OPTIONS: Required<CsvImportOptions> = {
  updateExisting: true,
  insertNew: false,
  downloadImages: true,
}

export type CsvImportProgress =
  | {
      type: 'start'
      rows: number
      downloadTotal: number
      percent: number
      message: string
    }
  | {
      type: 'progress'
      phase: 'downloading' | 'inserting'
      processed: number
      total: number
      percent: number
      message: string
    }
  | {
      type: 'warning'
      message: string
    }
  | {
      type: 'complete'
      inserted: number
      updated: number
      skipped: number
      warnings: string[]
      percent: number
      message: string
    }

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
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

function parseWebUrl(value: string | null) {
  if (!value) return null

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
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

async function ensureCardBucket(admin: AdminClient) {
  const { error: getError } = await admin.storage.getBucket(CARD_BUCKET)
  if (!getError) return

  const { error: createError } = await admin.storage.createBucket(CARD_BUCKET, {
    public: true,
    fileSizeLimit: MAX_IMAGE_SIZE,
    allowedMimeTypes: Array.from(ALLOWED_IMAGE_TYPES),
  })

  if (createError && !createError.message.toLowerCase().includes('already')) {
    throw new Error(`画像保存用Bucketの作成に失敗しました: ${createError.message}`)
  }
}

async function uploadCardImageBuffer(
  admin: AdminClient,
  buffer: Buffer,
  contentType: string
) {
  await ensureCardBucket(admin)

  const extension = imageExtensionFromType(contentType) ?? 'jpg'
  const storagePath = `cards/${crypto.randomUUID()}.${extension}`
  const { error } = await admin.storage
    .from(CARD_BUCKET)
    .upload(storagePath, buffer, {
      contentType,
      upsert: false,
    })

  if (error) throw new Error(`画像のアップロードに失敗しました: ${error.message}`)

  const {
    data: { publicUrl },
  } = admin.storage.from(CARD_BUCKET).getPublicUrl(storagePath)

  return publicUrl
}

async function fetchRemoteImage(url: URL) {
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, REMOTE_IMAGE_TIMEOUT_MS)

  try {
    return await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

async function downloadRemoteCardImage(admin: AdminClient, imageUrl: string) {
  const url = parseWebUrl(imageUrl)
  if (!url) return { publicUrl: imageUrl, warning: null }

  let response: Response
  try {
    response = await fetchRemoteImage(url)
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError'
    return {
      publicUrl: null,
      warning: timedOut
        ? `画像URLの取得がタイムアウトしました: ${imageUrl}`
        : `画像URLの取得に失敗しました: ${imageUrl}`,
    }
  }

  if (response.status === 404) {
    return {
      publicUrl: null,
      warning: `画像が見つかりませんでした: ${imageUrl} (404)`,
    }
  }

  if (!response.ok) {
    return {
      publicUrl: null,
      warning: `画像URLの取得に失敗しました: ${imageUrl} (${response.status})`,
    }
  }

  const contentLength = Number.parseInt(response.headers.get('content-length') ?? '0', 10)
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_SIZE) {
    return {
      publicUrl: null,
      warning: `画像URLのファイルサイズは5MB以下にしてください: ${imageUrl}`,
    }
  }

  const contentType =
    normalizedImageType(response.headers.get('content-type')) ?? imageTypeFromUrl(url)
  if (!contentType) {
    return {
      publicUrl: null,
      warning: `画像URLはPNG、JPEG、WebP、GIFのみ対応しています: ${imageUrl}`,
    }
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength > MAX_IMAGE_SIZE) {
    return {
      publicUrl: null,
      warning: `画像URLのファイルサイズは5MB以下にしてください: ${imageUrl}`,
    }
  }

  return {
    publicUrl: await uploadCardImageBuffer(admin, buffer, contentType),
    warning: null,
  }
}

function parseCardsCsv(body: string) {
  const lines = body
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim())

  if (lines.length < 2) throw new Error('CSVに取り込む行がありません')

  const headers = parseCsvLine(lines[0]).map((header) => header.trim())
  const rows = lines
    .slice(1)
    .map((line, index): ParsedCardRow => {
      const cells = parseCsvLine(line)
      const record = Object.fromEntries(
        headers.map((header, cellIndex) => [header, cells[cellIndex] ?? ''])
      )

      return {
        csvLine: index + 2,
        name: record.name || record.card_name || record['カード名'] || '',
        category: normalizeCategory(record.category || record['カテゴリ'] || ''),
        card_number: record.card_number || record.number || record['型番'] || null,
        grade: normalizeGrade(record.grade || record['グレード'] || ''),
        buy_price: normalizePrice(record.buy_price || record.price || record['買取価格'] || ''),
        image_url: record.image_url || record.image || record['画像URL'] || record['画像'] || null,
      }
    })
    .filter((row) => row.name)

  if (rows.length === 0) throw new Error('取り込めるカードがありません')
  return rows
}

function progressPercent(processed: number, total: number) {
  if (total <= 0) return 100
  return Math.min(100, Math.round((processed / total) * 100))
}

function cardIdentityKey(row: {
  category: CardCategory
  card_number: string | null
  grade: string
  name: string
}) {
  return `${row.category}::${row.card_number ?? ''}::${row.grade}::${row.name}`
}

export async function importCardsCsvContent({
  admin,
  body,
  onProgress,
  options,
}: {
  admin: AdminClient
  body: string
  onProgress: (event: CsvImportProgress) => void | Promise<void>
  options?: CsvImportOptions
}) {
  const resolvedOptions = {
    ...DEFAULT_CSV_IMPORT_OPTIONS,
    ...options,
  }
  const parsedRows = parseCardsCsv(body)
  const downloadTotal = resolvedOptions.downloadImages
    ? parsedRows.filter((row) => parseWebUrl(row.image_url)).length
    : 0
  const warnings: string[] = []
  const rows: InsertCardRow[] = []

  await onProgress({
    type: 'start',
    rows: parsedRows.length,
    downloadTotal,
    percent: downloadTotal > 0 ? 0 : 100,
    message:
      downloadTotal > 0
        ? `ダウンロード中... 0%`
        : 'CSVを登録しています...',
  })

  let downloaded = 0
  let lastDownloadAt = 0

  for (const row of parsedRows) {
    let imageUrl = row.image_url

    if (resolvedOptions.downloadImages && row.image_url && parseWebUrl(row.image_url)) {
      const wait = Math.max(
        0,
        REMOTE_IMAGE_DOWNLOAD_DELAY_MS - (Date.now() - lastDownloadAt)
      )
      if (wait > 0) await sleep(wait)
      lastDownloadAt = Date.now()

      await onProgress({
        type: 'progress',
        phase: 'downloading',
        processed: downloaded,
        total: downloadTotal,
        percent: progressPercent(downloaded, downloadTotal),
        message: `ダウンロード中... ${progressPercent(downloaded, downloadTotal)}%`,
      })

      const result = await downloadRemoteCardImage(admin, row.image_url)
      downloaded += 1
      imageUrl = result.publicUrl

      if (result.warning) {
        const message = `${row.csvLine}行目: ${result.warning}`
        warnings.push(message)
        await onProgress({ type: 'warning', message })
      }

      await onProgress({
        type: 'progress',
        phase: 'downloading',
        processed: downloaded,
        total: downloadTotal,
        percent: progressPercent(downloaded, downloadTotal),
        message: `ダウンロード中... ${progressPercent(downloaded, downloadTotal)}%`,
      })
    }

    rows.push({
      name: row.name,
      category: row.category,
      card_number: row.card_number,
      grade: row.grade,
      buy_price: row.buy_price,
      image_url: imageUrl,
    })
  }

  await onProgress({
    type: 'progress',
    phase: 'inserting',
    processed: rows.length,
    total: rows.length,
    percent: 100,
    message: 'カード情報を反映しています...',
  })

  // カテゴリ+型番+グレード+名前が一致するカードを既存カードとして扱う。
  const cardNumbers = [...new Set(rows.map((r) => r.card_number).filter(Boolean))] as string[]
  const noNumberNames = [...new Set(rows.filter((r) => !r.card_number).map((r) => r.name))]

  const existingCards: {
    id: string
    category: CardCategory
    card_number: string | null
    grade: string
    name: string
  }[] = []
  const PAGE = 1000

  // 型番ありカードを型番で一括取得
  if (cardNumbers.length > 0) {
    let from = 0
    while (true) {
      const { data } = await admin
        .from('cards')
        .select('id, category, card_number, grade, name')
        .in('card_number', cardNumbers)
        .range(from, from + PAGE - 1)
      if (!data || data.length === 0) break
      existingCards.push(...(data as typeof existingCards))
      if (data.length < PAGE) break
      from += PAGE
    }
  }

  // 型番なしカードを名前で一括取得（card_number IS NULL のもの）
  if (noNumberNames.length > 0) {
    let from = 0
    while (true) {
      const { data } = await admin
        .from('cards')
        .select('id, category, card_number, grade, name')
        .is('card_number', null)
        .in('name', noNumberNames)
        .range(from, from + PAGE - 1)
      if (!data || data.length === 0) break
      existingCards.push(...(data as typeof existingCards))
      if (data.length < PAGE) break
      from += PAGE
    }
  }

  const existingMap = new Map(
    existingCards.map((card) => [cardIdentityKey(card), card.id])
  )

  const toUpdate: { id: string; buy_price: number }[] = []
  const toInsert: InsertCardRow[] = []
  let skipped = 0

  for (const row of rows) {
    const existingId = existingMap.get(cardIdentityKey(row))
    if (existingId) {
      if (resolvedOptions.updateExisting) {
        toUpdate.push({ id: existingId, buy_price: row.buy_price })
      } else {
        skipped += 1
      }
      continue
    }

    if (resolvedOptions.insertNew) {
      toInsert.push(row)
    } else {
      skipped += 1
    }
  }

  // 50件ずつ並列更新（逐次だと件数が多い時にタイムアウトする）
  const UPDATE_BATCH = 50
  for (let i = 0; i < toUpdate.length; i += UPDATE_BATCH) {
    await Promise.all(
      toUpdate.slice(i, i + UPDATE_BATCH).map(async ({ id, buy_price }) => {
        const { error } = await admin.from('cards').update({ buy_price }).eq('id', id)
        if (error) throw new Error(`価格更新に失敗しました: ${error.message}`)
      })
    )
  }

  const INSERT_BATCH = 200
  for (let i = 0; i < toInsert.length; i += INSERT_BATCH) {
    const { error } = await admin
      .from('cards')
      .insert(toInsert.slice(i, i + INSERT_BATCH))
    if (error) throw new Error(`カードの新規登録に失敗しました: ${error.message}`)
  }

  const updated = toUpdate.length
  const inserted = toInsert.length

  await onProgress({
    type: 'complete',
    inserted,
    updated,
    skipped,
    warnings,
    percent: 100,
    message:
      warnings.length > 0
        ? `取込が完了しました（更新 ${updated}件・新規 ${inserted}件・スキップ ${skipped}件・警告 ${warnings.length}件）`
        : `取込が完了しました（更新 ${updated}件・新規 ${inserted}件・スキップ ${skipped}件）`,
  })
}
