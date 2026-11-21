import {useState} from 'react';
import {FlatList,Image,Pressable,RefreshControl,StyleSheet,Text,View} from 'react-native';
import {RoyalIcon} from '../RoyalIcon';
import {colors} from '../theme';
import {inboxDateLabel,type InboxItem} from '../inbox';

function Thumbnail({item}:{item:InboxItem}){
 const [failed,setFailed]=useState(false);
 if((!item.imageUrl||failed)&&(item.cardCount??0)>1)return <View accessibilityLabel="複数枚のカード" style={styles.thumbnail}><View style={[styles.stack,{transform:[{rotate:'-12deg'}],left:5,top:5}]}/><View style={[styles.stack,{transform:[{rotate:'8deg'}],left:14,top:9}]}/><View style={[styles.stack,{left:10,top:14,backgroundColor:colors.surface}]}><RoyalIcon name="transactions" size={16}/></View></View>;
 return <View style={styles.thumbnail}>{item.imageUrl&&!failed?<Image source={{uri:item.imageUrl}} alt="" accessible={false} resizeMode="contain" onError={()=>setFailed(true)} style={{width:40,height:54}}/>:<RoyalIcon name={item.target==='account'?'person':'transactions'} size={24} color={colors.goldMuted}/>}</View>;
}
export function InboxScreen({items,readIds,ready,saving,error,onRead,onOpen,onRefresh,refreshing,now}:{
 items:InboxItem[];readIds:string[];ready:boolean;saving:boolean;error:string;
 onRead:(ids:string[])=>Promise<boolean>;onOpen:(item:InboxItem)=>void;onRefresh:()=>void;refreshing:boolean;now:number;
}){
 const [unreadOnly,setUnreadOnly]=useState(false);
 const read=new Set(readIds),unread=items.filter(item=>!read.has(item.id));
 const visible=unreadOnly&&ready?unread:items;
 return <View style={styles.screen}>
  <FlatList data={visible} keyExtractor={item=>item.id} contentContainerStyle={styles.list} alwaysBounceVertical
   refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold}/>}
   ListHeaderComponent={error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:undefined}
   ListEmptyComponent={<Text style={styles.empty}>{unreadOnly?'未読のお知らせはありません':'お知らせはまだありません'}</Text>}
   renderItem={({item})=>{
    const isUnread=ready&&!read.has(item.id);
    return <Pressable accessibilityRole="button" accessibilityLabel={`${isUnread?'未読。':''}${item.title}。${inboxDateLabel(item.notificationDate??item.date,now)}${(item.cardCount??0)>1?'。複数枚のカード':''}`} onPress={()=>{onOpen(item);if(ready&&!saving)void onRead([item.id]);}} style={({pressed})=>[styles.row,isUnread&&styles.unreadRow,pressed&&{opacity:.65}]}>
     <Thumbnail key={item.imageUrl??'missing'} item={item}/><View style={styles.message}><Text numberOfLines={2} style={[styles.title,isUnread&&styles.unreadTitle]}>{item.title}</Text>{item.urgent&&<Text style={styles.urgent}>要確認</Text>}</View>
     <View style={styles.trailing}><Text style={[styles.time,isUnread&&{color:colors.gold}]}>{inboxDateLabel(item.notificationDate??item.date,now)}</Text>{isUnread&&<View testID="unread-dot" style={styles.dot}/>}</View>
    </Pressable>;
   }}/>
  <View pointerEvents="box-none" style={styles.actions}>
   <Pressable accessibilityRole="button" accessibilityLabel="すべて既読にする" disabled={!ready||saving||!unread.length} onPress={()=>void onRead(unread.map(item=>item.id))} style={({pressed})=>[styles.filter,{opacity:!ready||saving||!unread.length?.45:pressed?.8:1}]}><RoyalIcon name="check" size={19}/><Text style={styles.filterText}>すべて既読</Text></Pressable>
  <Pressable accessibilityRole="button" accessibilityLabel="未読のみ表示" accessibilityState={{selected:unreadOnly,disabled:!ready}} disabled={!ready} onPress={()=>setUnreadOnly(value=>!value)} style={({pressed})=>[styles.filter,unreadOnly&&styles.filterSelected,pressed&&{opacity:.8}]}><RoyalIcon name={unreadOnly?'check':'mail'} size={19} color={unreadOnly?'#ffffff':colors.gold}/><Text style={[styles.filterText,unreadOnly&&{color:'#ffffff'}]}>未読のみ表示</Text></Pressable>
  </View>
 </View>;
}
const styles=StyleSheet.create({
 screen:{flex:1,backgroundColor:colors.surface},list:{flexGrow:1,paddingBottom:92},
 actions:{position:'absolute',bottom:18,left:16,right:16,flexDirection:'row',justifyContent:'space-between',gap:8},
 row:{minHeight:82,paddingHorizontal:16,paddingVertical:12,flexDirection:'row',alignItems:'center',gap:12,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},unreadRow:{backgroundColor:'#edf5fb'},
 thumbnail:{width:46,height:56,alignItems:'center',justifyContent:'center'},stack:{position:'absolute',width:29,height:38,borderWidth:1,borderColor:colors.goldMuted,borderRadius:4,backgroundColor:colors.active,alignItems:'center',justifyContent:'center'},
 message:{flex:1},title:{fontSize:14,lineHeight:21,fontWeight:'400',color:colors.muted},unreadTitle:{fontWeight:'700',color:colors.text},
 trailing:{alignSelf:'stretch',alignItems:'flex-end',gap:8,minWidth:42},time:{fontSize:11,color:colors.muted},dot:{width:6,height:6,borderRadius:3,backgroundColor:colors.gold},urgent:{fontSize:10,color:'#b42338',marginTop:3},
 filter:{minHeight:48,paddingHorizontal:12,borderRadius:16,flexDirection:'row',alignItems:'center',gap:6,backgroundColor:colors.active,borderWidth:1,borderColor:colors.border,shadowColor:'#18354b',shadowOffset:{width:0,height:3},shadowOpacity:.16,shadowRadius:6,elevation:4},filterSelected:{backgroundColor:colors.gold,borderColor:colors.gold},filterText:{fontSize:13,fontWeight:'600',color:colors.gold},
 empty:{padding:28,textAlign:'center',fontSize:14,color:colors.muted},error:{margin:12,padding:12,color:'#b42338',backgroundColor:'#fff1f2',borderRadius:8},
});
