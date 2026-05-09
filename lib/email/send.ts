import { resend } from './resend'
import {
  acceptedEmailHtml,
  inspectingEmailHtml,
  completedEmailHtml,
} from './templates'
import type { OrderStatus, OrderWithItems } from '@/lib/types'

const FROM = 'TCG Royal <onboarding@resend.dev>'

export async function sendStatusEmail(
  toEmail: string,
  order: OrderWithItems,
  status: OrderStatus
): Promise<void> {
  if (status === 'accepted') {
    await resend.emails.send({
      from: FROM,
      to: toEmail,
      subject: '【TCG Royal】買取申込を受け付けました',
      html: acceptedEmailHtml(order),
    })
  } else if (status === 'inspecting') {
    await resend.emails.send({
      from: FROM,
      to: toEmail,
      subject: '【TCG Royal】カードを受け取りました',
      html: inspectingEmailHtml(order),
    })
  } else if (status === 'completed') {
    await resend.emails.send({
      from: FROM,
      to: toEmail,
      subject: '【TCG Royal】買取代金の振込が完了しました',
      html: completedEmailHtml(order),
    })
  }
}
