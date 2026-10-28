// auth-js falls back to plain PKCE when native WebCrypto.subtle is unavailable.
// Upgrade only the first-party email auth request, using Expo's native SHA-256.
// Leave crypto.subtle untouched so SDK signature checks can use their supported fallback.
export async function upgradePkceRequest(url: string, init: RequestInit | undefined, authOrigin: string, sha256Base64Url: (value: string) => Promise<string>): Promise<RequestInit | undefined> {
  if (!init || typeof init.body !== 'string') return init;
  const target = new URL(url);
  if (target.origin !== authOrigin || !['/auth/v1/signup', '/auth/v1/recover', '/auth/v1/otp', '/auth/v1/magiclink'].includes(target.pathname)) return init;
  let body: Record<string, unknown>;
  try { body = JSON.parse(init.body); } catch { return init; }
  if (body.code_challenge_method !== 'plain' || typeof body.code_challenge !== 'string') return init;
  const challenge = await sha256Base64Url(body.code_challenge);
  return { ...init, body: JSON.stringify({ ...body, code_challenge: challenge, code_challenge_method: 's256' }) };
}
