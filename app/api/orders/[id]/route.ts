import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  checkRequestRateLimit,
  rateLimitResponse,
} from '@/lib/security/rateLimit'

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const rateLimit = checkRequestRateLimit(request, 'api:orders-id', {
    limit: 120,
    windowMs: 60 * 1000,
  })
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit)
  }

  const { id } = await ctx.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', user.id)
    .single()

  if (adminRow) {
    const adminClient = createAdminClient()
    const { data, error } = await adminClient
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', id)
      .single()

    if (error) {
      return Response.json({ error: error.message }, { status: 404 })
    }

    return Response.json(data)
  }

  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 404 })
  }

  return Response.json(data)
}
