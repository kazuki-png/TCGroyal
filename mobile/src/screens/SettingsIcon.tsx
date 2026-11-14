import {StyleSheet,View} from 'react-native';
import {colors} from '../theme';
import {RoyalIcon,type RoyalIconName} from '../RoyalIcon';
export type SettingsIconName='mail'|'lock'|'person'|'identity'|'bell'|'document'|'shield'|'chat'|'delete'|'logout'|'balance'|'history';
const icons:Record<SettingsIconName,RoyalIconName>={mail:'mail',lock:'lock',person:'person',identity:'document',bell:'bell',document:'document',shield:'lock',chat:'chat',delete:'person',logout:'logout',balance:'balance',history:'history'};
export function SettingsIcon({name,danger=false}:{name:SettingsIconName;danger?:boolean}){
 const ink=danger?'#b42338':colors.gold;
 return <View accessible={false} style={[s.tile,danger&&{backgroundColor:'#fff0f2'}]}><RoyalIcon name={icons[name]} size={20} color={ink}/>{name==='delete'&&<View style={s.badge}><RoyalIcon name="minus" size={10} color={ink}/></View>}</View>;
}
const s=StyleSheet.create({tile:{width:32,height:32,borderRadius:8,backgroundColor:colors.background,alignItems:'center',justifyContent:'center'},badge:{position:'absolute',right:2,top:3,width:14,height:14,borderRadius:7,backgroundColor:'#fff0f2',alignItems:'center',justifyContent:'center'}});
