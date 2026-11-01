// @vitest-environment node
import {beforeEach,describe,expect,it,vi} from 'vitest'
vi.mock('server-only',()=>({}))
const mocks=vi.hoisted(()=>({local:vi.fn(),external:vi.fn()}))
vi.mock('@/lib/lending/catalog-server',()=>({searchCatalog:mocks.local}))
vi.mock('@/lib/lending/snkrdunk-card-search',()=>({searchSnkrdunkCards:mocks.external}))
import {discoverCards} from '@/lib/lending/discovery'
const local={public_uid:'id',name:'カードA',card_number:'123/100',category:'pokemon',grade:'PSA10',image_url:null,buy_price:100000,buy_price_updated_at:'2026-11-01'}
const external={productId:'123',name:'カードA',cardNumber:'123/100',category:'pokemon',imageUrl:null,sourceUrl:'https://snkrdunk.com/apparels/123'}
beforeEach(()=>{vi.resetAllMocks();mocks.local.mockResolvedValue({cards:[local],total:1,page:1});mocks.external.mockResolvedValue({cards:[external],page:1,hasMore:false})})
describe('provider neutral discovery',()=>{
 it('deduplicates exact identities and strips raw prices and upstream URLs',async()=>{const result=await discoverCards('123/100');expect(result.cards).toHaveLength(1);expect(result.cards[0].kind).toBe('external');expect(JSON.stringify(result)).not.toMatch(/snkrdunk|buy_price|sourceUrl/);expect(result.cards[0].cardNumber).toBe('123/100')})
 it('does not merge other editions sharing a printed number',async()=>{mocks.external.mockResolvedValue({cards:[external,{...external,productId:'124',name:'カードA 英語版'}],hasMore:true});const result=await discoverCards('123/100');expect(result.cards).toHaveLength(2);expect(result.hasMore).toBe(true)})
 it('keeps local candidates when upstream is unavailable or rate limited',async()=>{mocks.external.mockRejectedValue(Error('provider secret'));expect(await discoverCards('123')).toMatchObject({partial:true,cards:[{kind:'catalog'}]});mocks.external.mockClear();expect(await discoverCards('123','all',1,false)).toMatchObject({partial:true});expect(mocks.external).not.toHaveBeenCalled()})
 it('keeps external candidates when local discovery fails and rejects a total outage',async()=>{mocks.local.mockRejectedValue(Error('db'));expect((await discoverCards('123')).cards).toHaveLength(1);mocks.external.mockRejectedValue(Error('remote'));await expect(discoverCards('123')).rejects.toThrow('discovery_unavailable')})
 it('does not query the external source for empty input and respects pagination',async()=>{mocks.local.mockResolvedValue({cards:[local],total:25,page:1});expect((await discoverCards('')).hasMore).toBe(true);expect(mocks.external).not.toHaveBeenCalled();await discoverCards('123','pokemon',2);expect(mocks.external).toHaveBeenCalledWith('123','pokemon',2)})
})
