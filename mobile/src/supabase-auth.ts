import 'react-native-url-polyfill/auto';
import './native-auth-random';
import { AppState } from 'react-native';
import { createClient, processLock } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { randomUUID, digestStringAsync, CryptoDigestAlgorithm, CryptoEncoding } from 'expo-crypto';
import { upgradePkceRequest } from './pkce-request';
import { serviceErrorMessage } from './service-errors';
import { createChunkedAuthStorage } from './chunked-auth-storage';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, AUTH_REDIRECT_URL } from './supabase-config';
const options: SecureStore.SecureStoreOptions = { keychainService: 'tcg-royal-supabase-auth', keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const storage = createChunkedAuthStorage({
  get: key => SecureStore.getItemAsync(key, options),
  set: (key, value) => SecureStore.setItemAsync(key, value, options),
  remove: key => SecureStore.deleteItemAsync(key, options),
}, randomUUID);
const pkceHash = async (value: string) => (await digestStringAsync(CryptoDigestAlgorithm.SHA256, value, { encoding: CryptoEncoding.BASE64 })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: { fetch: async (input, init) => {
    const url = typeof input === 'string' ? input : (input as Request).url ?? String(input);
    if (new URL(url).origin !== SUPABASE_URL) throw Error('認証サービスの接続先が一致しません。');
    return fetch(input, { ...await upgradePkceRequest(url, init, SUPABASE_URL, pkceHash), redirect: 'error' });
  } },
  auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce', lock: processLock, storageKey: 'tcg-royal-supabase-preview-v1' },
});
AppState.addEventListener('change', state => { if (state === 'active') supabaseAuth.auth.startAutoRefresh(); else supabaseAuth.auth.stopAutoRefresh(); });
if (AppState.currentState === 'active') supabaseAuth.auth.startAutoRefresh();
export async function supabaseBearer() {
  const { data, error } = await supabaseAuth.auth.getSession();
  if (error || !data.session) throw Error('ログインの有効期限が切れました。再度ログインしてください。');
  return data.session.access_token;
}
export async function confirmedSupabaseUser() {
  const { data, error } = await supabaseAuth.auth.getUser();
  if (error || !data.user || !data.user.email_confirmed_at || data.user.is_anonymous) throw Error('メールの確認とログインを完了してください。');
  return data.user;
}
export async function signupWithConfirmation(email: string, password: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } });
  if (!response.ok || (await response.json()).mailer_autoconfirm !== false) throw Error('新規登録のメール確認設定を確認中です。時間をおいてお試しください。');
  const result = await supabaseAuth.auth.signUp({ email, password, options: { emailRedirectTo: AUTH_REDIRECT_URL } });
  if (result.error) throw result.error;
}
export async function handleSupabaseAuthLink(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'tcgroyal-preview:' || url.hostname !== 'auth' || url.pathname !== '/callback' || url.username || url.password) return false;
  if (url.searchParams.has('error')) throw Error('確認リンクが無効か期限切れです。もう一度お試しください。');
  const code = url.searchParams.get('code');
  if (!code || code.length > 4096 || url.hash) throw Error('認証リンクが不正です。メールを送信した端末でリンクを開いてください。');
  const { error } = await supabaseAuth.auth.exchangeCodeForSession(code);
  if (error) throw error;
  return true;
}
export function supabaseAuthError(error: unknown) {
  const code = (error as { code?: string })?.code;
  const messages: Record<string, string> = {
    mfa_verification_failed: '認証アプリのコードが正しくありません。新しいコードを確認してください。', mfa_challenge_expired: '認証コードの有効期限が切れました。もう一度お試しください。',
    invalid_credentials: 'メールアドレスまたはパスワードが正しくありません。', email_not_confirmed: '確認メールのリンクを開いてからログインしてください。',
    over_request_rate_limit: '試行回数が多いため、時間をおいてお試しください。', over_email_send_rate_limit: 'メール送信の上限に達しました。時間をおいてお試しください。',
    user_banned: 'このアカウントではログインできません。運営へお問い合わせください。', weak_password: '12文字以上の、推測されにくいパスワードを設定してください。',
    same_password: '現在とは異なるパスワードを設定してください。', reauthentication_needed: '本人確認の有効期限が切れました。再設定メールをもう一度送信してください。',
    otp_expired: '確認リンクの有効期限が切れています。再設定メールをもう一度送信してください。',
    flow_state_not_found: 'この再設定リンクは使用済みか期限切れです。再設定メールをもう一度送信してください。',
    bad_code_verifier: 'メールを送信したアプリと同じ端末で、最新の再設定リンクを開いてください。',
  };
  return messages[code ?? ''] ?? serviceErrorMessage(error, '認証を完了できません。通信状態を確認して、もう一度お試しください。');
}
