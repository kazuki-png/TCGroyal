import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
vi.mock('../../../mobile/node_modules/react/index.js',()=>vi.importActual('react'));
vi.mock('../../../mobile/src/RoyalIcon',()=>({RoyalIcon:()=>null}));
vi.mock('../../../mobile/node_modules/react-native/index.js',()=>({
 StyleSheet:{create:(s:unknown)=>s,hairlineWidth:1},
 View:({children,testID,accessibilityLabel}:any)=><div data-testid={testID} aria-label={accessibilityLabel}>{children}</div>,
 Text:({children}:any)=><span>{children}</span>,Image:({source}:any)=><img src={source.uri} alt="card"/>,
 Pressable:({children,onPress,accessibilityLabel,accessibilityState,disabled}:any)=><button aria-label={accessibilityLabel} aria-pressed={accessibilityState?.selected} disabled={disabled} onClick={onPress}>{children}</button>,
 RefreshControl:({onRefresh}:any)=><button onClick={onRefresh}>pull-refresh</button>,
 FlatList:({data,renderItem,ListHeaderComponent,ListEmptyComponent,refreshControl}:any)=><div>{refreshControl}{ListHeaderComponent}{data.length?data.map((item:any)=><div key={item.id}>{renderItem({item})}</div>):ListEmptyComponent}</div>,
}));
import {InboxScreen} from '../../../mobile/src/screens/InboxScreen';
const items=[{id:'one',title:'カードを受領しました',body:'非表示のカード内訳',date:'2026-11-21T00:00:00Z',dateLabel:'更新',target:'loans' as const,imageUrl:'https://example.com/card.jpg',cardCount:2},{id:'two',title:'返済を確認しました',body:'非表示の内訳',date:'2026-11-20T00:00:00Z',dateLabel:'更新',target:'loans' as const,cardCount:2}];
afterEach(cleanup);
it('renders compact rows, toggles unread-only, marks only unread IDs, and retains pull refresh',()=>{
 const onRead=vi.fn().mockResolvedValue(true),onOpen=vi.fn(),onRefresh=vi.fn();
 render(<InboxScreen items={items} readIds={['two']} ready saving={false} error="" onRead={onRead} onOpen={onOpen} onRefresh={onRefresh} refreshing={false} now={Date.parse('2026-11-21T03:00:00Z')}/>);
 expect(screen.queryByText('お知らせを更新')).toBeNull();expect(screen.queryByText('未読')).toBeNull();expect(screen.queryByText('非表示のカード内訳')).toBeNull();
 expect(screen.getAllByTestId('unread-dot')).toHaveLength(1);expect(screen.getByText('09:00')).toBeTruthy();expect(screen.getByText('11/20')).toBeTruthy();
 expect(screen.getByLabelText('複数枚のカード')).toBeTruthy();expect(screen.getByRole('img')).toHaveAttribute('src','https://example.com/card.jpg');
 fireEvent.click(screen.getByLabelText('すべて既読にする'));expect(onRead).toHaveBeenCalledWith(['one']);
 fireEvent.click(screen.getByLabelText('未読のみ表示'));expect(screen.queryByText('返済を確認しました')).toBeNull();
 expect(screen.getByLabelText('未読のみ表示')).toHaveAttribute('aria-pressed','true');
 fireEvent.click(screen.getByRole('button',{name:/未読。カードを受領/}));expect(onOpen).toHaveBeenCalledWith(items[0]);
 fireEvent.click(screen.getByText('pull-refresh'));expect(onRefresh).toHaveBeenCalledOnce();
});
