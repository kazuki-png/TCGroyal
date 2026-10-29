import {useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Image,Pressable,Switch,Text,View} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {randomUUID} from 'expo-crypto';
import type {CatalogCard,CatalogSearch,CatalogAssessment,DeclaredGrade} from '../../../lib/lending/catalog-types';
import type {SupportCase} from '../../../lib/lending/support-case-types';
import {lendingApi} from '../api';
import {SupportEstimate} from './SupportEstimate';
import {Button,Field,ui,yen,date} from '../ui';

export function CatalogAssessmentScreen({onApplied}:{onApplied:()=>Promise<void>}){
 const [route,setRoute]=useState<'catalog'|'support'>('catalog');
 const [query,setQuery]=useState(''),[category,setCategory]=useState('all'),[results,setResults]=useState<CatalogSearch|null>(null);
 const [selected,setSelected]=useState<CatalogCard|null>(null),[grade,setGrade]=useState<DeclaredGrade>('ungraded');
 const [assessment,setAssessment]=useState<CatalogAssessment|null>(null),[amount,setAmount]=useState(''),[notes,setNotes]=useState('');
 const [consent,setConsent]=useState(false),[busy,setBusy]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [imageMode,setImageMode]=useState(false),[asset,setAsset]=useState<ImagePicker.ImagePickerAsset|null>(null),[imageConsent,setImageConsent]=useState(false);
 const [registered,setRegistered]=useState<SupportCase|null>(null);
 const lock=useRef(true),imageKey=useRef<string|null>(null),submitKey=useRef<{signature:string;key:string}|null>(null);
 useEffect(()=>{let live=true;void lendingApi<CatalogSearch>('/catalog',{body:{action:'search',query:'',category:'all',page:1}}).then(d=>{if(live)setResults(d)}).catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live){lock.current=false;setBusy(false)}});return()=>{live=false}},[]);
 const run=async(work:()=>Promise<void>)=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');try{await work()}catch(e){setError(e instanceof Error?e.message:'通信に失敗しました。')}finally{lock.current=false;setBusy(false)}};
 const invalidate=()=>{setAssessment(null);setConsent(false);setRegistered(null);submitKey.current=null};
 async function search(page=1){
  const data=await lendingApi<CatalogSearch>('/catalog',{body:{action:'search',query,category,page}});
  setResults(data);setSelected(null);invalidate();if(!data.total)setNotice('候補がありません。検索語を変えるか、個別見積もりをご利用ください。');
 }
 async function choose(camera:boolean){
  if(camera&&!(await ImagePicker.requestCameraPermissionsAsync()).granted)throw Error('カメラを許可するか、写真から選択してください。');
  const options:ImagePicker.ImagePickerOptions={mediaTypes:['images'],quality:.8,exif:false,allowsEditing:false};
  const value=camera?await ImagePicker.launchCameraAsync(options):await ImagePicker.launchImageLibraryAsync(options);
  if(!value.canceled){const item=value.assets[0];if(item.fileSize&&item.fileSize>3*1024*1024)throw Error('3MB以下の画像を選んでください。');setAsset(item);setImageConsent(false);imageKey.current=randomUUID()}
 }
 async function imageSearch(){
  if(!asset||!imageConsent)return;
  const form=new FormData();form.append('file',{uri:asset.uri,name:'card.jpg',type:asset.mimeType??'image/jpeg'} as unknown as Blob);
  form.append('key',imageKey.current??(imageKey.current=randomUUID()));form.append('consent','true');
  const data=await lendingApi<CatalogSearch>('/card-image',{body:form});
  setResults(data);setSelected(null);invalidate();setAsset(null);setImageConsent(false);setImageMode(false);
  setQuery(data.hints?.cardNumber||data.hints?.name||'');setCategory(data.hints?.category??'all');
  setNotice(data.total?'画像から候補を探しました。型番・版・言語・グレードを確認して選択してください。':'一致する候補がありません。検索語の修正、再撮影、個別見積もりをご利用ください。');
 }
 async function submit(){
  if(!assessment||!consent||registered)return;
  const body={action:'submit',assessmentId:assessment.id,requestedAmount:amount,notes,consent:true},signature=JSON.stringify(body);
  if(submitKey.current?.signature!==signature)submitKey.current={signature,key:randomUUID()};
  const data=await lendingApi<{case:SupportCase}>('/catalog',{body:{...body,key:submitKey.current.key}});setRegistered(data.case);
  setNotice('査定依頼を受け付けました。貸付状況で見積もりと進捗を確認できます。');
  await onApplied().catch(()=>setNotice('受付済みです。貸付状況を開いて確認してください。'));
 }
 return <View style={{gap:20}}>
  <View style={ui.row}>
   <View style={{flex:1}}><Button title="カードを検索" secondary disabled={busy} onPress={()=>{setRoute('catalog')}}/></View>
   <View style={{flex:1}}><Button title="個別見積もり" secondary disabled={busy} onPress={()=>{setRoute('support')}}/></View>
  </View>
  {route==='support'?<SupportEstimate connected onRegistered={onApplied}/>:<>
   {error?<Text accessibilityRole="alert" style={ui.error}>{error}</Text>:null}
   {notice?<Text accessibilityLiveRegion="polite" style={ui.success}>{notice}</Text>:null}
   <View style={ui.card}>
    <Text style={ui.title}>カードを選択</Text><Text style={ui.muted}>TCG ROYALに登録されたカードからお選びください。カード画像から候補を探すこともできます。</Text>
    <Field label="カード名・型番" value={query} maxLength={100} editable={!busy} onChangeText={setQuery}/>
    <View style={ui.row}>{(['all','pokemon','onepiece'] as const).map(v=><View style={{flex:1}} key={v}><Button title={`${category===v?'✓ ':''}${v==='all'?'すべて':v==='pokemon'?'ポケモン':'ワンピース'}`} secondary disabled={busy} onPress={()=>setCategory(v)}/></View>)}</View>
    <Button title="検索する" disabled={busy} onPress={()=>void run(()=>search())}/>
    <Button title="画像で探す" secondary disabled={busy} onPress={()=>setImageMode(!imageMode)}/>
    {imageMode&&<>
     <Text style={ui.body}>カード表面の画像からカード名や型番を読み取り、登録カードから候補を探します。画像だけでは鑑定・真贋確認はできません。</Text>
     <View style={ui.row}><Button title="撮影する" secondary disabled={busy} onPress={()=>void run(()=>choose(true))}/><Button title="写真から選択" secondary disabled={busy} onPress={()=>void run(()=>choose(false))}/></View>
     {asset&&<>
      <Image alt="検索するカード画像" accessibilityLabel="検索するカード画像" source={{uri:asset.uri}} style={{height:220,width:'100%'}} resizeMode="contain"/>
      <View style={ui.row}><Switch value={imageConsent} onValueChange={setImageConsent} disabled={busy} accessibilityLabel="カード画像をOpenAIへ送信することに同意"/><Text style={[ui.body,{flex:1}]}>検索のためカード画像をOpenAIへ送信することに同意します。本人確認書類は送らないでください。</Text></View>
      <Button title="この画像で検索" disabled={busy||!imageConsent} onPress={()=>void run(imageSearch)}/>
     </>}
    </>}
   </View>
   {busy&&<ActivityIndicator accessibilityLabel="処理中" color="#fcd66e"/>}
   {results&&<View style={{gap:12}}>
    <Text style={ui.muted}>候補 {results.total}件 / {results.page}ページ。マスタのグレードも確認してください。</Text>
    {results.cards.map(card=><Pressable key={card.public_uid} accessibilityRole="radio" accessibilityState={{checked:selected?.public_uid===card.public_uid,disabled:busy}} disabled={busy} style={[ui.card,selected?.public_uid===card.public_uid&&{borderColor:'#fcd66e'}]} onPress={()=>{setSelected(card);setGrade('ungraded');invalidate()}}>
     {card.image_url&&/^https:\/\//.test(card.image_url)?<Image alt={card.name} accessibilityLabel={card.name} source={{uri:card.image_url}} style={{height:140,width:'100%'}} resizeMode="contain"/>:null}
     <Text style={ui.title}>{card.name}</Text><Text style={ui.body}>{card.card_number||'型番未登録'} / {card.category} / {card.grade}</Text>
    </Pressable>)}
    {!results.total&&<Text style={ui.body}>該当カードがない場合も、個別見積もりから相談できます。</Text>}
    {!results.imageRequestId&&<View style={ui.row}><Button title="前のページ" secondary disabled={busy||results.page<=1} onPress={()=>void run(()=>search(results.page-1))}/><Button title="次のページ" secondary disabled={busy||results.page*12>=results.total} onPress={()=>void run(()=>search(results.page+1))}/></View>}
    {results.imageRequestId&&results.total>results.cards.length&&<Text style={ui.muted}>さらに探す場合は、読み取った型番で「検索する」を押してください。</Text>}
   </View>}
   {selected&&!registered&&<View style={ui.card}>
    <Text style={ui.title}>選択したカード：{selected.name}</Text><Text style={ui.body}>{selected.card_number} / マスタ上のグレード {selected.grade}</Text><Text style={ui.label}>お手元のカードの状態</Text>
    {(['ungraded','PSA10','other'] as const).map(value=><Button key={value} title={`${grade===value?'✓ ':''}${value==='ungraded'?'未鑑定':value==='PSA10'?'PSA10（自己申告）':'その他の鑑定・グレード'}`} secondary disabled={busy} onPress={()=>{setGrade(value);invalidate()}}/>)}
    <Text style={ui.muted}>カード名・型番・版・言語と実物を照合してください。鑑定情報は運営による確認待ちとして扱います。</Text>
    <Button title="このカードで査定内容を確認" disabled={busy} onPress={()=>void run(async()=>{const data=await lendingApi<{assessment:CatalogAssessment}>('/catalog',{body:{action:'assess',cardUid:selected.public_uid,declaredGrade:grade,...(results?.imageRequestId?{imageRequestId:results.imageRequestId}:{})}});setAssessment(data.assessment);setConsent(false)})}/>
   </View>}
   {assessment&&!registered&&<View style={ui.card}>
    <Text style={ui.title}>査定依頼</Text><Text style={ui.amount}>{assessment.indicative_jpy===null?'個別見積もり':yen(assessment.indicative_jpy)}</Text>
    {assessment.reasons.map((reason,i)=><Text key={i} style={ui.muted}>{reason}</Text>)}
    <Text style={ui.muted}>参考額は融資の確約ではありません。現物検品後に最終条件を提示します。受付期限 {date(assessment.expires_at)}</Text>
    <Field label="借入希望額・円（任意）" value={amount} onChangeText={v=>{setAmount(v);setConsent(false)}} keyboardType="number-pad" maxLength={8} editable={!busy}/>
    <Field label="カードの状態・相談内容（任意）" value={notes} onChangeText={v=>{setNotes(v);setConsent(false)}} multiline maxLength={1000} editable={!busy}/>
    <View style={ui.row}><Switch value={consent} onValueChange={setConsent} disabled={busy} accessibilityLabel="カードの一致と査定依頼の保存に同意"/><Text style={[ui.body,{flex:1}]}>カードの一致を確認し、申告内容を保存して運営へ査定を依頼します。現物・本人確認と最終条件への同意が必要なことを確認しました。</Text></View>
    <Button title="査定を依頼する" disabled={busy||!consent||!!amount&&(!/^[1-9]\d{0,7}$/.test(amount)||Number(amount)>10000000)} onPress={()=>void run(submit)}/>
   </View>}
   {registered&&<View style={ui.card}><Text style={ui.title}>査定依頼を受け付けました</Text><Text selectable style={ui.amount}>{registered.reference}</Text><Text style={ui.body}>貸付状況から査定の進捗と見積もりを確認できます。</Text><Button title="別のカードを探す" secondary onPress={()=>{setSelected(null);setAmount('');setNotes('');invalidate()}}/></View>}
   <Button title="カードが見つからない・サポートへ相談" secondary disabled={busy} onPress={()=>setRoute('support')}/>
  </>}
 </View>;
}
