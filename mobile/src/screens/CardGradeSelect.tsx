import {useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {colors} from '../theme';
import {ui} from '../ui';
import {useAppBack} from '../use-app-back';
export const CARD_GRADES=['PSA10','PSA9以下','その他鑑定','未鑑定'] as const;
export function CardGradeSelect({value,onChange,active=true}:{value:string;onChange:(value:string)=>void;active?:boolean}){
 const [expanded,setExpanded]=useState(false);
 useAppBack(active&&expanded,45,()=>{setExpanded(false);return true});
 return <View style={{gap:8}}><Text style={ui.label}>グレード</Text><Pressable accessibilityRole="button" accessibilityLabel={`グレード ${value}`} accessibilityState={{expanded}} onPress={()=>setExpanded(!expanded)} style={[ui.input,{flexDirection:'row',justifyContent:'space-between'}]}><Text style={ui.body}>{value}</Text><Text style={{color:colors.gold}}>⌄</Text></Pressable>{expanded&&<View style={ui.card}>{CARD_GRADES.map(grade=><Pressable key={grade} accessibilityRole="radio" accessibilityLabel={grade} accessibilityState={{checked:value===grade}} onPress={()=>{onChange(grade);setExpanded(false)}} style={{paddingVertical:12}}><Text style={[ui.body,value===grade&&{color:colors.gold}]}>{value===grade?'✓ ':''}{grade}</Text></Pressable>)}</View>}<Text style={ui.muted}>初期値はPSA10です。お手元のカードの鑑定状態に合わせて変更してください。</Text></View>;
}
