import {useState} from 'react';
import {Text,View} from 'react-native';
import {randomUUID} from 'expo-crypto';
import type {CollateralItem} from '../../../lib/lending/collateral-types';
import {collateralQuantity,collateralTitle} from '../../../lib/lending/collateral-types';
import {Button,Field,ui} from '../ui';
import {SupportEstimate} from './SupportEstimate';
import {useReferenceEstimate} from '../use-reference-estimate';
import {ReferenceEstimate} from './ReferenceEstimate';
export function CollateralBasket({items,onChange,onApplied,onBack,onReset}:{items:CollateralItem[];onChange:(items:CollateralItem[])=>void;onApplied:()=>Promise<void>;onBack:()=>void;onReset:()=>void}){
 const [busy,setBusy]=useState(false),[submitted,setSubmitted]=useState(false),[manual,setManual]=useState('');
 const [review,setReview]=useState(false),[error,setError]=useState('');
 const [requested,setRequested]=useState('');
 const signature=JSON.stringify(items),reference=useReferenceEstimate(items,!submitted);
 function invalidate(){setReview(false);setRequested('')}
 function update(id:string,patch:Partial<CollateralItem>){onChange(items.map(item=>item.id===id?{...item,...patch}:item));invalidate()}
 const valid=items.length>0&&items.length<=20&&collateralQuantity(items)<=100&&items.every(item=>Number.isInteger(item.quantity)&&item.quantity>=1&&item.quantity<=100);
 return <View style={{gap:16}}>
  <Text style={ui.title}>まとめて申込 / {items.length}種類・{collateralQuantity(items)}枚</Text>
  <Text style={ui.muted}>借入希望額・契約・返済期限は全カードでひとつです。カードごとの状態と枚数を確認してください。返却も契約全体で行います。</Text>
  {!submitted&&<Button title="カード検索へ戻って追加" secondary disabled={busy} onPress={onBack}/>}
  {items.map((item,index)=><View key={item.id} style={ui.card}><Text style={ui.title}>{index+1}. {item.name}</Text><Text style={ui.muted}>{item.cardNumber}</Text>
   <Field label={`${index+1}番目のカード番号`} value={item.cardNumber} maxLength={100} editable={!busy&&!submitted} onChangeText={cardNumber=>update(item.id,{cardNumber})}/>
   <Field label={`${index+1}番目の枚数`} value={String(item.quantity||'')} keyboardType="number-pad" maxLength={3} editable={!busy&&!submitted} onChangeText={value=>update(item.id,{quantity:/^\d{1,3}$/.test(value)?Number(value):0})}/>
   <Field label={`${index+1}番目の鑑定・グレード`} value={item.grade} maxLength={60} editable={!busy&&!submitted} onChangeText={grade=>update(item.id,{grade})}/>
   <Field label={`${index+1}番目の状態`} value={item.condition} maxLength={300} multiline editable={!busy&&!submitted} onChangeText={condition=>update(item.id,{condition})}/>
   {!submitted&&<Button title={`${index+1}番目のカードを削除`} secondary disabled={busy} onPress={()=>{onChange(items.filter(row=>row.id!==item.id));invalidate()}}/>}
  </View>)}
  {!submitted&&<View style={ui.card}><Field label="手入力で追加するカード名" value={manual} onChangeText={setManual} maxLength={100} editable={!busy}/><Button title="手入力のカードを追加" secondary disabled={busy||!manual.trim()||items.length>=20||collateralQuantity(items)>=100} onPress={()=>{onChange([...items,{id:randomUUID(),name:manual.trim(),cardNumber:'',quantity:1,grade:'',condition:'',source:'manual',productId:null,cardUid:null}]);setManual('');invalidate()}}/></View>}
  {!valid&&<Text accessibilityRole="alert" style={ui.error}>カードを追加し、20種類・合計100枚以内で、各カードの枚数を1枚以上にしてください。</Text>}
  {!!error&&<Text style={ui.error}>{error}</Text>}
  {!submitted&&<ReferenceEstimate {...reference} onRefresh={()=>{invalidate();reference.refresh()}} disabled={busy||!valid} onUse={amount=>{if(!reference.estimate||Date.parse(reference.estimate.expiresAt)<=Date.now()){setError('参考額の期限が切れています。再取得してください。');return}setRequested(String(amount));setReview(true)}}/>}
  {!review&&!submitted&&<Button title="この内容でまとめて査定を依頼" disabled={busy||!valid} onPress={()=>{setError('');setReview(true)}}/>}
  {review&&valid&&<SupportEstimate key={signature+requested} connected items={items} onBusyChange={setBusy} initialDraft={{reason:'other',cardName:collateralTitle(items),cardNumber:'',condition:'カード別の状態は明細を参照',requestedAmount:requested,notes:''}} onRegistered={async()=>{setSubmitted(true);await onApplied()}}/>}
  {submitted&&<Button title="別の申込を作る" secondary disabled={busy} onPress={onReset}/>}
 </View>;
}
