import {Image,Pressable} from 'react-native';
import cartIcon from '../../assets/application-cart.png';
import {colors} from '../theme';

export function ApplicationCartButton({onPress,disabled=false}:{onPress:()=>void;disabled?:boolean}){
 return <Pressable accessibilityRole="button" accessibilityLabel="申込リストを確認" disabled={disabled} onPress={onPress} style={{width:52,height:52,borderRadius:26,alignItems:'center',justifyContent:'center',backgroundColor:'#00000099',opacity:disabled?.4:1}}>
  <Image source={cartIcon} alt="" accessible={false} style={{width:32,height:29,tintColor:colors.gold}} resizeMode="contain"/>
 </Pressable>;
}
