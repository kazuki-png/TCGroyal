import { getResend } from './resend'
import { getEnvironmentLabel } from '@/lib/environment'
import {
  acceptedEmailHtml,
  adminNotificationEmailHtml,
  cancelledEmailHtml,
  completedEmailHtml,
  orderSubmittedEmailHtml,
  pendingApprovalEmailHtml,
  reviewCouponEmailHtml,
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

function escapeEmailNoticeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function environmentSubject(subject: unknown, label: string) {
  if (typeof subject !== 'string') return subject
  const prefix = `【${label}】`
  return subject.startsWith(prefix) ? subject : `${prefix}${subject}`
}

function environmentHtmlNotice(label: string) {
  const escapedLabel = escapeEmailNoticeHtml(label)

  return `
    <div style="max-width:640px;margin:16px auto;padding:14px 18px;border:2px solid #d97706;border-radius:12px;background:#fff7ed;color:#7c2d12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;font-weight:700;line-height:1.7;">
      【${escapedLabel}】このメールはテスト環境から送信されています。本番の通知ではありません。
    </div>
  `
}

function environmentTextNotice(label: string) {
  return [
    `【${label}】このメールはテスト環境から送信されています。本番の通知ではありません。`,
    '',
  ].join('\n')
}

function injectEnvironmentHtml(html: string, label: string) {
  const notice = environmentHtmlNotice(label)
  if (html.includes('このメールはテスト環境から送信されています')) return html

  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body([^>]*)>/i, (match) => `${match}${notice}`)
  }

  return `${notice}${html}`
}

function decoratePreviewEmailPayload(
  payload: Omit<CreateEmailOptions, 'from'>
): Omit<CreateEmailOptions, 'from'> {
  const label = getEnvironmentLabel()
  if (!label) return payload

  const payloadRecord = payload as Record<string, unknown>

  return {
    ...payload,
    subject: environmentSubject(payloadRecord.subject, label),
    ...(typeof payloadRecord.html === 'string'
      ? { html: injectEnvironmentHtml(payloadRecord.html, label) }
      : {}),
    ...(typeof payloadRecord.text === 'string'
      ? {
          text: payloadRecord.text.startsWith(`【${label}】`)
            ? payloadRecord.text
            : `${environmentTextNotice(label)}${payloadRecord.text}`,
        }
      : {}),
  } as Omit<CreateEmailOptions, 'from'>
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

export async function cancelScheduledEmail(
  emailId: string,
  meta: EmailDebugDetails = {}
): Promise<boolean> {
  const client = emailClient()
  if (!client) return false

  logEmailDebug('resend-cancel-start', {
    ...meta,
    resendEmailId: emailId,
  })

  const { error } = await client.emails.cancel(emailId)

  if (error) {
    logEmailDebug('resend-cancel-error', {
      ...meta,
      resendEmailId: emailId,
      error,
    })
    console.error('Resend scheduled email cancel failed', error)
    return false
  }

  logEmailDebug('resend-cancel-success', {
    ...meta,
    resendEmailId: emailId,
  })
  return true
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
    emailEnvironmentLabel: getEnvironmentLabel(),
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
): Promise<string | null> {
  const decoratedPayload = decoratePreviewEmailPayload(payload)
  const payloadRecord = decoratedPayload as Record<string, unknown>
  logEmailDebug('send-request-created', {
    ...meta,
    ...recipientSummary(payloadRecord.to),
    subject: payloadRecord.subject,
    previewEmailLabel: getEnvironmentLabel(),
    hasHtml: typeof payloadRecord.html === 'string',
    htmlLength:
      typeof payloadRecord.html === 'string' ? payloadRecord.html.length : 0,
    hasText: typeof payloadRecord.text === 'string',
    textLength:
      typeof payloadRecord.text === 'string' ? payloadRecord.text.length : 0,
    ...emailEnvironmentSnapshot(),
  })

  const client = emailClient()
  if (!client) return null

  const from = fromEmail()
  const emailPayload = {
    ...decoratedPayload,
    ...(from ? { from } : {}),
  } as CreateEmailOptions

  logEmailDebug('resend-send-start', {
    ...meta,
    ...recipientSummary(payloadRecord.to),
    subject: payloadRecord.subject,
    scheduledAt: payloadRecord.scheduledAt,
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

  return data?.id ?? null
}

function escapeEmailHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function passwordResetEmailHtml(resetUrl: string) {
  const escapedResetUrl = escapeEmailHtml(resetUrl)

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>TCG Royal パスワード再設定</title>
  <style>
    body { margin: 0; padding: 0; background: #0b0a08; color: #ede8d5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .container { max-width: 640px; margin: 0 auto; padding: 32px 20px; }
    .panel { border: 1px solid #2d2a20; border-radius: 18px; background: #12100c; padding: 28px; }
    .brand { color: #c9a52e; font-size: 13px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
    h1 { margin: 16px 0 12px; color: #f6f0dc; font-size: 24px; line-height: 1.35; }
    p { margin: 0 0 16px; color: #d7ceb8; font-size: 15px; line-height: 1.8; }
    .button { display: inline-block; margin: 10px 0 18px; border-radius: 999px; background: #c9a52e; color: #0b0a08 !important; padding: 13px 22px; font-weight: 900; text-decoration: none; }
    .note { color: #9c9278; font-size: 12px; overflow-wrap: anywhere; }
    .footer { margin-top: 18px; color: #756c56; font-size: 12px; line-height: 1.7; }
  </style>
</head>
<body>
  <div class="container">
    <div class="panel">
      <div class="brand">TCG Royal</div>
      <h1>パスワード再設定のご案内</h1>
      <p>TCG Royal アカウントのパスワード再設定を受け付けました。以下のボタンから新しいパスワードを設定してください。</p>
      <p><a class="button" href="${escapedResetUrl}">パスワードを再設定する</a></p>
      <p>このメールに心当たりがない場合は、何も操作せず破棄してください。</p>
      <p class="note">ボタンが開けない場合は、以下のURLをブラウザに貼り付けてください。<br />${escapedResetUrl}</p>
    </div>
    <div class="footer">
      <p>このメールは自動送信されています。返信は受け付けておりません。</p>
      <p>© TCG Royal</p>
    </div>
  </div>
</body>
</html>`
}

export async function sendPasswordResetEmail(
  toEmail: string,
  resetUrl: string
): Promise<boolean> {
  return Boolean(
    await sendEmail(
      {
        to: toEmail,
        subject: '【TCG Royal】パスワード再設定のご案内',
        html: passwordResetEmailHtml(resetUrl),
        text: [
          'TCG Royal パスワード再設定のご案内',
          '',
          'TCG Royal アカウントのパスワード再設定を受け付けました。',
          '以下のURLから新しいパスワードを設定してください。',
          '',
          resetUrl,
          '',
          'このメールに心当たりがない場合は、何も操作せず破棄してください。',
          '',
          'TCG Royal',
        ].join('\n'),
      },
      {
        emailType: 'password_reset',
        resetUrlOrigin: new URL(resetUrl).origin,
      }
    )
  )
}

export async function sendReviewCouponEmail(
  toEmail: string,
  customerName?: string,
  scheduledAt?: string
): Promise<string | null> {
  const lineUrl = 'https://lin.ee/Q6CsfJkl'
  const displayName = customerName?.trim()

  logEmailDebug('sendReviewCouponEmail-called', {
    toEmail,
    hasCustomerName: Boolean(displayName),
    scheduledAt,
  })

  return sendEmail(
    {
      to: toEmail,
      subject: '【TCG ROYAL】Xレビューでお得なクーポンGET！',
      html: reviewCouponEmailHtml(customerName),
      scheduledAt,
      text: [
        displayName ? `${displayName}様` : 'お客様',
        '',
        'この度はTCG ROYALの郵送買取をご利用いただき、誠にありがとうございました！',
        '',
        'もしよろしければ、Xにてサービスのご感想をご投稿いただけますと幸いです。',
        'ご投稿いただいた方には、次回の買取で使える「500円増額クーポン」をプレゼントしております🎁',
        '',
        '【参加方法】',
        '① XでTCG ROYALの郵送買取について投稿し、必ず「#TCGROYAL郵送買取」のハッシュタグを付ける',
        '② 郵送買取一覧ページより、買取申込いただいた注文の「申し込んだカードの内訳」画面をスクリーンショットし、投稿に添付',
        `③ X投稿URLをTCG ROYAL公式LINEに送信: ${lineUrl}`,
        '④ 確認後、クーポンコードをお送りいたします！',
        '',
        '簡単なご感想だけでも大歓迎です！',
        '今後ともTCG ROYALをよろしくお願いいたします。',
        '',
        'TCG ROYAL買取部',
      ].join('\n'),
    },
    {
      emailType: 'review_coupon',
    }
  )
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
  } else if (status === 'cancelled') {
    await sendEmail({
      to: toEmail,
      subject: '【TCG Royal】買取申し込みのキャンセルを受け付けました',
      html: cancelledEmailHtml(order, {
        customerName: customerName(order),
        mypageUrl: mypageOrderUrl(order),
      }),
    }, {
      emailType: 'status_cancelled',
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
