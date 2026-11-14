import {ConsentLinks} from './ConsentLinks';
import {useEffect,useState} from 'react';
import {Text,View} from 'react-native';
import type {WorkflowLoan} from '../../../lib/lending/workflow-types';
import {DUMMY_LENDING_BANK,type BankPaymentPreview} from '../../../lib/lending/bank-payment-types';
import {lendingApi} from '../api';
import {Button,Field,RoyalSwitch,ui,yen,date} from '../ui';

export function BankPayment({loan,kind,busy,onReport}:{loan:WorkflowLoan;kind:'repayment'|'extension';busy:boolean;onReport:(action:'report_repayment'|'request_extension',payload:Record<string,unknown>)=>void}){
 const [day,setDay]=useState(()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10)),[name,setName]=useState(''),[consent,setConsent]=useState(false),[quote,setQuote]=useState<BankPaymentPreview|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const pending=loan.status==='repayment_pending'||loan.requests.some(request=>request.status==='pending');
 useEffect(()=>{
  if(pending||!/^\d{4}-\d{2}-\d{2}$/.test(day))return;
  let live=true;const controller=new AbortController();
  void lendingApi<{preview:BankPaymentPreview}>(`/workflow?view=payment&loanId=${encodeURIComponent(loan.id)}&date=${encodeURIComponent(day)}`,{signal:controller.signal}).then(data=>{if(live){setQuote(data.preview);setError('')}}).catch(cause=>{if(live){setQuote(null);setError(cause instanceof Error?cause.message:'振込額を取得できません。')}});
  return()=>{live=false;controller.abort()};
 },[loan.id,loan.version,day,pending,retry]);
 if(pending)return <View style={ui.card}><Text style={ui.title}>入金確認中</Text><Text style={ui.body}>確認後に手続きを進めます。</Text></View>;
 const valid=quote?.version===loan.version,available=valid&&(kind==='repayment'||quote.extensionAvailable);
 const bank=DUMMY_LENDING_BANK;
 return <View style={{gap:10}}>
  <View style={[ui.card,{padding:14,gap:8,borderRadius:12}]}>
   <Text style={ui.title}>{kind==='extension'?'1か月延長':'全額返済'}</Text>
   {quote&&valid?<><Text style={ui.amount}>{yen(kind==='extension'?quote.extensionAmountJpy:quote.totalJpy)}</Text>{kind==='repayment'?<Text style={ui.muted}>元金 {yen(quote.principalJpy)} / {quote.chargeLabel} {yen(quote.interestJpy)}</Text>:<><Text style={ui.muted}>未払い質料 {quote.unpaidMonths}か月分</Text><Text style={ui.body}>延長後 {date(quote.newDueAt)}</Text><Text style={ui.muted}>申告・着金期限 {date(quote.dueAt)}</Text>{!quote.extensionAvailable&&<Text style={ui.error}>現在は延長できません。</Text>}</>}</>:<Text style={ui.muted}>{error?'金額を取得できません':'金額を確認中…'}</Text>}
   {!!error&&<><Text accessibilityRole="alert" style={ui.error}>{error}</Text><Button title="再取得" secondary onPress={()=>setRetry(value=>value+1)}/></>}
  </View>
  <View style={[ui.card,{padding:14,gap:4,borderRadius:12}]}><Text style={ui.label}>振込先（ダミー）</Text><Text style={ui.body}>{bank.bank} {bank.branch}</Text><Text style={ui.body}>{bank.accountType} {bank.accountNumber} / {bank.accountName}</Text><Text style={ui.muted}>この口座へは振り込めません。</Text></View>
  <Field label="振込日（YYYY-MM-DD）" value={day} onChangeText={value=>{setDay(value);setQuote(null);setConsent(false)}} maxLength={10} editable={!busy}/>
  <Field label="振込名義" value={name} onChangeText={value=>{setName(value);setConsent(false)}} maxLength={100} editable={!busy}/>
  <ConsentLinks/><View style={ui.row}><RoyalSwitch accessibilityLabel="振込内容を確認しました" value={consent} onValueChange={setConsent} disabled={busy}/><Text style={[ui.body,{flex:1}]}>振込内容を確認しました</Text></View>
  <Button title={kind==='extension'?'延長分を振込済み':'返済分を振込済み'} disabled={busy||!available||!name.trim()||!consent} onPress={()=>onReport(kind==='extension'?'request_extension':'report_repayment',{transferDate:day,transferName:name.trim(),...(kind==='extension'?{termsAccepted:true}:{})})}/>
  <Text style={ui.muted}>管理者の入金確認後に{kind==='extension'?'期限を更新':'返却手続きを開始'}します。</Text>
 </View>;
}
