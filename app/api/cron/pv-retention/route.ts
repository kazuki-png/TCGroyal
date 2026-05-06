import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const DEFAULT_RAW_RETENTION_DAYS = 90
const DEFAULT_AGGREGATE_RETENTION_DAYS = 730

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export async function GET(request: NextRequest) {
  const start = Date.now()
  const secret = process.env.CRON_SECRET

  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const rawRetentionDays = positiveInt(
    process.env.PV_RAW_RETENTION_DAYS,
    DEFAULT_RAW_RETENTION_DAYS
  )
  const aggregateRetentionDays = positiveInt(
    process.env.PV_AGGREGATE_RETENTION_DAYS,
    DEFAULT_AGGREGATE_RETENTION_DAYS
  )

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('prune_page_view_logs', {
    p_raw_retention_days: rawRetentionDays,
    p_aggregate_retention_days: aggregateRetentionDays,
  })

  if (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'pv_retention_failed',
      route: '/api/cron/pv-retention',
      ms: Date.now() - start,
      error: error.message,
    }))
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  const result = Array.isArray(data) ? data[0] : data

  console.log(JSON.stringify({
    level: 'info',
    message: 'pv_retention_completed',
    route: '/api/cron/pv-retention',
    ms: Date.now() - start,
    rawRetentionDays,
    aggregateRetentionDays,
    deletedRaw: result?.deleted_raw ?? 0,
    deletedDaily: result?.deleted_daily ?? 0,
  }))

  return NextResponse.json({
    ok: true,
    rawRetentionDays,
    aggregateRetentionDays,
    deletedRaw: result?.deleted_raw ?? 0,
    deletedDaily: result?.deleted_daily ?? 0,
  })
}
