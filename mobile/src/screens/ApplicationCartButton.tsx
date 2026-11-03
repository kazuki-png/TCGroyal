import {Pressable} from 'react-native';
import {RoyalIcon} from '../RoyalIcon';
import {colors} from '../theme';

export function ApplicationCartButton({onPress,disabled=false}:{onPress:()=>void;disabled?:boolean}){
 return <Pressable accessibilityRole="button" accessibilityLabel="申込リストを確認" disabled={disabled} onPress={onPress} style={{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:colors.background+'D9',opacity:disabled?.4:1}}>
  <RoyalIcon name="cart" size={24} color={colors.gold}/>
 </Pressable>;
}
