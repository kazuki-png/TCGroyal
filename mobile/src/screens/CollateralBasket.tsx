import {useRef,useState} from 'react';
import {Text,View} from 'react-native';
import {randomUUID} from 'expo-crypto';
import type {CollateralItem} from '../../../lib/lending/collateral-types';
import {collateralTitle} from '../../../lib/lending/collateral-types';
import type {SupportCase} from '../../../lib/lending/support-case-types';
import type {ApplicationForm} from '../application-draft';
import {buildSupportEstimateMessage} from '../support-estimate';
import {lendingApi} from '../api';
import {Button,Field,RoyalSwitch,ui} from '../ui';
import {useAppBack} from '../use-app-back';
import {ApplicationSummary} from './ApplicationSummary';

export function CollateralBasket({items,onChange,onApplied,onBack,onReset,onSubmitted,active=true,form,onFormChange,notice='',error:draftError='',onBusyChange}:{items:CollateralItem[];onChange:(items:CollateralItem[])=>void;onApplied:()=>Promise<void>;onBack:()=>void;onReset:()=>void;onSubmitted?:()=>void;active?:boolean;form?:ApplicationForm;onFormChange?:(patch:Partial<ApplicationForm>)=>void;notice?:string;error?:string;onBusyChange?:(busy:boolean)=>void}){
 const [localForm,setLocalForm]=useState<ApplicationForm>({requestedAmount:'',notes:''}),[receipt,setReceipt]=useState<SupportCase|null>(null);
 const [busy,setBusy]=useState(false),[consentSignature,setConsentSignature]=useState<string|null>(null),[notesOpen,setNotesOpen]=useState(false),[error,setError]=useState('');
 const lock=useRef(false),retry=useRef<{signature:string;key:string}|null>(null),value=form??localForm;
 const draft={reason:'other' as const,cardName:collateralTitle(items),cardNumber:'',condition:'カード別の状態は明細を参照',requestedAmount:value.requestedAmount,notes:value.notes,items};
 const signature=JSON.stringify(draft);
 let validation='';try{buildSupportEstimateMessage(draft)}catch(cause){validation=cause instanceof Error?cause.message:'入力内容を確認してください。'}
 const agreed=consentSignature===signature;
 useAppBack(active&&busy,60,()=>true);
 function change(patch:Partial<ApplicationForm>){if(busy)return;if(onFormChange)onFormChange(patch);else setLocalForm(current=>({...current,...patch}));setConsentSignature(null);setError('')}
 async function submit(){
  if(lock.current||!agreed||validation||receipt)return;
  lock.current=true;setBusy(true);onBusyChange?.(true);setError('');
  if(retry.current?.signature!==signature)retry.current={signature,key:randomUUID()};
  try{
   const data=await lendingApi<{case:SupportCase}>('/support-cases',{body:{action:'create',draft,consent:true,key:retry.current.key}});
   setReceipt(data.case);onChange([]);onSubmitted?.();
   try{await onApplied()}catch{setError('申請は受付済みです。取引状況を更新して確認してください。')}
  }catch(cause){setError(cause instanceof Error?cause.message:'申請できませんでした。もう一度お試しください。')}
  finally{lock.current=false;setBusy(false);onBusyChange?.(false)}
 }
 if(receipt)return <View style={{flex:1,padding:16,gap:12}}><Text style={ui.title}>査定依頼を受け付けました</Text><Text selectable style={ui.amount}>{receipt.reference}</Text><Text style={ui.muted}>取引状況で進捗を確認できます。</Text>{!!error&&<Text accessibilityRole="alert" style={ui.error}>{error}</Text>}<Button title="続けて登録" secondary disabled={busy} onPress={onReset}/></View>;
 return <ApplicationSummary items={items} active={active} busy={busy} notice={notice} error={error||draftError} onRemove={id=>{onChange(items.filter(item=>item.id!==id));setConsentSignature(null)}} onUpdate={(id,patch)=>{onChange(items.map(item=>item.id===id?{...item,...patch}:item));setConsentSignature(null)}} onContinue={onBack} onProceed={()=>void submit()} proceedLabel={busy?'申請中…':'申請する'} canProceed={!validation&&agreed} form={<View style={{gap:10,marginTop:6}}>
  <Field label="融資希望額（円・任意）" placeholder="金額を入力" value={value.requestedAmount} onChangeText={requestedAmount=>change({requestedAmount})} keyboardType="number-pad" maxLength={8} editable={!busy&&items.length>0}/>
  {!!value.requestedAmount&&!!validation&&<Text accessibilityRole="alert" style={ui.error}>{validation}</Text>}
  <Button title={notesOpen?'相談内容を閉じる':'相談内容を追加（任意）'} secondary disabled={busy} onPress={()=>setNotesOpen(!notesOpen)}/>
  {(notesOpen||!!value.notes)&&<Field label="相談内容（任意）" value={value.notes} onChangeText={notes=>change({notes})} multiline maxLength={1000} editable={!busy}/>}
  <View style={ui.row}><RoyalSwitch accessibilityLabel="査定依頼の登録に同意する" value={agreed} disabled={busy||!items.length} onValueChange={checked=>setConsentSignature(checked?signature:null)}/><Text style={[ui.body,{flex:1}]}>査定依頼の登録に同意する</Text></View>
  <Text style={ui.muted}>正式な融資条件は現物確認後に確定します。</Text>
 </View>}/>;
}
