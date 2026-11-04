import {useEffect,useRef,useState,type ComponentRef} from 'react';
import {AppState,Image,Linking,Pressable,ScrollView,View} from 'react-native';
import {supabaseAuth} from '../supabase-auth';
import {colors} from '../theme';
import homeBanner from '../../assets/home-banner.png';

type Banner={id:string;title:string;image_url:string;link_url:string};
const webOrigin='https://tcg-royal-git-develop-collectorsrepublic.vercel.app';
export function HomeBanners({active=true}:{active?:boolean}){
 const [banners,setBanners]=useState<Banner[]>([]),[index,setIndex]=useState(0),[width,setWidth]=useState(0),[foreground,setForeground]=useState(AppState.currentState==='active');
 const scroll=useRef<ComponentRef<typeof ScrollView>>(null);
 useEffect(()=>{const subscription=AppState.addEventListener('change',value=>setForeground(value==='active'));return()=>subscription.remove()},[]);
 useEffect(()=>{
  if(!active)return;let live=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  void Promise.resolve(supabaseAuth.from('homepage_banners').select('id,title,image_url,link_url').eq('is_active',true).order('sort_order',{ascending:true}).order('created_at',{ascending:false}).limit(20).abortSignal(controller.signal))
   .then(({data,error})=>{if(live&&!error){setBanners((data??[]).filter(row=>{try{const url=new URL(row.image_url);return url.protocol==='https:'&&!url.username&&!url.password}catch{return false}}));setIndex(0)}})
   .catch(()=>{}).finally(()=>clearTimeout(timer));
  return()=>{live=false;clearTimeout(timer);controller.abort()};
 },[active]);
 useEffect(()=>{if(!active||!foreground||banners.length<2)return;const timer=setInterval(()=>setIndex(value=>(value+1)%banners.length),4200);return()=>clearInterval(timer)},[active,foreground,banners.length]);
 useEffect(()=>{if(width)scroll.current?.scrollTo({x:index*width,animated:true})},[index,width]);
 function open(link:string){if(!link||link==='#')return;try{const url=new URL(link,webOrigin);if(url.protocol==='https:'&&!url.username&&!url.password)void Linking.openURL(url.href).catch(()=>{})}catch{}}
 return <View accessibilityLabel="おすすめバナー" onLayout={event=>setWidth(event.nativeEvent.layout.width)} style={{backgroundColor:colors.surface,borderRadius:12,overflow:'hidden',borderWidth:1,borderColor:colors.border}}>
  {banners.length?<><ScrollView ref={scroll} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={event=>{if(width)setIndex(Math.max(0,Math.min(banners.length-1,Math.round(event.nativeEvent.contentOffset.x/width))))}}>{banners.map(banner=><Pressable key={banner.id} accessibilityRole={banner.link_url&&banner.link_url!=='#'?'link':'image'} accessibilityLabel={banner.title||'TCG ROYAL バナー'} onPress={()=>open(banner.link_url)} style={{width,height:148}}><Image alt={banner.title} source={{uri:banner.image_url}} style={{width:'100%',height:'100%'}} resizeMode="contain"/></Pressable>)}</ScrollView>{banners.length>1&&<View style={{position:'absolute',bottom:6,left:0,right:0,flexDirection:'row',justifyContent:'center',gap:2}}>{banners.map((banner,i)=><Pressable key={banner.id} accessibilityRole="button" accessibilityLabel={`${i+1}枚目のバナーを表示`} accessibilityState={{selected:i===index}} onPress={()=>setIndex(i)} style={{width:32,height:28,alignItems:'center',justifyContent:'center'}}><View style={{width:i===index?18:6,height:6,borderRadius:3,backgroundColor:i===index?colors.gold:colors.muted}}/></Pressable>)}</View>}</>:<Pressable accessibilityRole="link" accessibilityLabel="TCG ROYAL バナー" onPress={()=>open('https://www.tcg-royal.com')} style={{width:'100%',aspectRatio:8/3}}><Image alt="TCG ROYAL バナー" source={homeBanner} style={{width:'100%',height:'100%'}} resizeMode="contain"/></Pressable>}
 </View>;
}
