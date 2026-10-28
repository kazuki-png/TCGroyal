import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, date, ui } from '../ui';
import type { InboxItem } from '../inbox';

export function InboxScreen({ items, readIds, ready, saving, error, onRead, onOpen, onRefresh, refreshing }: {
  items: InboxItem[]; readIds: string[]; ready: boolean; saving: boolean; error: string;
  onRead: (ids: string[]) => Promise<boolean>; onOpen: (item: InboxItem) => void;
  onRefresh: () => void; refreshing: boolean;
}) {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const read = new Set(readIds);
  const unread = items.filter(item => !read.has(item.id));
  const visible = unreadOnly ? unread : items;
  return <View style={{ gap: 18 }}>
    {error ? <Text accessibilityRole="alert" style={ui.error}>{error}</Text> : null}
    <View style={ui.row}>
      <View style={{ flex: 1 }}><Button title="すべて" secondary={unreadOnly} onPress={() => setUnreadOnly(false)}/></View>
      <View style={{ flex: 1 }}><Button title={`未読${ready ? ` ${unread.length}` : ''}`} secondary={!unreadOnly} onPress={() => setUnreadOnly(true)}/></View>
    </View>
    <Button title="お知らせを更新" secondary disabled={refreshing} onPress={onRefresh}/>
    <Button title="すべて既読にする" secondary disabled={!ready || saving || unread.length === 0} onPress={() => void onRead(items.map(item => item.id))}/>
    {!visible.length && <View style={ui.card}><Text style={ui.title}>{unreadOnly ? '未読のお知らせはありません' : 'お知らせはまだありません'}</Text><Text style={ui.muted}>申込・書類確認の更新や、返済期限のご案内をこちらに表示します。</Text></View>}
    {visible.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${ready && !read.has(item.id) ? '未読。' : ''}${item.title}。${item.body}`} disabled={saving} onPress={() => { if (ready) void onRead([item.id]).then(() => onOpen(item)); else onOpen(item); }} style={[ui.card, ready && !read.has(item.id) && { borderColor: '#b69b50' }]}>
      <View style={ui.row}>{ready && !read.has(item.id) && <Text style={{ color: '#fcd66e', fontSize: 12, fontWeight: '700' }}>未読</Text>}{item.urgent && <Text style={{ color: '#fda4af', fontSize: 12 }}>要確認</Text>}</View>
      <Text style={ui.title}>{item.title}</Text><Text style={ui.body}>{item.body}</Text>
      <Text style={ui.muted}>{item.dateLabel} {date(item.date)}</Text>
      <Text style={{ color: '#fcd66e', fontSize: 13 }}>{item.target === 'loans' ? '貸付状況を確認する ›' : 'マイページを確認する ›'}</Text>
    </Pressable>)}
    <Text style={ui.muted}>最近の申込・書類・査定情報を表示しています。既読状態はこの端末に保存されます。</Text>
  </View>;
}
