import {Platform} from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {lendingApi,getInboxStorageKey} from './api';
let registration:{key:string;deviceId:string;token:string}|null=null;
const pending=new Map<string,Promise<string|null>>();
let generation=0;
export function currentStatusPushDevice(){return registration?.key===getInboxStorageKey()?registration.deviceId:null;}
export async function registerStatusPush(prompt=false,changedToken?:Notifications.DevicePushToken){
 const epoch=generation;
 if(Platform.OS!=='android')throw Error('iOSのプッシュ通知は接続設定の準備中です。');
 const key=getInboxStorageKey();if(!key)throw Error('ログインしてください。');
 if(!prompt&&await AsyncStorage.getItem(`tcg:status-push:${key}`)==='disabled')return null;
 await Notifications.setNotificationChannelAsync('lending-test',{name:'TCG ROYAL お知らせ',importance:Notifications.AndroidImportance.HIGH});
 let permission=await Notifications.getPermissionsAsync();if(!permission.granted&&prompt)permission=await Notifications.requestPermissionsAsync();
 if(!permission.granted){if(prompt)throw Error('通知が許可されていません。端末の設定を確認してください。');return null;}
 // Android emits a token event even for an explicit token read. The listener
 // must use its event payload, never request another token from within itself.
 const token=(changedToken??await Notifications.getDevicePushTokenAsync()).data;
 if(typeof token!=='string')throw Error('端末の通知登録を取得できません。');
 if(epoch!==generation||key!==getInboxStorageKey())return null;
 if(!prompt&&registration?.key===key&&registration.token===token)return registration.deviceId;
 const signature=JSON.stringify([epoch,key,token]);
 const existing=pending.get(signature);if(existing)return existing;
 const request=(async()=>{
  const result=await lendingApi<{deviceId:string}>('/notifications',{body:{action:'register',platform:'android',token}});
  if(epoch!==generation||key!==getInboxStorageKey())return null;
  registration={key,deviceId:result.deviceId,token};await AsyncStorage.setItem(`tcg:status-push:${key}`,'enabled');return result.deviceId;
 })();
 pending.set(signature,request);
 try{return await request}finally{if(pending.get(signature)===request)pending.delete(signature)}
}
export function watchStatusPushToken(){
 return Notifications.addPushTokenListener(token=>{void registerStatusPush(false,token).catch(()=>{})});
}
export async function unregisterStatusPush(rememberOptOut=true){
 generation++;
 const key=getInboxStorageKey(),id=currentStatusPushDevice();
 try{if(id)await lendingApi('/notifications',{body:{action:'unregister',deviceId:id}})}
 finally{try{await Notifications.unregisterForNotificationsAsync()}finally{registration=null;if(rememberOptOut&&key)await AsyncStorage.setItem(`tcg:status-push:${key}`,'disabled')}}
}
export async function reportStatusPush(notificationId:string){
 const deviceId=currentStatusPushDevice();if(deviceId&&/^[a-f0-9-]{36}$/i.test(notificationId))await lendingApi('/notifications',{body:{action:'received_status',notificationId,deviceId}});
}
