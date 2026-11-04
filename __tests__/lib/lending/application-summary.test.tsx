import {useState} from 'react'
import {afterEach,describe,it,expect,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
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
const api=vi.hoisted(()=>vi.fn());vi.mock('../../../mobile/src/api.ts',()=>({lendingApi:api}))
import {ApplicationSummary} from '../../../mobile/src/screens/ApplicationSummary'
const first:CollateralItem={id:'a',name:'長いカード名のピカチュウ サンプル [SV 001/100]',cardNumber:'001/100',quantity:2,grade:'PSA10',condition:'',source:'snkrdunk',productId:'123',cardUid:null,imageUrl:'https://cdn.snkrdunk.com/card.webp'}
const second:CollateralItem={...first,id:'b',name:'ライチュウ',quantity:3,grade:'未鑑定',source:'manual',productId:null,imageUrl:null}
afterEach(()=>{cleanup();vi.resetAllMocks()})
const quote=(items:CollateralItem[])=>({estimate:{amountJpy:items.every(item=>item.grade==='PSA10')?200000:null,expiresAt:new Date(Date.now()+300000).toISOString(),calculatedAt:new Date().toISOString(),reason:'個別査定が必要です。',lines:items.map(item=>({id:item.id,name:item.name,quantity:item.quantity,amountJpy:item.grade==='PSA10'?200000:null,reason:'申告内容を確認します。'}))}})
function Harness(){const [items,setItems]=useState([first,second]);return <ApplicationSummary items={items} active onRemove={id=>setItems(values=>values.filter(item=>item.id!==id))} onContinue={()=>{}} onProceed={()=>{}}/>}
describe('compact application summary',()=>{
 it('shows quantities and per-card amount, distinguishes manual items from a complete total and opens the full name/image',async()=>{
  api.mockImplementation(async(_path,options)=>quote(options.body.items));render(<Harness/>);
  expect(screen.getByText(first.name).getAttribute('data-lines')).toBe('2');expect(screen.getByText('2枚')).toBeTruthy();expect(screen.getByText('3枚')).toBeTruthy()
  expect(await screen.findByText('参考額 ¥200,000',{}, {timeout:2500})).toBeTruthy();expect(screen.getByText('算出済み小計（参考）')).toBeTruthy();expect(screen.getByText('¥200,000 ＋ 個別査定')).toBeTruthy();expect(screen.getByText('個別査定')).toBeTruthy()
  expect(api).toHaveBeenCalledTimes(1);expect(api.mock.calls[0][1].body.items).toHaveLength(2)
  fireEvent.click(screen.getByRole('button',{name:first.name+'を拡大表示'}));expect(screen.getByRole('dialog')).toBeTruthy();expect(screen.getByRole('img',{name:first.name+'の拡大画像'})).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'閉じる'}));expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:second.name+'を申込から削除'}));await waitFor(()=>expect(screen.getByText('融資可能額 合計（参考）')).toBeTruthy(),{timeout:2500});expect(await screen.findByText('¥200,000')).toBeTruthy();expect(api.mock.calls.at(-1)[1].body.items).toHaveLength(1)
 })
 it('keeps checkout available after quote failure and permits retry without showing a false zero',async()=>{
  api.mockRejectedValueOnce(Error('通信できません')).mockImplementation(async()=>quote([first]));const proceed=vi.fn();render(<ApplicationSummary items={[first]} active onRemove={()=>{}} onContinue={()=>{}} onProceed={proceed}/>);
  expect(await screen.findByText('通信できません',{}, {timeout:2500})).toBeTruthy();expect(screen.queryByText('¥0')).toBeNull();fireEvent.click(screen.getByText('申請に進む'));expect(proceed).toHaveBeenCalledOnce();fireEvent.click(screen.getByText('参考額を再計算'));expect(await screen.findByText('¥200,000',{}, {timeout:2500})).toBeTruthy()
 })
})
