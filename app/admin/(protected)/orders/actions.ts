'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendStatusEmail } from '@/lib/email/send'
import {
  EMAIL_TRIGGER_STATUSES,
  ORDER_STATUS_FLOW,
  isBackwardOrderStatusTransition,
  isForwardOrderStatusTransition,
} from '@/lib/types'
import type { OrderStatus, OrderWithItems } from '@/lib/types'

async function requireAdmin() {
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

  return user
}

export async function setOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  reason?: string
) {
  const user = await requireAdmin()

  if (!ORDER_STATUS_FLOW.includes(newStatus)) {
    return { error: '不正なステータスです' }
  }

  const admin = createAdminClient()
  const { data: currentOrder } = await admin
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .single()

  if (!currentOrder) return { error: '注文が見つかりません' }
  const currentStatus = currentOrder.status as OrderStatus
  const rollbackReason = reason?.trim()

  if (currentStatus === newStatus) return {}

  if (
    isBackwardOrderStatusTransition(currentStatus, newStatus) &&
    !rollbackReason
  ) {
    return { error: 'ステータスを戻す場合は理由を入力してください' }
  }

  if (
    !isForwardOrderStatusTransition(currentStatus, newStatus) &&
    !isBackwardOrderStatusTransition(currentStatus, newStatus)
  ) {
    return { error: '無効なステータス変更です' }
  }

  const { error } = await admin
    .from('orders')
    .update({ status: newStatus })
    .eq('id', orderId)

  if (error) return { error: 'ステータスの更新に失敗しました' }

  await admin.from('order_status_logs').insert({
    order_id: orderId,
    old_status: currentStatus,
    new_status: newStatus,
    changed_by: user.id,
    note: rollbackReason || null,
  })

  if (EMAIL_TRIGGER_STATUSES.includes(newStatus)) {
    const { data: orderWithItems } = await admin
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .single()

    if (orderWithItems) {
      const { data: authUser } = await admin.auth.admin.getUserById(
        orderWithItems.user_id
      )

      if (authUser.user?.email) {
        await sendStatusEmail(
          authUser.user.email,
          orderWithItems as unknown as OrderWithItems,
          newStatus
        ).catch(console.error)
      }
    }
  }

  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath('/mypage/orders')

  return {}
}
