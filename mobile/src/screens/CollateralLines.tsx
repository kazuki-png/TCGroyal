import {Text,View} from 'react-native';
import type {CollateralItem} from '../../../lib/lending/collateral-types';
import {collateralQuantity} from '../../../lib/lending/collateral-types';
import {ui} from '../ui';
export function CollateralLines({items=[]}:{items?:CollateralItem[]}){
 if(!items.length)return null;
 return <View style={{gap:8}}><Text style={ui.label}>担保カード / {items.length}種類・{collateralQuantity(items)}枚</Text>{items.map((item,index)=><View key={item.id}><Text style={ui.body}>{index+1}. {item.name} × {item.quantity}枚</Text><Text style={ui.muted}>{item.cardNumber} / {item.grade||'鑑定・グレード未申告'} / {item.condition||'状態確認待ち'}</Text></View>)}</View>;
}
