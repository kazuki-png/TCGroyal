import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,Image,Keyboard,Pressable,Text,View,useWindowDimensions} from 'react-native';
import {randomUUID} from 'expo-crypto';
import type {DiscoveryCard,DiscoverySearch,ImageDiscoverySearch} from '../../../lib/lending/discovery-types';
import type {CollateralItem} from '../../../lib/lending/collateral-types';
import {collateralQuantity} from '../../../lib/lending/collateral-types';
import {lendingApi} from '../api';
import {appendImageFile} from '../image-upload';
import {useAppBack} from '../use-app-back';
import {useReferenceEstimate} from '../use-reference-estimate';
import {colors} from '../theme';
import {Button,Field,ui} from '../ui';
import {ReferenceEstimate} from './ReferenceEstimate';
import {CollateralBasket} from './CollateralBasket';
import {CardCapture} from './CardCapture';
import {CardGradeSelect} from './CardGradeSelect';

type Route='camera'|'manual'|'results'|'added'|'basket';
const noop=()=>{};
export function ApplicationScreen({active,items,onChange,onApplied,ready,error:draftError,onNavigate=noop}:{active:boolean;items:CollateralItem[];onChange:(items:CollateralItem[])=>void;onApplied:()=>Promise<void>;ready:boolean;error:string;onNavigate?:()=>void}){
 const {width,fontScale}=useWindowDimensions(),columns=width>=360&&fontScale<1.3;
 const [route,setRoute]=useState<Route>('camera'),[selected,setSelected]=useState<{card:DiscoveryCard;id:string}|null>(null);
 const [query,setQuery]=useState(''),[results,setResults]=useState<DiscoverySearch|null>(null);
 const [grade,setGrade]=useState('PSA10'),[quantity,setQuantity]=useState('1'),[condition,setCondition]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[manual,setManual]=useState('');
 const [photo,setPhoto]=useState<string|null>(null),[hints,setHints]=useState<ImageDiscoverySearch['hints']|null>(null);
 const [origin,setOrigin]=useState<'manual'|'results'>('results');
 const generation=useRef(0),mounted=useRef(true),controller=useRef<AbortController|null>(null),imageRequest=useRef<{uri:string;key:string}|null>(null);
 const cancel=useCallback(()=>{generation.current++;controller.current?.abort();setBusy(false)},[]);
 const cameraRoute=useCallback(()=>{cancel();setSelected(null);setRoute('camera');setError('');setNotice('');setPhoto(null);setHints(null);setResults(null)},[cancel]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort()}},[]);
 useEffect(()=>{if(!active)controller.current?.abort()},[active]);
 useEffect(()=>{if(active)onNavigate()},[route,selected,active,onNavigate]);
 useAppBack(active&&(!!selected||route!=='camera'),25,()=>{cancel();if(selected)setSelected(null);else if(route==='basket')setRoute('added');else cameraRoute();return true});

 const line=useMemo<CollateralItem|null>(()=>selected&&/^\d+$/.test(quantity)&&Number(quantity)>0?{id:selected.id,name:selected.card.name.slice(0,100),cardNumber:selected.card.cardNumber,quantity:Number(quantity),grade,condition,source:selected.card.kind==='external'?'snkrdunk':'catalog',productId:selected.card.productId,cardUid:selected.card.cardUid}:null,[selected,grade,quantity,condition]);
 const reference=useReferenceEstimate(line?[line]:[],active&&!!selected);

 const search=useCallback(async(text:string,page=1)=>{
  cancel();const attempt=++generation.current,abort=new AbortController();controller.current=abort;
  setBusy(true);setError('');setResults(null);const timer=setTimeout(()=>abort.abort(),35000);
  try{const value=await lendingApi<DiscoverySearch>('/catalog',{body:{action:'discover',query:text,category:'all',page},signal:abort.signal});if(mounted.current&&attempt===generation.current){setResults(value);setNotice(value.message??'')}}
  catch(cause){if(mounted.current&&attempt===generation.current)setError(cause instanceof Error?cause.message:'検索できませんでした。')}
  finally{clearTimeout(timer);if(mounted.current&&attempt===generation.current)setBusy(false)}
 },[cancel]);
 useEffect(()=>{
  if(!active||route!=='manual'||selected)return;
  if(!query.trim())return;
  const timer=setTimeout(()=>void search(query.trim()),750);
  return()=>{clearTimeout(timer);cancel()};
 },[query,active,route,selected,search,cancel]);
 function editQuery(value:string){cancel();setQuery(value);setResults(null);setError('');setNotice('')}

 function manualRoute(){cancel();setSelected(null);setRoute('manual');setResults(null);setError('');setNotice('');setPhoto(null);setHints(null)}
 function choose(card:DiscoveryCard){Keyboard.dismiss();cancel();setOrigin(route==='manual'?'manual':'results');setSelected({card,id:randomUUID()});setGrade('PSA10');setQuantity('1');setCondition('');setError('');setNotice('')}
 async function imageSearch(uri:string,retry=false){
  cancel();Keyboard.dismiss();const attempt=++generation.current,abort=new AbortController();controller.current=abort;
  if(!retry||imageRequest.current?.uri!==uri)imageRequest.current={uri,key:randomUUID()};
  setPhoto(uri);setRoute('results');setSelected(null);setResults(null);setHints(null);setBusy(true);setError('');setNotice('');
  const timer=setTimeout(()=>abort.abort(),55000);
  try{
   const form=new FormData();appendImageFile(form,uri);form.append('key',imageRequest.current!.key);form.append('consent','true');form.append('format','discovery');
   const value=await lendingApi<ImageDiscoverySearch>('/card-image',{body:form,signal:abort.signal});
   if(!mounted.current||attempt!==generation.current)return;
   setResults(value);setHints(value.hints);setQuery(value.searchQuery??value.hints?.cardNumber??value.hints?.name??'');setNotice(value.message??'');
  }catch(cause){if(mounted.current&&attempt===generation.current)setError(cause instanceof Error?cause.message:'画像を読み取れませんでした。')}
  finally{clearTimeout(timer);if(mounted.current&&attempt===generation.current)setBusy(false)}
 }
 function addItem(item:CollateralItem){
  const same=items.find(row=>row.source===item.source&&row.productId===item.productId&&row.cardUid===item.cardUid&&row.name===item.name&&row.grade===item.grade&&row.condition===item.condition);
  if((!same&&items.length>=20)||collateralQuantity(items)+item.quantity>100){setError('20種類・合計100枚まで追加できます。枚数を確認してください。');return}
  onChange(same?items.map(row=>row.id===same.id?{...row,quantity:row.quantity+item.quantity}:row):[...items,item]);
  cancel();setSelected(null);setRoute('added');setNotice(item.name+'を申請に追加しました。');setError('');
 }
 if(!ready)return <ActivityIndicator accessibilityLabel="申込下書きを復元中" color={colors.gold}/>;
 const showCandidates=!selected&&(route==='results'||route==='manual');
 return <View style={{gap:18}}>
  {!!draftError&&<Text accessibilityRole="alert" style={ui.error}>{draftError}</Text>}
  {!!error&&<Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
  {route!=='added'&&route!=='basket'&&items.length>0&&<Button title={'申込リスト '+collateralQuantity(items)+'枚を確認'} secondary onPress={()=>{cancel();setSelected(null);setRoute('added');setNotice('')}}/>}
  {route==='basket'?<CollateralBasket active={active} items={items} onChange={onChange} onApplied={onApplied} onBack={()=>setRoute('added')} onReset={()=>{onChange([]);cameraRoute()}} onSubmitted={()=>onChange([])}/>:route==='added'?<>
   {!!notice&&<Text accessibilityLiveRegion="polite" style={ui.success}>{notice}</Text>}
   <Text style={ui.title}>現在の融資申込カード</Text><Text style={ui.body}>{items.length}種類・{collateralQuantity(items)}枚</Text>
   {items.map(item=><View key={item.id} style={ui.card}><Text style={ui.title}>{item.name}</Text><Text style={ui.body}>{item.cardNumber||'型番未登録'} / {item.grade} / {item.quantity}枚</Text><Button title={item.name+'を申込から削除'} secondary onPress={()=>onChange(items.filter(row=>row.id!==item.id))}/></View>)}
   {!items.length&&<Text style={ui.muted}>カードがまだ追加されていません。</Text>}
   <Button title="続けてカードを登録する" secondary onPress={cameraRoute}/>
   <Button title="登録を終了して申請に進む" disabled={!items.length} onPress={()=>setRoute('basket')}/>
  </>:selected?<>
   <Button title="候補一覧に戻る" secondary onPress={()=>{setSelected(null);setRoute(origin);setError('')}}/>
   <View style={ui.card}>{selected.card.imageUrl?<Image alt={selected.card.name} source={{uri:selected.card.imageUrl}} accessibilityLabel={selected.card.name} style={{height:330,width:'100%'}} resizeMode="contain"/>:<Text style={ui.muted}>画像は準備中です</Text>}<Text style={ui.title}>{selected.card.name}</Text><Text style={ui.body}>型番 {selected.card.cardNumber||'未登録'}</Text><Text style={ui.muted}>版・言語・型番が、お手元のカードと一致することを確認してください。</Text><CardGradeSelect value={grade} onChange={setGrade} active={active}/><Field label="枚数" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" maxLength={3}/><Field label="傷・白かけ・ケース破損など（任意）" value={condition} onChangeText={setCondition} maxLength={300} multiline/></View>
   {line&&<ReferenceEstimate {...reference} onRefresh={reference.refresh}/>}
   <Button title="申込に追加" disabled={!line||line.quantity>100} onPress={()=>{if(line)addItem(line)}}/>
  </>:route==='camera'?active&&<CardCapture onCapture={uri=>void imageSearch(uri)} onManual={manualRoute}/>:<>
   {route==='manual'?<View style={ui.card}><Field label="カード名・型番で検索" placeholder="ピカチュウ、132/106 など" value={query} onChangeText={editQuery} maxLength={100} returnKeyType="search" onSubmitEditing={()=>Keyboard.dismiss()}/><Text style={ui.muted}>キーワードを入力すると候補を検索します。</Text><Button title="撮影して探す" secondary onPress={cameraRoute}/></View>:<><Button title="撮り直す" secondary disabled={busy} onPress={cameraRoute}/>{photo&&<Image alt="検索したカード画像" source={{uri:photo}} accessibilityLabel="検索したカード画像" style={{height:170,width:'100%'}} resizeMode="contain"/>}{hints&&<Text style={ui.muted}>読み取り：{hints.name||'名前不明'} / {hints.cardNumber||'型番不明'}</Text>}<Button title="手動で検索" secondary onPress={manualRoute}/>{!!error&&photo&&<Button title="同じ写真の結果を再確認" secondary disabled={busy} onPress={()=>void imageSearch(photo,true)}/>}</>}
   {busy&&<><ActivityIndicator accessibilityLabel="カード候補を検索中" color={colors.gold}/><Text accessibilityLiveRegion="polite" style={ui.muted}>カード候補を検索しています…</Text></>}
   {showCandidates&&results&&<>{results.partial&&<Text style={ui.error}>{results.message||'一部の候補を取得できませんでした。'}</Text>}<Text style={ui.title}>{route==='results'?'撮影したカードの候補':'検索結果'}</Text>{route==='results'&&<Text style={ui.muted}>型番・セット・名前などの一致情報が多い順です。画像を見比べて選択してください。</Text>}{!results.cards.length&&<Text style={ui.body}>候補がありません。検索語を変えるか、下から個別査定のカードを追加してください。</Text>}<View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>{results.cards.map(card=><Pressable key={card.id} accessibilityRole="button" accessibilityLabel={card.name+' '+card.cardNumber+' を確認'} style={[ui.card,{width:columns?'48%':'100%',padding:14}]} onPress={()=>choose(card)}>{card.imageUrl&&<Image alt={card.name} source={{uri:card.imageUrl}} accessibilityLabel={card.name} style={{height:150,width:'100%'}} resizeMode="contain"/>}<Text style={ui.title}>{card.name}</Text><Text style={ui.body}>{card.cardNumber||'型番未登録'}</Text><Text style={ui.muted}>このカードを確認 ›</Text></Pressable>)}</View>{route==='manual'&&<View style={ui.row}><Button title="前のページ" secondary disabled={busy||results.page<=1} onPress={()=>void search(query.trim(),results.page-1)}/><Button title="次のページ" secondary disabled={busy||!results.hasMore} onPress={()=>void search(query.trim(),results.page+1)}/></View>}</>}
   <View style={ui.card}><Text style={ui.title}>見つからないカードは個別査定へ</Text><Field label="個別査定を依頼するカード名" value={manual} onChangeText={setManual} maxLength={100}/><Button title="個別査定のカードを申込に追加" secondary disabled={busy||!manual.trim()} onPress={()=>{addItem({id:randomUUID(),name:manual.trim(),cardNumber:'',quantity:1,grade:'未鑑定',condition:'',source:'manual',cardUid:null,productId:null});setManual('')}}/></View>
  </>}
 </View>;
}
