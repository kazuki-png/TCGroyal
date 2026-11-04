import {useState} from 'react';
import {Image,Modal,Pressable,ScrollView,Text,View} from 'react-native';
import type {CollateralItem} from '../../../lib/lending/collateral-types';
import {RoyalIcon} from '../RoyalIcon';
import {colors} from '../theme';
import {useAppBack} from '../use-app-back';
import {Button,ui} from '../ui';
export function CollateralLines({items=[]}:{items?:CollateralItem[]}){
 const [expanded,setExpanded]=useState<string|null>(null),selected=items.find(item=>item.id===expanded);
 useAppBack(!!selected,45,()=>{setExpanded(null);return true});
 if(!items.length)return null;
 return <View style={{gap:8}}>
  {items.map(item=><Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.name+'を拡大表示'} onPress={()=>setExpanded(item.id)} style={({pressed})=>({flexDirection:'row',alignItems:'center',gap:10,padding:10,borderWidth:1,borderColor:colors.border,borderRadius:12,backgroundColor:colors.surface,opacity:pressed?.7:1})}>
   {item.imageUrl?<Image alt={item.name} source={{uri:item.imageUrl}} accessibilityLabel={item.name+'の画像'} style={{width:52,height:72}} resizeMode="contain"/>:<View style={{width:52,height:72,alignItems:'center',justifyContent:'center'}}><RoyalIcon name="document" size={24} color={colors.muted}/></View>}
   <View style={{flex:1,gap:3}}><Text numberOfLines={2} ellipsizeMode="tail" style={{color:colors.text,fontWeight:'600',fontSize:14,lineHeight:20}}>{item.name}</Text><Text numberOfLines={1} style={{color:colors.muted,fontSize:11,lineHeight:16}}>{item.cardNumber||'型番未登録'} / {item.grade||'未申告'}</Text><Text style={{color:colors.text,fontSize:12}}>{item.quantity}枚</Text>{!!item.condition&&<Text numberOfLines={1} style={{color:colors.muted,fontSize:11}}>{item.condition}</Text>}</View>
   <RoyalIcon name="right" size={14} color={colors.gold}/>
  </Pressable>)}
  <Modal transparent visible={!!selected} animationType="fade" onRequestClose={()=>setExpanded(null)}>
   <View style={{flex:1,backgroundColor:'#000C',justifyContent:'center',padding:20}}><Pressable accessibilityRole="button" accessibilityLabel="背景をタップして拡大表示を閉じる" onPress={()=>setExpanded(null)} style={{position:'absolute',top:0,left:0,bottom:0,right:0}}/>
    <View style={{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:16,maxHeight:'90%',padding:16,gap:12}}><ScrollView contentContainerStyle={{gap:10}}>{selected&&<>{selected.imageUrl?<Image alt={selected.name} source={{uri:selected.imageUrl}} accessibilityLabel={selected.name+'の拡大画像'} style={{width:'100%',height:300}} resizeMode="contain"/>:<Text style={ui.muted}>画像なし</Text>}<Text style={[ui.title,{fontSize:18}]}>{selected.name}</Text><Text style={ui.body}>{selected.cardNumber||'型番未登録'} / {selected.grade||'未申告'} / {selected.quantity}枚</Text>{!!selected.condition&&<Text style={ui.body}>{selected.condition}</Text>}</>}</ScrollView><Button title="閉じる" secondary onPress={()=>setExpanded(null)}/></View>
   </View>
  </Modal>
 </View>;
}
