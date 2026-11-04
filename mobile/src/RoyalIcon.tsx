import {Image,type ImageStyle,type StyleProp} from 'react-native';
import home from '../assets/icons/cman/home.png';
import transactions from '../assets/icons/cman/transactions.png';
import plus from '../assets/icons/cman/plus.png';
import mail from '../assets/icons/cman/mail.png';
import person from '../assets/icons/cman/person.png';
import search from '../assets/icons/cman/search.png';
import upload from '../assets/icons/cman/upload.png';
import close from '../assets/icons/cman/close.png';
import history from '../assets/icons/cman/history.png';
import lock from '../assets/icons/cman/lock.png';
import document from '../assets/icons/cman/document.png';
import chat from '../assets/icons/cman/chat.png';
import bell from '../assets/icons/cman/bell.png';
import right from '../assets/icons/cman/right.png';
import arrow from '../assets/icons/cman/arrow.png';
import check from '../assets/icons/cman/check.png';
import minus from '../assets/icons/cman/minus.png';
import balance from '../assets/icons/cman/balance.png';
import cart from '../assets/application-cart.png';
import {colors} from './theme';

const images={home,transactions,plus,mail,person,search,upload,close,history,lock,document,chat,bell,right,back:right,down:right,logout:arrow,check,minus,balance,cart};
export type RoyalIconName=keyof typeof images;
// Local, source-tracked cman artwork. No remote image requests or icon fonts.
export function RoyalIcon({name,size=24,color=colors.gold,style}:{name:RoyalIconName;size?:number;color?:string;style?:StyleProp<ImageStyle>}){
 const navigation=name==='right'||name==='back'||name==='down';
 const iconSize=navigation?Math.min(size,10):size;
 const rotation=name==='back'||name==='logout'?'180deg':name==='down'?'90deg':undefined;
 return <Image source={images[name]} alt="" accessible={false} importantForAccessibility="no" resizeMode="contain" style={[{width:iconSize,height:iconSize,tintColor:color,opacity:navigation?.65:1},rotation&&{transform:[{rotate:rotation}]},style]}/>;
}
