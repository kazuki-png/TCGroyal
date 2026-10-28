import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Alert, Linking, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Notifications from 'expo-notifications';
import { LOAN_STATUS_LABELS, type LoanCommand, type WorkflowLoan, type WorkflowState } from '../lib/lending/workflow-types';
import { parsePsaCert } from '../lib/lending/psa';
import { connectPreview, disconnectPreview, loadWorkflow, workflowRequest, lendingApi, getInboxStorageKey, restorePreview, getRememberedPreviewUrl, clearRuntimeSession, isSupabasePreviewConnected } from './src/api';
import { AssessmentScreen } from './src/screens/AssessmentScreen';
import { AccountScreen } from './src/screens/AccountScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { SupportCasesScreen } from './src/screens/SupportCasesScreen';
import { SupportEstimate } from './src/screens/SupportEstimate';
import { SupabaseLogin } from './src/screens/SupabaseLogin';
import { supabaseAuth, handleSupabaseAuthLink, supabaseAuthError } from './src/supabase-auth';
import { DEFAULT_PREVIEW_URL } from './src/remembered-access';
import { InboxScreen } from './src/screens/InboxScreen';
import { buildInbox, type InboxItem } from './src/inbox';
import { useInboxReceipts } from './src/useInboxReceipts';
import type { AccountState } from '../lib/lending/mobile-types';

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;
const date = (value: string | null) => value ? new Date(value).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '—';
function Action({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}
type Send = (body: Record<string, unknown>) => Promise<void>;
function LoanTile({ loan, send, busy }: { loan: WorkflowLoan; send: Send; busy: boolean }) {
  const [consent, setConsent] = useState(false);
  const [additionalConsent, setAdditionalConsent] = useState(false);
  const [additional, setAdditional] = useState('10000');
  const command = (action: LoanCommand, payload: Record<string, unknown> = {}) => void send({ type: 'command', loanId: loan.id, version: loan.version, action, payload });
  const pending = loan.requests.find(r => r.status === 'pending');
  const terms = loan.terms;
  return <View style={styles.card}>
    <Text style={styles.badge}>{LOAN_STATUS_LABELS[loan.status]}</Text>
    <Text style={styles.title}>{loan.card_name}</Text>
    <Text style={styles.muted}>{loan.cert_number?`PSA / 鑑定番号 ${loan.cert_number}`:'PSA番号なし・個別見積もり'}</Text>
    <Text style={styles.muted}>{['active','repayment_pending'].includes(loan.status) ? '借入元本' : '申込希望額'}</Text>
    <Text style={styles.amount}>{yen(['active','repayment_pending'].includes(loan.status) ? loan.principal_jpy : loan.requested_jpy)}</Text>
    <Text style={styles.body}>返済必要額: {loan.payoff_jpy ? yen(loan.payoff_jpy) : '—'}</Text>
    <Text style={styles.body}>返済期限: {date(loan.due_at)}</Text>
    {terms && <View style={styles.inset}>
      <Text style={styles.label}>契約条件</Text>
      <Text style={styles.body}>元本 {yen(terms.principalJpy)} / 月利 {terms.monthlyRateBps / 100}% / {terms.termMonths}か月 / 手数料 {yen(terms.feesJpy)}</Text>
      <Text style={styles.body}>満期返済額 {yen(terms.principalJpy + Math.ceil(terms.principalJpy * terms.monthlyRateBps * terms.termMonths / 10000))}</Text>
      <Text style={styles.muted}>期間は出金日から数えます。期限前返済の利息は暦月単位で切り上げ、最低1か月・最大3か月分です。期限経過後は質流れの確認対象になります。</Text>
      {loan.requests.filter(r => r.kind === 'extension' && r.status === 'completed').map(r => <Text key={r.id} style={styles.muted}>延長記録: 利息 {yen(r.amount_jpy)} / 期限 {date(r.consent_terms.newDueAt ?? null)}</Text>)}
    </View>}
    {loan.status === 'offered' && <>
      <View style={styles.row}><Switch accessibilityLabel="契約条件への同意" value={consent} onValueChange={setConsent} disabled={busy} /><Text style={styles.body}>条件を確認し、同意します</Text></View>
      <Action label="この条件に同意する" disabled={busy || !consent} onPress={() => command('accept', { termsAccepted: true })} />
    </>}
    {['submitted','received','offered','accepted'].includes(loan.status) && <Action label="申込をキャンセル" disabled={busy} onPress={() => Alert.alert('申込のキャンセル', '預入済みのカードは返却待ちになります。', [{ text: '戻る', style: 'cancel' }, { text: 'キャンセルする', onPress: () => command('cancel') }])} />}
    {loan.status === 'active' && <>
      <Action label="振込済みを申告" disabled={busy} onPress={() => command('report_repayment')} />
      {!pending && loan.due_at && Date.parse(loan.evaluated_at) < Date.parse(loan.due_at) && <>
        <View style={styles.row}><Switch accessibilityLabel="追加手続きへの同意" value={consent} onValueChange={setConsent} disabled={busy} /><Text style={[styles.body, styles.flex]}>延長時は現在の3か月分の利息 {yen(Math.ceil(loan.principal_jpy * (loan.monthly_rate_bps ?? 0) * 3 / 10000))} を精算し、期限を3か月延長することに同意します</Text></View>
        <Action label="3か月延長を申請" disabled={busy || !consent} onPress={() => command('request_extension', { termsAccepted: true })} />
        <TextInput accessibilityLabel="追加借入の相談額" value={additional} onChangeText={setAdditional} keyboardType="number-pad" style={styles.input} editable={!busy} />
        <Text style={styles.muted}>追加借入は再査定・変更契約が必要です。ここでは相談のみ受け付けます。</Text>
        <View style={styles.row}><Switch accessibilityLabel="追加借入の相談申請への同意" value={additionalConsent} onValueChange={setAdditionalConsent} disabled={busy} /><Text style={styles.body}>相談申請の内容を確認しました</Text></View>
        <Action label="追加借入を相談" disabled={busy || !additionalConsent || !/^\d+$/.test(additional) || Number(additional) < 10000 || Number(additional) % 10000 !== 0 || Number(additional) > 10000000 - loan.principal_jpy} onPress={() => command('request_additional', { amountJpy: Number(additional), termsAccepted: true })} />
      </>}
    </>}
    {pending && <Text style={styles.badge}>{pending.kind === 'extension' ? '延長申請' : '追加借入相談'}を確認中</Text>}
    {loan.status === 'repayment_pending' && <Text style={styles.muted}>運営が入金を照合しています。確認後にカードを返却します。</Text>}
    <Text style={styles.label}>手続き履歴</Text>
    {loan.events.map(event => <Text key={event.version} style={styles.muted}>{date(event.created_at)} / {LOAN_STATUS_LABELS[event.to_status]}{event.reason ? ` / ${event.reason}` : ''}</Text>)}
  </View>;
}

export default function App() {
  return <SafeAreaProvider><LendingApp /></SafeAreaProvider>;
}
function LendingApp() {
  const insets = useSafeAreaInsets();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [supportOpen, setSupportOpen] = useState(false);
  const [recovering, setRecovering] = useState(false);

  const [tab, setTab] = useState<'assessment'|'loans'|'inbox'|'account'>('assessment');
  const [legacy, setLegacy] = useState(false);
  const [state, setState] = useState<WorkflowState | null>(null);
  const [inboxAccount, setInboxAccount] = useState<AccountState | null>(null);
  const [focusedLoan, setFocusedLoan] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState('');
  const [cert, setCert] = useState('');
  const [amount, setAmount] = useState('300000');
  const [deposit, setDeposit] = useState<'mail' | 'store'>('mail');
  const [acknowledged, setAcknowledged] = useState(false);
  const [quote, setQuote] = useState<{ id: string; cap_jpy: number; expires_at: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [accessUrl, setAccessUrl] = useState(process.env.EXPO_PUBLIC_LENDING_API_URL ?? DEFAULT_PREVIEW_URL);
  const [accessCode, setAccessCode] = useState('');
  const reload = useCallback(async () => { const key = getInboxStorageKey(); const [data, account] = await Promise.all([loadWorkflow(), lendingApi<AccountState>('/account')]); if (key !== getInboxStorageKey()) return; setState(data); setInboxAccount(account); setNow(Date.now()); }, []);
  const inbox = useMemo(() => buildInbox(state, inboxAccount, now), [state, inboxAccount, now]);
  const receipts = useInboxReceipts(state ? getInboxStorageKey() : null);
  const readIds = new Set(receipts.readIds);
  const unreadCount = receipts.ready ? inbox.filter(item => !readIds.has(item.id)).length : 0;
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    let live = true;
    void (async () => {
      try { const url = await restorePreview(); if (!live) return; if (url) setAccessUrl(url); if (url || __DEV__) await reload(); }
      catch { if (live) { setAccessUrl(getRememberedPreviewUrl() ?? DEFAULT_PREVIEW_URL); setNotice('接続を復元できませんでした。通信状態や共有URLを確認し、再度ログインしてください。'); } }
      finally { if (live) setRestoring(false); }
    })();
    return () => { live = false; };
  }, [reload]);
  useEffect(() => {
    let live = true;
    const subscription = supabaseAuth.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') { clearRuntimeSession(); setState(null); setInboxAccount(null); setRecovering(true); }
      if (event === 'SIGNED_OUT' && isSupabasePreviewConnected()) { clearRuntimeSession(); setState(null); setInboxAccount(null); }
    }).data.subscription;
    async function open(url: string) {
      try { if (await handleSupabaseAuthLink(url) && live) { setState(null); setInboxAccount(null); setNotice('メールの確認が完了しました。画面の案内に沿って続けてください。'); } }
      catch (cause) { if (live) setError(supabaseAuthError(cause)); }
    }
    const links = Linking.addEventListener('url', event => { void open(event.url); });
    void Linking.getInitialURL().then(url => { if (url && live) void open(url); });
    return () => { live = false; links.remove(); subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    const report = (data: Record<string, unknown> | undefined) => {
      if (typeof data?.testId === 'string') void lendingApi('/notifications', { body: { action: 'received', testId: data.testId } }).catch(() => {});
    };
    const received = Notifications.addNotificationReceivedListener(n => { setNotice('通知を受信しました。'); report(n.request.content.data); });
    const tapped = Notifications.addNotificationResponseReceivedListener(n => { const data = n.notification.request.content.data; if (data?.testId || data?.screen === 'notifications') setToolsOpen(true); else { setTab('inbox'); void reload().catch(() => {}); } report(data); });
    return () => { received.remove(); tapped.remove(); };
  }, [reload]);
  const send: Send = async body => {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const data = await workflowRequest(body);
      if (data.quote) { setQuote(data.quote); setAmount(String(Math.min(300000, Math.floor(data.quote.cap_jpy / 10000) * 10000))); }
      else { setQuote(null); setAcknowledged(false); setNotice('手続きを記録しました。'); }
      await reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : '通信に失敗しました。'); }
    finally { setBusy(false); }
  };
  async function scan() {
    const current = permission?.granted ? permission : await requestPermission();
    if (current.granted) setScanning(true);
    else setError('カメラを利用できません。鑑定番号またはQRコードURLを入力してください。');
  }
  async function connect() {
    setBusy(true); setError('');
    try { await connectPreview(accessUrl, accessCode); await reload(); setAccessCode('');
      const last = await Notifications.getLastNotificationResponseAsync();
      if (last?.notification.request.content.data?.screen === 'notifications') { setToolsOpen(true); const testId = last.notification.request.content.data.testId; if (typeof testId === 'string') await lendingApi('/notifications', { body: { action: 'received', testId } }); }
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Previewに接続できません。'); }
    finally { setBusy(false); }
  }
  const canApply = !!quote && !!parsePsaCert(cert) && acknowledged && /^\d+$/.test(amount) && Number(amount) >= 100000 && Number(amount) % 10000 === 0 && Number(amount) <= quote.cap_jpy;
  async function refresh() {
    if (busy) return; setBusy(true);
    try { await reload(); } catch (cause) { setError(cause instanceof Error ? cause.message : '情報を更新できません。'); } finally { setBusy(false); }
  }
  function switchTab(next: typeof tab) {
    setTab(next); setFocusedLoan(null); setError(''); setNotice(''); if (next === 'inbox' && state) void refresh(); scroll.current?.scrollTo({ y: 0, animated: false });
  }
  async function signOut() {
    if (busy || restoring) return; setBusy(true);
    try { await disconnectPreview(); } catch { setError('ログイン情報を削除できません。もう一度お試しください。'); setBusy(false); return; } setState(null); setInboxAccount(null); setFocusedLoan(null); setQuote(null); setSelected(''); setCert('');
    setAcknowledged(false); setNotice(''); setError(''); setLegacy(false); setScanning(false);
    setTab('assessment'); setBusy(false);
  }
  function openInboxItem(item: InboxItem) { switchTab(item.target); setFocusedLoan(item.loanId ?? null); }
  const heading = !state && supportOpen && !recovering ? '個別見積もり相談' : tab === 'assessment' ? '融資申請' : tab === 'loans' ? '貸付状況' : tab === 'inbox' ? 'お知らせ' : 'マイページ';
  return <KeyboardAvoidingView style={[styles.screen, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <StatusBar style="light" />
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="テスト環境の設定と機能を開く" onPress={() => setToolsOpen(true)} style={styles.environment}>
        <View style={styles.environmentDot}/><Text style={styles.badge}>テスト環境</Text>
      </Pressable>
      <Text style={styles.brand}>TCG ROYAL</Text>
    </View>
    <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={state?<RefreshControl refreshing={busy} onRefresh={() => void refresh()} tintColor="#fcd66e" />:undefined}>
      <Text accessibilityRole="header" style={styles.heading}>{heading}</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {notice ? <Text accessibilityLiveRegion="polite" style={styles.success}>{notice}</Text> : null}
      {!state && (busy || restoring) && <ActivityIndicator accessibilityLabel="接続を確認中" color="#fcd66e" />}
      {!state && <>
        <Text style={styles.muted}>{supportOpen && !recovering ? 'PSA番号がないカードや未鑑定カードの見積もりを、サポートへ相談できます。' : tab === 'assessment' ? 'カードの査定・申込にはログインが必要です。' : tab === 'loans' ? '申込状況・返済額・返済期限を確認できます。ログインしてください。' : tab === 'inbox' ? '申込や本人確認に関するお知らせを確認できます。ログインしてください。' : '登録情報・本人確認書類を管理できます。ログインしてください。'}</Text>
        {supportOpen && !recovering ? <><SupportEstimate onLogin={()=>setSupportOpen(false)}/><Action label="ログインへ戻る" onPress={() => setSupportOpen(false)}/></> : <>
        {!recovering && <Action label="PSA番号なし・未鑑定の見積もり相談" onPress={() => setSupportOpen(true)}/>}
        <SupabaseLogin accessUrl={accessUrl} onConnected={reload} disabled={busy || restoring} onBusyChange={setBusy} recovering={recovering} onRecovered={() => setRecovering(false)}/>
        </>}
      </>}
      {state && tab === 'assessment' && <AssessmentScreen onApplied={reload}/>}
      {state && tab === 'loans' && <>
        <SupportCasesScreen onChanged={reload}/>
        <View style={styles.card}><Text style={styles.label}>現在融資額（元本）</Text><Text style={styles.amount}>{yen(state.outstandingJpy)}</Text><Text style={styles.muted}>申込・契約 {state.loanCount}件</Text></View>
        <Text style={styles.title}>{focusedLoan ? '申込・契約の詳細' : '申込・契約一覧'}</Text>
        {focusedLoan && <Action label="すべての申込・契約を表示" onPress={() => setFocusedLoan(null)}/>}
        {state.loanCount > state.loans.length && <Text style={styles.muted}>最新50件を表示。元本の合計は全契約を集計しています。</Text>}
        {!state.loans.length && <View style={styles.card}><Text style={styles.title}>申込はまだありません</Text><Text style={styles.muted}>カードを査定すると、融資の申込に進めます。</Text><Action label="融資申請へ" onPress={() => switchTab('assessment')}/></View>}
        {state.loans.filter(loan => !focusedLoan || loan.id === focusedLoan).map(loan => <LoanTile key={`${loan.id}-${loan.version}`} loan={loan} send={send} busy={busy} />)}
      </>}
      {state && tab === 'inbox' && <InboxScreen items={inbox} readIds={receipts.readIds} ready={receipts.ready} saving={receipts.saving} error={receipts.error} onRead={receipts.markRead} onOpen={openInboxItem} onRefresh={() => { if (receipts.error) receipts.retry(); void refresh(); }} refreshing={busy}/>}
      {state && tab === 'account' && <><AccountScreen onUpdated={reload}/><Action label="ログアウト" disabled={busy} onPress={() => void signOut()}/></>}
    </ScrollView>
    <View accessibilityRole="tablist" style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {([['assessment','融資申請','＋'],['loans','貸付状況','≡'],['inbox','お知らせ','✉'],['account','マイページ','○']] as const).map(([key,label,icon]) => <Pressable key={key} accessibilityRole="tab" accessibilityLabel={key === 'inbox' && unreadCount ? `お知らせ、未読${unreadCount}件` : label} accessibilityState={{selected: tab === key}} onPress={() => switchTab(key)} style={[styles.tab, tab === key && styles.activeTab]}>
        <Text accessible={false} style={[styles.tabIcon, tab === key && styles.activeText]}>{icon}</Text>
        <Text style={[styles.tabText, tab === key && styles.activeText]}>{label}</Text>
        {key === 'inbox' && unreadCount > 0 && <View style={styles.unreadBadge}><Text style={styles.unreadText}>{unreadCount > 99 ? '99+' : unreadCount}</Text></View>}
      </Pressable>)}
    </View>
    <Modal visible={toolsOpen} animationType="slide" onRequestClose={() => { if (!busy) { setToolsOpen(false); setScanning(false); } }}>
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.toolsHeader}><Text accessibilityRole="header" style={styles.title}>テスト環境</Text><Pressable accessibilityRole="button" accessibilityLabel="テスト環境を閉じる" disabled={busy} onPress={() => { setToolsOpen(false); setScanning(false); }} style={styles.close}><Text style={styles.body}>閉じる</Text></Pressable></View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.muted}>Preview専用です。実際の送金・正式な契約締結は行いません。本人確認にはテスト画像を使用してください。通常ログインはSupabase Authのメール・パスワード認証です。接続コードは動作確認用です。</Text>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {notice ? <Text accessibilityLiveRegion="polite" style={styles.success}>{notice}</Text> : null}
          <View style={styles.card}>
            <Text style={styles.title}>接続設定</Text>
            <TextInput accessibilityLabel="接続先URL" style={styles.input} value={accessUrl} onChangeText={setAccessUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="Preview共有URL" placeholderTextColor="#8b96aa" editable={!busy&&!restoring&&!state} />
            {!state ? <><Text style={styles.muted}>URLを入力すると、通常画面から会員アカウントでログインできます。接続コードを使う場合はここでログインしてください。</Text>
              <TextInput accessibilityLabel="テスト接続コード" style={styles.input} value={accessCode} onChangeText={setAccessCode} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="テスト接続コード" placeholderTextColor="#8b96aa" editable={!busy}/>
              <Action label="接続コードでログイン" disabled={busy || restoring || !accessUrl || accessCode.length < 16} onPress={() => void connect()}/>
            </> : <><Text style={styles.success}>接続済み</Text><Action label="接続先を切り替える" disabled={busy} onPress={() => void signOut()}/></>}
          </View>
          {state && <><NotificationsScreen/><Action label={legacy ? '登録済みカードの動作確認を閉じる' : '登録済みカードの動作確認'} disabled={busy} onPress={() => setLegacy(!legacy)}/></>}
        {state&&legacy&&<View style={styles.card}>
          <Text style={styles.title}>新規の査定・申込</Text>
          {state.cards.map(card => <Pressable key={card.public_uid} accessibilityRole="radio" accessibilityState={{ selected: selected === card.public_uid }} disabled={busy} onPress={() => { setSelected(card.public_uid); setQuote(null); }} style={[styles.choice, selected === card.public_uid && styles.chosen]}><Text style={styles.body}>{card.name} / {card.card_number}</Text></Pressable>)}
          <Text style={styles.label}>PSA鑑定番号 / QRコードURL</Text><TextInput accessibilityLabel="PSA鑑定番号またはQRコードURL" style={styles.input} value={cert} onChangeText={setCert} autoCapitalize="none" autoCorrect={false} editable={!busy} placeholder="番号またはPSA公式URL" placeholderTextColor="#8b96aa" maxLength={250} />
          <Action label="QRコードを読み取る" disabled={busy} onPress={() => void scan()} />
          {scanning && <><CameraView style={styles.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={result => { const value = parsePsaCert(result.data); if (value) { setCert(value); setScanning(false); } }} /><Action label="読み取りを閉じる" onPress={() => setScanning(false)} /></>}
          {!quote ? <Action label="概算額を確認" disabled={busy || !selected} onPress={() => void send({ type: 'quote', cardUid: selected })} /> : <>
            <Text style={styles.muted}>借入可能額の目安</Text><Text style={styles.amount}>{yen(quote.cap_jpy)}</Text><Text style={styles.muted}>有効期限 {date(quote.expires_at)}</Text>
            <Text style={styles.label}>借入希望額（円・1万円単位）</Text><TextInput accessibilityLabel="借入希望額" value={amount} onChangeText={setAmount} keyboardType="number-pad" style={styles.input} editable={!busy} />
            <View style={styles.row}>{(['mail','store'] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: deposit === value }} disabled={busy} style={[styles.choice, styles.flex, deposit === value && styles.chosen]} onPress={() => setDeposit(value)}><Text style={styles.body}>{value === 'mail' ? '郵送' : '店頭持込'}</Text></Pressable>)}</View>
            <View style={styles.row}><Switch accessibilityLabel="概算と現物検品についての確認" disabled={busy} value={acknowledged} onValueChange={setAcknowledged} /><Text style={[styles.body, styles.flex]}>概算は融資承認ではなく、現物検品後に最終条件を確認することを了承しました</Text></View>
            <Action label="この内容で申し込む" disabled={busy || !canApply} onPress={() => void send({ type: 'apply', quoteId: quote.id, certInput: cert, amountJpy: Number(amount), deposit })} />
          </>}
        </View>}
        </ScrollView>
      </View>
    </Modal>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#253149' },
  environment: { minHeight: 40, paddingHorizontal: 10, flexDirection: 'row', gap: 6, alignItems: 'center', borderWidth: 1, borderColor: '#66572f', borderRadius: 8, backgroundColor: '#28251c' },
  environmentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fcd66e' },
  footer: { flexDirection: 'row', paddingTop: 10, paddingHorizontal: 12, backgroundColor: '#111b2d', borderTopWidth: 1, borderColor: '#253149' },
  tab: { flex: 1, minHeight: 60, paddingVertical: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 12, gap: 3 },
  unreadBadge: { position: 'absolute', top: 2, right: 10, borderRadius: 10, backgroundColor: '#fcd66e', paddingHorizontal: 5, minWidth: 19, alignItems: 'center' }, unreadText: { color: '#101827', fontSize: 11, fontWeight: '800' },
  activeTab: { backgroundColor: '#272a2e' }, tabIcon: { fontSize: 24, color: '#9ba7ba', fontWeight: '600' }, tabText: { fontSize: 12, fontWeight: '700', color: '#9ba7ba' }, activeText: { color: '#fcd66e' },
  toolsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, borderBottomWidth: 1, borderColor: '#253149' },
  close: { minHeight: 52, minWidth: 64, justifyContent: 'center', alignItems: 'center' },
  screen: { flex: 1, backgroundColor: '#0a1220' }, content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32, gap: 20 },
  brand: { color: '#fcd66e', fontSize: 15, fontWeight: '800', letterSpacing: 2 }, heading: { color: '#f3f5fa', fontSize: 30, fontWeight: '800', lineHeight: 43 },
  title: { color: '#f3f5fa', fontSize: 19, fontWeight: '700' }, badge: { color: '#fcd66e', fontSize: 12, fontWeight: '700' },
  card: { backgroundColor: '#111b2d', borderRadius: 20, borderColor: '#253149', borderWidth: 1, padding: 20, gap: 14 },
  body: { color: '#e7ebf3', fontSize: 14, lineHeight: 23 }, muted: { color: '#9ba7ba', fontSize: 12, lineHeight: 21 },
  label: { color: '#d9dfeb', fontSize: 13, fontWeight: '700' }, amount: { color: '#f3f5fa', fontSize: 34, fontWeight: '800' },
  button: { backgroundColor: '#fcd66e', borderRadius: 12, padding: 15, alignItems: 'center', minHeight: 48 }, buttonText: { color: '#101827', fontWeight: '800', fontSize: 14 }, disabled: { opacity: 0.4 },
  input: { backgroundColor: '#0a1220', borderWidth: 1, borderColor: '#3a455b', borderRadius: 12, padding: 14, color: '#fff', fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, flex: { flex: 1 },
  choice: { borderWidth: 1, borderColor: '#3a455b', borderRadius: 12, padding: 14 }, chosen: { borderColor: '#fcd66e', backgroundColor: '#2a2930' },
  inset: { padding: 14, borderRadius: 12, backgroundColor: '#0a1220', gap: 8 }, camera: { height: 260, borderRadius: 12 },
  error: { color: '#fecaca', backgroundColor: '#421b26', padding: 14, borderRadius: 12 }, success: { color: '#a7f3d0', backgroundColor: '#11352e', padding: 14, borderRadius: 12 },
});
