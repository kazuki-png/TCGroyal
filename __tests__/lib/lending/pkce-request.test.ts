import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash, randomFillSync } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { upgradePkceRequest } from '../../../mobile/src/pkce-request';
const origin = 'https://project.supabase.co';
const hash = async (value: string) => createHash('sha256').update(value).digest('base64url');
afterEach(() => vi.unstubAllGlobals());
describe('native email PKCE compatibility', () => {
  it('preserves recovery intent through code exchange and authenticates the password update', async () => {
    vi.stubGlobal('crypto', { getRandomValues: (array: Uint32Array) => randomFillSync(array) });
    const store = new Map<string, string>();
    const events: string[] = [];
    const user = { id: 'fixture-user', email: 'fixture@example.invalid', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-01T00:00:00Z' };
    let challenge = '', passwordUpdated = false;
    const client = createClient(origin, 'public-fixture-key', { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'recovery-fixture', storage: {
      getItem: async key => store.get(key) ?? null, setItem: async (key, value) => { store.set(key, value); }, removeItem: async key => { store.delete(key); },
    } }, global: { fetch: async (input, init) => {
      const url = new URL(String(input));
      const upgraded = await upgradePkceRequest(url.href, init, origin, hash);
      const body = JSON.parse(upgraded!.body as string);
      let response: unknown;
      if (url.pathname === '/auth/v1/recover') {
        expect(body.code_challenge_method).toBe('s256'); challenge = body.code_challenge;
        expect(url.searchParams.get('redirect_to')).toBe('tcgroyal-preview://auth/callback');
        response = {};
      } else if (url.pathname === '/auth/v1/token') {
        expect(await hash(body.code_verifier)).toBe(challenge);
        expect(body.code_verifier).not.toContain('/recovery');
        response = { access_token: 'fixture-access', refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600, user };
      } else if (url.pathname === '/auth/v1/user' && upgraded?.method === 'PUT') {
        expect(new Headers(upgraded.headers).get('Authorization')).toBe('Bearer fixture-access');
        expect(body.password).toBe('new-fixture-password-0123456'); passwordUpdated = true; response = user;
      } else throw Error('Unexpected Auth request');
      return new Response(JSON.stringify(response), { headers: { 'Content-Type': 'application/json' } });
    } } });
    const subscription = client.auth.onAuthStateChange(event => { events.push(event); }).data.subscription;
    try {
      expect((await client.auth.resetPasswordForEmail(user.email, { redirectTo: 'tcgroyal-preview://auth/callback' })).error).toBeNull();
      expect(JSON.parse(store.get('recovery-fixture-code-verifier')!)).toMatch(/\/recovery$/);
      expect((await client.auth.exchangeCodeForSession('fixture-code')).error).toBeNull();
      expect(events).toContain('PASSWORD_RECOVERY');
      expect((await client.auth.updateUser({ password: 'new-fixture-password-0123456' })).error).toBeNull();
      expect(passwordUpdated).toBe(true); expect(events).toContain('USER_UPDATED');
    } finally { subscription.unsubscribe(); client.auth.stopAutoRefresh(); }
  });
  it('upgrades the native plain fallback using SHA-256 while preserving credentials and options', async () => {
    const request = { method: 'POST', body: JSON.stringify({ email: 'fixture@example.invalid', code_challenge: 'verifier', code_challenge_method: 'plain' }) };
    const result = await upgradePkceRequest(`${origin}/auth/v1/recover`, request, origin, hash);
    expect(JSON.parse(result!.body as string)).toEqual({ email: 'fixture@example.invalid', code_challenge: await hash('verifier'), code_challenge_method: 's256' });
    expect(result!.method).toBe('POST');
  });
  it('does not modify another host, database RPC payload or existing s256 requests', async () => {
    const request = { body: JSON.stringify({ code_challenge: 'hash', code_challenge_method: 's256' }) };
    expect(await upgradePkceRequest(`${origin}/auth/v1/signup`, request, origin, hash)).toBe(request);
    const plain = { body: JSON.stringify({ code_challenge: 'secret', code_challenge_method: 'plain' }) };
    expect(await upgradePkceRequest('https://other.supabase.co/auth/v1/signup', plain, origin, hash)).toBe(plain);
    expect(await upgradePkceRequest(`${origin}/rest/v1/rpc`, plain, origin, hash)).toBe(plain);
  });
  it('sends s256 with the actual SDK when native WebCrypto.subtle is absent', async () => {
    vi.stubGlobal('crypto', { getRandomValues: (array: Uint32Array) => randomFillSync(array) });
    const store = new Map<string, string>(); let posted: Record<string, string> | null = null; let verifierAtSend: string | null = null;
    const client = createClient(origin, 'public-fixture-key', { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: false, storage: {
      getItem: async key => store.get(key) ?? null, setItem: async (key, value) => { store.set(key, value); }, removeItem: async key => { store.delete(key); },
    } }, global: { fetch: async (url, init) => {
      const upgraded = await upgradePkceRequest(String(url), init, origin, hash);
      posted = JSON.parse(upgraded!.body as string);
      const saved = [...store.entries()].find(([key]) => key.endsWith('-code-verifier'));
      if (saved) verifierAtSend = JSON.parse(saved[1]);
      return new Response(JSON.stringify({ error_code: 'fixture_only', msg: 'No email sent by this test' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    } } });
    await client.auth.signUp({ email: 'fixture@example.invalid', password: 'fixture-password-0123456' });
    expect(verifierAtSend).not.toBeNull();
    expect(posted).toMatchObject({ code_challenge_method: 's256', code_challenge: await hash(verifierAtSend!) });
  });
});
