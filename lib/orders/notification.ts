import { logEmailDebug } from '@/lib/email/send'
import { createAdminClient } from '@/lib/supabase/admin'
import type { OrderWithItems } from '@/lib/types'

export async function loadOrderForNotification(
  admin: ReturnType<typeof createAdminClient>,
  orderId: string,
  context: string
) {
  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    logEmailDebug('notification-order-load-failed', {
      context,
      orderId,
      error: orderError,
      hasOrder: Boolean(order),
    })
    return null
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('last_name, first_name, email')
    .eq('id', order.user_id)
    .maybeSingle()

  if (profileError) {
    logEmailDebug('notification-profile-load-failed', {
      context,
      orderId,
      userId: order.user_id,
      error: profileError,
    })
  }

  logEmailDebug('notification-order-load-succeeded', {
    context,
    orderId: order.id,
    orderNumber: order.order_number,
    userId: order.user_id,
    itemCount: order.order_items?.length ?? 0,
    hasProfile: Boolean(profile),
  })

  return {
    ...order,
    profiles: profile ?? undefined,
  } as unknown as OrderWithItems
}
