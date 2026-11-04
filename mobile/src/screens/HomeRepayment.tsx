import {StyleSheet,Text,View} from 'react-native';
import type {WorkflowLoan} from '../../../lib/lending/workflow-types';
import {Button,ui,yen} from '../ui';
import {repaymentChargeLabel} from '../../../lib/lending/bank-payment-types';
import {colors} from '../theme';

const jstDay=(time:number)=>Math.floor((time+9*3600000)/86400000);
const dueTime=(loan:WorkflowLoan)=>{const time=Date.parse(loan.due_at??'');return Number.isFinite(time)?time:Infinity};
export function repaymentLoans(loans:WorkflowLoan[]){return loans.filter(loan=>loan.status==='active'||loan.status==='repayment_pending').sort((a,b)=>dueTime(a)-dueTime(b)||a.id.localeCompare(b.id))}
export function repaymentDeadline(dueAt:string|null,now:number){
 const time=Date.parse(dueAt??'');if(!Number.isFinite(time))return {date:'未設定',remaining:'',urgent:false};
 const days=jstDay(time)-jstDay(now);
 return {date:new Date(time).toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric'}),remaining:time<now?'期限超過':days===0?'本日期限':`あと${days}日`,urgent:time<now||days<=7};
}
export function HomeRepayment({loan,now,onOpen,onExtend}:{loan:WorkflowLoan;now:number;onOpen:()=>void;onExtend?:()=>void}){
 const due=repaymentDeadline(loan.due_at,now),valid=Number.isSafeInteger(loan.payoff_jpy)&&loan.payoff_jpy>=loan.principal_jpy&&loan.principal_jpy>0;
 const evaluated=Date.parse(loan.evaluated_at),items=loan.collateral_items??[],quantity=items.reduce((sum,item)=>sum+item.quantity,0);
 return <View accessibilityLabel="返済の確認" style={styles.card}>
  <View style={styles.row}><Text style={ui.label}>返済必要額</Text>{loan.status==='repayment_pending'&&<Text style={styles.pending}>入金確認中</Text>}</View>
  <Text style={styles.amount}>{valid?yen(loan.payoff_jpy):'確認が必要です'}</Text>
  {valid&&<Text style={ui.muted}>元金 {yen(loan.principal_jpy)} · {repaymentChargeLabel(loan.due_at,loan.evaluated_at)} {yen(loan.payoff_jpy-loan.principal_jpy)}</Text>}
  <View style={styles.deadline}><Text style={styles.due}>返済期限 {due.date}</Text>{!!due.remaining&&<Text style={[styles.remaining,due.urgent&&styles.urgent]}>{due.remaining}</Text>}</View>
  <Text style={ui.body} numberOfLines={1}>{items.length?`${items[0].name}${items.length>1?` ほか${items.length-1}種類`:''} · ${quantity}枚`:loan.card_name}</Text>
  {Number.isFinite(evaluated)&&<Text style={styles.asOf}>{new Date(evaluated).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})} 時点</Text>}
  <View style={{flexDirection:'row',gap:8}}><View style={{flex:1}}><Button title={loan.status==='repayment_pending'?'入金状況を確認':'返済する'} onPress={onOpen}/></View>{loan.status==='active'&&onExtend&&!loan.requests.some(item=>item.status==='pending')&&Date.parse(loan.due_at??'')>=now&&<View style={{flex:1}}><Button title="延長する" secondary onPress={onExtend}/></View>}</View>
 </View>;
}
const styles=StyleSheet.create({
 card:{padding:14,gap:6,borderRadius:12,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.goldMuted},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
 amount:{fontSize:34,lineHeight:42,fontWeight:'800',color:colors.gold,fontVariant:['tabular-nums']},pending:{fontSize:12,color:colors.gold},
 deadline:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:8,marginTop:4},due:{fontSize:16,fontWeight:'700',color:colors.text},remaining:{fontSize:12,color:colors.gold},urgent:{color:'#ffb4a6'},asOf:{fontSize:11,color:colors.muted},
});
