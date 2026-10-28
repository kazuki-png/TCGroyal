import { describe, expect, it } from 'vitest';
import { ACCESS_RETENTION_MS, DEFAULT_PREVIEW_URL, createVaultQueue, parseRememberedAccess, trustedPreviewUrl, migratePreviewAccessUrl } from '../../../mobile/src/remembered-access';
const now = Date.now();
const record = { version: 1, kind: 'code', url: DEFAULT_PREVIEW_URL, savedAt: now, code: 'fixture-code-0123456789' };
describe('remembered Preview access validation', () => {
  it('migrates the previously shipped project endpoint without forwarding its old private share query', () => {
    expect(migratePreviewAccessUrl('https://tcg-royal-9a2agk48s-collectorsrepublic.vercel.app/lending?_vercel_share=old-fixture')).toBe(DEFAULT_PREVIEW_URL);
  });
  it('never migrates an arbitrary app or a credential-bearing URL', () => {
    for (const value of ['https://other.vercel.app', 'https://user:pass@tcg-royal-9a2agk48s-collectorsrepublic.vercel.app']) expect(() => migratePreviewAccessUrl(value)).toThrow();
  });
  it('accepts the selected Preview origin and its private sharing query', () => {
    expect(trustedPreviewUrl(`${DEFAULT_PREVIEW_URL}/lending?_vercel_share=fixture`).origin).toBe(DEFAULT_PREVIEW_URL);
  });
  it('does not send real member tokens to another Vercel project or URL-embedded credentials', () => {
    for (const url of ['https://another-project.vercel.app', DEFAULT_PREVIEW_URL.replace('https:', 'http:'), DEFAULT_PREVIEW_URL.replace('https://', 'https://user:password@')]) {
      expect(() => trustedPreviewUrl(url)).toThrow();
    }
  });
  it('restores valid code access while stripping extra fields', () => {
    expect(parseRememberedAccess(JSON.stringify({ ...record, token: 'never-restore-a-bearer-token' }), now)).toEqual(record);
  });
  it('does not persist Firebase ID tokens in the connection record', () => {
    const firebase = { version: 1, kind: 'firebase', url: DEFAULT_PREVIEW_URL, savedAt: now };
    expect(parseRememberedAccess(JSON.stringify({ ...firebase, token: 'secret' }), now)).toEqual(firebase);
  });
  it('rejects expired, future and malformed records', () => {
    for (const savedAt of [now - ACCESS_RETENTION_MS, now + 1, 'invalid']) expect(() => parseRememberedAccess(JSON.stringify({ ...record, savedAt }), now)).toThrow();
    expect(() => parseRememberedAccess('invalid', now)).toThrow();
    expect(() => parseRememberedAccess(JSON.stringify({ ...record, code: 'short' }), now)).toThrow();
  });
  it('never restores credentials to HTTP, lookalike domains or URL-embedded credentials', () => {
    for (const url of ['http://example.vercel.app', 'https://example.vercel.app.attacker.com', 'https://user:pass@example.vercel.app', 'https://example.vercel.app:444']) {
      expect(() => parseRememberedAccess(JSON.stringify({ ...record, url }), now)).toThrow();
    }
  });
  it('keeps logout deletion after an in-flight credential save', async () => {
    const enqueue = createVaultQueue(); let stored: string | null = null;
    let finish!: () => void;
    const pending = new Promise<void>(resolve => { finish = resolve; });
    const save = enqueue(async () => { await pending; stored = 'encrypted-record'; });
    const logout = enqueue(async () => { stored = null; });
    finish(); await Promise.all([save, logout]); expect(stored).toBeNull();
  });
  it('still removes credentials if an earlier write failed', async () => {
    const enqueue = createVaultQueue(); let removed = false;
    const failed = enqueue(async () => { throw Error('storage-failed'); });
    const logout = enqueue(async () => { removed = true; });
    await expect(failed).rejects.toThrow('storage-failed'); await logout; expect(removed).toBe(true);
  });
});
