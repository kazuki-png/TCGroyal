import {useState} from 'react'
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
vi.mock('../../../mobile/src/ui.tsx',()=>({ui:{},RoyalSwitch:({value,onValueChange}:{value:boolean;onValueChange:(value:boolean)=>void})=><input aria-label="査定依頼の登録に同意する" type="checkbox" checked={value} onChange={event=>onValueChange(event.target.checked)}/>,Field:({label,value,onChangeText}:{label:string;value:string;onChangeText:(value:string)=>void})=><input aria-label={label} value={value} onChange={event=>onChangeText(event.target.value)}/>,yen:(value:number)=>'¥'+value.toLocaleString('ja-JP'),Button:({title,onPress,disabled}:{title:string;onPress:()=>void;disabled?:boolean})=><button onClick={onPress} disabled={disabled}>{title}</button>}))
vi.mock('../../../mobile/src/use-app-back.ts',()=>({useAppBack:()=>{}}))
const api=vi.hoisted(()=>vi.fn());vi.mock('../../../mobile/src/api.ts',()=>({lendingApi:api}))
vi.mock('../../../mobile/node_modules/expo-crypto/build/Crypto.js',()=>({randomUUID:()=>crypto.randomUUID()}));
import {CollateralBasket} from '../../../mobile/src/screens/CollateralBasket'
const first:CollateralItem={id:'10000000-0000-4000-8000-000000000001',name:'カートのピカチュウ',cardNumber:'150/XY-P',quantity:1,grade:'PSA10',condition:'',source:'snkrdunk',productId:'91395',cardUid:null,imageUrl:'https://cdn.snkrdunk.com/card.webp'};
const accepted={case:{id:'case',reference:'TR-123456789ABC'}};
afterEach(()=>{cleanup();vi.resetAllMocks()});
function quote(items:CollateralItem[]){return {estimate:{amountJpy:100000*items.reduce((n,item)=>n+item.quantity,0),expiresAt:new Date(Date.now()+300000).toISOString(),lines:items.map(item=>({id:item.id,amountJpy:100000*item.quantity})),reason:''}}}
function Harness({onApplied=async()=>{},changed=()=>{}}:{onApplied?:()=>Promise<void>;changed?:(items:CollateralItem[])=>void}){const [items,setItems]=useState([first]);return <CollateralBasket items={items} active onChange={values=>{changed(values);setItems(values)}} onApplied={onApplied} onBack={()=>{}} onReset={()=>{}}/>}
function agree(){fireEvent.click(screen.getByLabelText('査定依頼の登録に同意する'))}
describe('one-page application cart',()=>{
 it('submits the selected cards and requested amount from the cart without a second form',async()=>{
  api.mockImplementation(async(path,options)=>path==='/catalog'?quote(options.body.items):accepted);const changed=vi.fn();render(<Harness changed={changed}/>);
  expect(screen.getByText('現在の融資申込カード')).toBeTruthy();expect(screen.getByLabelText('融資希望額（円・任意）')).toBeTruthy();expect(screen.queryByText('まとめて申込')).toBeNull();expect(screen.queryByText('カードをまとめて査定依頼')).toBeNull();
  expect((screen.getByText('申請する') as HTMLButtonElement).disabled).toBe(true);fireEvent.change(screen.getByLabelText('融資希望額（円・任意）'),{target:{value:'250000'}});fireEvent.click(screen.getByText('相談内容を追加（任意）'));fireEvent.change(screen.getByLabelText('相談内容（任意）'),{target:{value:'相談メモ'}});fireEvent.click(screen.getByText('相談内容を閉じる'));expect(screen.queryByLabelText('相談内容（任意）')).toBeNull();agree();fireEvent.click(screen.getByText('申請する'));
  expect(await screen.findByText('TR-123456789ABC')).toBeTruthy();const request=api.mock.calls.find(([path])=>path==='/support-cases')![1].body;expect(request.draft).toMatchObject({requestedAmount:'250000',notes:'相談メモ',reason:'other',items:[first]});expect(request.consent).toBe(true);expect(changed).toHaveBeenCalledWith([]);
 });
 it('keeps the draft on a failed request and retries with the same idempotency key',async()=>{
  let tries=0;api.mockImplementation(async(path,options)=>{if(path==='/catalog')return quote(options.body.items);if(++tries===1)throw Error('通信失敗');return accepted});const changed=vi.fn();render(<Harness changed={changed}/>);agree();fireEvent.click(screen.getByText('申請する'));expect(await screen.findByText('通信失敗')).toBeTruthy();expect(changed).not.toHaveBeenCalled();expect(screen.getByText(first.name)).toBeTruthy();fireEvent.click(screen.getByText('申請する'));expect(await screen.findByText('TR-123456789ABC')).toBeTruthy();const requests=api.mock.calls.filter(([path])=>path==='/support-cases');expect(requests).toHaveLength(2);expect(requests[0][1].body.key).toBe(requests[1][1].body.key);
 });
 it('edits a card in the enlargement and requires consent again after its quantity changes',async()=>{
  api.mockImplementation(async(path,options)=>path==='/catalog'?quote(options.body.items):accepted);render(<Harness/>);agree();fireEvent.click(screen.getByRole('button',{name:first.name+'を拡大表示'}));fireEvent.change(screen.getByLabelText('枚数'),{target:{value:'2'}});fireEvent.click(screen.getByText('変更を保存'));expect(screen.queryByRole('dialog')).toBeNull();expect(screen.getByText('2枚')).toBeTruthy();expect((screen.getByText('申請する') as HTMLButtonElement).disabled).toBe(true);expect(await screen.findByText('参考額 ¥200,000',{}, {timeout:2500})).toBeTruthy();
 });
 it('does not permit an out-of-range amount and does not resubmit after receipt-refresh failure',async()=>{
  api.mockImplementation(async(path,options)=>path==='/catalog'?quote(options.body.items):accepted);render(<Harness onApplied={async()=>{throw Error('reload failed')}}/>);fireEvent.change(screen.getByLabelText('融資希望額（円・任意）'),{target:{value:'10000001'}});agree();expect((screen.getByText('申請する') as HTMLButtonElement).disabled).toBe(true);fireEvent.change(screen.getByLabelText('融資希望額（円・任意）'),{target:{value:''}});agree();fireEvent.click(screen.getByText('申請する'));expect(await screen.findByText('TR-123456789ABC')).toBeTruthy();expect(await screen.findByText('申請は受付済みです。取引状況を更新して確認してください。')).toBeTruthy();expect(screen.queryByText('申請する')).toBeNull();expect(api.mock.calls.filter(([path])=>path==='/support-cases')).toHaveLength(1);
 });
});
