export function safeLocalPath(value: unknown, fallback = '/mypage') {
  if (typeof value !== 'string' || !value.startsWith('/') || /[\\\u0000-\u0020\u007f]/.test(value)) return fallback
  try {
    const base = 'https://local.invalid'
    const url = new URL(value, base)
    if (url.origin !== base || ['/login', '/register', '/signup'].includes(url.pathname)) return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch { return fallback }
}
