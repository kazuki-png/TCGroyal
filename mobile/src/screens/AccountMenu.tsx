import {useState} from 'react';
import {Alert,Linking,Modal,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors} from '../theme';
import {Button,ui} from '../ui';
import {SUPPORT_LINE_URL} from '../support-estimate';
import {AccountDetails} from './AccountDetails';
import {AccountSecurity} from './AccountSecurity';
import {PushSettings} from './PushSettings';
import {SettingsIcon,type SettingsIconName} from './SettingsIcon';
import {appBackActions} from '../back-actions';
import {useAppBack} from '../use-app-back';
type Page='profile'|'identity'|'summary'|'history'|'email'|'password'|'notifications'|'terms'|'privacy'|'support'|'delete';
const titles:Record<Page,string>={profile:'プロフィール・登録情報',identity:'本人確認書類',summary:'融資・返済状況',history:'査定履歴',email:'メールアドレスの変更',password:'パスワードの変更',notifications:'通知設定',terms:'利用規約',privacy:'プライバシーポリシー',support:'お問い合わせ',delete:'退会・アカウント削除'};
const groups:{title:string;rows:{page:Page;icon:SettingsIconName}[]}[]=[
 {title:'アカウント',rows:[{page:'email',icon:'mail'},{page:'password',icon:'lock'},{page:'profile',icon:'person'},{page:'identity',icon:'identity'}]},
 {title:'ご利用状況',rows:[{page:'summary',icon:'balance'},{page:'history',icon:'history'}]},
 {title:'通知',rows:[{page:'notifications',icon:'bell'}]},
 {title:'規約・サポート',rows:[{page:'terms',icon:'document'},{page:'privacy',icon:'shield'},{page:'support',icon:'chat'}]},
 {title:'その他',rows:[{page:'delete',icon:'delete'}]},
];
function MenuRow({label,icon,onPress,last=false,danger=false,disabled=false}:{label:string;icon:SettingsIconName;onPress:()=>void;last?:boolean;danger?:boolean;disabled?:boolean}){
 return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={({pressed})=>[s.row,pressed&&{backgroundColor:colors.raised},disabled&&{opacity:.45}]}><SettingsIcon name={icon} danger={danger}/><View style={[s.rowBody,!last&&s.divider]}><Text style={[s.rowLabel,danger&&s.danger]}>{label}</Text><Text accessible={false} style={s.chevron}>›</Text></View></Pressable>;
}
export function AccountMenu({onUpdated,onSignOut,signingOut=false}:{onUpdated:()=>Promise<void>;onSignOut:()=>void;signingOut?:boolean}){
 const [page,setPage]=useState<Page|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');const insets=useSafeAreaInsets();
 function close(){if(!busy){setPage(null);setError('')}}
 useAppBack(page!==null,40,()=>{close();return true});
 async function contact(){try{await Linking.openURL(SUPPORT_LINE_URL)}catch{setError('LINEを開けませんでした。TCG ROYAL公式LINEからお問い合わせください。')}}
 return <View style={{gap:26,paddingBottom:10}}>
  {groups.map(group=><View key={group.title} style={{gap:10}}><Text style={s.groupTitle}>{group.title}</Text><View style={s.group}>{group.rows.map((row,index)=><MenuRow key={row.page} label={titles[row.page]} icon={row.icon} last={index===group.rows.length-1} danger={row.page==='delete'} onPress={()=>setPage(row.page)}/>)}</View></View>)}
  <View style={s.group}><MenuRow label="ログアウト" icon="logout" danger last disabled={signingOut} onPress={()=>Alert.alert('ログアウト','この端末からログアウトしますか？',[{text:'戻る',style:'cancel'},{text:'ログアウト',style:'destructive',onPress:onSignOut}])}/></View>
  <Modal visible={page!==null} animationType="slide" onRequestClose={()=>{appBackActions.dispatch()}}>
   <View style={[s.modal,{paddingTop:insets.top}]}>
    <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="前の画面に戻る" disabled={busy} onPress={()=>{appBackActions.dispatch()}} style={s.back}><Text style={{fontSize:28,color:colors.gold}}>‹</Text><Text style={{fontSize:14,color:colors.gold}}>戻る</Text></Pressable><Text accessibilityRole="header" style={s.pageTitle}>{page?titles[page]:''}</Text></View>
    <ScrollView contentContainerStyle={{padding:20,paddingBottom:Math.max(insets.bottom,24),gap:18}} keyboardShouldPersistTaps="handled">
     {(page==='profile'||page==='identity'||page==='summary'||page==='history')&&<AccountDetails key={page} section={page} onUpdated={onUpdated} onBusyChange={setBusy}/>}
     {(page==='email'||page==='password')&&<AccountSecurity key={page} mode={page} onBusyChange={setBusy}/>}
     {page==='notifications'&&<PushSettings/>}
     {(page==='terms'||page==='privacy')&&<View style={ui.card}><Text style={ui.title}>{titles[page]}</Text><Text style={ui.body}>現在準備中です。正式な内容は公開前にご案内します。</Text></View>}
     {page==='support'&&<View style={ui.card}><Text style={ui.title}>サポートへお問い合わせ</Text><Text style={ui.body}>査定・ご契約・返済やアプリについてのお問い合わせは、TCG ROYAL公式LINEで受け付けています。</Text><Text style={ui.muted}>案件についてのご相談は受付番号をお知らせください。パスワードや本人確認書類はLINEへ送らないでください。</Text><Button title="公式LINEを開く" onPress={()=>void contact()}/></View>}
     {page==='delete'&&<View style={ui.card}><Text style={ui.title}>アカウントの削除について</Text><Text style={ui.body}>退会・アカウント削除をご希望の場合は、公式LINEからお問い合わせください。契約・返済状況を確認のうえ、運営がご案内します。</Text><Text style={ui.muted}>この画面を開いただけでは、退会やデータの削除は行われません。</Text><Button title="削除についてサポートへ相談" secondary onPress={()=>void contact()}/></View>}
     {!!error&&<Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    </ScrollView>
   </View>
  </Modal>
 </View>;
}
const s=StyleSheet.create({groupTitle:{color:colors.muted,fontSize:12,fontWeight:'700',letterSpacing:1,marginLeft:5},group:{borderRadius:20,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,overflow:'hidden'},row:{flexDirection:'row',alignItems:'center',paddingLeft:16,gap:14,minHeight:72},rowBody:{flex:1,minHeight:72,flexDirection:'row',alignItems:'center',paddingRight:18,gap:12},divider:{borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},rowLabel:{color:colors.text,fontSize:15,fontWeight:'600',flex:1,paddingVertical:18},chevron:{fontSize:27,color:colors.muted,fontWeight:'300'},danger:{color:'#ef7777'},modal:{flex:1,backgroundColor:colors.background},header:{minHeight:66,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:colors.border,gap:12,paddingHorizontal:16},back:{flexDirection:'row',alignItems:'center',gap:5,paddingVertical:12,paddingRight:6},pageTitle:{fontSize:17,fontWeight:'700',color:colors.text,flex:1}});
