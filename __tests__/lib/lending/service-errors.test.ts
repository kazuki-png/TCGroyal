import { describe, expect, it } from 'vitest';
import { apiResponseError, serviceErrorMessage } from '../../../mobile/src/service-errors';

describe('mobile service errors', () => {
  it('identifies the actual Vercel protection response instead of stringifying its nested error', () => {
    const response = { protection: { vercel_auth_enabled: true }, message: 'Protected by Vercel Authentication', error: { code: '401', message: 'Protected deployment' } };
    expect(apiResponseError(response, 401).message).toContain('Vercel');
    expect(apiResponseError(response, 401).message).not.toContain('[object Object]');
  });
  it('preserves application error messages and nested provider messages', () => {
    expect(apiResponseError({ error: 'ログインが必要です。' }, 401).message).toBe('ログインが必要です。');
    expect(apiResponseError({ error: { message: 'Try again later' } }, 429).message).toBe('Try again later');
    expect(serviceErrorMessage({ message: '[object Object]', cause: { message: 'Connection failed' } }, 'fallback')).toBe('Connection failed');
  });
  it('does not render arbitrary response objects, credentials, cycles or bogus messages', () => {
    const cyclic: Record<string, unknown> = { access_token: 'never-render-me' }; cyclic.error = cyclic;
    for (const value of [cyclic, null, { message: '[object Object]' }, { message: '{"access_token":"never-render-me"}' }]) {
      expect(serviceErrorMessage(value, 'fallback')).toBe('fallback');
    }
    expect(apiResponseError({ error: {} }, 503).message).toContain('HTTP 503');
  });
});
