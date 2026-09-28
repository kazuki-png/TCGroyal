import { getAdminAccess } from '@/lib/admin/authorization'
import { revalidatePath } from 'next/cache'
import { isAdminHostAllowedForRequest } from '@/lib/admin/hostAccess'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  checkRequestRateLimit,
  rateLimitResponse,
} from '@/lib/security/sharedRateLimit'
import {
  importCardsCsvContent,
  type CsvImportProgress,
} from '@/lib/admin/cardsCsvImport'

export const runtime = 'nodejs'

async function requireAdmin() { return Boolean(await getAdminAccess()) }

function streamEvent(event: CsvImportProgress | { type: 'error'; message: string }) {
  return `${JSON.stringify(event)}\n`
}

function booleanOption(formData: FormData, name: string, fallback: boolean) {
  const value = formData.getAll(name).map(String).at(-1)
  if (value === undefined) return fallback
  return value === 'true' || value === '1' || value === 'on'
}

export async function POST(request: Request) {
  if (!isAdminHostAllowedForRequest(request)) {
    return Response.json({ message: 'Not found' }, { status: 404 })
  }

  const rateLimit = await checkRequestRateLimit(request, 'api:admin-cards-import', {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  })
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit)
  }

  const isAdmin = await requireAdmin()
  if (!isAdmin) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({ message: 'Forbidden' }, { status: 403 })
  const formData = await request.formData()
  const file = formData.get('csv') as File | null
  if (!(file instanceof File) || file.size === 0 || file.size > 3 * 1024 * 1024) {
    return Response.json({ message: 'CSVファイルを選択してください' }, { status: 400 })
  }

  const body = await file.text()
  const options = {
    updateExisting: booleanOption(formData, 'updateExisting', true),
    insertNew: booleanOption(formData, 'insertNew', false),
    downloadImages: booleanOption(formData, 'downloadImages', true),
  }
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: CsvImportProgress | { type: 'error'; message: string }) => {
        controller.enqueue(encoder.encode(streamEvent(event)))
      }

      try {
        await importCardsCsvContent({
          admin: createAdminClient(),
          body,
          onProgress: send,
          options,
        })
        revalidatePath('/admin/cards')
        revalidatePath('/cart')
      } catch (error) {
        send({
          type: 'error',
          message: error instanceof Error ? error.message : 'CSV取込に失敗しました',
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
