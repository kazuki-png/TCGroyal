import {useEffect,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,Image,Pressable,Text,View,useWindowDimensions} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {randomUUID} from 'expo-crypto';
import type {DiscoveryCard,DiscoverySearch} from '../../../lib/lending/discovery-types';
import type {CollateralItem} from '../../../lib/lending/collateral-types';
import {collateralQuantity} from '../../../lib/lending/collateral-types';
import {lendingApi} from '../api';
import {useAppBack} from '../use-app-back';
import {useReferenceEstimate} from '../use-reference-estimate';
import {colors} from '../theme';
import {Button,Field,ui} from '../ui';
import {ReferenceEstimate} from './ReferenceEstimate';
import {CollateralBasket} from './CollateralBasket';

type Selection={card:DiscoveryCard;id:string};
export function ApplicationScreen({active,items,onChange,onApplied,ready,error:draftError,basketOpen=false,onBasketClose=()=>{}}:{active:boolean;items:CollateralItem[];onChange:(items:CollateralItem[])=>void;onApplied:()=>Promise<void>;ready:boolean;error:string;basketOpen?:boolean;onBasketClose?:()=>void}){
 const {width,fontScale}=useWindowDimensions();const columns=width>=360&&fontScale<1.3;
 const [localRoute,setRoute]=useState<'search'|'image'|'basket'>('search'),[selected,setSelected]=useState<Selection|null>(null);
 const route=basketOpen?'basket':localRoute;
 const closeBasket=()=>{onBasketClose();setRoute('search');setSelected(null)};
 const [query,setQuery]=useState(''),[category,setCategory]=useState<'all'|'pokemon'|'onepiece'>('all');
 const [results,setResults]=useState<DiscoverySearch|null>(null),[grade,setGrade]=useState(''),[quantity,setQuantity]=useState('1'),[condition,setCondition]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[manual,setManual]=useState('');
 const [asset,setAsset]=useState<ImagePicker.ImagePickerAsset|null>(null),[consent,setConsent]=useState(false);
 const current=useRef(0),mounted=useRef(true),controller=useRef<AbortController|null>(null),lastSearch=useRef({query:'',category:'all' as typeof category}),imageKey=useRef('');
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort()}},[]);
 useEffect(()=>{if(!active)controller.current?.abort()},[active]);
 useAppBack(active&&(selected!==null||route!=='search'),25,()=>{if(busy){controller.current?.abort();current.current++;setBusy(false)}if(route==='basket')closeBasket();else if(selected)setSelected(null);else{setRoute('search');setAsset(null);setConsent(false)}return true});
 const line=useMemo<CollateralItem|null>(()=>selected&&grade&&/^\d+$/.test(quantity)&&Number(quantity)>0?{id:selected.id,name:selected.card.name.slice(0,100),cardNumber:selected.card.cardNumber,quantity:Number(quantity),grade,condition,source:selected.card.kind==='external'?'snkrdunk':'catalog',productId:selected.card.productId,cardUid:selected.card.cardUid}:null,[selected,grade,quantity,condition]);
 const reference=useReferenceEstimate(line?[line]:[],active&&route!=='basket');
 function choose(card:DiscoveryCard){setSelected({card,id:randomUUID()});setGrade('');setQuantity('1');setCondition('');setError('');setNotice('')}
 async function search(page=1){
  controller.current?.abort();const abort=new AbortController();controller.current=abort;const generation=++current.current;
  const input=page===1?{query:query.trim(),category}:lastSearch.current;
  setBusy(true);setError('');setSelected(null);const timer=setTimeout(()=>abort.abort(),35000);
  try{const value=await lendingApi<DiscoverySearch>('/catalog',{body:{action:'discover',...input,page},signal:abort.signal});if(!mounted.current||generation!==current.current)return;setResults(value);lastSearch.current=input;setNotice(value.message??'')}
  catch(cause){if(mounted.current&&generation===current.current)setError(cause instanceof Error?cause.message:'検索できません。時間をおいてお試しください。')}
  finally{clearTimeout(timer);if(mounted.current&&generation===current.current)setBusy(false)}
 }
 async function chooseImage(camera:boolean){
  try{if(camera&&!(await ImagePicker.requestCameraPermissionsAsync()).granted){setError('カメラを許可するか、写真から選択してください。');return}
   const options:ImagePicker.ImagePickerOptions={mediaTypes:['images'],quality:.8,exif:false};const value=camera?await ImagePicker.launchCameraAsync(options):await ImagePicker.launchImageLibraryAsync(options);
   if(value.canceled||!mounted.current)return;const file=value.assets[0];if(file.fileSize&&file.fileSize>3*1024*1024){setError('3MB以下の画像を選択してください。');return}setAsset(file);setConsent(false);imageKey.current=randomUUID();setError('');
  }catch{setError('写真を開けませんでした。名前・型番での検索も利用できます。')}
 }
 async function imageSearch(){
  if(!asset||!consent||busy)return;const generation=++current.current;setBusy(true);setError('');
  const abort=new AbortController();controller.current=abort;const timer=setTimeout(()=>abort.abort(),45000);
  try{const form=new FormData();form.append('file',{uri:asset.uri,name:'card.jpg',type:asset.mimeType??'image/jpeg'} as unknown as Blob);form.append('key',imageKey.current);form.append('consent','true');form.append('format','discovery');
   const value=await lendingApi<DiscoverySearch&{hints?:{cardNumber:string|null;name:string|null}}>('/card-image',{body:form,signal:abort.signal});
   if(!mounted.current||generation!==current.current)return;setResults(value);setQuery(value.hints?.cardNumber??value.hints?.name??'');setNotice('撮影画像と候補の型番・版・言語を見比べて選択してください。');
  }catch(cause){if(mounted.current&&generation===current.current)setError(cause instanceof Error?cause.message:'画像を読み取れませんでした。')}
  finally{clearTimeout(timer);if(mounted.current&&generation===current.current)setBusy(false)}
 }
 function add(){
  if(!line)return;const same=items.find(item=>item.source===line.source&&item.productId===line.productId&&item.cardUid===line.cardUid&&item.name===line.name&&item.grade===line.grade&&item.condition===line.condition);
  if((!same&&items.length>=20)||collateralQuantity(items)+line.quantity>100){setError('20種類・合計100枚まで追加できます。枚数を確認してください。');return}
  onChange(same?items.map(item=>item.id===same.id?{...item,quantity:item.quantity+line.quantity}:item):[...items,line]);setSelected(null);setNotice('申込リストに追加しました。続けてカードを追加できます。');
 }
 if(!ready)return <ActivityIndicator accessibilityLabel="申込下書きを復元中" color={colors.gold}/>;
 return <View style={{gap:20}}>
  {!!draftError&&<Text accessibilityRole="alert" style={ui.error}>{draftError}</Text>}
  {route!=='basket'&&<Button title={`申込リストを確認 · ${items.length}種類 / ${collateralQuantity(items)}枚`} onPress={()=>{setSelected(null);setRoute('basket')}}/>}
  {route==='basket'?<CollateralBasket active={active} items={items} onChange={onChange} onApplied={onApplied} onBack={closeBasket} onReset={()=>{onChange([]);closeBasket()}} onSubmitted={()=>onChange([])}/>:<>
   {!!error&&<Text accessibilityRole="alert" style={ui.error}>{error}</Text>}{!!notice&&<Text accessibilityLiveRegion="polite" style={ui.success}>{notice}</Text>}
   {selected?<>
    <Button title="候補一覧に戻る" secondary onPress={()=>setSelected(null)}/>
    {asset&&route==='image'&&<><Text style={ui.label}>撮影したカード</Text><Image alt="撮影したカード" source={{uri:asset.uri}} accessibilityLabel="撮影したカード" style={{height:190,width:'100%'}} resizeMode="contain"/></>}
    <View style={ui.card}>{selected.card.imageUrl&&<Image alt={selected.card.name} source={{uri:selected.card.imageUrl}} accessibilityLabel={selected.card.name} style={{height:230,width:'100%'}} resizeMode="contain"/>}<Text style={ui.title}>{selected.card.name}</Text><Text style={ui.body}>型番 {selected.card.cardNumber||'未登録'} / {selected.card.category==='pokemon'?'ポケモン':'ワンピース'}</Text><Text style={ui.muted}>版・言語・型番が、お手元のカードと一致することを確認してください。</Text>
     <Text style={ui.label}>鑑定状態を選択</Text>{['未鑑定','PSA10','PSA9以下','その他鑑定'].map(value=><Button key={value} title={`${grade===value?'✓ ':''}${value}`} secondary onPress={()=>setGrade(value)}/>)}<Text style={ui.muted}>鑑定状態は自己申告です。現物確認後に正式な条件をご案内します。</Text>
     <Field label="枚数" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" maxLength={3}/><Field label="傷・白かけ・ケース破損など（任意）" value={condition} onChangeText={setCondition} maxLength={300} multiline/>
    </View>
    {line&&<ReferenceEstimate {...reference} onRefresh={reference.refresh}/>}
    <Button title="申込リストに追加" disabled={!line||line.quantity>100} onPress={add}/>
   </>:<>
    <View style={ui.card}><Text style={ui.title}>カードを追加</Text><Field label="カード名・型番で検索" value={query} onChangeText={setQuery} maxLength={100} onSubmitEditing={()=>void search()} returnKeyType="search"/>
     <View style={ui.row}>{(['all','pokemon','onepiece'] as const).map(value=><View key={value} style={{flex:1}}><Button title={`${category===value?'✓ ':''}${value==='all'?'すべて':value==='pokemon'?'ポケモン':'ワンピース'}`} secondary onPress={()=>setCategory(value)}/></View>)}</View>
     <Button title={busy?'検索中…':'検索する'} disabled={busy} onPress={()=>void search()}/><Button title={route==='image'?'名前・型番で探す':'写真で探す'} secondary onPress={()=>{setRoute(route==='image'?'search':'image');setError('')}}/>
    </View>
    {route==='image'&&<View style={ui.card}><Text style={ui.title}>カードを1枚撮影</Text><Text style={ui.body}>カード全体と型番を枠内に入れ、反射やピンぼけを避けてください。</Text><Button title="撮影する" secondary disabled={busy} onPress={()=>void chooseImage(true)}/><Button title="写真を選ぶ" secondary disabled={busy} onPress={()=>void chooseImage(false)}/>{asset&&<><Image alt="検索するカード写真" source={{uri:asset.uri}} accessibilityLabel="検索するカード写真" style={{height:220,width:'100%'}} resizeMode="contain"/><Text style={ui.muted}>カード情報を読み取るためOpenAIに画像を送信します。本人確認書類は送信しないでください。画像は真贋・鑑定状態の証明には使用しません。</Text><Button title={`${consent?'✓ ':''}画像送信に同意する`} secondary disabled={busy} onPress={()=>setConsent(!consent)}/><Button title="この写真で候補を探す" disabled={busy||!consent} onPress={()=>void imageSearch()}/></>}</View>}
    {busy&&<ActivityIndicator accessibilityLabel="カードを検索中" color={colors.gold}/>}
    {results&&<><Text style={ui.label}>候補 {results.cards.length}件</Text>{!results.cards.length&&<Text style={ui.body}>候補がありません。検索語の変更・写真・個別査定をお試しください。</Text>}<View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>{results.cards.map(card=><Pressable key={card.id} accessibilityRole="button" accessibilityLabel={`${card.name} ${card.cardNumber} を確認`} style={[ui.card,{width:columns?'48%':'100%',padding:16}]} onPress={()=>choose(card)}>{card.imageUrl&&<Image alt={card.name} source={{uri:card.imageUrl}} accessibilityLabel={card.name} style={{height:140,width:'100%'}} resizeMode="contain"/>}<Text style={ui.title}>{card.name}</Text><Text style={ui.body}>{card.cardNumber||'型番未登録'}</Text><Text style={ui.muted}>鑑定状態・枚数を選ぶ ›</Text></Pressable>)}</View>{route!=='image'&&<View style={ui.row}><Button title="前のページ" secondary disabled={busy||results.page<=1} onPress={()=>void search(results.page-1)}/><Button title="次のページ" secondary disabled={busy||!results.hasMore} onPress={()=>void search(results.page+1)}/></View>}</>}
    <View style={ui.card}><Text style={ui.title}>見つからないカード・未鑑定カード</Text><Text style={ui.body}>名前を入力してリストに追加すると、ほかのカードとまとめて個別査定を依頼できます。</Text><Field label="個別査定を依頼するカード名" value={manual} onChangeText={setManual} maxLength={100}/><Button title="個別査定のカードを追加" secondary disabled={!manual.trim()||items.length>=20||collateralQuantity(items)>=100} onPress={()=>{onChange([...items,{id:randomUUID(),name:manual.trim(),cardNumber:'',quantity:1,grade:'未鑑定',condition:'',source:'manual',cardUid:null,productId:null}]);setManual('');setNotice('個別査定のカードを申込リストに追加しました。')}}/></View>
   </>}
  </>}
 </View>;
}
