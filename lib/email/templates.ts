import type { OrderWithItems } from '@/lib/types'
import { SHIPPING_DESTINATION } from '@/lib/shipping'

export type AdminNotificationKind =
  | 'new_order'
  | 'assessment_approved'
  | 'cancellation'

type EmailContext = {
  customerName?: string
  mypageUrl?: string
  adminUrl?: string
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function yen(value: number) {
  return `¥${value.toLocaleString('ja-JP')}`
}

function salutation(name?: string) {
  const cleanName = name?.trim()
  return cleanName ? `${escapeHtml(cleanName)}様` : 'お客様'
}

function currentUnitPrice(item: OrderWithItems['order_items'][number]) {
  return item.assessed_unit_price ?? item.unit_price
}

function cancellationStatusLabel(
  order: OrderWithItems,
  item: OrderWithItems['order_items'][number]
) {
  if (item.customer_decision === 'cancelled') return 'キャンセル'
  if (item.customer_decision === 'approved') return '承認'
  if (order.status === 'cancelled') return '注文キャンセル'
  return '未回答'
}

function signatureBlock() {
  return `
    <div class="signature">
      <p>TCG ROYAL 買取部</p>
    </div>
  `
}

function baseLayout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f5f5; color: #1a1a1a; margin: 0; padding: 0; }
    .container { max-width: 640px; margin: 32px auto; background: #fff; border-radius: 12px; padding: 32px; }
    .header { border-bottom: 2px solid #111; margin-bottom: 24px; padding-bottom: 16px; }
    .header h1 { margin: 0; font-size: 24px; color: #111; }
    .lead { font-size: 16px; line-height: 1.8; }
    .box { background: #f7f7f7; border-radius: 10px; padding: 16px; margin: 16px 0; }
    .amount { font-size: 20px; font-weight: 800; color: #111; }
    .button { display: inline-block; background: #111; color: #fff !important; border-radius: 999px; padding: 12px 18px; text-decoration: none; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
    th { background: #f5f5f5; font-weight: 700; }
    .signature { margin-top: 28px; border-top: 1px solid #d8d8d8; border-bottom: 1px solid #d8d8d8; padding: 12px 0; font-weight: 700; }
    .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>TCG Royal 郵送買取</h1>
    </div>
    ${body}
    <div class="footer">
      <p>このメールは自動送信されています。</p>
      <p>© TCG Royal</p>
    </div>
  </div>
</body>
</html>`
}

function itemRows(
  order: OrderWithItems,
  options: { showCancellationStatus?: boolean } = {}
) {
  return order.order_items
    .map(
      (item) => {
        const unitPrice = currentUnitPrice(item)
        return `
        <tr>
          <td>${escapeHtml(item.card_name)}</td>
          <td>${escapeHtml(item.grade)}</td>
          <td>${item.quantity}</td>
          <td>${yen(unitPrice)}</td>
          <td>${yen(unitPrice * item.quantity)}</td>
          ${
            options.showCancellationStatus
              ? `<td>${escapeHtml(cancellationStatusLabel(order, item))}</td>`
              : ''
          }
        </tr>
      `
      }
    )
    .join('')
}

function orderItemsTable(
  order: OrderWithItems,
  options: { showCancellationStatus?: boolean } = {}
) {
  const couponAmount = Math.max(0, Number(order.coupon_amount ?? 0))
  const couponHtml =
    couponAmount > 0 && order.coupon_code
      ? `<p><strong>クーポンコード：</strong>${escapeHtml(order.coupon_code)} / <strong>増額：</strong>${yen(couponAmount)}${
          order.coupon_comment
            ? `<br /><strong>コメント：</strong>${escapeHtml(order.coupon_comment)}`
            : ''
        }</p>`
      : ''

  return `
    <table>
      <thead>
        <tr>
          <th>カード名</th>
          <th>グレード</th>
          <th>数量</th>
          <th>単価</th>
          <th>小計</th>
          ${options.showCancellationStatus ? '<th>キャンセル状況</th>' : ''}
        </tr>
      </thead>
      <tbody>${itemRows(order, options)}</tbody>
    </table>
    ${couponHtml}
    <p class="amount">合計金額：${yen(order.total_amount)}</p>
  `
}

function shippingDestinationHtml() {
  return `
    <div class="box">
      <h3>発送先</h3>
      <p>
        ${SHIPPING_DESTINATION.map(
          ([label, value]) => `<strong>${label}：</strong>${escapeHtml(value)}`
        ).join('<br />')}
      </p>
    </div>
  `
}

function adminLink(url?: string) {
  if (!url) return '<p>※管理画面URLが設定されていません。</p>'
  return `<p><a class="button" href="${escapeHtml(url)}">管理画面で確認する</a></p>`
}

export function orderSubmittedEmailHtml(
  order: OrderWithItems,
  context: EmailContext = {}
): string {
  const body = `
    <p class="lead">${salutation(context.customerName)}</p>
    <p>この度はTCG Royalの郵送買取をご利用いただきありがとうございます。</p>
    <p>お申し込みを受け付けいたしました。</p>
    <p>現在、当社にて内容確認を行っております。</p>
    <p>承認完了後、発送先住所および発送方法をメールにてご案内いたしますので、商品発送は承認メール受領後にお願いいたします。</p>

    <div class="box">
      <p><strong>注文番号：</strong>${escapeHtml(order.order_number)}</p>
    </div>
    ${orderItemsTable(order)}

    <p>何卒よろしくお願いいたします。</p>
    ${signatureBlock()}
  `

  return baseLayout('買取申込を受け付けました - TCG Royal', body)
}

export function acceptedEmailHtml(
  order: OrderWithItems,
  context: EmailContext = {}
): string {
  const body = `
    <p class="lead">${salutation(context.customerName)}</p>
    <p>この度はTCG Royalの郵送買取をご利用いただきありがとうございます。</p>
    <p>お申し込み内容の確認が完了し、承認いたしました。</p>
    <p>下記住所まで商品をご発送ください。</p>

    <div class="box">
      <p><strong>注文番号：</strong>${escapeHtml(order.order_number)}</p>
    </div>
    ${shippingDestinationHtml()}
    <div class="box">
      <h3>発送について</h3>
      <p>・送料はTCG Royalが負担しますので、必ず着払いにて発送をお願いいたします<br />
      ・配送会社の指定はございません<br />
      ・発送後は追跡番号の保管をお願いいたします</p>
    </div>

    <p>商品到着後、査定完了次第ご連絡いたします。</p>
    <p>何卒よろしくお願いいたします。</p>
    ${signatureBlock()}
  `

  return baseLayout('お申し込み内容を承認しました - TCG Royal', body)
}

export function pendingApprovalEmailHtml(
  order: OrderWithItems,
  context: EmailContext = {}
): string {
  const mypageLink = context.mypageUrl
    ? `<p><a class="button" href="${escapeHtml(context.mypageUrl)}">査定結果を確認する</a></p>`
    : '<p>マイページの「郵送買取一覧」よりご確認ください。</p>'

  const body = `
    <p class="lead">${salutation(context.customerName)}</p>
    <p>この度はTCG Royalの郵送買取をご利用いただきありがとうございます。</p>
    <p>商品の査定が完了いたしました。</p>
    <p>マイページの「郵送買取一覧」より、査定結果をご確認いただき、「承認」または「キャンセル」をご選択ください。</p>

    <div class="box">
      <p><strong>注文番号：</strong>${escapeHtml(order.order_number)}</p>
      <p class="amount">査定結果合計額：${yen(order.total_amount)}</p>
    </div>
    ${mypageLink}

    <p>査定額をご承認いただき次第、最短即日にご指定口座へお振込みいたします。</p>
    <p>ご不明点がございましたら、お気軽にお問い合わせください。</p>
    <p>今後ともよろしくお願いいたします。</p>
    ${signatureBlock()}
  `

  return baseLayout('査定結果のご確認・ご承認のお願い - TCG Royal', body)
}

export function completedEmailHtml(
  order: OrderWithItems,
  context: EmailContext = {}
): string {
  const body = `
    <p class="lead">${salutation(context.customerName)}</p>
    <p>この度は郵送買取をご利用いただきありがとうございます。</p>
    <p>買取代金のお振込み手続きが完了いたしました。</p>
    <p>ご登録いただいた銀行口座をご確認ください。</p>

    <div class="box">
      <p><strong>注文番号：</strong>${escapeHtml(order.order_number)}</p>
      <p class="amount">振込金額：${yen(order.total_amount)}</p>
      <p>※金融機関によっては、着金までにお時間がかかる場合がございます。</p>
    </div>

    <p>今後ともよろしくお願いいたします。</p>
    ${signatureBlock()}
  `

  return baseLayout('買取代金をお振込みいたしました - TCG Royal', body)
}

export function reviewCouponEmailHtml(customerName?: string): string {
  const lineUrl = 'https://lin.ee/Q6CsfJkl'
  const body = `
    <p class="lead">${salutation(customerName)}</p>
    <p>この度はTCG ROYALの郵送買取をご利用いただき、誠にありがとうございました！</p>

    <p>もしよろしければ、Xにてサービスのご感想をご投稿いただけますと幸いです。<br />
    ご投稿いただいた方には、次回の買取で使える「500円増額クーポン」をプレゼントしております🎁</p>

    <div class="box">
      <h3>参加方法</h3>
      <p>① XでTCG ROYALの郵送買取について投稿し、必ず「#TCGROYAL郵送買取」のハッシュタグを付ける</p>
      <p>② 郵送買取一覧ページより、買取申込いただいた注文の「申し込んだカードの内訳」画面をスクリーンショットし、投稿に添付</p>
      <p>③ X投稿URLを<a href="${escapeHtml(lineUrl)}">TCG ROYAL公式LINE</a>に送信</p>
      <p>④ 確認後、クーポンコードをお送りいたします！</p>
    </div>

    <p>簡単なご感想だけでも大歓迎です！<br />
    今後ともTCG ROYALをよろしくお願いいたします。</p>

    ${signatureBlock()}
  `

  return baseLayout('Xレビューでお得なクーポンGET！ - TCG ROYAL', body)
}

export function cancelledEmailHtml(
  order: OrderWithItems,
  context: EmailContext = {}
): string {
  const body = `
    <p class="lead">${salutation(context.customerName)}</p>
    <p>以下の買取申し込みのキャンセルを受け付けいたしましたので、お知らせいたします。</p>

    <div class="box">
      <p><strong>注文番号：</strong>${escapeHtml(order.order_number)}</p>
    </div>
    ${orderItemsTable(order)}

    <p>なお、すでに商品をTCG ROYALへ発送済みの場合は、3営業日以内に返送手続きを行わせていただきますので、返送まで今しばらくお待ちいただけますと幸いです。</p>
    <p>返送料につきましても、TCG ROYALにて負担いたしますのでご安心ください。</p>
    <p>引き続きTCG ROYALをよろしくお願いいたします。</p>
    ${signatureBlock()}
  `

  return baseLayout('買取申し込みのキャンセルを受け付けました - TCG Royal', body)
}

export function adminNotificationEmailHtml(
  kind: AdminNotificationKind,
  order: OrderWithItems,
  context: EmailContext = {}
): string {
  const content = {
    new_order: {
      title: '新規買取申込がありました',
      lead: '新しい郵送買取申込がありました。',
      body: '管理画面より申込内容をご確認のうえ、受付対応をお願いいたします。',
    },
    assessment_approved: {
      title: '査定結果が承認されました',
      lead: 'ユーザーが査定結果を承認しました。',
      body: '管理画面をご確認のうえ、振込対応をお願いいたします。',
    },
    cancellation: {
      title: 'キャンセル商品があります',
      lead: 'ユーザーよりキャンセル申請がありました。',
      body: '返送対応が必要なため、管理画面をご確認ください。',
    },
  }[kind]

  const body = `
    <p class="lead">${escapeHtml(content.lead)}</p>
    <p>${escapeHtml(content.body)}</p>

    <div class="box">
      <p><strong>注文番号：</strong>${escapeHtml(order.order_number)}</p>
      <p><strong>ユーザー名：</strong>${escapeHtml(context.customerName || order.user_id)}</p>
      <p><strong>査定結果合計額：</strong>${yen(order.total_amount)}</p>
    </div>
    ${orderItemsTable(order, {
      showCancellationStatus: kind === 'cancellation',
    })}
    ${adminLink(context.adminUrl)}
  `

  return baseLayout(`${content.title} - TCG Royal`, body)
}
