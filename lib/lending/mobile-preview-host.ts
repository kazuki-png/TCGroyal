// This alias serves the Git-linked develop deployment; it must never serve Production.
export const MOBILE_PREVIEW_HOST = 'tcg-royal-mobile-preview-collectorsrepublic.vercel.app'
export const MOBILE_PREVIEW_ORIGIN = `https://${MOBILE_PREVIEW_HOST}`
const mobilePaths = new Set([
  '/api/lending/account', '/api/lending/catalog', '/api/lending/card-image',
  '/api/lending/documents', '/api/lending/notifications', '/api/lending/workflow',
  '/api/lending/support-cases', '/api/lending/session', '/api/lending/cards',
])
export function isMobilePreviewHost(host: string) { return host.toLowerCase() === MOBILE_PREVIEW_HOST }
export function isMobilePreviewPath(path: string) { return mobilePaths.has(path) }
