import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
export const yen=(v:number)=>`¥${v.toLocaleString('ja-JP')}`;
export const date=(v:string|null)=>v?new Date(v).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}):'—';
export function Button({title,onPress,disabled=false,secondary=false}:{title:string;onPress:()=>void;disabled?:boolean;secondary?:boolean}) {
 return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress} style={[ui.button,secondary&&ui.secondary,disabled&&{opacity:.4}]}><Text style={[ui.buttonText,secondary&&{color:'#e5e7eb'}]}>{title}</Text></Pressable>;
}
export function Field({label,...props}:TextInputProps&{label:string}) {return <View style={{gap:6}}><Text style={ui.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor="#8c9bb0" style={ui.input} {...props}/></View>}
export const ui=StyleSheet.create({
 card:{backgroundColor:'#111b2d',borderColor:'#253149',borderWidth:1,borderRadius:20,padding:20,gap:14},
 title:{fontSize:20,fontWeight:'700',color:'#f3f5fa'},body:{fontSize:14,lineHeight:23,color:'#e7ebf3'},muted:{fontSize:12,lineHeight:21,color:'#9ba7ba'},label:{fontSize:13,fontWeight:'700',color:'#d9dfeb'},
 input:{backgroundColor:'#0a1220',borderColor:'#3a455b',borderWidth:1,borderRadius:12,padding:14,color:'#fff',fontSize:16},
 button:{backgroundColor:'#fcd66e',borderRadius:12,padding:15,minHeight:48,alignItems:'center'},buttonText:{fontSize:14,fontWeight:'800',color:'#101827'},secondary:{backgroundColor:'#1c2a40',borderColor:'#42536e',borderWidth:1},
 error:{color:'#fecaca',backgroundColor:'#421b26',padding:14,borderRadius:12},success:{color:'#a7f3d0',backgroundColor:'#11352e',padding:14,borderRadius:12},
 amount:{fontSize:32,fontWeight:'800',color:'#fcd66e'},row:{flexDirection:'row',alignItems:'center',gap:12},
});
