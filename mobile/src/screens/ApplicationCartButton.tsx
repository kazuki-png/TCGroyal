import {Pressable,Text,View} from 'react-native';
import {RoyalIcon} from '../RoyalIcon';
import {colors} from '../theme';

export function ApplicationCartButton({onPress,disabled=false,count=0}:{onPress:()=>void;disabled?:boolean;count?:number}){
 return <Pressable accessibilityRole="button" accessibilityLabel="申込リストを確認" accessibilityHint={`申込リスト${count}枚`} disabled={disabled} onPress={onPress} style={{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:colors.background+'D9',opacity:disabled?.4:1}}>
  <RoyalIcon name="cart" size={24} color={colors.gold}/>
  <View pointerEvents="none" style={{position:'absolute',right:-1,top:-2,minWidth:18,height:18,borderRadius:9,paddingHorizontal:4,alignItems:'center',justifyContent:'center',backgroundColor:colors.gold}}><Text maxFontSizeMultiplier={1.2} style={{fontSize:11,fontWeight:'700',color:colors.background}}>{count>99?'99+':count}</Text></View>
 </Pressable>;
}
