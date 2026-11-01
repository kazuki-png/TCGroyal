import {Text,View} from 'react-native';
import type {LendingTransaction} from '../../../lib/lending/transactions';
import type {WorkflowState} from '../../../lib/lending/workflow-types';
import {Button,ui,yen,date} from '../ui';
import {TransactionRow} from './TransactionList';
export function HomeScreen({state,items,draftCount,onApply,onTransactions,onOpen,onIdentity,onInbox,notices=[]}:{state:WorkflowState;items:LendingTransaction[];draftCount:number;onApply:()=>void;onTransactions:()=>void;onOpen:(id:string)=>void;onIdentity:()=>void;onInbox?:()=>void;notices?:{id:string;title:string}[]}){
 const attention=items.filter(item=>item.group==='attention').sort((a,b)=>(Date.parse(a.dueAt??'')||Infinity)-(Date.parse(b.dueAt??'')||Infinity)).slice(0,3);
 const nearest=items.filter(item=>['active','repayment_pending'].includes(item.status)&&item.dueAt).sort((a,b)=>Date.parse(a.dueAt!)-Date.parse(b.dueAt!))[0];
 return <View style={{gap:20}}>
  {!!attention.length&&<><Text style={ui.title}>対応が必要な手続き</Text>{attention.map(item=><TransactionRow key={item.id} item={item} onOpen={()=>onOpen(item.id)}/>)}</>}
  <View style={ui.card}><Text style={ui.label}>借入元本の合計</Text><Text style={ui.amount}>{yen(state.outstandingJpy)}</Text>{nearest?<><Text style={ui.body}>最も近い返済期限 {date(nearest.dueAt)}</Text><Text style={ui.muted}>{nearest.reference} / 対象元本 {yen(nearest.amountJpy??0)}</Text><Button title="対象の契約を見る" onPress={()=>onOpen(nearest.id)}/></>:<Text style={ui.muted}>現在、返済期限のある契約はありません。</Text>}<Button title="すべての取引を見る" secondary onPress={onTransactions}/></View>
  {!state.identityVerified&&<View style={ui.card}><Text style={ui.title}>本人確認</Text><Text style={ui.body}>正式な契約には本人確認が必要です。提出・確認状況はマイページから確認できます。</Text><Button title="本人確認の状況を確認" secondary onPress={onIdentity}/></View>}
  <View style={ui.card}><Text style={ui.title}>{draftCount?'申し込み途中のカードがあります':'カードを選んで申し込む'}</Text><Text style={ui.body}>{draftCount?`申込リストに${draftCount}枚保存されています。`:'名前・型番・写真からカードを探し、複数枚まとめて査定を依頼できます。'}</Text><Button title={draftCount?'申し込みを続ける':'申し込みを始める'} onPress={onApply}/></View>
  <Text style={ui.title}>進行中の取引</Text>{items.filter(item=>item.group==='progress').slice(0,3).map(item=><TransactionRow key={item.id} item={item} onOpen={()=>onOpen(item.id)}/>)}
  {!!notices.length&&<View style={ui.card}><Text style={ui.title}>最新のお知らせ</Text>{notices.slice(0,2).map(item=><Text key={item.id} style={ui.body}>{item.title}</Text>)}<Button title="お知らせを見る" secondary onPress={()=>onInbox?.()}/></View>}
 </View>;
}
