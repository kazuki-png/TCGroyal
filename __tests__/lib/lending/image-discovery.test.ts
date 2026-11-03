// @vitest-environment node
import {beforeEach,describe,expect,it,vi} from 'vitest'
vi.mock('server-only',()=>({}))
const discover=vi.hoisted(()=>vi.fn())
vi.mock('@/lib/lending/discovery',()=>({discoverCards:discover}))
import {discoverImageCards} from '@/lib/lending/image-discovery'
const hints={name:'ピカチュウ',cardNumber:'132/106',category:'pokemon' as const,setName:'SV8',language:'日本語',rarity:'SAR'}
const match={cards:[{id:'1',name:'ピカチュウ SAR',cardNumber:'SV8 132/106',category:'pokemon',kind:'external',productId:'1',cardUid:null,imageUrl:null}],page:1,hasMore:true,partial:false}
beforeEach(()=>vi.resetAllMocks())
describe('bounded image discovery',()=>{
 it('searches the printed number first and stops on usable candidates',async()=>{
  discover.mockResolvedValue(match);const allow=vi.fn(async()=>true)
  const result=await discoverImageCards(hints,allow)
  expect(discover).toHaveBeenCalledExactlyOnceWith('132/106','pokemon',1,true)
  expect(result).toMatchObject({hasMore:false,searchQuery:'132/106',cards:[{id:'1',imageMatch:{matchedOn:['number','set','name','rarity']}}]})
 })
 it('falls back once to the printed name when the number query has no usable candidates',async()=>{
  discover.mockResolvedValueOnce({...match,cards:[{...match.cards[0],cardNumber:'001/100'}]}).mockResolvedValueOnce(match)
  const allow=vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false)
  const result=await discoverImageCards(hints,allow)
  expect(result.cards).toHaveLength(1);expect(discover).toHaveBeenCalledTimes(2)
  expect(discover).toHaveBeenLastCalledWith('ピカチュウ','pokemon',1,false)
 })
 it('returns extracted text on an outage so a user can retry text search without another image analysis',async()=>{
  discover.mockRejectedValue(Error('private provider detail'))
  const result=await discoverImageCards(hints,async()=>true)
  expect(result).toMatchObject({cards:[],hints,partial:true});expect(JSON.stringify(result)).not.toContain('private provider')
  expect(discover).toHaveBeenCalledTimes(2)
 })
 it('does not contact a source for unreadable/non-card images and deduplicates queries',async()=>{
  const empty={name:null,cardNumber:null,category:null,setName:null,language:null,rarity:null}
  const allow=vi.fn(async()=>true);expect((await discoverImageCards(empty,allow)).cards).toEqual([]);expect(allow).not.toHaveBeenCalled()
  discover.mockResolvedValue({...match,cards:[]});await discoverImageCards({...empty,name:'132/106',cardNumber:'132/106'},allow);expect(discover).toHaveBeenCalledOnce()
 })
})
