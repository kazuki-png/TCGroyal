import {useState} from 'react';
import {Linking,Pressable,Text,View} from 'react-native';
import {colors} from '../theme';
import {MOBILE_PREVIEW_ORIGIN} from '../../../lib/lending/mobile-preview-host';
export function ConsentLinks(){
 const [error,setError]=useState('');
 return <View style={{gap:4}}><View style={{flexDirection:'row',gap:18}}>{([['terms','利用規約'],['privacy','プライバシーポリシー']] as const).map(([path,label])=><Pressable key={path} accessibilityRole="link" onPress={()=>{setError('');void Linking.openURL(`${MOBILE_PREVIEW_ORIGIN}/lending/${path}`).catch(()=>setError('ページを開けませんでした。もう一度お試しください。'))}} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.gold,fontSize:13,textDecorationLine:'underline'}}>{label}</Text></Pressable>)}</View>{!!error&&<Text accessibilityRole="alert" style={{color:'#9b2436'}}>{error}</Text>}</View>;
}
