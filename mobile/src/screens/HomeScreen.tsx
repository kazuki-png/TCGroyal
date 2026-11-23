import {RoyalIcon} from '../RoyalIcon';
import {useState,type ReactNode} from 'react';
import {useAppBack} from '../use-app-back';
import {BorrowingDetails} from './BorrowingDetails';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import type {LendingTransaction} from '../../../lib/lending/transactions';
import type {WorkflowState} from '../../../lib/lending/workflow-types';
import {Button,ui,yen} from '../ui';
import {colors} from '../theme';
import {repaymentLoans} from './HomeRepayment';

export function HomeScreen({state,items,draftCount,onApply,onTransactions,onOpen,onIdentity,onInbox,notices=[],banner,now,onPageChange}:{state:WorkflowState;items:LendingTransaction[];draftCount:number;onApply:()=>void;onTransactions:()=>void;onOpen:(id:string,panel?:'repayment'|'extension')=>void;onIdentity:()=>void;onInbox?:()=>void;notices?:{id:string;title:string}[];banner?:ReactNode;now:number;onPageChange?:()=>void}){
 const [details,setDetails]=useState(false);
 const changePage=(value:boolean)=>{setDetails(value);onPageChange?.()};
 useAppBack(details,15,()=>{changePage(false);return true});
 const loans=repaymentLoans(state.loans),nearest=loans[0];
 const total=loans.reduce((sum,loan)=>sum+loan.principal_jpy,0);
 const attention=items.filter(item=>item.group==='attention').slice(0,3);
 const progress=items.filter(item=>item.group==='progress'&&!['active','repayment_pending'].includes(item.status)).slice(0,3);
 if(details)return <BorrowingDetails loans={loans} items={items} now={now} onBack={()=>changePage(false)} onOpen={onOpen}/>;
 return <View style={homeStyles.stack}>
  {banner}
  <Pressable accessibilityRole="button" accessibilityLabel={`現在の借入額 ${yen(total)}、内訳を見る`} onPress={()=>changePage(true)} style={({pressed})=>[homeStyles.balance,{opacity:pressed?.7:1}]}>
   <View style={homeStyles.balanceHeader}><Text style={homeStyles.heading}>現在の借入額</Text><View style={{flexDirection:'row',alignItems:'center',gap:6}}><Text style={homeStyles.gold}>内訳を見る</Text><RoyalIcon name="right"/></View></View>
   <Text style={homeStyles.amount}>{yen(total)}</Text>
   <Text style={homeStyles.balanceNote}>{loans.length?`借入中 ${loans.length}件`:'現在の借り入れはありません'}</Text>
  </Pressable>
  {!!attention.length&&<><Text style={homeStyles.heading}>対応が必要</Text>{attention.map(item=><HomeTransaction key={item.id} item={item} onOpen={()=>onOpen(item.id)}/>)}</>}
  <View style={homeStyles.card}><Button title={draftCount?`申し込みを続ける · ${draftCount}枚`:'カードを申し込む'} onPress={onApply}/>{!state.identityVerified&&<Pressable accessibilityRole="button" accessibilityLabel="本人確認の状況を確認" onPress={onIdentity} style={homeStyles.link}><Text style={ui.muted}>本人確認</Text><View style={{flexDirection:'row',alignItems:'center',gap:6}}><Text style={homeStyles.gold}>確認する</Text><RoyalIcon name="right"/></View></Pressable>}</View>
  {!!progress.length&&<><Text style={homeStyles.heading}>進行中の取引</Text>{progress.map(item=><HomeTransaction key={item.id} item={item} onOpen={()=>onOpen(item.id)}/>)}</>}
  {!nearest&&items.length>0&&<Button title="取引一覧" secondary onPress={onTransactions}/>}
  {!!notices.length&&<View style={homeStyles.card}><Text style={homeStyles.heading}>お知らせ</Text>{notices.slice(0,2).map(item=><Text key={item.id} numberOfLines={2} style={ui.body}>{item.title}</Text>)}<Button title="お知らせ一覧" secondary onPress={()=>onInbox?.()}/></View>}
 </View>;
}
function HomeTransaction({item,onOpen}:{item:LendingTransaction;onOpen:()=>void}){
 return <Pressable accessibilityRole="button" accessibilityLabel={`${item.statusLabel} ${item.title}を確認`} onPress={onOpen} style={[homeStyles.card,homeStyles.transaction]}><View style={{flex:1,gap:3}}><Text style={homeStyles.gold}>{item.statusLabel}</Text><Text style={ui.body} numberOfLines={2}>{item.title}</Text></View><RoyalIcon name="right"/></Pressable>;
}
const homeStyles=StyleSheet.create({balance:{backgroundColor:colors.surface,padding:16,borderRadius:12,gap:10},balanceHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},amount:{fontSize:38,lineHeight:48,fontWeight:'700',color:colors.text,fontVariant:['tabular-nums']},balanceNote:{fontSize:12,color:colors.muted},stack:{gap:10},card:{backgroundColor:colors.surface,borderColor:colors.border,borderWidth:1,borderRadius:12,padding:12,gap:8},heading:{fontSize:16,fontWeight:'700',color:colors.text},gold:{fontSize:13,color:colors.gold},link:{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},transaction:{flexDirection:'row',alignItems:'center',gap:10}});
