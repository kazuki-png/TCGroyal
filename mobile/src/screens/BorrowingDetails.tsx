import {Pressable,StyleSheet,Text,View} from 'react-native';
import type {WorkflowLoan} from '../../../lib/lending/workflow-types';
import type {LendingTransaction} from '../../../lib/lending/transactions';
import {colors} from '../theme';
import {RoyalIcon} from '../RoyalIcon';
import {yen} from '../ui';
import {repaymentDeadline} from './HomeRepayment';

export function BorrowingDetails({loans,items,now,onBack,onOpen}:{loans:WorkflowLoan[];items:LendingTransaction[];now:number;onBack:()=>void;onOpen:(id:string,panel?:'repayment'|'extension')=>void}){
 const total=loans.reduce((sum,loan)=>sum+loan.principal_jpy,0);
 return <View style={{gap:12}}>
  <Pressable accessibilityRole="button" accessibilityLabel="ホームに戻る" onPress={onBack} style={styles.back}><RoyalIcon name="back"/><Text style={styles.link}>ホーム</Text></Pressable>
  <View style={styles.summary}><Text style={styles.heading}>借入の内訳</Text><Text style={styles.label}>現在の借入額</Text><Text style={styles.total}>{yen(total)}</Text></View>
  {loans.length>0&&<Text style={styles.note}>返済額は各契約の最終取得時点の金額です</Text>}
  <View style={styles.list}>{loans.length?loans.map(loan=>{
   const transaction=items.find(item=>item.loanId===loan.id),deadline=repaymentDeadline(loan.due_at,now);
   const due=loan.due_at&&Number.isFinite(Date.parse(loan.due_at))?new Date(loan.due_at).toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'numeric',day:'numeric'}):'未設定';
   const valid=Number.isSafeInteger(loan.payoff_jpy)&&loan.payoff_jpy>=loan.principal_jpy&&loan.principal_jpy>0;
   return <Pressable key={loan.id} accessibilityRole="button" accessibilityLabel={`${transaction?.reference??loan.card_name}、返済期限 ${due}、返済額 ${valid?yen(loan.payoff_jpy):'確認が必要です'}`} onPress={()=>onOpen(`loan:${loan.id}`,'repayment')} style={({pressed})=>[styles.row,{opacity:pressed?.65:1}]}>
    <View style={{flex:1,gap:6}}><View style={styles.line}><Text style={[styles.date,deadline.urgent&&{color:'#b42338'}]}>返済期限 {due}</Text><RoyalIcon name="right"/></View>
    <Text numberOfLines={1} ellipsizeMode="tail" style={styles.name}>{loan.card_name}</Text>
    <View style={styles.line}><Text style={styles.label}>返済額</Text><Text style={styles.amount}>{valid?yen(loan.payoff_jpy):'確認が必要です'}</Text></View>
    <View style={styles.line}><Text style={styles.note}>借入額 {yen(loan.principal_jpy)}</Text>{loan.status==='repayment_pending'?<Text style={styles.link}>入金確認中</Text>:deadline.urgent&&<Text style={styles.warning}>{deadline.remaining}</Text>}</View>
    {transaction&&<Text style={styles.note}>{transaction.reference}</Text>}
    </View>
   </Pressable>;
  }):<Text style={styles.empty}>現在の借り入れはありません</Text>}</View>
 </View>;
}
const styles=StyleSheet.create({
 back:{flexDirection:'row',alignItems:'center',gap:8,minHeight:40,alignSelf:'flex-start'},link:{fontSize:12,color:colors.gold},
 summary:{backgroundColor:colors.surface,padding:16,gap:6,borderRadius:12},heading:{fontSize:18,fontWeight:'700',color:colors.text,marginBottom:8},label:{fontSize:12,color:colors.muted},total:{fontSize:34,fontWeight:'700',color:colors.text,fontVariant:['tabular-nums']},
 list:{backgroundColor:colors.surface,borderRadius:12,overflow:'hidden'},row:{padding:16,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},line:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},date:{fontSize:14,fontWeight:'600',color:colors.text},name:{fontSize:13,color:colors.muted},amount:{fontSize:22,fontWeight:'700',color:colors.text,fontVariant:['tabular-nums']},note:{fontSize:11,color:colors.muted},warning:{fontSize:11,color:'#b42338'},empty:{padding:20,color:colors.muted,fontSize:14},
});
