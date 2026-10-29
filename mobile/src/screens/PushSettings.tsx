import {useEffect,useState} from 'react';
import {Linking,Platform,Text,View} from 'react-native';
import * as Notifications from 'expo-notifications';
import {currentStatusPushDevice,registerStatusPush,unregisterStatusPush} from '../status-push';
import {Button,ui} from '../ui';
export function PushSettings(){
 const [enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let live=true;void Notifications.getPermissionsAsync().then(p=>{if(live)setEnabled(p.granted&&!!currentStatusPushDevice())});return()=>{live=false}},[]);
 async function update(enable:boolean){setBusy(true);setError('');try{if(enable){await registerStatusPush(true);setEnabled(true);setMessage('ステータス変更のお知らせを受け取ります。')}else{await unregisterStatusPush();setEnabled(false);setMessage('この端末へのお知らせを停止しました。')}}catch(e){setError(e instanceof Error?e.message:'通知設定を更新できません。')}finally{setBusy(false)}}
 return <View style={ui.card}><Text style={ui.title}>ステータス変更のお知らせ</Text><Text style={ui.body}>査定・融資・返済・返却の状況が変わった際に、プッシュ通知を受け取れます。</Text><Text style={ui.muted}>{enabled?'この端末への通知は登録済みです。':'この端末への通知は未登録です。'} 通知本文には金額・カード名を含めません。</Text>{Platform.OS==='android'?<><Button title="通知を受け取る" disabled={busy} onPress={()=>void update(true)}/><Button title="この端末への通知を停止" secondary disabled={busy||!enabled} onPress={()=>void update(false)}/></>:<Text style={ui.muted}>iOSのプッシュ通知は接続設定の準備中です。</Text>}<Button title="端末の通知設定を開く" secondary onPress={()=>void Linking.openSettings()}/>{message?<Text style={ui.success}>{message}</Text>:null}{error?<Text accessibilityRole="alert" style={ui.error}>{error}</Text>:null}</View>;
}
