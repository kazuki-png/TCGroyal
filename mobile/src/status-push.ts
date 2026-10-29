import {Platform} from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {lendingApi,getInboxStorageKey} from './api';
let registration:{key:string;deviceId:string}|null=null;
export function currentStatusPushDevice(){return registration?.key===getInboxStorageKey()?registration.deviceId:null;}
export async function registerStatusPush(prompt=false){
 if(Platform.OS!=='android')throw Error('iOSのプッシュ通知は接続設定の準備中です。');
 const key=getInboxStorageKey();if(!key)throw Error('ログインしてください。');
 if(!prompt&&await AsyncStorage.getItem(`tcg:status-push:${key}`)==='disabled')return null;
 await Notifications.setNotificationChannelAsync('lending-test',{name:'TCG ROYAL お知らせ',importance:Notifications.AndroidImportance.HIGH});
 let permission=await Notifications.getPermissionsAsync();if(!permission.granted&&prompt)permission=await Notifications.requestPermissionsAsync();
 if(!permission.granted){if(prompt)throw Error('通知が許可されていません。端末の設定を確認してください。');return null;}
 const token=(await Notifications.getDevicePushTokenAsync()).data;
 if(typeof token!=='string')throw Error('端末の通知登録を取得できません。');
 const result=await lendingApi<{deviceId:string}>('/notifications',{body:{action:'register',platform:'android',token}});
 if(key!==getInboxStorageKey())return null;
 registration={key,deviceId:result.deviceId};await AsyncStorage.setItem(`tcg:status-push:${key}`,'enabled');return result.deviceId;
}
export async function unregisterStatusPush(rememberOptOut=true){
 const key=getInboxStorageKey(),id=currentStatusPushDevice();
 try{if(id)await lendingApi('/notifications',{body:{action:'unregister',deviceId:id}})}
 finally{try{await Notifications.unregisterForNotificationsAsync()}finally{registration=null;if(rememberOptOut&&key)await AsyncStorage.setItem(`tcg:status-push:${key}`,'disabled')}}
}
export async function reportStatusPush(notificationId:string){
 const deviceId=currentStatusPushDevice();if(deviceId&&/^[a-f0-9-]{36}$/i.test(notificationId))await lendingApi('/notifications',{body:{action:'received_status',notificationId,deviceId}});
}
