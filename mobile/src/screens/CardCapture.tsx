import {useEffect,useRef,useState} from 'react';
import {ActivityIndicator,AppState,Linking,Pressable,StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import {CameraView,useCameraPermissions} from 'expo-camera';
import {selectCardImage} from '../select-card-image';
import {Button,ui} from '../ui';
import {colors} from '../theme';
import {RoyalIcon} from '../RoyalIcon';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ApplicationCartButton} from './ApplicationCartButton';

export function CardCapture({onCapture,onManual,onBasket,onClose,error:outerError}:{onCapture:(uri:string)=>void;onManual:()=>void;onBasket:()=>void;onClose:()=>void;error?:string}){
 const {width,height}=useWindowDimensions(),insets=useSafeAreaInsets();
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
  <View pointerEvents="none" style={[StyleSheet.absoluteFill,{justifyContent:'center',alignItems:'center',paddingBottom:110}]}>
   <View style={{width:Math.min(width*.72,height*.50*63/88),aspectRatio:63/88,borderWidth:2,borderColor:colors.gold,borderRadius:14}}/>
  </View>
  <View style={{position:'absolute',top:insets.top+12,left:16,right:16,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
   <Pressable accessibilityRole="button" accessibilityLabel="撮影画面を閉じる" disabled={busy} onPress={onClose} style={{width:52,height:52,borderRadius:26,backgroundColor:'#00000099',alignItems:'center',justifyContent:'center'}}><RoyalIcon name="close" size={26} color="#fff"/></Pressable>
   <ApplicationCartButton onPress={onBasket} disabled={busy}/>
  </View>
  {!!(error||outerError)&&<Text accessibilityRole="alert" style={[ui.error,{position:'absolute',top:insets.top+76,left:16,right:16}]}>{error||outerError}</Text>}
  <View style={{position:'absolute',bottom:Math.max(insets.bottom,12)+18,left:16,right:16,paddingVertical:16,paddingHorizontal:8,borderRadius:26,backgroundColor:'#00000088',flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}>
   <Pressable accessibilityRole="button" accessibilityLabel="画像をアップロード" disabled={busy} onPress={()=>void capture(true)} style={{width:84,minHeight:76,alignItems:'center',justifyContent:'center',gap:8,opacity:busy?.4:1}}><RoyalIcon name="upload" size={30} color="#fff"/><Text style={{fontSize:12,fontWeight:'700',color:'#fff'}}>アップロード</Text></Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel="撮影して検索" accessibilityState={{busy,disabled}} disabled={disabled} onPress={()=>void capture()} style={({pressed})=>({width:82,height:82,borderRadius:41,borderWidth:4,borderColor:'#fff',padding:5,opacity:disabled?.45:pressed?.7:1})}>{busy?<ActivityIndicator color="#fff" style={{flex:1}}/>:<View style={{flex:1,borderRadius:36,backgroundColor:'#fff'}}/>}</Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel="手動で検索" disabled={busy} onPress={onManual} style={{width:84,minHeight:76,alignItems:'center',justifyContent:'center',gap:8,opacity:busy?.4:1}}><RoyalIcon name="search" size={30} color="#fff"/><Text style={{fontSize:12,fontWeight:'700',color:'#fff'}}>手動で検索</Text></Pressable>
  </View>
 </View>;
}
