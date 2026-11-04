import {useEffect,useState} from 'react';
import {Image,Modal,Pressable,ScrollView,Text,View} from 'react-native';
import type {CollateralItem} from '../../../lib/lending/collateral-types';
import {useReferenceEstimate} from '../use-reference-estimate';
import {useAppBack} from '../use-app-back';
import {RoyalIcon} from '../RoyalIcon';
import {colors} from '../theme';
import {Button,ui,yen} from '../ui';

export function ApplicationSummary({items,active,onRemove,onContinue,onProceed,notice='',error=''}:{items:CollateralItem[];active:boolean;onRemove:(id:string)=>void;onContinue:()=>void;onProceed:()=>void;notice?:string;error?:string}){
 const reference=useReferenceEstimate(items,active),[expanded,setExpanded]=useState<string|null>(null),[actionsHeight,setActionsHeight]=useState(126);
 const selected=items.find(item=>item.id===expanded),estimate=reference.estimate;
 useAppBack(active&&!!selected,45,()=>{setExpanded(null);return true});
 useEffect(()=>{if(!active||!estimate)return;const timer=setTimeout(reference.refresh,Math.max(0,Date.parse(estimate.expiresAt)-Date.now())+100);return()=>clearTimeout(timer)},[active,estimate,reference.refresh]);
 const lines=estimate?.lines??[],subtotal=lines.reduce((sum,line)=>sum+(line.amountJpy??0),0),manual=lines.filter(line=>line.amountJpy===null).length;
 const ready=!!estimate&&!reference.loading&&!reference.error;
 const total=reference.loading?'計算中…':reference.error?'取得できません':!items.length?yen(0):estimate?.amountJpy!==null&&estimate?.amountJpy!==undefined?yen(estimate.amountJpy):subtotal>0?yen(subtotal)+(manual?' ＋ 個別査定':''):'個別査定';
 const label=ready&&estimate.amountJpy===null&&subtotal>0?'算出済み小計（参考）':'融資可能額 合計（参考）';
 function amount(item:CollateralItem){const line=lines.find(line=>line.id===item.id);return reference.loading?'参考額 計算中…':reference.error?'参考額 取得できません':line?.amountJpy!==null&&line?.amountJpy!==undefined?'参考額 '+yen(line.amountJpy):'個別査定'}
 return <View style={{flex:1}}>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:16,gap:8,paddingBottom:actionsHeight+16}}>
   {!!error&&<Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
   {!!notice&&<Text accessibilityLiveRegion="polite" numberOfLines={2} style={ui.muted}>{notice}</Text>}
   <Text style={[ui.title,{fontSize:18,marginBottom:4}]}>現在の融資申込カード</Text>
   {items.map(item=><View key={item.id} style={{borderWidth:1,borderColor:colors.border,borderRadius:12,backgroundColor:colors.surface}}>
    <Pressable accessibilityRole="button" accessibilityLabel={item.name+'を拡大表示'} onPress={()=>setExpanded(item.id)} style={({pressed})=>({padding:10,paddingRight:38,flexDirection:'row',alignItems:'center',gap:10,opacity:pressed?.7:1})}>
     {item.imageUrl?<Image alt={item.name} source={{uri:item.imageUrl}} accessibilityLabel={item.name+'の画像'} style={{width:52,height:72}} resizeMode="contain"/>:<View style={{width:52,height:72,alignItems:'center',justifyContent:'center'}}><RoyalIcon name="document" size={24} color={colors.muted}/></View>}
     <View style={{flex:1,gap:3}}><Text numberOfLines={2} ellipsizeMode="tail" style={{color:colors.text,fontWeight:'600',fontSize:14,lineHeight:20}}>{item.name}</Text><Text numberOfLines={1} ellipsizeMode="tail" style={{color:colors.muted,fontSize:11,lineHeight:16}}>{item.cardNumber||'型番未登録'} / {item.grade}</Text><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:6}}><Text style={{color:colors.text,fontSize:12}}>{item.quantity}枚</Text><Text style={{color:colors.gold,fontSize:13,fontWeight:'600',flexShrink:1}}>{amount(item)}</Text></View></View>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={item.name+'を申込から削除'} onPress={()=>onRemove(item.id)} style={{position:'absolute',right:0,top:0,width:36,height:36,alignItems:'center',justifyContent:'center'}}><RoyalIcon name="close" size={14} color={colors.muted}/></Pressable>
   </View>)}
   {!items.length&&<Text style={ui.muted}>カードがまだ追加されていません。</Text>}
   {!!reference.error&&<Text accessibilityRole="alert" style={ui.muted}>{reference.error}</Text>}
   {ready&&estimate.amountJpy===null&&<Text style={ui.muted}>{estimate.reason}</Text>}
  </ScrollView>
  <View accessibilityLabel="申込リストの操作" onLayout={event=>setActionsHeight(event.nativeEvent.layout.height)} style={{position:'absolute',bottom:0,left:0,right:0,zIndex:10,elevation:12,padding:12,gap:8,backgroundColor:colors.background+'F5',borderTopWidth:1,borderColor:colors.border}}>
   <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10}}><Text style={{color:colors.muted,fontSize:11,flex:1}}>{label}</Text><Text accessibilityLiveRegion="polite" style={{color:colors.gold,fontSize:18,fontWeight:'700',flexShrink:1}}>{total}</Text></View>
   <View style={{flexDirection:'row',gap:10}}><View style={{flex:1}}><Button title="続けて登録" secondary onPress={onContinue}/></View><View style={{flex:1}}><Button title="申請に進む" disabled={!items.length} onPress={onProceed}/></View></View>
   {!!reference.error&&<Button title="参考額を再計算" secondary onPress={reference.refresh}/>}
  </View>
  <Modal transparent visible={!!selected&&active} animationType="fade" onRequestClose={()=>setExpanded(null)}>
   <View style={{flex:1,backgroundColor:'#000C',justifyContent:'center',padding:20}}><Pressable accessibilityRole="button" accessibilityLabel="背景をタップして拡大表示を閉じる" onPress={()=>setExpanded(null)} style={{position:'absolute',top:0,left:0,bottom:0,right:0}}/>
    <View style={{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:16,maxHeight:'90%',padding:16,gap:12}}><ScrollView contentContainerStyle={{gap:10}}>{selected&&<>{selected.imageUrl?<Image alt={selected.name} source={{uri:selected.imageUrl}} accessibilityLabel={selected.name+'の拡大画像'} style={{width:'100%',height:300}} resizeMode="contain"/>:<Text style={ui.muted}>画像なし</Text>}<Text style={[ui.title,{fontSize:18}]}>{selected.name}</Text><Text style={ui.body}>{selected.cardNumber||'型番未登録'} / {selected.grade} / {selected.quantity}枚</Text><Text style={{color:colors.gold,fontSize:18,fontWeight:'700'}}>{amount(selected)}</Text><Text style={ui.muted}>{lines.find(line=>line.id===selected.id)?.reason}</Text></>}</ScrollView><Button title="閉じる" secondary onPress={()=>setExpanded(null)}/></View>
   </View>
  </Modal>
 </View>;
}
