import {useCallback,useEffect,useRef,useState} from 'react';
import {Switch,Text,View} from 'react-native';
import {Button,Field,ui} from '../ui';
import {firebaseProjectId,sendPhoneCode,phoneError,watchPhoneSignIn,signOutPhone} from '../firebase-phone';
import {normalizeMobilePhone} from '../../../lib/lending/phone';
import {checkPhonePreview,connectPhonePreview} from '../api';
export function PhoneLogin({accessUrl,onConnected,disabled,onBusyChange}:{accessUrl:string;onConnected:()=>Promise<void>;disabled:boolean;onBusyChange:(busy:boolean)=>void}){
 const [phone,setPhone]=useState(''),[code,setCode]=useState(''),[consent,setConsent]=useState(false);
 const [confirmation,setConfirmation]=useState<Awaited<ReturnType<typeof sendPhoneCode>>|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[remaining,setRemaining]=useState(0);
 const attempt=useRef<{url:string;phone:string}|null>(null),completion=useRef<Promise<void>|null>(null);
 const complete=useCallback(async(token:string)=>{
  if(completion.current)return completion.current;
  const current=attempt.current;if(!current)return;
  setBusy(true);onBusyChange(true);
  const work=(async()=>{await connectPhonePreview(current.url,token);await onConnected()})();completion.current=work;
  try{await work}finally{completion.current=null;setBusy(false);onBusyChange(false)}
 },[onConnected,onBusyChange]);
 useEffect(()=>{
  if(!firebaseProjectId)return;
  let live=true,unsubscribe:(()=>void)|undefined;
  void watchPhoneSignIn((phone,getToken)=>{if(live&&attempt.current?.phone===phone)void getToken().then(complete).catch(e=>{if(live)setError(phoneError(e))})})
   .then(stop=>{if(live)unsubscribe=stop;else stop()}).catch(e=>{if(live)setError(phoneError(e))});
  return()=>{live=false;attempt.current=null;unsubscribe?.()};
 },[complete]);
 useEffect(()=>{if(!remaining)return;const timer=setTimeout(()=>setRemaining(v=>Math.max(0,v-1)),1000);return()=>clearTimeout(timer)},[remaining]);
 async function run(work:()=>Promise<void>){if(busy||disabled)return;setBusy(true);onBusyChange(true);setError('');setNotice('');try{await work()}catch(e){setError(phoneError(e))}finally{const pending=!!completion.current;setBusy(pending);onBusyChange(pending)}}
 return <View style={ui.card}>
  <Text style={ui.title}>電話番号でログイン</Text>
  <Text style={ui.muted}>初めての方は電話番号認証後にアカウントを作成します。</Text>
  {!firebaseProjectId&&<Text style={ui.muted}>電話番号認証は準備中です。</Text>}
  {error?<Text accessibilityRole="alert" style={ui.error}>{error}</Text>:null}
  {notice?<Text accessibilityLiveRegion="polite" style={ui.success}>{notice}</Text>:null}
  <Field label="携帯電話番号" value={phone} onChangeText={v=>{attempt.current=null;setPhone(v);setConfirmation(null);setCode('')}} keyboardType="phone-pad" editable={!busy&&!disabled}/>
  <View style={ui.row}><Switch accessibilityLabel="電話番号認証への同意" value={consent} onValueChange={setConsent} disabled={busy||disabled}/><Text style={[ui.body,{flex:1}]}>電話番号を認証と不正利用防止のためGoogleへ送信・保存することに同意します。</Text></View>
  <Button title={remaining?`再送まで ${remaining}秒`:confirmation?'SMSを再送':'SMSで認証コードを送る'} disabled={busy||disabled||!consent||!firebaseProjectId||!accessUrl||remaining>0} onPress={()=>void run(async()=>{await checkPhonePreview(accessUrl,firebaseProjectId!);await signOutPhone();const normalized=normalizeMobilePhone(phone,true);if(!normalized)throw Error('携帯電話番号を確認してください。');attempt.current={url:accessUrl,phone:normalized};const result=await sendPhoneCode(phone);setConfirmation(result);setRemaining(60);setCode('');setNotice('認証コードを入力してください。')})}/>
  {confirmation&&<><Field label="認証コード（6桁）" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} editable={!busy&&!disabled}/><Button title="ログイン" disabled={busy||disabled||!/^\d{6}$/.test(code)} onPress={()=>void run(async()=>{const credential=await confirmation.confirm(code);if(!credential)throw Error('認証できませんでした。SMSを再送してください。');await complete(await credential.user.getIdToken())})}/></>}
 </View>
}
