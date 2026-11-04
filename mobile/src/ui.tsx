import {colors} from './theme';
import {RoyalIcon,type RoyalIconName} from './RoyalIcon';
import { Pressable, StyleSheet, Switch as NativeSwitch, Text, TextInput, View, type TextInputProps,type SwitchProps } from 'react-native';
export function RoyalSwitch(props:SwitchProps){return <NativeSwitch trackColor={{false:colors.inputBorder,true:colors.goldMuted}} thumbColor={props.value?colors.gold:colors.muted} ios_backgroundColor={colors.inputBorder} {...props}/>}
export const yen=(v:number)=>`¥${v.toLocaleString('ja-JP')}`;
export const date=(v:string|null)=>v?new Date(v).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}):'—';
export function Button({title,onPress,disabled=false,secondary=false,icon,selected}:{title:string;onPress:()=>void;disabled?:boolean;secondary?:boolean;icon?:RoyalIconName;selected?:boolean}) {
 return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{disabled,...(selected!==undefined?{selected}:icon==='check'?{selected:true}:{})}} disabled={disabled} onPress={onPress} style={({pressed})=>[ui.button,secondary&&ui.secondary,selected&&{backgroundColor:colors.gold,borderColor:colors.gold},pressed&&!disabled&&{opacity:.8},disabled&&{opacity:.4}]}><View style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6}}>{icon&&<RoyalIcon name={icon} size={16} color={colors.gold}/>}<Text style={[ui.buttonText,secondary&&{color:colors.gold},selected&&{color:colors.background}]}>{title}</Text></View></Pressable>;
}
export function Field({label,...props}:TextInputProps&{label:string}) {return <View style={{gap:6}}><Text style={ui.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={ui.input} {...props}/></View>}
export const ui=StyleSheet.create({
 card:{backgroundColor:colors.surface,borderColor:colors.border,borderWidth:1,borderRadius:20,padding:20,gap:14},
 title:{fontSize:20,fontWeight:'700',color:colors.text},body:{fontSize:14,lineHeight:23,color:colors.text},muted:{fontSize:12,lineHeight:21,color:colors.muted},label:{fontSize:13,fontWeight:'700',color:colors.text},
 input:{backgroundColor:colors.background,borderColor:colors.inputBorder,borderWidth:1,borderRadius:12,padding:14,color:'#fff',fontSize:16},
 button:{backgroundColor:colors.background,borderRadius:8,paddingVertical:10,paddingHorizontal:14,minHeight:44,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.goldMuted},buttonText:{fontSize:14,fontWeight:'600',color:colors.gold,flexShrink:1,textAlign:'center'},secondary:{backgroundColor:colors.background,borderColor:colors.border},
 error:{color:'#fecaca',backgroundColor:'#421b26',padding:14,borderRadius:12},success:{color:'#a7f3d0',backgroundColor:'#11352e',padding:14,borderRadius:12},
 amount:{fontSize:32,fontWeight:'800',color:colors.gold},row:{flexDirection:'row',alignItems:'center',gap:12},
});
