import {useEffect,useRef,useState} from 'react';
import {ActivityIndicator,AppState,Linking,Pressable,StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import {CameraView,useCameraPermissions} from 'expo-camera';
import {selectCardImage} from '../select-card-image';
import {Button,ui} from '../ui';
import {colors} from '../theme';
import {RoyalIcon} from '../RoyalIcon';

export function CardCapture({onCapture,onManual,onClose,error:outerError}:{onCapture:(uri:string)=>void;onManual:()=>void;onClose:()=>void;error?:string}){
 const {width,height}=useWindowDimensions();
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
 const disabled=busy||!ready||!permission?.granted||!foreground;
 return <View accessibilityLabel="カード撮影画面" style={{flex:1,backgroundColor:'#000'}}>
  {permission?.granted&&foreground?<CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" mode="picture" pictureSize={size} onCameraReady={()=>void cameraReady()} onMountError={()=>{setReady(false);setError('カメラを起動できません。写真を選ぶか、手動検索をご利用ください。')}}/>:<View style={{flex:1,justifyContent:'center',alignItems:'center',padding:24}}>{!permission?<ActivityIndicator color={colors.gold}/>:<Button title={permission.canAskAgain?'カメラを許可する':'端末の設定を開く'} onPress={()=>void (permission.canAskAgain?requestPermission():Linking.openSettings())}/>}</View>}
  <View pointerEvents="none" style={[StyleSheet.absoluteFill,{justifyContent:'center',alignItems:'center',paddingBottom:84}]}>
   <View style={{width:Math.min(width*.64,height*.44*63/88),aspectRatio:63/88,borderWidth:2,borderColor:colors.gold,borderRadius:14}}/>
  </View>
  <View style={{position:'absolute',top:8,left:12,right:12,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
   <Pressable accessibilityRole="button" accessibilityLabel="撮影画面を閉じる" disabled={busy} onPress={onClose} style={{width:44,height:44,borderRadius:22,backgroundColor:colors.background+'D9',alignItems:'center',justifyContent:'center'}}><RoyalIcon name="close" size={20} color={colors.gold}/></Pressable>
  </View>
  {!!(error||outerError)&&<Text accessibilityRole="alert" style={[ui.error,{position:'absolute',top:60,left:16,right:16}]}>{error||outerError}</Text>}
  <View style={{position:'absolute',bottom:12,left:12,right:12,paddingVertical:10,paddingHorizontal:12,borderRadius:14,backgroundColor:colors.background+'E6',flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}>
   <Pressable accessibilityRole="button" accessibilityLabel="画像をアップロード" disabled={busy} onPress={()=>void capture(true)} style={{width:72,minHeight:44,alignItems:'center',justifyContent:'center',gap:5,opacity:busy?.4:1}}><RoyalIcon name="upload" size={21} color={colors.gold}/><Text style={{fontSize:10,fontWeight:'600',color:colors.gold}}>アップロード</Text></Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel="撮影して検索" accessibilityState={{busy,disabled}} disabled={disabled} onPress={()=>void capture()} style={({pressed})=>({width:60,height:60,borderRadius:30,borderWidth:2,borderColor:colors.gold,padding:5,opacity:disabled?.45:pressed?.7:1})}>{busy?<ActivityIndicator color={colors.gold} style={{flex:1}}/>:<View style={{flex:1,borderRadius:24,backgroundColor:colors.gold}}/>}</Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel="手動で検索" disabled={busy} onPress={onManual} style={{width:72,minHeight:44,alignItems:'center',justifyContent:'center',gap:5,opacity:busy?.4:1}}><RoyalIcon name="search" size={21} color={colors.gold}/><Text style={{fontSize:10,fontWeight:'600',color:colors.gold}}>手動で検索</Text></Pressable>
  </View>
 </View>;
}
