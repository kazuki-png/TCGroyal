// This alias serves the Git-linked develop deployment; it must never serve Production.
export const MOBILE_PREVIEW_HOST = 'tcg-royal-mobile-preview-collectorsrepublic.vercel.app'
export const MOBILE_PREVIEW_ORIGIN = `https://${MOBILE_PREVIEW_HOST}`
const mobilePaths = new Set([
  '/lending/test', '/lending/download',
  '/api/lending/identity/callback', '/lending/about', '/lending/privacy', '/lending/terms',
  '/api/lending/account', '/api/lending/catalog', '/api/lending/card-image',
  '/api/lending/documents', '/api/lending/notifications', '/api/lending/workflow',
  '/api/lending/reminders', '/api/lending/support-cases', '/api/lending/session', '/api/lending/cards',
])
export function isMobilePreviewHost(host: string) { return host.toLowerCase() === MOBILE_PREVIEW_HOST }
export function isLendingWebPath(path:string) {
  return path === '/lending-web/index.html' || path === '/lending-web/favicon.ico' ||
    /^\/lending-web\/(?:assets|_expo)\/[a-zA-Z0-9_./@-]+$/.test(path) && !path.split('/').includes('..') && !path.endsWith('.map');
}
export function isMobilePreviewPath(path: string) { return mobilePaths.has(path) || isLendingWebPath(path) }
