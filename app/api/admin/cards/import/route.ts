import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  importCardsCsvContent,
  type CsvImportProgress,
} from '@/lib/admin/cardsCsvImport'

export const runtime = 'nodejs'

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return false

  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', user.id)
    .single()

  return Boolean(adminRow)
}

function streamEvent(event: CsvImportProgress | { type: 'error'; message: string }) {
  return `${JSON.stringify(event)}\n`
}

export async function POST(request: Request) {
  const isAdmin = await requireAdmin()
  if (!isAdmin) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('csv') as File | null
  if (!file || file.size === 0) {
    return Response.json({ message: 'CSVファイルを選択してください' }, { status: 400 })
  }

  const body = await file.text()
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
