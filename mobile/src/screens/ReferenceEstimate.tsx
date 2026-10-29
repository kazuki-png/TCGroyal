import {ActivityIndicator,Text,View} from 'react-native';
import type {BundleEstimate} from '../../../lib/lending/bundle-estimate-types';
import {Button,ui} from '../ui';
import {colors} from '../theme';
export function ReferenceEstimate({estimate,loading,error,onRefresh,onUse,disabled=false}:{estimate:BundleEstimate|null;loading:boolean;error:string;onRefresh:()=>void;onUse?:(amount:number)=>void;disabled?:boolean}){
 return <View style={ui.card}>
  <Text style={ui.title}>融資参考額</Text>
  <Text style={ui.muted}>選択したカード・枚数・鑑定状態から自動計算します。スニダンのPSA10は、確認できた30日間の成約件数に応じて40〜60%で計算します。</Text>
  {loading&&<><ActivityIndicator accessibilityLabel="参考額を計算中" color={colors.gold}/><Text accessibilityLiveRegion="polite" style={ui.muted}>参考額を計算しています…</Text></>}
  {!!error&&<Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
  {estimate&&<>
   {estimate.amountJpy!==null&&<Text accessibilityLiveRegion="polite" style={ui.amount}>合計参考額 ¥{estimate.amountJpy.toLocaleString('ja-JP')}</Text>}
   {estimate.lines.map(line=><View key={line.id} style={{gap:6}}><Text style={ui.body}>{line.name} / {line.quantity}枚</Text><Text style={ui.body}>{line.amountJpy===null?'個別査定':`参考額 ¥${line.amountJpy.toLocaleString('ja-JP')} / スコア${line.score}（下限）・融資比率${line.ltvPercent}%`}</Text><Text style={ui.muted}>{line.reason}</Text></View>)}
   <Text style={ui.muted}>{estimate.reason}</Text><Text style={ui.muted}>参考額の有効期限：{new Date(estimate.expiresAt).toLocaleTimeString('ja-JP')}</Text>
   {estimate.amountJpy!==null&&onUse&&<Button title="参考額を借入希望額に入力" secondary disabled={disabled||loading} onPress={()=>onUse(estimate.amountJpy!)}/>}
  </>}
  {!loading&&<Button title="参考額を再取得" secondary disabled={disabled} onPress={onRefresh}/>}
 </View>;
}
