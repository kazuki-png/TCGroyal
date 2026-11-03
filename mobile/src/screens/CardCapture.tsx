import {useEffect,useRef,useState} from 'react';
import {ActivityIndicator,AppState,Linking,Text,View,useWindowDimensions} from 'react-native';
import {CameraView,useCameraPermissions} from 'expo-camera';
import {selectCardImage} from '../select-card-image';
import {Button,ui} from '../ui';
import {colors} from '../theme';

export function CardCapture({onCapture,onManual}:{onCapture:(uri:string)=>void;onManual:()=>void}){
 const {height}=useWindowDimensions();
 const camera=useRef<CameraView|null>(null),requested=useRef(false),lock=useRef(false),alive=useRef(true);
 const [permission,requestPermission]=useCameraPermissions();
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[size,setSize]=useState<string>();
 const [foreground,setForeground]=useState(AppState.currentState==='active');
 useEffect(()=>{alive.current=true;const sub=AppState.addEventListener('change',value=>{setForeground(value==='active');setReady(false)});return()=>{alive.current=false;sub.remove()}},[]);
 useEffect(()=>{if(permission&&!permission.granted&&permission.canAskAgain&&!requested.current){requested.current=true;void requestPermission().catch(()=>setError('カメラの許可を確認できませんでした。'))}},[permission,requestPermission]);
 async function cameraReady(){
  try{const sizes=await camera.current?.getAvailablePictureSizesAsync();if(!alive.current)return;
   const candidates=(sizes??[]).map(value=>({value,area:value.split('x').map(Number).reduce((a,b)=>a*b,1)})).filter(value=>Number.isFinite(value.area)&&value.area>0&&value.area<=2400000).sort((a,b)=>b.area-a.area);
   if(candidates[0])setSize(candidates[0].value);
  }catch{/* The camera's default size remains usable when capability discovery is unavailable. */}
  if(alive.current)setReady(true);
 }
 async function capture(library=false){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{
   let uri:string|null|undefined;
   if(library)uri=await selectCardImage();
   else {if(!ready||!camera.current)return;uri=(await camera.current.takePictureAsync({quality:.6,exif:false,skipProcessing:false}))?.uri}
   if(uri&&alive.current)onCapture(uri);
  }catch{if(alive.current)setError('写真を取得できませんでした。撮り直すか、手動で検索してください。')}
  finally{lock.current=false;if(alive.current)setBusy(false)}
 }
 return <View style={{gap:12}}>
  <Text style={ui.title}>カードを撮影</Text><Text style={ui.muted}>カードを1枚、型番まで見えるように撮影してください。</Text>
  {!!error&&<Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
  <View accessibilityLabel="カード撮影プレビュー" style={{height:Math.max(180,Math.min(300,height*.27)),backgroundColor:'#000',borderRadius:20,overflow:'hidden',borderWidth:1,borderColor:colors.inputBorder}}>
   {permission?.granted&&foreground?<><CameraView ref={camera} style={{flex:1}} facing="back" mode="picture" pictureSize={size} onCameraReady={()=>void cameraReady()} onMountError={()=>{setReady(false);setError('カメラを起動できません。写真を選ぶか、手動検索をご利用ください。')}}/><View pointerEvents="none" style={{position:'absolute',top:24,bottom:24,left:'20%',right:'20%',borderWidth:2,borderColor:colors.gold,borderRadius:14}}/></>:<View style={{flex:1,justifyContent:'center',padding:20,gap:16}}><Text style={ui.body}>撮影にはカメラの許可が必要です。手動検索も利用できます。</Text>{!permission?<ActivityIndicator color={colors.gold}/>:<Button title={permission.canAskAgain?'カメラを許可する':'端末の設定を開く'} onPress={()=>void (permission.canAskAgain?requestPermission():Linking.openSettings())}/>}</View>}
  </View>
  <Text style={ui.muted}>撮影・写真選択でカード画像をOpenAIへ送信して検索します。本人確認書類は撮影・選択しないでください。</Text>
  <Button title={busy?'写真を準備中…':'撮影して検索'} disabled={busy||!ready||!permission?.granted||!foreground} onPress={()=>void capture()}/>
  <View style={ui.row}><View style={{flex:1}}><Button title="手動で検索" secondary disabled={busy} onPress={onManual}/></View><View style={{flex:1}}><Button title="画像をアップロード" secondary disabled={busy} onPress={()=>void capture(true)}/></View></View>
 </View>;
}
