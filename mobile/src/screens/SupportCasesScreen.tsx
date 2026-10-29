import {useEffect,useRef,useState} from 'react';
import {Alert,Linking,Switch,Text,View} from 'react-native';
import {randomUUID} from 'expo-crypto';
import * as Clipboard from 'expo-clipboard';
import {SUPPORT_CASE_STATUS,type SupportCase,type SupportCaseList} from '../../../lib/lending/support-case-types';
import {LOAN_STATUS_LABELS} from '../../../lib/lending/workflow-types';
import {lendingApi} from '../api';
import {buildSupportEstimateMessage,SUPPORT_LINE_URL} from '../support-estimate';
import {Button,Field,ui,yen,date} from '../ui';

function CaseCard({item,busy,command,now}:{item:SupportCase;busy:boolean;now:number;command:(item:SupportCase,action:string,payload:Record<string,unknown>)=>Promise<void>}){
 const [consent,setConsent]=useState(false),[amount,setAmount]=useState(String(item.offer_jpy??item.requested_jpy??100000)),[deposit,setDeposit]=useState<'mail'|'store'>('mail');
 const [contactError,setContactError]=useState('');
 const expired=!item.offer_expires_at||Date.parse(item.offer_expires_at)<=now;
 async function contact(){setContactError('');try{await Clipboard.setStringAsync(buildSupportEstimateMessage({reason:item.reason,cardName:item.card_name,cardNumber:item.card_number,condition:item.condition,notes:item.notes,requestedAmount:String(item.requested_jpy??'')},item.reference));await Linking.openURL(SUPPORT_LINE_URL);}catch{setContactError('受付番号を公式LINEへ送ってお問い合わせください。');}}
 return <View style={ui.card}>
  <Text selectable style={ui.label}>{item.reference}</Text><Text style={ui.title}>{item.card_name}</Text>
  <Text style={ui.body}>{item.loan_status?LOAN_STATUS_LABELS[item.loan_status]:SUPPORT_CASE_STATUS[item.status]}</Text>
  <Text style={ui.muted}>{item.card_number||'カード番号未登録'} / 相談登録 {date(item.created_at)}</Text>
  {item.card_uid&&<><Text style={ui.muted}>{item.search_method==='image'?'画像から候補検索':'カード一覧から選択'} / 申告 {item.declared_grade} / 鑑定・現物確認待ち</Text><Text style={ui.body}>{item.condition}</Text>{item.indicative_jpy!=null&&<Text style={ui.muted}>受付時の参考額 {yen(item.indicative_jpy)}（運営の見積もりとは別です）</Text>}</>}
  <Button title="受付番号を付けてLINEで連絡" secondary disabled={busy} onPress={()=>void contact()}/>
  {contactError?<Text accessibilityRole="alert" style={ui.error}>{contactError}</Text>:null}
  {item.offer_jpy!==null&&<><Text style={ui.label}>融資参考額</Text><Text style={ui.amount}>{yen(item.offer_jpy)}</Text><Text style={ui.body}>{item.offer_note}</Text><Text style={ui.muted}>見積もりの期限 {date(item.offer_expires_at)}。現物検品後に最終条件を提示します。</Text></>}
  {item.status==='offered'&&!item.loan_id&&<>
   {expired?<Text style={ui.error}>見積もりの期限が切れています。サポートへ再見積もりを依頼してください。</Text>:<>
    <Field label="借入希望額（1万円単位・10万円以上）" value={amount} onChangeText={setAmount} keyboardType="number-pad" editable={!busy}/>
    <View style={ui.row}>{(['mail','store'] as const).map(value=><Button key={value} title={`${deposit===value?'✓ ':''}${value==='mail'?'郵送':'店頭'}`} secondary disabled={busy} onPress={()=>setDeposit(value)}/>)}</View>
    <View style={ui.row}><Switch accessibilityLabel="個別見積もりと現物検品への同意" value={consent} onValueChange={setConsent} disabled={busy}/><Text style={[ui.body,{flex:1}]}>見積もりを確認し、現物検品後の最終条件に改めて同意することを確認しました</Text></View>
    <Button title="この見積もりで申し込む" disabled={busy||!consent||!/^\d+$/.test(amount)||Number(amount)<100000||Number(amount)%10000!==0||Number(amount)>(item.offer_jpy??0)} onPress={()=>void command(item,'accept',{amountJpy:Number(amount),deposit,termsAccepted:true})}/>
   </>}
  </>}
  {item.loan_id?<Text style={ui.muted}>融資申込へ引き継ぎ済みです。契約条件・返済期限・残高は下の申込・契約一覧で確認できます。</Text>:!['cancelled','declined'].includes(item.status)&&<Button title="相談をキャンセル" secondary disabled={busy} onPress={()=>Alert.alert('相談をキャンセル','この見積もり相談をキャンセルします。',[{text:'戻る',style:'cancel'},{text:'キャンセルする',style:'destructive',onPress:()=>void command(item,'cancel',{})}])}/>}
  {item.events?.map(event=><Text key={event.id} style={ui.muted}>{date(event.created_at)} / {SUPPORT_CASE_STATUS[event.to_status]}{event.message?` / ${event.message}`:''}</Text>)}
 </View>;
}
export function SupportCasesScreen({onChanged}:{onChanged:()=>Promise<void>}){
 const [now,setNow]=useState(Date.now);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[]);
 const [data,setData]=useState<SupportCaseList|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const retries=useRef(new Map<string,string>());
 useEffect(()=>{let live=true;void lendingApi<SupportCaseList>('/support-cases').then(value=>{if(live)setData(value);}).catch(cause=>{if(live)setError(cause.message);});return()=>{live=false;};},[]);
 async function refresh(){if(busy)return;setBusy(true);setError('');try{setData(await lendingApi<SupportCaseList>('/support-cases'));}catch(cause){setError(cause instanceof Error?cause.message:'相談を取得できません。');}finally{setBusy(false);}}
 async function command(item:SupportCase,action:string,payload:Record<string,unknown>){
  if(busy)return;setBusy(true);setError('');const body={action,caseId:item.id,version:item.version,payload};const signature=JSON.stringify(body);const key=retries.current.get(signature)??randomUUID();retries.current.set(signature,key);
  try{await lendingApi('/support-cases',{body:{...body,key}});retries.current.delete(signature);setData(await lendingApi<SupportCaseList>('/support-cases'));await onChanged();}catch(cause){setError(cause instanceof Error?cause.message:'更新できません。');}finally{setBusy(false);}
 }
 return <View style={{gap:16}}><Text style={ui.title}>査定依頼・個別見積もり</Text><Button title="査定の状況を更新" secondary disabled={busy} onPress={()=>void refresh()}/>{error?<Text accessibilityRole="alert" style={ui.error}>{error}</Text>:null}{data?.cases.map(item=><CaseCard key={`${item.id}-${item.version}`} item={item} now={now} busy={busy} command={command}/>)}{data?.total===0?<Text style={ui.muted}>査定依頼・個別見積もりはまだありません。</Text>:null}{data&&data.total>data.cases.length?<Text style={ui.muted}>新しい順に100件を表示しています。</Text>:null}</View>;
}
