import {afterEach,describe,it,expect,vi} from 'vitest'
import {cleanup,fireEvent,render,screen} from '@testing-library/react'
import type {CollateralItem} from '@/lib/lending/collateral-types'
vi.mock('../../../mobile/node_modules/react/index.js',()=>vi.importActual('react'))
vi.mock('../../../mobile/node_modules/react-native/index.js',()=>({
 View:({children}:{children:React.ReactNode})=><div>{children}</div>,ScrollView:({children}:{children:React.ReactNode})=><div>{children}</div>,
 Text:({children,numberOfLines}:{children:React.ReactNode;numberOfLines?:number})=><span data-lines={numberOfLines}>{children}</span>,Image:({accessibilityLabel,accessible}:{accessibilityLabel:string;accessible?:boolean})=>accessible===false?null:<span role="img" aria-label={accessibilityLabel}/>,
 Modal:({visible,children}:{visible:boolean;children:React.ReactNode})=>visible?<div role="dialog">{children}</div>:null,
 Pressable:({children,onPress,accessibilityLabel}:{children:React.ReactNode;onPress:()=>void;accessibilityLabel:string})=><button aria-label={accessibilityLabel} onClick={onPress}>{children}</button>,
}))
vi.mock('../../../mobile/src/ui.tsx',()=>({ui:{},yen:(value:number)=>'¥'+value.toLocaleString('ja-JP'),Button:({title,onPress,disabled}:{title:string;onPress:()=>void;disabled?:boolean})=><button onClick={onPress} disabled={disabled}>{title}</button>}))
vi.mock('../../../mobile/src/use-app-back.ts',()=>({useAppBack:()=>{}}))
import {CollateralLines} from '../../../mobile/src/screens/CollateralLines'
const item:CollateralItem={id:'a',name:'コイキングごっこピカチュウ [XY-P 150/XY-P]',cardNumber:'150/XY-P',quantity:2,grade:'PSA10',condition:'',source:'snkrdunk',productId:'91395',cardUid:null,imageUrl:'https://cdn.snkrdunk.com/card.webp'}
afterEach(cleanup)
describe('transaction collateral rows',()=>{
 it('shows compact image rows with quantity and opens a read-only full image',()=>{
  render(<CollateralLines items={[item,{...item,id:'b',name:'手入力カード',imageUrl:null,source:'manual',productId:null}]}/>);
  expect(screen.getByText(item.name).getAttribute('data-lines')).toBe('2');expect(screen.getAllByText('2枚')).toHaveLength(2);expect(screen.getByRole('img',{name:item.name+'の画像'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:item.name+'を拡大表示'}));expect(screen.getByRole('dialog')).toBeTruthy();expect(screen.getByRole('img',{name:item.name+'の拡大画像'})).toBeTruthy();expect(screen.queryByText('変更を保存')).toBeNull();fireEvent.click(screen.getByText('閉じる'));expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'手入力カードを拡大表示'}));expect(screen.getByText('画像なし')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'背景をタップして拡大表示を閉じる'}));expect(screen.queryByRole('dialog')).toBeNull();
 });
 it('renders nothing for legacy transactions without item lines',()=>{const {container}=render(<CollateralLines/>);expect(container.innerHTML).toBe('')});
})
