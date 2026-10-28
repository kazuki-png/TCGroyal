import { useState } from 'react';
import { Linking, Pressable, Switch, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { Assessment, CertificateLookup, ProductCandidate } from '../../../lib/lending/mobile-types';
import { SupportEstimate } from './SupportEstimate';
import { parsePsaCert } from '../../../lib/lending/psa';
import { lendingApi, workflowRequest } from '../api';
import { Button,Field,ui,yen,date } from '../ui';
type Result={assessment:Assessment;quote:{id:string;cap_jpy:number;expires_at:string}|null;market:{fetchedAt:string};notice:string};
export function AssessmentScreen({onApplied}:{onApplied:()=>Promise<void>}){
 const [route,setRoute]=useState<'psa'|'support'>('psa');
 const [cert,setCert]=useState(''),[lookup,setLookup]=useState<CertificateLookup|null>(null),[candidates,setCandidates]=useState<ProductCandidate[]>([]);
 const [query,setQuery]=useState(''),[productId,setProductId]=useState(''),[confirmed,setConfirmed]=useState(false),[consent,setConsent]=useState(false);
 const [result,setResult]=useState<Result|null>(null),[amount,setAmount]=useState('300000'),[deposit,setDeposit]=useState<'mail'|'store'>('mail');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[scanning,setScanning]=useState(false);
 const [permission,requestPermission]=useCameraPermissions();
 const [manual,setManual]=useState(false),[manualName,setManualName]=useState(''),[manualNumber,setManualNumber]=useState(''),[manualBrand,setManualBrand]=useState<'pokemon'|'onepiece'>('pokemon');
 const run=async(work:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');setNotice('');try{await work()}catch(e){setError(e instanceof Error?e.message:'通信に失敗しました。')}finally{setBusy(false)}};
 const reset=()=>{setLookup(null);setCandidates([]);setProductId('');setResult(null);setConfirmed(false);setConsent(false)};
 async function searchCert(value=cert){
  reset();const data=await lendingApi<CertificateLookup>('/cards',{body:{action:'lookup',certInput:value}});
  setLookup(data);setCandidates(data.candidates);setQuery(data.searchQuery);if(data.cacheHit)setNotice('保存済みの鑑定情報を表示しました。');if(data.searchWarning)setError(data.searchWarning);
 }
 async function scan(){const current=permission?.granted?permission:await requestPermission();if(!current.granted){setError('カメラを許可するか、鑑定番号を入力してください。');return}setScanning(true)}
 const c=lookup?.certificate;
 return <View style={{gap:20}}>
  <View style={ui.card}><Text style={ui.title}>査定方法を選択</Text><Button title={`${route==='psa'?'✓ ':''}PSA鑑定番号から査定`} secondary disabled={busy} onPress={()=>setRoute('psa')}/><Button title={`${route==='support'?'✓ ':''}PSA番号なし・未鑑定の見積もり相談`} secondary disabled={busy} onPress={()=>{setRoute('support');setScanning(false)}}/></View>
  {route==='support'?<SupportEstimate connected onRegistered={onApplied}/>:<>
  <View style={ui.card}><Text style={ui.title}>1. PSAからカードを検索</Text><Text style={ui.muted}>鑑定番号またはPSAラベルのQRから、カード名・収録年・番号・グレードを確認します。</Text>
   <Field label="PSA鑑定番号 / 公式QR URL" value={cert} onChangeText={v=>{setCert(v);reset()}} autoCapitalize="none" autoCorrect={false} maxLength={250} editable={!busy}/>
   <Button title="QRを読み取る" disabled={busy} onPress={()=>void scan()}/>
   {scanning&&<><CameraView style={{height:260}} barcodeScannerSettings={{barcodeTypes:['qr']}} onBarcodeScanned={r=>{const n=parsePsaCert(r.data);if(n){setScanning(false);setCert(n);void run(()=>searchCert(n))}}}/><Button title="カメラを閉じる" secondary onPress={()=>setScanning(false)}/></>}
   <Button title={busy?'検索・取得中…':'PSA番号から検索'} disabled={busy||!parsePsaCert(cert)} onPress={()=>void run(()=>searchCert())}/>
   <Button title="ラベルの情報を手入力" secondary disabled={busy} onPress={()=>setManual(!manual)}/>
   {manual&&<><Text style={ui.muted}>手入力の情報は未照会として保存されます。融資前に運営の確認が必要です。</Text><Field label="ラベルのカード名（英語名も可）" value={manualName} onChangeText={setManualName} editable={!busy}/><Field label="ラベルのカード番号（例132）" value={manualNumber} onChangeText={setManualNumber} editable={!busy}/><View style={ui.row}>{(['pokemon','onepiece'] as const).map(v=><View key={v} style={{flex:1}}><Button title={`${manualBrand===v?'✓ ':''}${v==='pokemon'?'ポケモン':'ワンピース'}`} secondary disabled={busy} onPress={()=>setManualBrand(v)}/></View>)}</View><Button title="申告PSA10の参考査定に進む" disabled={busy||!parsePsaCert(cert)||manualName.trim().length<2||!manualNumber.trim()} onPress={()=>void run(async()=>{reset();const d=await lendingApi<CertificateLookup>('/cards',{body:{action:'manual_lookup',certInput:cert,subject:manualName,cardNumber:manualNumber,brand:manualBrand,grade:'10',unverifiedConfirmed:true}});setLookup(d);setCandidates(d.candidates);setQuery(d.searchQuery);if(d.searchWarning)setError(d.searchWarning)})}/></>}
  </View>
  {error?<><Text accessibilityRole="alert" style={ui.error}>{error}</Text><Button title="自動査定が使えない場合はサポートへ相談" secondary disabled={busy} onPress={()=>{setRoute('support');setScanning(false)}}/></>:null}{notice?<Text accessibilityLiveRegion="polite" style={ui.success}>{notice}</Text>:null}
  {c&&<View style={ui.card}><Text style={ui.title}>{c.subject}</Text><Text style={ui.body}>{c.year} / {c.brand}</Text><Text style={ui.body}>カード番号 {c.cardNumber} / {c.variety}</Text><Text style={ui.amount}>PSA {c.grade}</Text><Text style={ui.muted}>{c.verifiedBy==='psa_api'?'PSA照会済み':'手入力（PSA未照会）'} / 鑑定番号 {c.certNumber} / 取得 {date(c.fetchedAt)}</Text>
   <Button title="PSA公式の情報を見る" secondary onPress={()=>void Linking.openURL(c.sourceUrl)}/>
   {!c.eligible&&<Text style={ui.error}>自動査定の対象はポケモン・ワンピースのPSA10です。</Text>}
  </View>}
  {c?.eligible&&lookup&&<View style={ui.card}><Text style={ui.title}>2. スニダンの商品を確認</Text><Text style={ui.muted}>名前だけで選ばず、収録セット・言語・レアリティ・カード番号をラベルと照合してください。</Text>
   <Field label="商品検索キーワード" value={query} onChangeText={setQuery} editable={!busy}/>
   <Button title="スニダンで商品候補を検索" disabled={busy||query.trim().length<2} onPress={()=>void run(async()=>{const d=await lendingApi<{candidates:ProductCandidate[]}>('/cards',{body:{action:'search',lookupId:lookup.id,query}});setCandidates(d.candidates);if(!d.candidates.length)setNotice('候補がありません。キーワードを変えるか商品IDを指定してください。')})}/>
   {candidates.map(p=><Pressable key={p.productId} accessibilityRole="radio" accessibilityState={{selected:productId===p.productId}} disabled={busy} onPress={()=>{setProductId(p.productId);setConfirmed(false);setResult(null)}} style={[ui.card,productId===p.productId&&{borderColor:'#fcd66e'}]}><Text style={ui.body}>{p.name}</Text><Text style={ui.muted}>商品ID {p.productId}</Text></Pressable>)}
   <Field label="スニダン商品ID（候補がない場合）" value={productId} onChangeText={v=>{setProductId(v);setConfirmed(false);setResult(null)}} keyboardType="number-pad" editable={!busy}/>
   <View style={ui.row}><Switch value={confirmed} onValueChange={setConfirmed} disabled={busy} accessibilityLabel="PSAとスニダンの商品一致を確認"/><Text style={[ui.body,{flex:1}]}>セット・言語・カード番号を確認しました</Text></View>
   <Button title="PSA10の価格を取得して査定" disabled={busy||!confirmed||!/^\d{1,9}$/.test(productId)} onPress={()=>void run(async()=>{const d=await lendingApi<Result>('/cards',{body:{action:'assess',lookupId:lookup.id,productId,confirmed:true}});setResult(d);setConsent(false);setAmount(String(Math.min(300000,Math.floor(d.assessment.estimate_jpy/10000)*10000)))})}/>
  </View>}
  {result&&<View style={ui.card}><Text style={ui.title}>3. 査定結果</Text><Text style={ui.body}>{result.assessment.product.name}</Text><Text style={ui.muted}>融資参考額（相場の40%が上限）</Text><Text style={ui.amount}>{yen(result.assessment.estimate_jpy)}</Text><Text style={ui.muted}>スニダンPSA10価格の取得日時 {date(result.market.fetchedAt)} / 有効期限 {date(result.assessment.expires_at)}</Text><Text style={ui.body}>{result.notice}</Text>
   <Button title="スニダンで商品を確認" secondary onPress={()=>void Linking.openURL(result.assessment.product.sourceUrl)}/>
   <View style={ui.row}><Switch value={consent} onValueChange={setConsent} disabled={busy} accessibilityLabel="参考額と現物検品への同意"/><Text style={[ui.body,{flex:1}]}>参考額は融資の確約ではなく、現物検品・本人確認が必要なことに同意します</Text></View>
   {result.quote?<><Field label="借入希望額（1万円単位）" value={amount} onChangeText={setAmount} keyboardType="number-pad" editable={!busy}/><View style={ui.row}>{(['mail','store'] as const).map(v=><View key={v} style={{flex:1}}><Button title={`${deposit===v?'✓ ':''}${v==='mail'?'郵送':'店頭'}`} secondary onPress={()=>setDeposit(v)}/></View>)}</View><Button title="このカードで申し込む" disabled={busy||!consent||!/^\d+$/.test(amount)||Number(amount)<100000||Number(amount)%10000!==0||Number(amount)>result.quote.cap_jpy} onPress={()=>void run(async()=>{await workflowRequest({type:'apply',quoteId:result.quote!.id,certInput:result.assessment.cert_number,amountJpy:Number(amount),deposit});reset();await onApplied();setNotice('申込を受け付けました。マイページで確認できます。')})}/></>:
   <Button title="運営に査定を依頼する" disabled={busy||!consent||result.assessment.status==='submitted'} onPress={()=>void run(async()=>{await lendingApi('/cards',{body:{action:'request',assessmentId:result.assessment.id,consent:true}});setResult({...result,assessment:{...result.assessment,status:'submitted'}});await onApplied();setNotice('査定依頼を受け付けました。マイページに記録しました。')})}/>}
  </View>}
 </>}
 </View>
}
