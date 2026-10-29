import {colors} from './theme';
import { Pressable, StyleSheet, Switch as NativeSwitch, Text, TextInput, View, type TextInputProps,type SwitchProps } from 'react-native';
export function RoyalSwitch(props:SwitchProps){return <NativeSwitch trackColor={{false:colors.inputBorder,true:colors.goldMuted}} thumbColor={props.value?colors.gold:colors.muted} ios_backgroundColor={colors.inputBorder} {...props}/>}
export const yen=(v:number)=>`¥${v.toLocaleString('ja-JP')}`;
export const date=(v:string|null)=>v?new Date(v).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}):'—';
export function Button({title,onPress,disabled=false,secondary=false}:{title:string;onPress:()=>void;disabled?:boolean;secondary?:boolean}) {
 return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress} style={({pressed})=>[ui.button,secondary&&ui.secondary,pressed&&!disabled&&{opacity:.8},disabled&&{opacity:.4}]}><Text style={[ui.buttonText,secondary&&{color:colors.gold}]}>{title}</Text></Pressable>;
}
export function Field({label,...props}:TextInputProps&{label:string}) {return <View style={{gap:6}}><Text style={ui.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={ui.input} {...props}/></View>}
export const ui=StyleSheet.create({
 card:{backgroundColor:colors.surface,borderColor:colors.border,borderWidth:1,borderRadius:20,padding:20,gap:14},
 title:{fontSize:20,fontWeight:'700',color:colors.text},body:{fontSize:14,lineHeight:23,color:colors.text},muted:{fontSize:12,lineHeight:21,color:colors.muted},label:{fontSize:13,fontWeight:'700',color:colors.text},
 input:{backgroundColor:colors.background,borderColor:colors.inputBorder,borderWidth:1,borderRadius:12,padding:14,color:'#fff',fontSize:16},
 button:{backgroundColor:colors.gold,borderRadius:12,padding:15,minHeight:48,alignItems:'center'},buttonText:{fontSize:14,fontWeight:'800',color:colors.background},secondary:{backgroundColor:colors.raised,borderColor:colors.inputBorder,borderWidth:1},
 error:{color:'#fecaca',backgroundColor:'#421b26',padding:14,borderRadius:12},success:{color:'#a7f3d0',backgroundColor:'#11352e',padding:14,borderRadius:12},
 amount:{fontSize:32,fontWeight:'800',color:colors.gold},row:{flexDirection:'row',alignItems:'center',gap:12},
});
