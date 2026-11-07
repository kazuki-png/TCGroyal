// Self-contained HTML: no analytics, scripts, external assets or authentication cookies.
// These registration documents deliberately exist only in the Preview environment.
type Section = readonly [heading: string, text: string]
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]!))

export function sandboxDocument(title: string, sections: readonly Section[], status = 200) {
  if (process.env.VERCEL_ENV !== 'preview') return new Response(null, {status:404, headers:{'Cache-Control':'no-store'}})
  return new Response(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>${escape(title)} | TCG ROYAL</title><style>
  *{box-sizing:border-box}body{margin:0;background:#0b0b09;color:#eee9d8;font-family:system-ui,sans-serif;line-height:1.85}header,main,footer{max-width:760px;margin:auto;padding:24px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #3e3824}a{color:#d4b235;text-underline-offset:4px}.brand{font-size:22px;letter-spacing:3px;text-decoration:none}.badge{font-size:12px;color:#d4b235;border:1px solid #776523;padding:2px 10px;border-radius:6px}h1{font-size:26px;line-height:1.5;color:#d4b235;margin:8px 0 24px}h2{font-size:17px;margin:24px 0 6px}p{margin:0;overflow-wrap:anywhere}footer{font-size:13px;border-top:1px solid #3e3824}nav{display:flex;flex-wrap:wrap;gap:8px 20px}small{display:block;color:#b2ad9d;margin-top:14px}@media(max-width:400px){header,main,footer{padding:18px}.brand{font-size:19px}h1{font-size:23px}}
  </style></head><body><header><a class="brand" href="/lending/about">TCG ROYAL</a><span class="badge">テスト環境</span></header><main><h1>${escape(title)}</h1>${sections.map(([heading,text])=>`<section><h2>${escape(heading)}</h2><p>${escape(text)}</p></section>`).join('')}</main><footer><nav aria-label="サービス情報"><a href="/lending/about">サービス概要</a><a href="/lending/privacy">プライバシーポリシー</a><a href="/lending/terms">利用規約</a></nav><small>TCG ROYAL · テスト環境用 · 2026年11月7日</small></footer></body></html>`, {status, headers:{
    'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'private, no-store',
    'Referrer-Policy':'no-referrer', 'X-Robots-Tag':'noindex, nofollow, noarchive',
    'X-Content-Type-Options':'nosniff', 'X-Frame-Options':'DENY',
    'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  }})
}
