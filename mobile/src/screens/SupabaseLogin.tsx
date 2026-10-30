import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Field, ui } from '../ui';
import { supabaseAuth, signupWithConfirmation, supabaseAuthError, supabaseBearer } from '../supabase-auth';
import { AUTH_REDIRECT_URL } from '../supabase-config';
import { connectSupabasePreview } from '../api';
import {useAppBack} from '../use-app-back';
export function SupabaseLogin({ accessUrl, onConnected, disabled, onBusyChange, recovering, onRecovered }: {
  accessUrl: string; onConnected: () => Promise<void>; disabled: boolean; onBusyChange: (busy: boolean) => void; recovering: boolean; onRecovered: () => void;
}) {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [confirm, setConfirm] = useState('');
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [saved, setSaved] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null), [otp, setOtp] = useState('');
  useEffect(() => { let live = true; void supabaseAuth.auth.getSession().then(({ data }) => { if (live) setSaved(!!data.session); }); const subscription = supabaseAuth.auth.onAuthStateChange((_event, session) => { if (live) { setSaved(!!session); if (_event === 'PASSWORD_RECOVERY' || _event === 'SIGNED_OUT') setPasswordUpdated(false); } }).data.subscription; return () => { live = false; subscription.unsubscribe(); }; }, []);
  async function run(work: () => Promise<void>) {
    if (busy || disabled) return; setBusy(true); onBusyChange(true); setError(''); setNotice('');
    try { await work(); } catch (cause) { setError(supabaseAuthError(cause)); }
    finally { setBusy(false); onBusyChange(false); }
  }
  async function finish() { await connectSupabasePreview(accessUrl); await onConnected(); setPasswordUpdated(false); onRecovered(); }
  async function ensureAssurance() {
    const { data, error } = await supabaseAuth.auth.mfa.getAuthenticatorAssuranceLevel(await supabaseBearer()); if (error) throw error;
    if (data?.nextLevel === 'aal2' && data.currentLevel !== 'aal2') {
      const factors = await supabaseAuth.auth.mfa.listFactors(); if (factors.error) throw factors.error;
      const factor = factors.data.totp[0]; if (!factor) throw Error('このアカウントの多要素認証方式を確認してください。');
      setFactorId(factor.id); setNotice('認証アプリの6桁のコードを入力してください。'); return false;
    }
    return true;
  }
  async function checkFactors() { if (await ensureAssurance()) await finish(); }
  function changeMode(next: typeof mode) { setMode(next); setError(''); setNotice(''); setPassword(''); setConfirm(''); setFactorId(null); setOtp(''); }
  useAppBack(recovering||mode!=='login'||factorId!==null,20,()=>{if(busy||disabled)return true;if(factorId){setFactorId(null);setOtp('')}else{if(recovering)onRecovered();changeMode('login')}return true});
  return <View style={ui.card}>
    <Text style={ui.title}>{passwordUpdated && !factorId ? 'パスワードを更新しました' : factorId ? '多要素認証' : recovering ? '新しいパスワードを設定' : mode === 'signup' ? '会員登録' : mode === 'reset' ? 'パスワードの再設定' : 'ログイン'}</Text>
    <Text style={ui.muted}>TCG ROYALのメールアドレス・パスワードでログインできます。</Text>
    {error ? <Text accessibilityRole="alert" style={ui.error}>{error}</Text> : null}{notice ? <Text accessibilityLiveRegion="polite" style={ui.success}>{notice}</Text> : null}
    {passwordUpdated && !factorId ? <Button title="ログインして続ける" disabled={busy || disabled} onPress={() => void run(checkFactors)}/> : factorId ? <><Field label="認証アプリのコード" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} editable={!busy && !disabled}/><Button title="認証してログイン" disabled={busy || disabled || !/^\d{6}$/.test(otp)} onPress={() => void run(async () => { const result = await supabaseAuth.auth.mfa.challengeAndVerify({ factorId, code: otp }); if (result.error) throw result.error; setOtp(''); setFactorId(null); if (recovering && !passwordUpdated) setNotice('認証できました。新しいパスワードを設定してください。'); else await finish(); })}/></> : <>
      {!recovering && <Field label="メールアドレス" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" editable={!busy && !disabled}/>}
      {(recovering || mode !== 'reset') && <Field label={recovering || mode === 'signup' ? 'パスワード（12文字以上）' : 'パスワード'} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete={recovering || mode === 'signup' ? 'new-password' : 'current-password'} editable={!busy && !disabled}/>}
      {(recovering || mode === 'signup') && <Field label="パスワード（確認）" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" editable={!busy && !disabled}/>}
      <Button title={recovering ? 'パスワードを更新' : mode === 'signup' ? '確認メールを送信' : mode === 'reset' ? '再設定メールを送信' : 'ログイン'} disabled={busy || disabled} onPress={() => void run(async () => {
        if (recovering || mode === 'signup') { if (password.length < 12 || password.length > 128 || password !== confirm) throw Error('12文字以上のパスワードと確認欄を一致させてください。'); }
        const address = email.trim(); if (!recovering && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || address.length > 254)) throw Error('メールアドレスを確認してください。');
        if (recovering) { if (!await ensureAssurance()) return; const result = await supabaseAuth.auth.updateUser({ password }); if (result.error) throw result.error; setPassword(''); setConfirm(''); setPasswordUpdated(true); setNotice('新しいパスワードを保存しました。ログインして続けてください。'); }
        else if (mode === 'signup') { await signupWithConfirmation(address, password); setPassword(''); setConfirm(''); setNotice('確認メールを送信しました。メールのリンクをこの端末で開いてください。'); }
        else if (mode === 'reset') { const result = await supabaseAuth.auth.resetPasswordForEmail(address, { redirectTo: AUTH_REDIRECT_URL }); if (result.error) throw result.error; setNotice('登録されている場合、再設定メールが届きます。メールのリンクをこの端末で開いてください。'); }
        else { if (!password) throw Error('パスワードを入力してください。'); const result = await supabaseAuth.auth.signInWithPassword({ email: address, password }); if (result.error) throw result.error; setPassword(''); setSaved(true); await checkFactors(); }
      })}/>
      {!recovering && mode === 'login' && saved && <Button title="保存済みのアカウントで接続" secondary disabled={busy || disabled} onPress={() => void run(checkFactors)}/>}
      {!recovering && <><Button title={mode === 'signup' ? 'ログインへ戻る' : '新規会員登録'} secondary disabled={busy || disabled} onPress={() => changeMode(mode === 'signup' ? 'login' : 'signup')}/><Button title={mode === 'reset' ? 'ログインへ戻る' : 'パスワードを忘れた方'} secondary disabled={busy || disabled} onPress={() => changeMode(mode === 'reset' ? 'login' : 'reset')}/></>}
    </>}
  </View>;
}
