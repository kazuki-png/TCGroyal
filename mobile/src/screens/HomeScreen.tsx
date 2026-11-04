import type {ReactNode} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import type {LendingTransaction} from '../../../lib/lending/transactions';
import type {WorkflowState} from '../../../lib/lending/workflow-types';
import {Button,ui,yen} from '../ui';
import {colors} from '../theme';
import {HomeRepayment,repaymentLoans} from './HomeRepayment';

export function HomeScreen({state,items,draftCount,onApply,onTransactions,onOpen,onIdentity,onInbox,notices=[],banner,now}:{state:WorkflowState;items:LendingTransaction[];draftCount:number;onApply:()=>void;onTransactions:()=>void;onOpen:(id:string)=>void;onIdentity:()=>void;onInbox?:()=>void;notices?:{id:string;title:string}[];banner?:ReactNode;now:number}){
 const loans=repaymentLoans(state.loans),nearest=loans[0];
 const attention=items.filter(item=>item.group==='attention'&&item.loanId!==nearest?.id).slice(0,3);
 const progress=items.filter(item=>item.group==='progress'&&!['active','repayment_pending'].includes(item.status)).slice(0,3);
 return <View style={homeStyles.stack}>
  {nearest&&<HomeRepayment loan={nearest} now={now} onOpen={()=>onOpen(`loan:${nearest.id}`)}/>}
  {nearest&&<Pressable accessibilityRole="button" accessibilityLabel="すべての契約を見る" onPress={onTransactions} style={homeStyles.link}><Text style={ui.muted}>契約中 {loans.length}件 · 借入元本 {yen(state.outstandingJpy)}</Text><Text style={homeStyles.gold}>一覧 ›</Text></Pressable>}
  {banner}
  {!!attention.length&&<><Text style={homeStyles.heading}>対応が必要</Text>{attention.map(item=><HomeTransaction key={item.id} item={item} onOpen={()=>onOpen(item.id)}/>)}</>}
  <View style={homeStyles.card}><Button title={draftCount?`申し込みを続ける · ${draftCount}枚`:'カードを申し込む'} onPress={onApply}/>{!state.identityVerified&&<Pressable accessibilityRole="button" accessibilityLabel="本人確認の状況を確認" onPress={onIdentity} style={homeStyles.link}><Text style={ui.muted}>本人確認</Text><Text style={homeStyles.gold}>確認する ›</Text></Pressable>}</View>
  {!!progress.length&&<><Text style={homeStyles.heading}>進行中の取引</Text>{progress.map(item=><HomeTransaction key={item.id} item={item} onOpen={()=>onOpen(item.id)}/>)}</>}
  {!nearest&&items.length>0&&<Button title="取引一覧" secondary onPress={onTransactions}/>}
  {!!notices.length&&<View style={homeStyles.card}><Text style={homeStyles.heading}>お知らせ</Text>{notices.slice(0,2).map(item=><Text key={item.id} numberOfLines={2} style={ui.body}>{item.title}</Text>)}<Button title="お知らせ一覧" secondary onPress={()=>onInbox?.()}/></View>}
 </View>;
}
function HomeTransaction({item,onOpen}:{item:LendingTransaction;onOpen:()=>void}){
 return <Pressable accessibilityRole="button" accessibilityLabel={`${item.statusLabel} ${item.title}を確認`} onPress={onOpen} style={[homeStyles.card,homeStyles.transaction]}><View style={{flex:1,gap:3}}><Text style={homeStyles.gold}>{item.statusLabel}</Text><Text style={ui.body} numberOfLines={2}>{item.title}</Text></View><Text style={homeStyles.gold}>›</Text></Pressable>;
}
const homeStyles=StyleSheet.create({stack:{gap:10},card:{backgroundColor:colors.surface,borderColor:colors.border,borderWidth:1,borderRadius:12,padding:12,gap:8},heading:{fontSize:16,fontWeight:'700',color:colors.text},gold:{fontSize:13,color:colors.gold},link:{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},transaction:{flexDirection:'row',alignItems:'center',gap:10}});
