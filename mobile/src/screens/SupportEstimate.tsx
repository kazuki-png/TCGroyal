import {colors} from '../theme';
import { useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import type { SupportCase } from '../../../lib/lending/support-case-types';
import { lendingApi } from '../api';
import { Linking, Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { buildSupportEstimateMessage, ESTIMATE_REASONS, SUPPORT_LINE_URL, type SupportEstimateDraft } from '../support-estimate';
import {RoyalSwitch as Switch, Button, Field, ui } from '../ui';

export function SupportEstimate({connected=false,onRegistered,onLogin,initialDraft,items,onBusyChange}:{connected?:boolean;onRegistered?:()=>Promise<void>;onLogin?:()=>void;initialDraft?:SupportEstimateDraft;items?:import('../../../lib/lending/collateral-types').CollateralItem[];onBusyChange?:(busy:boolean)=>void}) {
  const [draft, setDraft] = useState<SupportEstimateDraft>(()=>initialDraft??{ reason: 'ungraded', cardName: '', cardNumber: '', condition: '', requestedAmount: '', notes: '' });
  const [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [registered,setRegistered]=useState<SupportCase|null>(null);
  const retry=useRef<{signature:string;key:string}|null>(null);
  async function register(){
    if(busy||!consent||registered)return;
    setBusy(true);setError('');setNotice('');
    try{
      const submitted=items?{...draft,items}:draft;
      buildSupportEstimateMessage(submitted);
      const signature=JSON.stringify(submitted);if(retry.current?.signature!==signature)retry.current={signature,key:randomUUID()};
      onBusyChange?.(true);
      const data=await lendingApi<{case:SupportCase}>('/support-cases',{body:{action:'create',draft:submitted,consent:true,key:retry.current.key}});
      setRegistered(data.case);setNotice('相談案件を登録しました。次に受付番号付きの相談文をLINEへ送信してください。');
      await onRegistered?.().catch(()=>setNotice('案件は登録済みです。貸付状況を更新して確認してください。'));
    }catch(cause){setError(cause instanceof Error?cause.message:'相談を登録できません。');}finally{setBusy(false);onBusyChange?.(false);}
  }
  function change<K extends keyof SupportEstimateDraft>(key: K, value: SupportEstimateDraft[K]) {
    setDraft(current => ({ ...current, [key]: value })); setConsent(false); setNotice(''); setError('');
  }
  async function contact() {
    if (busy || !registered) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const message = buildSupportEstimateMessage(items?{...draft,items}:draft,registered.reference);
      await Clipboard.setStringAsync(message);
      setNotice('相談内容をコピーしました。公式LINEのトークに貼り付け、カードの表裏の写真を添付して送信してください。');
      try { await Linking.openURL(SUPPORT_LINE_URL); }
      catch { setError('LINEを開けませんでした。コピーした内容をTCG ROYAL公式LINEへ送ってください。'); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : '相談内容を準備できませんでした。'); }
    finally { setBusy(false); }
  }
  if(!connected)return <View style={ui.card}><Text style={ui.title}>個別見積もりを相談</Text><Text style={ui.body}>相談案件を会員アカウントに登録すると、LINEでのご相談後も「貸付状況」から進捗を確認できます。</Text><Button title="ログインして相談を登録" onPress={()=>onLogin?.()}/></View>;
  return <View style={ui.card}>
    <Text accessibilityRole="header" style={ui.title}>{items?'カードをまとめて査定依頼':'サポートへ個別見積もりを相談'}</Text>
    <Text style={ui.body}>登録カードが見つからない場合や未鑑定カードもご相談いただけます。状態や市場価格を確認し、サポートが担保評価と融資の可否を個別にご案内します。</Text>
    <Text style={ui.muted}>1. 相談案件を登録 → 2. 受付番号と写真をLINEへ送信 → 3. 貸付状況で見積もりを確認</Text>
    {error ? <Text accessibilityRole="alert" style={ui.error}>{error}</Text> : null}
    {notice ? <Text accessibilityLiveRegion="polite" style={ui.success}>{notice}</Text> : null}
    {registered?<><Text selectable style={ui.amount}>{registered.reference}</Text><Text style={ui.body}>相談登録済み・LINEでの連絡待ち</Text><Button title="受付番号付きの相談文をコピーしてLINEを開く" disabled={busy} onPress={()=>void contact()}/><Text style={ui.muted}>貸付状況からいつでも進捗を確認できます。LINEを開いただけでは送信済みにはなりません。</Text></>:<>
    <View accessibilityRole="radiogroup" accessibilityLabel="見積もり相談の種類" style={{ gap: 8 }}>
      {(Object.keys(ESTIMATE_REASONS) as (keyof typeof ESTIMATE_REASONS)[]).map(reason => <Pressable key={reason} accessibilityRole="radio" accessibilityLabel={ESTIMATE_REASONS[reason]} accessibilityState={{ checked: draft.reason === reason, disabled: busy }} disabled={busy} style={[ui.button, ui.secondary, draft.reason === reason && { borderColor: colors.gold }]} onPress={() => change('reason', reason)}><Text style={ui.body}>{draft.reason === reason ? '✓ ' : ''}{ESTIMATE_REASONS[reason]}</Text></Pressable>)}
    </View>
    {!items&&<Field label="カード名（必須）" value={draft.cardName} onChangeText={value => change('cardName', value)} maxLength={100} editable={!busy}/>}
    {!items&&<Field label="収録セット・カード番号（任意）" value={draft.cardNumber} onChangeText={value => change('cardNumber', value)} maxLength={100} editable={!busy}/>}
    {!items&&<Field label="カードの状態・鑑定情報（任意）" value={draft.condition} onChangeText={value => change('condition', value)} placeholder="傷・白欠けの有無、他社鑑定の情報など" multiline maxLength={300} editable={!busy}/>}
    <Field label={items?'借入希望額・全カード合計・円（任意）':'借入希望額・円（任意）'} value={draft.requestedAmount} onChangeText={value => change('requestedAmount', value)} keyboardType="number-pad" maxLength={8} editable={!busy}/>
    <Field label="相談内容（任意）" value={draft.notes} onChangeText={value => change('notes', value)} multiline maxLength={1000} editable={!busy}/>
    <Text style={ui.muted}>LINEではカードの表面・裏面、傷がわかる写真を添付してください。本人確認書類やパスワードは送らないでください。</Text>
    <View style={ui.row}><Switch accessibilityLabel="相談案件の登録とサポートへの共有に同意" value={consent} onValueChange={setConsent} disabled={busy}/><Text style={[ui.body, { flex: 1 }]}>相談内容を案件として保存し、公式LINEでサポートへ共有することに同意します</Text></View>
    <Button title={busy ? '登録中…' : '見積もり相談を登録'} disabled={busy || !consent || !draft.cardName.trim()} onPress={() => void register()}/>
    </>}
    <Text style={ui.muted}>案件の登録では融資申込・契約は成立しません。サポートからの見積もり提示後、アプリで内容を確認してお申し込みください。</Text>
  </View>;
}
