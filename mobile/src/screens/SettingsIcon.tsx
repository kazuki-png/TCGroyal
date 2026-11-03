import {StyleSheet,View} from 'react-native';
import {colors} from '../theme';
import {RoyalIcon,type RoyalIconName} from '../RoyalIcon';
export type SettingsIconName='mail'|'lock'|'person'|'identity'|'bell'|'document'|'shield'|'chat'|'delete'|'logout'|'balance'|'history';
const icons:Record<SettingsIconName,RoyalIconName>={mail:'mail',lock:'lock',person:'person',identity:'document',bell:'bell',document:'document',shield:'lock',chat:'chat',delete:'person',logout:'logout',balance:'balance',history:'history'};
export function SettingsIcon({name,danger=false}:{name:SettingsIconName;danger?:boolean}){
 const ink=danger?'#ef7777':colors.gold;
 return <View accessible={false} style={[s.tile,danger&&{backgroundColor:'#382021'}]}><RoyalIcon name={icons[name]} size={23} color={ink}/>{name==='delete'&&<View style={s.badge}><RoyalIcon name="minus" size={10} color={ink}/></View>}</View>;
}
const s=StyleSheet.create({tile:{width:38,height:38,borderRadius:11,backgroundColor:colors.active,alignItems:'center',justifyContent:'center'},badge:{position:'absolute',right:2,top:3,width:14,height:14,borderRadius:7,backgroundColor:'#382021',alignItems:'center',justifyContent:'center'}});
