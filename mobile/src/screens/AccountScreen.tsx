import { useEffect,useState } from 'react';
import { ActivityIndicator, Alert, Image, Switch, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { AccountState,LendingProfile } from '../../../lib/lending/mobile-types';
import { lendingApi } from '../api';
import { Button,Field,ui,yen,date } from '../ui';
import {PushSettings} from './PushSettings';
const docTypes={drivers_license:'運転免許証',passport:'パスポート',mynumber_front:'マイナンバーカード表面',address_proof:'住所確認書類'} as const;
const statuses:Record<string,string>={uploading:'送信未完了',pending:'確認待ち',verified:'確認済み',rejected:'再提出が必要',deleted:'削除済み'};
export function AccountScreen({onUpdated}:{onUpdated:()=>Promise<void>}){
 const [account,setAccount]=useState<AccountState|null>(null),[profile,setProfile]=useState<LendingProfile|null>(null),[editing,setEditing]=useState(false);
 const documentType='drivers_license';
 const [side,setSide]=useState<'front'|'back'>('front');
 const [asset,setAsset]=useState<ImagePicker.ImagePickerAsset|null>(null),[consent,setConsent]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function load(){const data=await lendingApi<AccountState>('/account');setAccount(data);setProfile(data.profile)}
 useEffect(()=>{let live=true;void lendingApi<AccountState>('/account').then(d=>{if(live){setAccount(d);setProfile(d.profile)}}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[]);
 const run=async(work:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');setNotice('');try{await work()}catch(e){setError(e instanceof Error?e.message:'処理に失敗しました。')}finally{setBusy(false)}};
 async function choose(camera:boolean){
  if(camera){const p=await ImagePicker.requestCameraPermissionsAsync();if(!p.granted)throw Error('撮影にはカメラの許可が必要です。写真からの選択も利用できます。')}
  const options:ImagePicker.ImagePickerOptions={mediaTypes:['images'],allowsEditing:false,quality:.8,exif:false};
  const result=camera?await ImagePicker.launchCameraAsync(options):await ImagePicker.launchImageLibraryAsync(options);
  if(!result.canceled){const item=result.assets[0];if(item.fileSize&&item.fileSize>3*1024*1024)throw Error('3MB以下の写真を選択してください。');setAsset(item);setConsent(false)}
 }
 function update(key:keyof LendingProfile,value:string){if(profile)setProfile({...profile,[key]:value})}
 return <View style={{gap:20}}>
  <PushSettings/>
  {error?<Text accessibilityRole="alert" style={ui.error}>{error}</Text>:null}{notice?<Text accessibilityLiveRegion="polite" style={ui.success}>{notice}</Text>:null}
  {!account&&<ActivityIndicator color="#fcd66e"/>}
  {account&&<><View style={ui.card}><Text style={ui.title}>現在のご利用状況</Text><Text style={ui.muted}>現在融資額（元本）</Text><Text style={ui.amount}>{yen(account.summary.outstandingJpy)}</Text><Text style={ui.body}>現在の返済必要額 {yen(account.summary.payoffJpy)}</Text><Text style={ui.body}>最も近い返済期限 {date(account.summary.nextDueAt)}</Text><Text style={ui.muted}>契約中 {account.summary.activeCount}件</Text><Button title="マイページを更新" secondary disabled={busy} onPress={()=>void run(async()=>{await load();await onUpdated()})}/></View>
   {account.authentication?.email&&<View style={ui.card}><Text style={ui.title}>ログインアカウント</Text><Text style={ui.body}>{account.authentication.email}</Text><Text style={ui.muted}>{account.authentication.emailVerified?'メール確認済み':'メール未確認'}</Text></View>}
   <View style={ui.card}><Text style={ui.title}>プロフィール</Text>
    {!editing&&<><Text style={ui.body}>{profile?.last_name} {profile?.first_name}</Text><Text style={ui.body}>生年月日 {profile?.birthday??'未登録'}</Text><Text style={ui.body}>〒{profile?.postal_code??'未登録'} {profile?.address}</Text><Text style={ui.body}>電話 {profile?.phone??'未登録'}</Text><Button title="個人情報を編集" secondary disabled={busy} onPress={()=>setEditing(true)}/></>}
    {editing&&profile&&<><Field label="姓" value={profile.last_name} onChangeText={v=>update('last_name',v)} editable={!busy}/><Field label="名" value={profile.first_name} onChangeText={v=>update('first_name',v)} editable={!busy}/><Field label="姓（カナ）" value={profile.last_name_kana} onChangeText={v=>update('last_name_kana',v)} editable={!busy}/><Field label="名（カナ）" value={profile.first_name_kana} onChangeText={v=>update('first_name_kana',v)} editable={!busy}/><Field label="生年月日 YYYY-MM-DD" value={profile.birthday??''} onChangeText={v=>update('birthday',v)} editable={!busy} keyboardType="numbers-and-punctuation"/><Field label="郵便番号" value={profile.postal_code??''} onChangeText={v=>update('postal_code',v)} editable={!busy} keyboardType="number-pad"/><Field label="住所" value={profile.address??''} onChangeText={v=>update('address',v)} editable={!busy} multiline/><Field label="電話番号" value={profile.phone??''} onChangeText={v=>update('phone',v)} editable={!busy} keyboardType="phone-pad"/><Text style={ui.muted}>氏名・住所などを変更した場合は本人確認が必要です。</Text><Button title="個人情報を保存" disabled={busy} onPress={()=>void run(async()=>{await lendingApi('/account',{body:{...profile}});setEditing(false);await load();await onUpdated();setNotice('プロフィールを保存しました。')})}/><Button title="編集をキャンセル" secondary disabled={busy} onPress={()=>{setProfile(account.profile);setEditing(false)}}/></>}
   </View>
   <View style={ui.card}><Text style={ui.title}>電話番号認証</Text><Text style={ui.body}>{account.phone.status==='test_verified'?'認証済み':'未認証'}</Text><Text style={ui.muted}>{account.capabilities.phoneConfigured?'登録した電話番号と照合しています。':'電話番号認証は準備中です。'}</Text></View>
   <View style={ui.card}><Text style={ui.title}>本人確認（運転免許証）</Text><Text style={ui.body}>現在の状態: {account.identity.status==='test_verified'?'確認済み':account.identity.status==='verified'?'確認済み':'未確認・確認待ち'}</Text><Text style={ui.muted}>運転免許証の表面・裏面を提出してください。</Text></View>
   {account.capabilities.documentUploadEnabled&&<View style={ui.card}><Text style={ui.title}>免許証の表裏をアップロード</Text><Text style={ui.muted}>表面・裏面をそれぞれ送信してください。両面の確認が終わるまで本人確認は完了しません。登録情報を変更した場合は、両面の再提出が必要です。</Text>
    <View style={ui.row}>{(['front','back'] as const).map(v=><View style={{flex:1}} key={v}><Button title={`${side===v?'✓ ':''}${v==='front'?'表面':'裏面'}`} secondary disabled={busy} onPress={()=>{setSide(v);setAsset(null);setConsent(false)}}/></View>)}</View>
    <Button title="書類を撮影する" secondary disabled={busy} onPress={()=>void run(()=>choose(true))}/><Button title="写真から選択する" secondary disabled={busy} onPress={()=>void run(()=>choose(false))}/>
    {asset&&<><Image alt="送信する書類のプレビュー" accessibilityLabel="送信する書類のプレビュー" source={{uri:asset.uri}} style={{height:180,width:'100%',borderRadius:12}} resizeMode="contain"/><View style={ui.row}><Switch accessibilityLabel="書類送信への同意" value={consent} onValueChange={setConsent} disabled={busy}/><Text style={[ui.body,{flex:1}]}>本人確認のための画像送信に同意します</Text></View><Button title="この書類を送信する" disabled={busy||!consent} onPress={()=>void run(async()=>{const form=new FormData();form.append('file',{uri:asset.uri,name:'identity.jpg',type:asset.mimeType??'image/jpeg'} as unknown as Blob);form.append('documentType',documentType);form.append('side',side);form.append('consent','true');await lendingApi('/documents',{body:form});setAsset(null);setConsent(false);await load();await onUpdated();setNotice('書類を送信しました。運営の確認待ちです。')})}/></>}
    <Text style={ui.label}>送信した書類</Text>
    {!account.documents.length&&<Text style={ui.muted}>書類はまだ送信されていません。</Text>}
    {account.documents.map(d=><View key={d.id} style={{gap:8,borderTopWidth:1,borderColor:'#253149',paddingTop:12}}><Text style={ui.body}>{docTypes[d.document_type as keyof typeof docTypes]} / {d.side==='front'?'表面':'裏面'} / {statuses[d.status]??d.status}</Text><Text style={ui.muted}>{date(d.uploaded_at)}</Text><Button title="送信書類を削除" secondary disabled={busy} onPress={()=>Alert.alert('書類を削除','送信した画像を削除します。',[{text:'戻る',style:'cancel'},{text:'削除する',style:'destructive',onPress:()=>void run(async()=>{await lendingApi(`/documents?id=${d.id}`,{method:'DELETE'});await load();setNotice('書類を削除しました。')})}])}/></View>)}
   </View>}
   <View style={ui.card}><Text style={ui.title}>査定履歴</Text><Text style={ui.muted}>最新30件を表示します。</Text>
    {!account.assessments.length&&<Text style={ui.muted}>査定履歴はまだありません。</Text>}
    {account.assessments.map(a=><View key={a.id} style={{gap:8,borderTopWidth:1,borderColor:'#253149',paddingTop:12}}><Text style={ui.body}>{a.product.name}</Text><Text style={ui.body}>{yen(a.estimate_jpy)} / {a.status==='submitted'?'運営へ査定依頼中':a.status==='cancelled'?'取消済み':'参考額取得済み'}</Text><Text style={ui.muted}>{date(a.created_at)}</Text>{a.status==='submitted'&&<Button title="査定依頼を取り消す" secondary disabled={busy} onPress={()=>void run(async()=>{await lendingApi('/cards',{body:{action:'cancel',assessmentId:a.id}});await load()})}/>}</View>)}
   </View>
  </>}
 </View>
}
