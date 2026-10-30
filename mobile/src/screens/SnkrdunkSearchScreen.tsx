import {colors} from '../theme';
import {useRef,useState} from 'react';
import {ActivityIndicator,Image,Pressable,Text,View} from 'react-native';
import type {SnkrdunkCard,SnkrdunkCardSearch} from '../../../lib/lending/snkrdunk-card-types';
import {lendingApi} from '../api';
import {Button,Field,ui} from '../ui';
import {SupportEstimate} from './SupportEstimate';
import type {CollateralItem} from '../../../lib/lending/collateral-types';
import {useReferenceEstimate} from '../use-reference-estimate';
import {ReferenceEstimate} from './ReferenceEstimate';
import {useAppBack} from '../use-app-back';
export function SnkrdunkSearchScreen({onApplied,onAdd,active=true}:{onApplied:()=>Promise<void>;onAdd?:(item:Omit<CollateralItem,'id'|'quantity'>)=>boolean;active?:boolean}){
 const [added,setAdded]=useState(false);
 const [query,setQuery]=useState(''),[category,setCategory]=useState<'all'|'pokemon'|'onepiece'>('all');
 const [results,setResults]=useState<SnkrdunkCardSearch|null>(null),[selected,setSelected]=useState<SnkrdunkCard|null>(null);
 const [grade,setGrade]=useState('PSA10');
 const reference=useReferenceEstimate(selected?[{id:'00000000-0000-4000-8000-000000000001',name:selected.name.slice(0,100),cardNumber:selected.cardNumber,quantity:1,grade,condition:'',source:'snkrdunk',productId:selected.productId,cardUid:null}]:[],active);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const lock=useRef(false);
 const searched=useRef({query:'',category:'all' as typeof category});
 useAppBack(active&&selected!==null,30,()=>{setSelected(null);setAdded(false);return true});
 async function search(page=1){
  if(lock.current||!query.trim())return;lock.current=true;setBusy(true);setError('');setSelected(null);
  const input=page===1?{query:query.trim(),category}:searched.current;
  try{const data=await lendingApi<SnkrdunkCardSearch>('/catalog',{body:{action:'search_snkrdunk',...input,page}});searched.current=input;setResults(data);setSelected(null)}
  catch(cause){setError(cause instanceof Error?cause.message:'カードを検索できません。')}
  finally{lock.current=false;setBusy(false)}
 }
 return <View style={{gap:20}}>
  <View style={ui.card}><Text style={ui.title}>スニダンでカードを検索</Text><Text style={ui.muted}>カード名・型番からポケモンカード、ワンピースカードを探せます。選択後に状態を入力して査定を依頼してください。</Text>
   <Field label="カード名・型番" value={query} onChangeText={setQuery} maxLength={100} editable={!busy}/>
   <View style={ui.row}>{(['all','pokemon','onepiece'] as const).map(value=><View key={value} style={{flex:1}}><Button title={`${category===value?'✓ ':''}${value==='all'?'すべて':value==='pokemon'?'ポケモン':'ワンピース'}`} secondary disabled={busy} onPress={()=>setCategory(value)}/></View>)}</View>
   <Button title="スニダンで検索する" disabled={busy||!query.trim()} onPress={()=>void search()}/>
  </View>
  {busy&&<ActivityIndicator accessibilityLabel="カードを検索中" color={colors.gold}/>}
  {!!error&&<Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
  {added&&<Text style={ui.success}>申込に追加しました。続けてカードを検索・追加できます。</Text>}
  {results&&<><Text style={ui.muted}>{results.page}ページ / 候補 {results.cards.length}件</Text>
   {!results.cards.length&&<Text style={ui.body}>対象のカードが見つかりません。次のページ、検索語の変更、登録カード検索・個別見積もりをお試しください。</Text>}
   {results.cards.map(card=><View key={card.productId} style={{gap:12}}><Pressable accessibilityRole="radio" accessibilityLabel={card.name} accessibilityState={{checked:selected?.productId===card.productId,disabled:busy}} disabled={busy} onPress={()=>{setSelected(card);setGrade('PSA10');setAdded(false)}} style={[ui.card,selected?.productId===card.productId&&{borderColor:colors.gold}]}>
    {card.imageUrl&&<Image source={{uri:card.imageUrl}} accessibilityLabel={card.name} alt={card.name} style={{height:150,width:'100%'}} resizeMode="contain"/>}
    <Text style={ui.title}>{card.name}</Text><Text style={ui.muted}>{card.cardNumber} / {card.category==='pokemon'?'ポケモン':'ワンピース'}</Text>
   </Pressable>
   {selected?.productId===card.productId&&<>
    <View style={ui.card}><Text style={ui.title}>お手元のカードの鑑定状態</Text><Text style={ui.muted}>選択直後はPSA10を前提に参考計算します。実際の鑑定状態を選び直してから申込へ追加してください。鑑定済みであることを自動確認したものではありません。</Text>
     {(['PSA10','未鑑定','その他'] as const).map(value=><Button key={value} title={`${grade===value?'✓ ':''}${value==='PSA10'?'PSA10（自己申告）':value}`} secondary disabled={busy} onPress={()=>setGrade(value)}/>)}
    </View>
    <ReferenceEstimate {...reference} onRefresh={reference.refresh} disabled={busy}/>
    {onAdd?<Button title="このカードを申込に追加" disabled={busy} onPress={()=>{if(onAdd({name:card.name.slice(0,100),cardNumber:card.cardNumber,grade,condition:'',source:'snkrdunk',productId:card.productId,cardUid:null})){setSelected(null);setAdded(true)}}}/>:<SupportEstimate key={card.productId} connected onRegistered={onApplied} initialDraft={{reason:'other',cardName:card.name.slice(0,100),cardNumber:card.cardNumber,condition:grade,requestedAmount:'',notes:`スニダン検索で選択\n${card.name}\n商品ID: ${card.productId}\n${card.sourceUrl}`}}/>}
   </>}
   </View>)}
   <View style={ui.row}><Button title="前のページ" secondary disabled={busy||results.page<=1} onPress={()=>void search(results.page-1)}/><Button title="次のページ" secondary disabled={busy||!results.hasMore} onPress={()=>void search(results.page+1)}/></View>
  </>}
 </View>;
}
