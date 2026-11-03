import {useState} from 'react'
import {afterEach,describe,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import type {CollateralItem} from '@/lib/lending/collateral-types'
vi.mock('../../../mobile/node_modules/react/index.js',()=>vi.importActual('react'))
vi.mock('../../../mobile/node_modules/react-native/index.js',()=>({
 ScrollView:({children}:{children:React.ReactNode})=><div>{children}</div>,View:({children}:{children:React.ReactNode})=><div>{children}</div>,Text:({children}:{children:React.ReactNode})=><span>{children}</span>,
 Image:({accessible}:{accessible?:boolean})=>accessible===false?null:<span role="img" aria-label="card"/>,ActivityIndicator:()=> <span>loading</span>,Keyboard:{dismiss:vi.fn()},useWindowDimensions:()=>({width:390,fontScale:1}),
 Pressable:({children,onPress,accessibilityLabel}:{children:React.ReactNode;onPress:()=>void;accessibilityLabel:string})=><button aria-label={accessibilityLabel} onClick={onPress}>{children}</button>,
}))
vi.mock('../../../mobile/node_modules/expo-crypto/build/Crypto.js',()=>({randomUUID:()=>crypto.randomUUID()}))
vi.mock('../../../mobile/src/ui.tsx',()=>({ui:{},Button:({title,onPress,disabled}:{title:string;onPress:()=>void;disabled?:boolean})=><button onClick={onPress} disabled={disabled}>{title}</button>,Field:({label,value,onChangeText}:{label:string;value:string;onChangeText:(value:string)=>void})=><input aria-label={label} value={value} onChange={event=>onChangeText(event.target.value)}/>}))
vi.mock('../../../mobile/src/screens/CardCapture.tsx',()=>({CardCapture:({onCapture,onManual,onBasket}:{onCapture:(uri:string)=>void;onManual:()=>void;onBasket:()=>void})=><><button onClick={()=>onCapture('file:///fixture.jpg')}>撮影して検索</button><button onClick={onManual}>手動で検索</button><button onClick={onBasket}>申込リストを確認</button></>}))
vi.mock('../../../mobile/src/image-upload.ts',()=>({appendImageFile:(form:FormData)=>form.append('file',new Blob(['fixture'],{type:'image/jpeg'}),'fixture.jpg')}))
vi.mock('../../../mobile/src/use-app-back.ts',()=>({useAppBack:()=>{}}))
vi.mock('../../../mobile/src/screens/CollateralBasket.tsx',()=>({CollateralBasket:()=> <span>申請内容を確認</span>}))
vi.mock('../../../mobile/src/screens/ReferenceEstimate.tsx',()=>({ReferenceEstimate:({estimate}:{estimate:{amountJpy:number}|null})=><span>{estimate?'参考額 '+estimate.amountJpy:'参考額を計算中'}</span>}))
const api=vi.hoisted(()=>vi.fn())
const pickImage=vi.hoisted(()=>vi.fn())
vi.mock('../../../mobile/node_modules/expo-image-picker/src/ImagePicker.ts',()=>({launchImageLibraryAsync:pickImage}))
vi.mock('../../../mobile/src/api.ts',()=>({lendingApi:api}))
import {ApplicationScreen} from '../../../mobile/src/screens/ApplicationScreen'
const card={id:'external:123',kind:'external',productId:'123',cardUid:null,name:'ピカチュウ',cardNumber:'132/106',category:'pokemon',imageUrl:'https://cdn.snkrdunk.com/card.webp'}
function Harness({onCameraModeChange}:{onCameraModeChange?:(value:boolean)=>void}={}){const [items,setItems]=useState<CollateralItem[]>([]);return <ApplicationScreen active ready error="" items={items} onChange={setItems} onApplied={async()=>{}} onCameraModeChange={onCameraModeChange}/>}
afterEach(()=>{cleanup();vi.resetAllMocks()})
function responses(){api.mockImplementation(async(path,options)=>path==='/card-image'?{cards:[card],hints:{name:card.name,cardNumber:card.cardNumber},page:1,hasMore:false,partial:false}:options.body.action==='quote_bundle'?{estimate:{amountJpy:options.body.items[0].grade==='PSA10'?100000:0}}:{cards:[card],page:1,hasMore:false,partial:false})}
describe('camera-first lending application',()=>{
 it('leaves full-screen mode when opening search or the empty basket',()=>{const mode=vi.fn();render(<Harness onCameraModeChange={mode}/>);expect(mode).toHaveBeenLastCalledWith(true);fireEvent.click(screen.getByText('申込リストを確認'));expect(mode).toHaveBeenLastCalledWith(false);expect(screen.getByText('カードがまだ追加されていません。')).toBeTruthy();fireEvent.click(screen.getByText('続けて登録'));expect(mode).toHaveBeenLastCalledWith(true);fireEvent.click(screen.getByText('手動で検索'));expect(mode).toHaveBeenLastCalledWith(false)})
 it('uploads an existing image from manual search and does nothing when selection is cancelled',async()=>{
  responses();pickImage.mockResolvedValueOnce({canceled:true,assets:null}).mockResolvedValueOnce({canceled:false,assets:[{uri:'file:///existing-card.jpg'}]});render(<Harness/>);fireEvent.click(screen.getByText('手動で検索'))
  fireEvent.click(screen.getByText('画像をアップロード'));await waitFor(()=>expect(pickImage).toHaveBeenCalledTimes(1));await screen.findByText('画像をアップロード');expect(api).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('画像をアップロード'));expect(await screen.findByRole('button',{name:'ピカチュウ 132/106 を確認'})).toBeTruthy();expect(api.mock.calls.filter(([path])=>path==='/card-image')).toHaveLength(1)
 })
 it('moves from one photo request to default PSA10 quote, grade change, added list and checkout',async()=>{
  responses();render(<Harness/>);fireEvent.click(screen.getByText('撮影して検索'))
  fireEvent.click(await screen.findByRole('button',{name:'ピカチュウ 132/106 を確認'}));expect(screen.getByRole('button',{name:'グレード PSA10'})).toBeTruthy()
  await screen.findByText('参考額 100000',{}, {timeout:2500})
  fireEvent.click(screen.getByRole('button',{name:'グレード PSA10'}));fireEvent.click(screen.getByRole('button',{name:'未鑑定'}))
  await waitFor(()=>expect(api.mock.calls.some(([,options])=>options.body?.action==='quote_bundle'&&options.body.items[0].grade==='未鑑定')).toBe(true),{timeout:2500})
  fireEvent.click(screen.getByText('申込に追加'));expect(screen.getByText('ピカチュウを申請に追加しました。')).toBeTruthy();expect(screen.getByText('現在の融資申込カード')).toBeTruthy();expect(screen.queryByText('1種類・1枚')).toBeNull();expect(screen.getByRole('img')).toBeTruthy();expect(screen.getByRole('button',{name:'ピカチュウを申込から削除'}).textContent).toBe('')
  fireEvent.click(screen.getByText('続けて登録'));expect(screen.getByText('撮影して検索')).toBeTruthy();expect(screen.getByText('申込リストを確認')).toBeTruthy()
  fireEvent.click(screen.getByText('申込リストを確認'));fireEvent.click(screen.getByText('申請に進む'));expect(screen.getByText('申請内容を確認')).toBeTruthy()
  expect(api.mock.calls.filter(([path])=>path==='/card-image')).toHaveLength(1)
 })
 it('debounces keyword edits and shares the same detail and add flow without an image request',async()=>{
  responses();render(<Harness/>);fireEvent.click(screen.getByText('手動で検索'));const input=screen.getByLabelText('カード名・型番で検索')
  fireEvent.change(input,{target:{value:'13'}});fireEvent.change(input,{target:{value:'132/106'}})
  fireEvent.click(await screen.findByRole('button',{name:'ピカチュウ 132/106 を確認'},{timeout:2500}))
  expect(api.mock.calls.filter(([,options])=>options.body?.action==='discover')).toHaveLength(1)
  expect(api.mock.calls[0][1].body.query).toBe('132/106');fireEvent.click(screen.getByText('申込に追加'));expect(screen.getByText('ピカチュウを申請に追加しました。')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'ピカチュウを申込から削除'}));expect(screen.getByText('カードがまだ追加されていません。')).toBeTruthy();expect(screen.getByRole('button',{name:'申請に進む'}).hasAttribute('disabled')).toBe(true)
  expect(api.mock.calls.some(([path])=>path==='/card-image')).toBe(false)
 })
})
