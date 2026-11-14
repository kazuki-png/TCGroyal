import {ActivityIndicator,Text,View} from 'react-native';
import type {BundleEstimate} from '../../../lib/lending/bundle-estimate-types';
import {Button,ui} from '../ui';
import {colors} from '../theme';
import {useEffect,useState} from 'react';
export function ReferenceEstimate({estimate,loading,error,onRefresh,onUse,disabled=false}:{estimate:BundleEstimate|null;loading:boolean;error:string;onRefresh:()=>void;onUse?:(amount:number)=>void;disabled?:boolean}){
 const [now,setNow]=useState(Date.now);
 useEffect(()=>{if(!estimate)return;const timer=setTimeout(()=>setNow(Date.now()),Math.max(0,Date.parse(estimate.expiresAt)-Date.now())+50);return()=>clearTimeout(timer)},[estimate]);
 const expired=!!estimate&&Date.parse(estimate.expiresAt)<=now;
 const manual=estimate?.lines.filter(line=>line.amountJpy===null).length??0;
 const subtotal=estimate?.lines.reduce((sum,line)=>sum+(line.amountJpy??0),0)??0;
 return <View style={ui.card}>
  <Text style={ui.title}>融資参考額</Text>
  <Text style={ui.muted}>選択したカード・枚数・申告された鑑定状態をもとに計算します。現物確認後の正式な融資条件とは異なります。</Text>
  {loading&&<><ActivityIndicator accessibilityLabel="参考額を計算中" color={colors.gold}/><Text accessibilityLiveRegion="polite" style={ui.muted}>参考額を計算しています…</Text></>}
  {!!error&&<Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
  {estimate&&<>
   {expired&&<Text accessibilityRole="alert" style={ui.error}>参考額の有効期限が切れました。再計算してください。</Text>}
   {estimate.amountJpy!==null&&<Text accessibilityLiveRegion="polite" style={[ui.amount,expired&&{color:colors.muted}]}>融資可能額 ¥{estimate.amountJpy.toLocaleString('ja-JP')}</Text>}
   {manual>0&&subtotal>0&&<Text style={ui.body}>算出済みの参考額 ¥{subtotal.toLocaleString('ja-JP')} ＋ 個別査定 {manual}種類</Text>}
   {estimate.lines.map(line=><View key={line.id} style={{gap:6}}><Text style={ui.body}>{line.name} / {line.quantity}枚</Text><Text style={ui.body}>{line.amountJpy===null?'個別査定':`融資可能額 ¥${line.amountJpy.toLocaleString('ja-JP')}`}</Text><Text style={ui.body}>評価額 {line.valuationJpy!=null?`¥${line.valuationJpy.toLocaleString('ja-JP')}`:'個別査定'}</Text><Text style={ui.muted}>{line.reason}</Text></View>)}
   <Text style={ui.muted}>{estimate.reason}</Text><Text style={ui.muted}>参考額の有効期限：{new Date(estimate.expiresAt).toLocaleTimeString('ja-JP')}</Text>
   <Text style={ui.muted}>算出日時：{new Date(estimate.calculatedAt).toLocaleString('ja-JP')}</Text>
   {estimate.amountJpy!==null&&onUse&&<Button title="参考額を借入希望額に入力" secondary disabled={disabled||loading||expired} onPress={()=>onUse(estimate.amountJpy!)}/>}
  </>}
  {!loading&&<Button title="参考額を再取得" secondary disabled={disabled} onPress={onRefresh}/>}
 </View>;
}
