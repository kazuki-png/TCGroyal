import Constants from 'expo-constants';
import {normalizeMobilePhone} from '../../lib/lending/phone';
import {signOutIfSignedIn} from './phone-session';
export const firebaseProjectId: string|null=Constants.expoConfig?.extra?.firebaseProjectId??null;
export async function sendPhoneCode(input:string){
 if(!firebaseProjectId)throw Error('Firebase設定入りのAPKが必要です。現在はテスト接続コードをご利用ください。');
 const phone=normalizeMobilePhone(input,process.env.EXPO_PUBLIC_LENDING_CHANNEL==='preview'||__DEV__);
 if(!phone)throw Error('070・080・090で始まる携帯電話番号を入力してください。');
 const {getAuth,signInWithPhoneNumber}=await import('@react-native-firebase/auth');
 return signInWithPhoneNumber(getAuth(),phone);
}
export async function firebaseIdToken(){
 const {getAuth}=await import('@react-native-firebase/auth');
 const auth=getAuth();await auth.authStateReady();
 const user=auth.currentUser;
 if(!user)throw Error('電話番号で接続し直してください。');
 return user.getIdToken();
}
export async function watchPhoneSignIn(callback:(phone:string,getToken:()=>Promise<string>)=>void){
 const {getAuth,onAuthStateChanged}=await import('@react-native-firebase/auth');
 return onAuthStateChanged(getAuth(),user=>{if(user?.phoneNumber)callback(user.phoneNumber,()=>user.getIdToken())});
}
export async function signOutPhone(){
 if(!firebaseProjectId)return;
 const {getAuth,signOut}=await import('@react-native-firebase/auth');
 await signOutIfSignedIn(getAuth(),signOut);
}
export function phoneError(error:unknown):string{
 const code=(error as {code?:string})?.code;
 const messages:Record<string,string>={
  'auth/no-current-user':'認証状態が変わりました。SMSの認証をやり直してください。',
  'auth/invalid-verification-code':'認証コードが違います。SMSの6桁を確認してください。',
  'auth/session-expired':'認証コードが期限切れです。SMSを再送してください。',
  'auth/too-many-requests':'試行回数が多いため、時間をおいてお試しください。',
  'auth/quota-exceeded':'SMSの送信上限に達しています。運営へお問い合わせください。',
  'auth/billing-not-enabled':'FirebaseのSMS配信には課金設定が必要です。開発用テスト番号も利用できます。',
  'auth/operation-not-allowed':'Firebaseの電話番号認証が有効になっていません。',
  'auth/app-not-authorized':'Androidのパッケージ名と署名証明書をFirebaseに登録してください。',
  'auth/network-request-failed':'通信できません。接続を確認してください。',
 };
 return messages[code??'']??(error instanceof Error?error.message:'電話番号認証に失敗しました。');
}

export async function firebaseAccountId(){
 const {getAuth}=await import('@react-native-firebase/auth');
 const auth=getAuth();await auth.authStateReady();
 const user=auth.currentUser;
 if(!user)throw Error('電話番号で接続し直してください。');
 return user.uid;
}
