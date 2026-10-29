// @vitest-environment node
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest'
vi.mock('server-only',()=>({}))
vi.mock('@/lib/security/safeRemoteFetch',()=>({fetchPublicRemoteUrl:vi.fn()}))
import {fetchPublicRemoteUrl} from '@/lib/security/safeRemoteFetch'
import type {CollateralItem} from '@/lib/lending/collateral-types'
const item:CollateralItem={id:'30000000-0000-4000-8000-000000000001',name:'利用者が入力した名前',cardNumber:'SV 001/100',quantity:1,grade:'PSA10',condition:'良好',source:'snkrdunk',productId:'123',cardUid:null}
const product={id:123,localizedName:'正しいカード [SV 001/100]',brands:[{id:'pokemon'}],apparelInfo:{isTradingCard:true},categories:[{name:'trading-card-single'}]}
beforeEach(()=>{vi.resetModules();vi.clearAllMocks();vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-30T03:00:00Z'))})
afterEach(()=>vi.useRealTimers())
function provider(count=150,price=400000){vi.mocked(fetchPublicRemoteUrl).mockImplementation(async url=>url.pathname.endsWith('sales-history')?Response.json({history:Array.from({length:count},()=>({price,date:'1日前',condition:'PSA10',size:''})),minPrice:999999}):Response.json({...product,id:Number(url.pathname.split('/').at(-1))}))}
describe('bundle reference estimates',()=>{
 it('validates server product metadata, derives LTV and never returns raw prices or writes a loan',async()=>{
  provider();const {estimateBundle}=await import('@/lib/lending/bundle-estimate');const result=await estimateBundle([item]);
  expect(result).toMatchObject({status:'reference',amountJpy:200000,lines:[{name:product.localizedName,score:2,ltvPercent:50,amountJpy:200000}]})
  expect(JSON.stringify(result)).not.toMatch(/400000|999999|recentPrices|history|floorPrice/)
  const url=vi.mocked(fetchPublicRemoteUrl).mock.calls[1][0];expect(url.searchParams.get('per_page')).toBe('300');expect(url.searchParams.get('condition_id')).toBe('22')
  await estimateBundle([item]);expect(fetchPublicRemoteUrl).toHaveBeenCalledTimes(2)
 })
 it('aggregates duplicate product rows before applying the quantity guard and coalesces reads',async()=>{
  provider(30);const {estimateBundle}=await import('@/lib/lending/bundle-estimate');const result=await estimateBundle([item,{...item,id:'30000000-0000-4000-8000-000000000002'}]);
  expect(result.amountJpy).toBeNull();expect(result.lines.every(line=>line.amountJpy===null)).toBe(true);expect(fetchPublicRemoteUrl).toHaveBeenCalledTimes(2)
 })
 it('does not misrepresent a partial basket as a whole basket total',async()=>{
  provider();const {estimateBundle}=await import('@/lib/lending/bundle-estimate');const result=await estimateBundle([item,{...item,id:'30000000-0000-4000-8000-000000000002',source:'manual',productId:null}]);
  expect(result.status).toBe('manual');expect(result.amountJpy).toBeNull();expect(result.lines[0].amountJpy).toBe(200000)
 })
 it.each([{grade:'未鑑定'},{grade:'PSA9'},{cardNumber:'wrong'}])('never uses PSA10 prices for another grade or edited number',async patch=>{
  provider();const {estimateBundle}=await import('@/lib/lending/bundle-estimate');expect((await estimateBundle([{...item,...patch}])).amountJpy).toBeNull()
 })
 it('caps total at ten million, rounds to ten thousand and applies the minimum to the whole bundle',async()=>{
  provider(300,100000000);const {estimateBundle}=await import('@/lib/lending/bundle-estimate');expect((await estimateBundle([item])).amountJpy).toBe(10000000)
 })
 it('does not elevate truncated histories and falls back without retrying HTTP failures',async()=>{
  provider(20);const {estimateBundle}=await import('@/lib/lending/bundle-estimate');expect((await estimateBundle([item])).amountJpy).toBeNull()
  vi.mocked(fetchPublicRemoteUrl).mockResolvedValue(new Response('private upstream response',{status:429}));const result=await estimateBundle([{...item,productId:'456'}]);expect(result.amountJpy).toBeNull();expect(JSON.stringify(result)).not.toContain('private');expect(fetchPublicRemoteUrl).toHaveBeenCalledTimes(3)
 })
 it('expires cache and re-fetches after five minutes',async()=>{
  provider();const {estimateBundle}=await import('@/lib/lending/bundle-estimate');await estimateBundle([item]);vi.setSystemTime(Date.now()+300000);await estimateBundle([item]);expect(fetchPublicRemoteUrl).toHaveBeenCalledTimes(4)
 })
})
