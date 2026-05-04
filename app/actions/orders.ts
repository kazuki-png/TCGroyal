'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendStatusEmail } from '@/lib/email/send'
import { EMAIL_TRIGGER_STATUSES, ORDER_STATUS_FLOW } from '@/lib/types'
import type { CartItem, OrderStatus, OrderWithItems } from '@/lib/types'

export async function createOrder(
  items: CartItem[],
  bankInfo: {
    bank_name: string
    bank_branch: string
    bank_account_no: string
    bank_holder: string
  }
): Promise<{ error?: string }> {
  if (items.length === 0) {
    return { error: 'カードを選択してください' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const totalAmount = items.reduce(
    (sum, item) => sum + item.card.buy_price * item.quantity,
    0
  )

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: user.id,
      status: 'unhandled',
      total_amount: totalAmount,
      ...bankInfo,
    })
    .select()
    .single()

  if (orderError || !order) {
    return { error: '注文の作成に失敗しました' }
  }

  const orderItems = items.map((item) => ({
    order_id: order.id,
    card_id: item.card.id,
    card_name: item.card.name,
    grade: item.card.grade,
    quantity: item.quantity,
    unit_price: item.card.buy_price,
  }))

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems)

  if (itemsError) {
    return { error: '注文明細の作成に失敗しました' }
  }

  revalidatePath('/mypage')
  redirect('/mypage')
}

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: '認証が必要です' }
  }

  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', user.id)
    .single()

  if (!adminRow) {
    return { error: '管理者権限が必要です' }
  }

  const adminClient = createAdminClient()

  const { data: currentOrder } = await adminClient
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .single()

  if (!currentOrder) {
    return { error: '注文が見つかりません' }
  }

  const currentIndex = ORDER_STATUS_FLOW.indexOf(
    currentOrder.status as OrderStatus
  )
  const newIndex = ORDER_STATUS_FLOW.indexOf(newStatus)

  if (newIndex <= currentIndex) {
    return { error: '無効なステータス変更です' }
  }

  const { error: updateError } = await adminClient
    .from('orders')
    .update({ status: newStatus })
    .eq('id', orderId)

  if (updateError) {
    return { error: 'ステータスの更新に失敗しました' }
  }

  await adminClient.from('order_status_logs').insert({
    order_id: orderId,
    old_status: currentOrder.status,
    new_status: newStatus,
    changed_by: user.id,
  })

  if (EMAIL_TRIGGER_STATUSES.includes(newStatus)) {
    const { data: orderWithItems } = await adminClient
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .single()

    if (orderWithItems) {
      const { data: authUser } = await adminClient.auth.admin.getUserById(
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

  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath('/admin/orders')

  return {}
}
