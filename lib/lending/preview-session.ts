import 'server-only'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { isPreviewLendingEnabled } from './local-config'

const COOKIE = 'tcg_lending_preview'
const sign = (value: string) => createHmac('sha256', process.env.LENDING_PREVIEW_SESSION_SECRET!).update(value).digest('base64url')
function equal(a: string, b: string) {
  const left = Buffer.from(a); const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}
export function issuePreviewSession(code: string, now = Date.now()) {
  if (!isPreviewLendingEnabled() || code.length < 16 || code.length > 200) return null
  const hash = createHash('sha256').update(code).digest('hex')
  const customer = equal(hash, process.env.LENDING_PREVIEW_CUSTOMER_CODE_HASH!)
  const admin = equal(hash, process.env.LENDING_PREVIEW_ADMIN_CODE_HASH!)
  if (!customer && !admin) return null
  const role = admin ? 'admin' : 'customer'
  const id = admin ? process.env.LENDING_PREVIEW_ADMIN_ID! : process.env.LENDING_PREVIEW_CUSTOMER_ID!
  const body = Buffer.from(JSON.stringify({ id, role, exp: Math.floor(now / 1000) + 7200, ref: process.env.LENDING_PREVIEW_DB_REF })).toString('base64url')
  return { token: `${body}.${sign(body)}`, cookieName: COOKIE, expiresIn: 7200 }
}
export function readPreviewActor(request: Request, now = Date.now()) {
  if (!isPreviewLendingEnabled()) return null
  const bearer = request.headers.get('authorization')?.match(/^Bearer ([\w.-]+)$/)?.[1]
  const cookie = request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1)
  const token = bearer ?? cookie
  if (!token || token.length > 1500) return null
  const [body, signature, extra] = token.split('.')
  if (!body || !signature || extra || !equal(signature, sign(body))) return null
  try {
    const value = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    const id = value.role === 'admin' ? process.env.LENDING_PREVIEW_ADMIN_ID : value.role === 'customer' ? process.env.LENDING_PREVIEW_CUSTOMER_ID : null
    if (!id || value.id !== id || value.ref !== process.env.LENDING_PREVIEW_DB_REF || !Number.isSafeInteger(value.exp) || value.exp <= Math.floor(now / 1000)) return null
    return { id, role: value.role as 'admin' | 'customer', demo: true } as const
  } catch { return null }
}
