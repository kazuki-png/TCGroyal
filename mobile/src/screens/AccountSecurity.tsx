import {useEffect,useRef,useState} from 'react';
import {Text,View} from 'react-native';
import {isSupabasePreviewConnected} from '../api';
import {confirmedSupabaseUser,supabaseAuthError} from '../supabase-auth';
import {changeAccountEmail,changeAccountPassword,sendAccountConfirmation} from '../account-security';
import {Button,Field,ui} from '../ui';
export function AccountSecurity({mode,onBusyChange}:{mode:'email'|'password';onBusyChange:(busy:boolean)=>void}){
 const [email,setEmail]=useState(''),[address,setAddress]=useState(''),[current,setCurrent]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[nonce,setNonce]=useState('');
 const [needsCode,setNeedsCode]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');const lock=useRef(false);
 const connected=isSupabasePreviewConnected();
 useEffect(()=>{let live=true;if(connected)void confirmedSupabaseUser().then(user=>{if(live)setEmail(user.email??'')}).catch(cause=>{if(live)setError(supabaseAuthError(cause))});return()=>{live=false}},[connected]);
 async function run(work:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);onBusyChange(true);setError('');setNotice('');try{await work()}catch(cause){if((cause as {code?:string})?.code==='reauthentication_needed')setNeedsCode(true);setError(supabaseAuthError(cause))}finally{setCurrent('');setPassword('');setConfirm('');setNonce('');lock.current=false;setBusy(false);onBusyChange(false)}}
 return <View style={ui.card}><Text style={ui.title}>{mode==='email'?'メールアドレスの変更':'パスワードの変更'}</Text>
  {!connected?<Text style={ui.body}>メールアドレス・パスワードでログインすると変更できます。接続コードのアカウントでは変更できません。</Text>:<>
   {!!email&&<><Text style={ui.muted}>現在のメールアドレス</Text><Text selectable style={ui.body}>{email}</Text></>}
   {!!error&&<Text accessibilityRole="alert" style={ui.error}>{error}</Text>}{!!notice&&<Text accessibilityLiveRegion="polite" style={ui.success}>{notice}</Text>}
   {mode==='email'?<><Field label="新しいメールアドレス" value={address} onChangeText={setAddress} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={254} editable={!busy}/><Text style={ui.muted}>確認メールが届いた場合は、案内に従って変更を完了してください。パスワードは変更されません。</Text><Button title="メールアドレスを変更" disabled={busy} onPress={()=>void run(async()=>{const completed=await changeAccountEmail(address);if(completed)setEmail(address.trim());setAddress('');setNotice(completed?'メールアドレスを変更しました。':'変更の確認メールを送信しました。届いたメールの案内に従ってください。')})}/></>:<>
    <Field label="現在のパスワード" value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="current-password" maxLength={128} editable={!busy}/>
    <Field label="新しいパスワード（12文字以上）" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" maxLength={128} editable={!busy}/>
    <Field label="新しいパスワード（確認）" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={128} editable={!busy}/>
    {needsCode&&<><Button title="確認コードをメールに送信" secondary disabled={busy} onPress={()=>void run(async()=>{await sendAccountConfirmation();setNotice('確認コードを送信しました。コードとパスワードを入力してください。')})}/><Field label="メールの確認コード" value={nonce} onChangeText={setNonce} keyboardType="number-pad" maxLength={6} editable={!busy}/></>}
    <Button title="パスワードを変更" disabled={busy} onPress={()=>void run(async()=>{await changeAccountPassword(current,password,confirm,nonce);setNeedsCode(false);setNotice('パスワードを変更しました。次回から新しいパスワードでログインできます。')})}/>
   </>}
  </>}
 </View>;
}
