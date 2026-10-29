import { useEffect,useState } from 'react';
import { Linking,Platform,Text,View } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { AccountState } from '../../../lib/lending/mobile-types';
import { lendingApi } from '../api';
import { Button,ui,date } from '../ui';
Notifications.setNotificationHandler({handleNotification:async()=>({shouldPlaySound:true,shouldSetBadge:false,shouldShowBanner:true,shouldShowList:true})});
export function NotificationsScreen(){
 const [account,setAccount]=useState<AccountState|null>(null),[deviceId,setDeviceId]=useState<string|null>(null),[status,setStatus]=useState('未確認');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=async()=>setAccount(await lendingApi<AccountState>('/account'));
 const run=async(work:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');setNotice('');try{await work()}catch(e){setError(e instanceof Error?e.message:'通知テストに失敗しました。')}finally{setBusy(false)}};
 useEffect(()=>{
  let live=true;
  void lendingApi<AccountState>('/account').then(d=>{if(live)setAccount(d)}).catch(e=>{if(live)setError(e.message)});
  void Notifications.getPermissionsAsync().then(p=>{if(live)setStatus(p.granted?'許可済み':'未許可')}).catch(e=>{if(live)setError(e.message)});
  return()=>{live=false};
 },[]);
 async function permissions(){
  if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('lending-test',{name:'TCG ROYAL お知らせ',importance:Notifications.AndroidImportance.HIGH,sound:'default'});
  const p=await Notifications.requestPermissionsAsync();setStatus(p.granted?'許可済み':'未許可');if(!p.granted)throw Error('通知が許可されていません。端末の設定から許可してください。');
 }
 return <View style={{gap:20}}>
  {error?<Text accessibilityRole="alert" style={ui.error}>{error}</Text>:null}{notice?<Text accessibilityLiveRegion="polite" style={ui.success}>{notice}</Text>:null}
  <View style={ui.card}><Text style={ui.title}>通知の許可</Text><Text style={ui.body}>通知権限: {status}</Text><Button title="通知を許可する" disabled={busy} onPress={()=>void run(permissions)}/><Button title="端末の通知設定を開く" secondary onPress={()=>void Linking.openSettings()}/><Text style={ui.muted}>ロック画面には氏名・融資額などの個人情報を表示しません。</Text></View>
  <View style={ui.card}><Text style={ui.title}>端末内の通知テスト</Text><Text style={ui.body}>5秒後に通知を表示します。ホーム画面でも確認できます。</Text><Button title="5秒後に端末内通知を表示" disabled={busy} onPress={()=>void run(async()=>{await permissions();await Notifications.scheduleNotificationAsync({content:{title:'TCG ROYAL',body:'端末内の通知テストです。',sound:'default',data:{screen:'notifications'}},trigger:{type:Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,seconds:5,channelId:'lending-test'}});setNotice('端末内通知を予約しました。ホーム画面でお待ちください。')})}/></View>
  <View style={ui.card}><Text style={ui.title}>プッシュ通知テスト</Text><Text style={ui.body}>送信設定: {account?.capabilities.remotePushConfigured?'設定済み':'未設定'}</Text><Text style={ui.muted}>端末を登録してからテスト通知を送信します。</Text>
   <Button title="この端末をプッシュ通知に登録" disabled={busy||!account?.capabilities.remotePushConfigured} onPress={()=>void run(async()=>{if(Platform.OS!=='android')throw Error('Android端末で登録してください。');await permissions();let token:string;try{token=(await Notifications.getDevicePushTokenAsync()).data as string}catch{throw Error('通知を登録できません。アプリの設定とGoogle Play開発者サービスを確認してください。')}const d=await lendingApi<{deviceId:string}>('/notifications',{body:{action:'register',platform:'android',token}});setDeviceId(d.deviceId);setNotice('端末を登録しました。')})}/>
   <Button title="自分の端末へテストプッシュを送る" disabled={busy||!deviceId} onPress={()=>void run(async()=>{await lendingApi('/notifications',{body:{action:'test',deviceId}});await load();setNotice('送信を受け付けました。端末で受信を確認してください。')})}/>
   {deviceId&&<Button title="この端末の登録を解除" secondary disabled={busy} onPress={()=>void run(async()=>{await lendingApi('/notifications',{body:{action:'unregister',deviceId}});setDeviceId(null);setNotice('端末登録を解除しました。')})}/>}
   <Button title="通知テスト履歴を更新" secondary disabled={busy} onPress={()=>void run(load)}/>
   {account?.notifications.map(n=><Text key={n.id} style={ui.muted}>{date(n.created_at)} / {({sending:'送信中',accepted:'送信受付済み',received:'端末受信確認済み',failed:'送信失敗'} as Record<string,string>)[n.status]}{n.error_code?` / ${n.error_code}`:''}</Text>)}
  </View>
 </View>
}
