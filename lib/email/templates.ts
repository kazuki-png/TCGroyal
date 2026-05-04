import type { OrderWithItems } from '@/lib/types'

function baseLayout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    body { font-family: sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 32px auto; background: #fff; border-radius: 8px; padding: 32px; }
    .header { border-bottom: 2px solid #1a1a1a; margin-bottom: 24px; padding-bottom: 16px; }
    .header h1 { margin: 0; font-size: 24px; color: #1a1a1a; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e5e5; }
    th { background: #f5f5f5; font-weight: 600; }
    .amount { font-size: 20px; font-weight: bold; color: #1a1a1a; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
    .badge-accepted { background: #dbeafe; color: #1d4ed8; }
    .badge-waiting { background: #fef3c7; color: #b45309; }
    .badge-completed { background: #d1fae5; color: #065f46; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>TCG Royal 郵送買取</h1>
    </div>
    ${body}
    <div class="footer">
      <p>このメールは自動送信されています。ご不明な点は、サイトよりお問い合わせください。</p>
      <p>© TCG Royal</p>
    </div>
  </div>
</body>
</html>`
}

export function acceptedEmailHtml(order: OrderWithItems): string {
  const itemRows = order.order_items
    .map(
      (item) => `
    <tr>
      <td>${item.card_name}</td>
      <td>${item.grade}</td>
      <td>${item.quantity}枚</td>
      <td>¥${item.unit_price.toLocaleString()}</td>
    </tr>`
    )
    .join('')

  const body = `
    <p>この度はTCG Royalの郵送買取にお申込みいただきありがとうございます。</p>
    <p>以下の内容で買取申込を受け付けました。</p>

    <p><span class="badge badge-accepted">受付済み</span></p>

    <h3>申込内容</h3>
    <p><strong>申込番号：</strong> ${order.id.slice(0, 8).toUpperCase()}</p>
    <table>
      <thead>
        <tr><th>カード名</th><th>グレード</th><th>枚数</th><th>買取価格</th></tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    <p class="amount">合計金額：¥${order.total_amount.toLocaleString()}</p>

    <h3>次のステップ</h3>
    <p>カードを以下の住所に郵送してください。到着後、査定を開始いたします。</p>
    <p>
      〒XXX-XXXX<br />
      東京都XX区XX 1-1-1<br />
      TCG Royal 買取担当宛
    </p>
    <p>※送料はお客様のご負担となります。追跡可能な方法での発送をお願いいたします。</p>
  `

  return baseLayout('買取申込受付のお知らせ - TCG Royal', body)
}

export function waitingArrivalEmailHtml(order: OrderWithItems): string {
  const body = `
    <p>TCG Royalをご利用いただきありがとうございます。</p>
    <p>カードの発送準備ができましたら、以下の住所にお送りください。</p>

    <p><span class="badge badge-waiting">到着待ち</span></p>

    <h3>申込番号</h3>
    <p>${order.id.slice(0, 8).toUpperCase()}</p>

    <h3>送付先</h3>
    <p>
      〒XXX-XXXX<br />
      東京都XX区XX 1-1-1<br />
      TCG Royal 買取担当宛
    </p>

    <p>カードが届き次第、査定を開始いたします。査定完了後にメールにてご連絡いたします。</p>
    <p>※追跡番号をお控えいただくことをお勧めします。</p>
  `

  return baseLayout('発送のお願い - TCG Royal', body)
}

export function completedEmailHtml(order: OrderWithItems): string {
  const body = `
    <p>TCG Royalをご利用いただきありがとうございます。</p>
    <p>買取代金の振込が完了いたしました。</p>

    <p><span class="badge badge-completed">完了</span></p>

    <h3>申込番号</h3>
    <p>${order.id.slice(0, 8).toUpperCase()}</p>

    <h3>振込金額</h3>
    <p class="amount">¥${order.total_amount.toLocaleString()}</p>

    <h3>振込先</h3>
    <p>
      銀行：${order.bank_name ?? '-'}<br />
      支店：${order.bank_branch ?? '-'}<br />
      口座番号：${order.bank_account_no ?? '-'}<br />
      口座名義：${order.bank_holder ?? '-'}
    </p>

    <p>またのご利用をお待ちしております。</p>
  `

  return baseLayout('買取完了のお知らせ - TCG Royal', body)
}
