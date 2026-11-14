import {useState,type ReactNode} from 'react';
import {Text,View} from 'react-native';
import type {LendingTransaction,TransactionGroup} from '../../../lib/lending/transactions';
import {Button,ui,yen,date} from '../ui';
export function TransactionRow({item,onOpen}:{item:LendingTransaction;onOpen:()=>void}){
 return <View style={ui.card}><Text style={ui.label}>{item.statusLabel} · {item.reference}</Text><Text style={ui.title}>{item.title}</Text><Text style={ui.muted}>合計 {item.quantity}枚</Text>{item.amountJpy!==null&&<Text style={ui.body}>{item.amountLabel} {yen(item.amountJpy)}</Text>}{item.dueAt&&<Text style={ui.body}>返済期限 {date(item.dueAt)}</Text>}<Button title={item.nextAction} onPress={onOpen}/></View>;
}
export function TransactionList({items,selectedId,onSelect,renderDetail,onApply}:{items:LendingTransaction[];selectedId:string|null;onSelect:(id:string|null)=>void;renderDetail:(item:LendingTransaction)=>ReactNode;onApply:()=>void}){
 const [group,setGroup]=useState<TransactionGroup|'all'>('all');
 const selected=items.find(item=>item.id===selectedId);
 if(selectedId)return <View style={{gap:16}}><Button title="取引一覧に戻る" secondary onPress={()=>onSelect(null)}/>{selected?<><Text style={ui.label}>{selected.reference} · {selected.statusLabel}</Text>{renderDetail(selected)}</>:<Text style={ui.body}>この取引を表示できません。一覧を更新して確認してください。</Text>}</View>;
 const shown=items.filter(item=>group==='all'||item.group===group);
 return <View style={{gap:16}}><View style={ui.row}>{([['all','すべて'],['attention','対応が必要'],['progress','進行中'],['completed','返却・終了']] as const).map(([key,label])=><View key={key} style={{flex:1}}><Button selected={group===key} title={`${label} ${items.filter(item=>key==='all'||item.group===key).length}`} secondary onPress={()=>setGroup(key)}/></View>)}</View>{!shown.length&&<View style={ui.card}><Text style={ui.title}>{items.length?'この分類の取引はありません':'取引はまだありません'}</Text><Text style={ui.body}>査定依頼から返却まで、ここで状況を確認できます。</Text><Button title="カードを選んで申し込む" onPress={onApply}/></View>}{shown.map(item=><TransactionRow key={item.id} item={item} onOpen={()=>onSelect(item.id)}/>)}</View>;
}
