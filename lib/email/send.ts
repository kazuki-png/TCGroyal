import { getResend } from './resend'
import {
  acceptedEmailHtml,
  adminNotificationEmailHtml,
  completedEmailHtml,
  orderSubmittedEmailHtml,
  pendingApprovalEmailHtml,
  type AdminNotificationKind,
} from './templates'
import type { CreateEmailOptions } from 'resend'
import type { OrderStatus, OrderWithItems } from '@/lib/types'

type EmailDebugDetails = Record<string, unknown>

const EMAIL_DEBUG_PREFIX = '[email-debug]'
const DEFAULT_RESEND_FROM_EMAIL = 'TCG Royal <onboarding@resend.dev>'

function fromEmail() {
  return process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_RESEND_FROM_EMAIL
}

function fromEmailSource() {
  return process.env.RESEND_FROM_EMAIL?.trim()
    ? 'RESEND_FROM_EMAIL'
    : 'default_onboarding_resend_dev'
}

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') ?? ''
}

function customerName(order: OrderWithItems) {
  const profile = order.profiles
  return [profile?.last_name, profile?.first_name].filter(Boolean).join(' ')
}

function mypageOrderUrl(order: OrderWithItems) {
  const baseUrl = siteUrl()
  return baseUrl ? `${baseUrl}/mypage/orders/${order.id}` : undefined
}

function adminOrderUrl(order: OrderWithItems) {
  const baseUrl = siteUrl()
  return baseUrl ? `${baseUrl}/admin/orders/${order.id}` : undefined
}

function adminRecipients() {
  return (
    process.env.ADMIN_NOTIFICATION_EMAILS ??
    process.env.ADMIN_NOTIFICATION_EMAIL ??
    ''
  )
    .split(/[,\s;]+/)
    .map((email) => email.trim())
    .filter(Boolean)
}

export function maskEmailAddress(email: string | null | undefined) {
  if (!email) return null

  const [local = '', domain = ''] = email.split('@')
  const maskedLocal =
    local.length <= 2 ? `${local.slice(0, 1)}***` : `${local.slice(0, 2)}***`
  const maskedDomain =
    domain.length <= 4
      ? domain.replace(/./g, '*')
      : `${domain.slice(0, 2)}***${domain.slice(domain.lastIndexOf('.'))}`

  return domain ? `${maskedLocal}@${maskedDomain}` : `${maskedLocal}`
}

function sanitizeDebugValue(key: string, value: unknown): unknown {
  const lowerKey = key.toLowerCase()

  if (typeof value === 'string') {
    if (
      lowerKey.includes('email') ||
      lowerKey.includes('recipient') ||
      lowerKey === 'to' ||
      lowerKey === 'from'
    ) {
      return maskEmailAddress(value)
    }
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      typeof item === 'string' ? sanitizeDebugValue(key, item) : item
    )
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
    }
  }

  return value
}

export function logEmailDebug(event: string, details: EmailDebugDetails = {}) {
  const sanitized = Object.fromEntries(
    Object.entries(details).map(([key, value]) => [
      key,
      sanitizeDebugValue(key, value),
    ])
  )

  console.info(EMAIL_DEBUG_PREFIX, event, sanitized)
}

function recipientSummary(to: unknown) {
  const recipients = Array.isArray(to) ? to : [to]
  const emailRecipients = recipients.filter(
    (recipient): recipient is string => typeof recipient === 'string'
  )

  return {
    recipientCount: emailRecipients.length,
    recipients: emailRecipients.map(maskEmailAddress),
  }
}

function emailEnvironmentSnapshot() {
  const adminEmails = adminRecipients()

  return {
    hasResendApiKey: Boolean(process.env.RESEND_API_KEY),
    resendApiKeyLength: process.env.RESEND_API_KEY?.length ?? 0,
    hasResendFromEmail: Boolean(process.env.RESEND_FROM_EMAIL?.trim()),
    fromEmailSource: fromEmailSource(),
    adminRecipientCount: adminEmails.length,
    hasNextPublicSiteUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  }
}

function emailClient() {
  const client = getResend()
  if (!client) {
    logEmailDebug('client-missing', emailEnvironmentSnapshot())
    console.warn('RESEND_API_KEY is not configured; skipping email send')
  } else {
    logEmailDebug('client-ready', emailEnvironmentSnapshot())
  }
  return client
}

async function sendEmail(
  payload: Omit<CreateEmailOptions, 'from'>,
  meta: EmailDebugDetails
) {
  const payloadRecord = payload as Record<string, unknown>
  logEmailDebug('send-request-created', {
    ...meta,
    ...recipientSummary(payloadRecord.to),
    subject: payloadRecord.subject,
    hasHtml: typeof payloadRecord.html === 'string',
    htmlLength:
      typeof payloadRecord.html === 'string' ? payloadRecord.html.length : 0,
    hasText: typeof payloadRecord.text === 'string',
    textLength:
      typeof payloadRecord.text === 'string' ? payloadRecord.text.length : 0,
    ...emailEnvironmentSnapshot(),
  })

  const client = emailClient()
  if (!client) return

  const from = fromEmail()
  const emailPayload = {
    ...payload,
    ...(from ? { from } : {}),
  } as CreateEmailOptions

  logEmailDebug('resend-send-start', {
    ...meta,
    ...recipientSummary(payloadRecord.to),
    subject: payloadRecord.subject,
    from,
    fromEmailSource: fromEmailSource(),
    hasFrom: Boolean(from),
  })

  const { data, error } = await client.emails.send(emailPayload)

  if (error) {
    logEmailDebug('resend-send-error', {
      ...meta,
      ...recipientSummary(payloadRecord.to),
      subject: payloadRecord.subject,
      error,
    })
    console.error('Resend email send failed', error)
    throw new Error(error.message || 'メール送信に失敗しました')
  }

  logEmailDebug('resend-send-success', {
    ...meta,
    ...recipientSummary(payloadRecord.to),
    subject: payloadRecord.subject,
    resendEmailId: data?.id,
  })
}

export async function sendOrderSubmittedEmail(
  toEmail: string,
  order: OrderWithItems
): Promise<void> {
  logEmailDebug('sendOrderSubmittedEmail-called', {
    orderId: order.id,
    orderNumber: order.order_number,
    userId: order.user_id,
    toEmail,
  })

  await sendEmail({
    to: toEmail,
    subject: '【TCG Royal】買取申込を受け付けました',
    html: orderSubmittedEmailHtml(order, {
      customerName: customerName(order),
      mypageUrl: mypageOrderUrl(order),
    }),
  }, {
    emailType: 'order_submitted',
    orderId: order.id,
    orderNumber: order.order_number,
    userId: order.user_id,
  })
}

export async function sendStatusEmail(
  toEmail: string,
  order: OrderWithItems,
  status: OrderStatus
): Promise<void> {
  logEmailDebug('sendStatusEmail-called', {
    orderId: order.id,
    orderNumber: order.order_number,
    userId: order.user_id,
    status,
    toEmail,
  })

  if (status === 'accepted') {
    await sendEmail({
      to: toEmail,
      subject: '【TCG Royal】お申し込み内容を確認・承認しました',
      html: acceptedEmailHtml(order, {
        customerName: customerName(order),
        mypageUrl: mypageOrderUrl(order),
      }),
    }, {
      emailType: 'status_accepted',
      orderId: order.id,
      orderNumber: order.order_number,
      userId: order.user_id,
      status,
    })
  } else if (status === 'pending_approval') {
    await sendEmail({
      to: toEmail,
      subject: '【TCG Royal】査定結果のご確認・ご承認のお願い',
      html: pendingApprovalEmailHtml(order, {
        customerName: customerName(order),
        mypageUrl: mypageOrderUrl(order),
      }),
    }, {
      emailType: 'status_pending_approval',
      orderId: order.id,
      orderNumber: order.order_number,
      userId: order.user_id,
      status,
    })
  } else if (status === 'completed') {
    await sendEmail({
      to: toEmail,
      subject: '【振込完了】買取代金をお振込みいたしました',
      html: completedEmailHtml(order, {
        customerName: customerName(order),
        mypageUrl: mypageOrderUrl(order),
      }),
    }, {
      emailType: 'status_completed',
      orderId: order.id,
      orderNumber: order.order_number,
      userId: order.user_id,
      status,
    })
  } else {
    logEmailDebug('sendStatusEmail-no-template', {
      orderId: order.id,
      orderNumber: order.order_number,
      userId: order.user_id,
      status,
      toEmail,
    })
  }
}

export async function sendAdminOrderNotification(
  kind: AdminNotificationKind,
  order: OrderWithItems
): Promise<void> {
  const recipients = adminRecipients()
  logEmailDebug('sendAdminOrderNotification-called', {
    orderId: order.id,
    orderNumber: order.order_number,
    userId: order.user_id,
    kind,
    adminRecipientCount: recipients.length,
    adminRecipients: recipients,
  })

  if (recipients.length === 0) {
    logEmailDebug('admin-notification-no-recipients', {
      orderId: order.id,
      orderNumber: order.order_number,
      kind,
      ...emailEnvironmentSnapshot(),
    })
    console.warn(
      'ADMIN_NOTIFICATION_EMAILS is not configured; skipping admin email'
    )
    return
  }

  const subject = {
    new_order: '【管理通知】新規買取申込がありました',
    assessment_approved: '【管理通知】査定結果が承認されました',
    cancellation: '【管理通知】キャンセル商品があります',
  }[kind]

  await sendEmail({
    to: recipients,
    subject,
    html: adminNotificationEmailHtml(kind, order, {
      customerName: customerName(order),
      adminUrl: adminOrderUrl(order),
    }),
  }, {
    emailType: `admin_${kind}`,
    orderId: order.id,
    orderNumber: order.order_number,
    userId: order.user_id,
    kind,
  })
}
