import { CryptoDigestAlgorithm, digestStringAsync, randomUUID } from 'expo-crypto';
import {firebaseIdToken,firebaseAccountId,signOutPhone} from './firebase-phone';
import { readAccess, saveAccess, clearAccess } from './access-vault';
import { ACCESS_RETENTION_MS, DEFAULT_PREVIEW_URL, trustedPreviewUrl, migratePreviewAccessUrl, type RememberedAccess } from './remembered-access';
import { supabaseAuth, supabaseBearer, confirmedSupabaseUser } from './supabase-auth';
import type { WorkflowState } from '../../lib/lending/workflow-types';
import { apiResponseError } from './service-errors';

const retryKeys = new Map<string, string>();
let previewSession: { origin: string; token: string; inboxKey: string; expiresAt?: number; firebase?:boolean; supabase?:boolean } | null = null;
let rememberedAccess: RememberedAccess | null = null;
let renewal: Promise<void> | null = null;
let accessGeneration = 0;
export async function disconnectPreview() {
 accessGeneration++;
 const result = await supabaseAuth.auth.signOut({ scope: 'local' });
 if (result.error) throw result.error;
 await clearAccess(); rememberedAccess = null; previewSession = null; retryKeys.clear();
 await signOutPhone().catch(()=>{});
}
async function authFetch(url: string, options?: RequestInit) {
 const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 12000);
 try { return await fetch(url, { redirect: 'manual', ...options, signal: controller.signal }); } finally { clearTimeout(timeout); }
}
export function getRememberedPreviewUrl() { if (!rememberedAccess) return undefined; try { return trustedPreviewUrl(rememberedAccess.url).href; } catch { return DEFAULT_PREVIEW_URL; } }
export async function restorePreview() {
 const generation = accessGeneration; const saved = await readAccess();
 if (generation !== accessGeneration) return null; rememberedAccess = saved;
 if (!rememberedAccess) return null;
 if (rememberedAccess.kind !== 'supabase') { await clearAccess(); rememberedAccess = null; return null; }
 const url = migratePreviewAccessUrl(rememberedAccess.url);
 await connectSupabasePreview(url, url !== rememberedAccess.url);
 return url;
}
async function bootstrapPreview(accessUrl:string) {
  if (process.env.EXPO_PUBLIC_LENDING_CHANNEL !== 'preview' && !__DEV__) throw Error('Preview版のアプリを利用してください。');
  const url = trustedPreviewUrl(accessUrl);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.vercel.app') || url.username || url.password || url.port) {
    throw Error('Vercel PreviewのHTTPS URLを入力してください。');
  }
  const share = url.searchParams.get('_vercel_share');
  if (share) {
    // Exchange the expiring share URL for Vercel's cookie. No bypass token is
    // compiled into the APK or committed to source.
    const bootstrap = new URL('/', url.origin); bootstrap.searchParams.set('_vercel_share', share);
    await authFetch(bootstrap.toString(), { credentials: 'include', redirect: 'follow' });
  }
  return url.origin;
}
export async function checkPhonePreview(accessUrl:string,projectId:string){
 const origin=await bootstrapPreview(accessUrl);
 const response=await authFetch(`${origin}/api/lending/phone`,{credentials:'include'});
 if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Previewの共有URLを確認してください。');
 const config=await response.json();
 if(!response.ok||!config.enabled)throw Error('サーバーのFirebase設定が未完了です。');
 if(config.projectId!==projectId)throw Error('APKとPreviewのFirebaseプロジェクトが一致していません。');
}
export async function connectPhonePreview(accessUrl:string,idToken:string,remember=false){
 const generation = accessGeneration;
 const origin=await bootstrapPreview(accessUrl);
 const response=await authFetch(`${origin}/api/lending/phone`,{method:'POST',credentials:'include',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({idToken})});
 if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Previewの共有URLを確認してください。');
 const result=await response.json();if(!response.ok)throw apiResponseError(result,response.status);
 const inboxKey = await inboxStorageKey(origin, 'firebase', await firebaseAccountId());
 if (generation !== accessGeneration) throw Error('ログインを中止しました。');
 if (remember) { const record: RememberedAccess = { version:1, kind:'firebase', url:accessUrl.trim(), savedAt:Date.now() }; await saveAccess(record); if (generation !== accessGeneration) throw Error('ログインを中止しました。'); rememberedAccess=record; }
 if (generation !== accessGeneration) throw Error('ログインを中止しました。');
 previewSession={origin,token:idToken,inboxKey,firebase:true};retryKeys.clear();
}
async function authorization():Promise<Record<string,string>>{
 if(rememberedAccess&&Date.now()-rememberedAccess.savedAt>=ACCESS_RETENTION_MS)throw Error('ログインの保存期限が切れました。再度ログインしてください。');
 if(previewSession&&!previewSession.firebase&&!previewSession.supabase&&previewSession.expiresAt!<=Date.now()+30000&&rememberedAccess?.kind==='code'){
  if(!renewal){const access=rememberedAccess;renewal=connectPreview(access.url,access.code,false).finally(()=>{renewal=null});}
  await renewal;
 }
 return previewSession?{Authorization:`Bearer ${previewSession.supabase?await supabaseBearer():previewSession.firebase?await firebaseIdToken():previewSession.token}`}:{'x-lending-demo-role':'customer'};}
export async function connectPreview(accessUrl: string, code: string, remember = false) {
  const generation = accessGeneration;
  const origin=await bootstrapPreview(accessUrl);
  const response = await authFetch(`${origin}/api/lending/session`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ code }),
  });
  if (!response.headers.get('content-type')?.includes('application/json')) throw Error('Previewへのアクセス保護を確認してください。有効な共有URLが必要です。');
  const data = await response.json();
  if (!response.ok || typeof data.token !== 'string') throw apiResponseError(data,response.status);
  const inboxKey = await inboxStorageKey(origin, 'code', code);
  if (generation !== accessGeneration) throw Error('ログインを中止しました。');
  if (remember) { const record: RememberedAccess = { version:1, kind:'code', url:accessUrl.trim(), code, savedAt:Date.now() }; await saveAccess(record); if (generation !== accessGeneration) throw Error('ログインを中止しました。'); rememberedAccess=record; }
  if (generation !== accessGeneration) throw Error('ログインを中止しました。');
  previewSession = { origin, token: data.token, inboxKey, expiresAt:Date.now()+Math.min(Number(data.expiresIn)||7200,7200)*1000 }; retryKeys.clear();
}
export function getApiBase() {
  if (previewSession) return previewSession.origin;
  const url = new URL(process.env.EXPO_PUBLIC_LENDING_API_URL ?? 'http://127.0.0.1:3000');
  if (!__DEV__ || url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)
    || url.username || url.password || url.pathname !== '/') {
    throw Error('PreviewのURLとテスト接続コードを入力してください。');
  }
  return url.origin;
}
export async function workflowRequest(body?: Record<string, unknown>) {
  const base = getApiBase();
  const signature = body ? JSON.stringify(body) : '';
  const key = retryKeys.get(signature) ?? randomUUID();
  if (body) retryKeys.set(signature, key);
  const response = await fetch(`${base}/api/lending/workflow`, {
    method: body ? 'POST' : 'GET', redirect: 'manual',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Origin: base,
      ...await authorization(),
    },
    body: body ? JSON.stringify(['apply','command'].includes(String(body.type)) ? { ...body, key } : body) : undefined,
  });
  if (!response.headers.get('content-type')?.includes('application/json')) throw Error('Previewのアクセス保護により接続できません。共有URLから接続し直してください。');
  const data = await response.json();
  if (!response.ok) throw apiResponseError(data,response.status);
  retryKeys.delete(signature);
  return data;
}
export const loadWorkflow = async (): Promise<WorkflowState> => workflowRequest();

export async function lendingApi<T = Record<string, unknown>>(path: string, options: { method?: 'GET'|'POST'|'DELETE'; body?: Record<string, unknown>|FormData } = {}): Promise<T> {
  if (!/^\/(?:cards|catalog|card-image|account|documents|notifications|identity|support-cases)(?:\?id=[a-f0-9-]{36})?$/.test(path)) throw Error('APIパスが不正です。');
  const base = getApiBase();
  const multipart = options.body instanceof FormData;
  const response = await fetch(`${base}/api/lending${path}`, {
    method: options.method ?? (options.body ? 'POST' : 'GET'), redirect: 'manual', credentials: 'include',
    headers: { Origin: base, ...(!multipart ? { 'Content-Type': 'application/json' } : {}),
      ...await authorization() },
    body: options.body ? (multipart ? options.body as FormData : JSON.stringify(options.body)) : undefined,
  });
  if (!response.headers.get('content-type')?.includes('application/json')) throw Error('Previewの共有URLが期限切れです。接続し直してください。');
  const data = await response.json();
  if (!response.ok) throw apiResponseError(data,response.status);
  return data as T;
}

// Inbox receipt keys are separate from encrypted login credentials. Never persist message bodies or bearer tokens here.
async function inboxStorageKey(origin: string, method: string, account: string) {
  return `tcg:inbox:v1:${await digestStringAsync(CryptoDigestAlgorithm.SHA256, JSON.stringify([origin, method, account]))}`;
}
export function getInboxStorageKey() {
  return previewSession?.inboxKey ?? (__DEV__ ? 'tcg:inbox:v1:local-customer' : null);
}

export function clearRuntimeSession() { accessGeneration++; previewSession = null; retryKeys.clear(); }
export function isSupabasePreviewConnected() { return !!previewSession?.supabase; }
export async function connectSupabasePreview(accessUrl: string, remember = true) {
 const generation = accessGeneration;
 const origin = await bootstrapPreview(accessUrl);
 const user = await confirmedSupabaseUser();
 const assurance = await supabaseAuth.auth.mfa.getAuthenticatorAssuranceLevel(await supabaseBearer());
 if (assurance.error) throw assurance.error;
 if (assurance.data?.nextLevel === 'aal2' && assurance.data.currentLevel !== 'aal2') throw Error('多要素認証を完了してください。');
 const inboxKey = await inboxStorageKey(origin, 'supabase', user.id);
 if (generation !== accessGeneration) throw Error('ログインを中止しました。');
 if (remember) {
  const record: RememberedAccess = { version: 1, kind: 'supabase', url: accessUrl.trim(), savedAt: Date.now() };
  await saveAccess(record);
  if (generation !== accessGeneration) throw Error('ログインを中止しました。');
  rememberedAccess = record;
 }
 previewSession = { origin, token: '', inboxKey, supabase: true }; retryKeys.clear();
}
