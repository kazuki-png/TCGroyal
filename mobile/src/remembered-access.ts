export const DEFAULT_PREVIEW_URL = 'https://tcg-royal-git-develop-collectorsrepublic.vercel.app';
export const ACCESS_RETENTION_MS = 30 * 86400000;
// Only migrate previously shipped endpoints from this same Preview project.
// Keep trustedPreviewUrl strict for all new, user-entered connections.
export function migratePreviewAccessUrl(value: string): string {
  const url = new URL(value);
  const previous = ['https://tcg-royal-9a2agk48s-collectorsrepublic.vercel.app','https://tcg-royal-otku1p51i-collectorsrepublic.vercel.app','https://tcg-royal-2u2kvw3cy-collectorsrepublic.vercel.app'];
  if (previous.includes(url.origin) && !url.username && !url.password && !url.port) return DEFAULT_PREVIEW_URL;
  return trustedPreviewUrl(value).href;
}
export function trustedPreviewUrl(value: string): URL {
  const url = new URL(value.trim());
  if (url.origin !== new URL(DEFAULT_PREVIEW_URL).origin || url.username || url.password || url.port) {
    throw Error('現在のPreview用の共有URLを入力してください。別の接続先にはログイン情報を送信できません。');
  }
  return url;
}
export type RememberedAccess = { version: 1; url: string; savedAt: number } & ({ kind: 'supabase' } | { kind: 'firebase' } | { kind: 'code'; code: string });
export function createVaultQueue() {
  let pending: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = pending.then(operation);
    pending = result.catch(() => {});
    return result;
  };
}
export function parseRememberedAccess(raw: string, now = Date.now()): RememberedAccess {
  const value = JSON.parse(raw);
  if (value?.version !== 1 || typeof value.url !== 'string' || value.url.length > 2500 || !Number.isFinite(value.savedAt)
    || value.savedAt > now || now - value.savedAt >= ACCESS_RETENTION_MS) throw Error('保存した接続情報の期限が切れました。再度ログインしてください。');
  const url = new URL(value.url);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.vercel.app') || url.port || url.username || url.password) throw Error('保存した接続先を確認してください。');
  if (value.kind === 'supabase') return { version: 1, kind: 'supabase', url: value.url, savedAt: value.savedAt };
  if (value.kind === 'firebase') return { version: 1, kind: 'firebase', url: value.url, savedAt: value.savedAt };
  if (value.kind === 'code' && typeof value.code === 'string' && value.code.length >= 16 && value.code.length <= 200 && !/[\r\n]/.test(value.code)) {
    return { version: 1, kind: 'code', url: value.url, code: value.code, savedAt: value.savedAt };
  }
  throw Error('保存したログイン情報を読み込めません。再度ログインしてください。');
}
