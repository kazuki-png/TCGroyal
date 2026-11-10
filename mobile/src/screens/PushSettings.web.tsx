import {Text,View} from 'react-native';
import {ui} from '../ui';
export function PushSettings(){return <View style={ui.card}><Text style={ui.title}>通知設定</Text><Text style={ui.body}>プッシュ通知はAndroid版をご利用ください。ブラウザ版でも「お知らせ」を確認できます。</Text></View>}
