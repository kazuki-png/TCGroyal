import {useRef,useState} from 'react';
import {Text,View} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import {probeConnection,type ConnectionCheck} from '../connection-diagnostics';
import {DEFAULT_PREVIEW_URL} from '../remembered-access';
import {getApiBase,lendingApi} from '../api';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from '../supabase-config';
import {serviceErrorMessage} from '../service-errors';
import {Button,ui} from '../ui';
export function ConnectionDiagnostics({connected}:{connected:boolean}){
 const [results,setResults]=useState<ConnectionCheck[]>([]),[busy,setBusy]=useState(false),[checkedAt,setCheckedAt]=useState('');
 const [copied,setCopied]=useState(false);
 const device=`${Device.manufacturer??''} ${Device.modelName??''} / ${Device.osName??''} ${Device.osVersion??''}`;
 const version=Constants.expoConfig?.version??'不明';
 const lock=useRef(false);
 async function diagnose(){
  if(lock.current)return;lock.current=true;setBusy(true);setResults([]);setCopied(false);setCheckedAt(new Date().toLocaleString('ja-JP'));
  try{
   const origin=connected?getApiBase():DEFAULT_PREVIEW_URL;
   const checks=await Promise.all([
    probeConnection('Supabaseへの接続',SUPABASE_URL+'/auth/v1/health','health',{apikey:SUPABASE_PUBLISHABLE_KEY}),
    probeConnection('アプリAPIへの接続（圧縮なし）',origin+'/api/lending/account','unauthenticated',{'Accept-Encoding':'identity'}),
    probeConnection('アプリAPIへの接続（gzip比較）',origin+'/api/lending/account','unauthenticated',{'Accept-Encoding':'gzip'}),
   ]);setResults(checks);
   if(connected&&checks[1].ok){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try{await lendingApi('/account',{signal:controller.signal});setResults([...checks,{label:'ログイン情報付きのAPI接続',ok:true,message:'認証とデータ取得に成功しました'}])}
    catch(error){setResults([...checks,{label:'ログイン情報付きのAPI接続',ok:false,message:serviceErrorMessage(error,'認証付きの接続を確認できませんでした')}])}
    finally{clearTimeout(timer)}
   }
  }catch(error){setResults([{label:'接続設定',ok:false,message:serviceErrorMessage(error,'接続設定を確認できませんでした')}])
  }finally{lock.current=false;setBusy(false)}
 }
 return <View style={ui.card}>
  <Text style={ui.title}>接続診断</Text><Text style={ui.muted}>ログイン先とアプリAPIへの通信を分けて確認します。診断では申込や通知設定を変更しません。</Text>
  <Text selectable style={ui.muted}>{DEFAULT_PREVIEW_URL}</Text>
  <Text selectable style={ui.muted}>アプリ {version} / {device}</Text>
  <Button title={busy?'接続を診断中…':'接続を診断する'} disabled={busy} onPress={()=>void diagnose()}/>
  {!!checkedAt&&<Text style={ui.muted}>確認日時：{checkedAt}</Text>}
  {results.map(result=><View key={result.label} style={{gap:6}}><Text style={ui.label}>{result.label}</Text><Text selectable style={result.ok?ui.success:ui.error}>{result.message}</Text>{!!result.detail&&<Text selectable style={ui.muted}>{result.detail}</Text>}</View>)}
  {!!results.length&&<Button title={copied?'診断結果をコピーしました':'診断結果をコピー'} secondary disabled={busy} onPress={()=>void Clipboard.setStringAsync(JSON.stringify({version,device,checkedAt,origin:DEFAULT_PREVIEW_URL,results},null,2)).then(()=>setCopied(true)).catch(()=>setCopied(false))}/>}
 </View>
}
