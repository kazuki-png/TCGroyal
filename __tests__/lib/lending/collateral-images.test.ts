// @vitest-environment node
import {beforeEach,expect,it,vi} from 'vitest'
import type {CollateralItem} from '@/lib/lending/collateral-types'
vi.mock('server-only',()=>({}))
const mocks=vi.hoisted(()=>({from:vi.fn(),select:vi.fn(),in:vi.fn(),eq:vi.fn(),abortSignal:vi.fn()}))
vi.mock('@/lib/lending/workflow-client',()=>({createWorkflowClient:()=>({from:mocks.from})}))
import {withCollateralImages} from '@/lib/lending/collateral-images'
const card:CollateralItem={id:'a',name:'ピカチュウ',cardNumber:'150/XY-P',quantity:2,grade:'PSA10',condition:'',source:'snkrdunk',productId:'91395',cardUid:null}
beforeEach(()=>{vi.clearAllMocks();for(const key of ['from','select','in','eq'] as const)mocks[key].mockReturnValue(mocks)})
it('enriches only matching source identifiers without altering contractual fields or the input',async()=>{
 mocks.abortSignal.mockResolvedValueOnce({data:[{product_id:'91395',image_url:'https://cdn.snkrdunk.com/card.webp'}]}).mockResolvedValueOnce({data:[{public_uid:'catalog-a',image_url:'https://example.com/card.jpg'}]})
 const input=[{reference:'TR-example',requested_jpy:200000,collateral_items:[card,{...card,id:'b'},{...card,id:'c',source:'catalog' as const,cardUid:'catalog-a'}, {...card,id:'d',source:'manual' as const,imageUrl:'https://untrusted.example/photo'}]}]
 const result=await withCollateralImages(input)
 expect(mocks.in.mock.calls).toEqual([['product_id',['91395']],['public_uid',['catalog-a']]])
 expect(mocks.eq).toHaveBeenCalledWith('provider','snkrdunk');expect(mocks.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal))
 expect(result[0].collateral_items.map(item=>item.imageUrl)).toEqual(['https://cdn.snkrdunk.com/card.webp','https://cdn.snkrdunk.com/card.webp','https://example.com/card.jpg',null])
 expect(input[0].collateral_items[0]).not.toHaveProperty('imageUrl');expect(result[0].requested_jpy).toBe(200000)
 expect(result[0].collateral_items[0]).toEqual({...card,imageUrl:'https://cdn.snkrdunk.com/card.webp'})
})
it('fails open on reference outages and never uses a caller image or fuzzy name fallback',async()=>{
 mocks.abortSignal.mockRejectedValueOnce(Error('private failure'))
 const result=await withCollateralImages([{collateral_items:[{...card,imageUrl:'https://untrusted.example/x'}]}])
 expect(result[0].collateral_items?.[0].imageUrl).toBeNull()
})
it('rejects unsafe or unrelated provider image hosts',async()=>{
 for(const image_url of ['http://cdn.snkrdunk.com/x','https://cdn.snkrdunk.com.evil.example/x','https://user:pass@cdn.snkrdunk.com/x']){
  mocks.abortSignal.mockResolvedValueOnce({data:[{product_id:'91395',image_url}]})
  const result=await withCollateralImages([{collateral_items:[card]}]);expect(result[0].collateral_items?.[0].imageUrl).toBeNull()
 }
})
it('batches unique identifiers and skips storage entirely for legacy records',async()=>{
 mocks.abortSignal.mockResolvedValue({data:[]})
 await withCollateralImages([{collateral_items:Array.from({length:201},(_,i)=>({...card,productId:String(i)}))}]);expect(mocks.in.mock.calls.map(call=>call[1].length)).toEqual([100,100,1])
 mocks.from.mockClear();await withCollateralImages([{}]);expect(mocks.from).not.toHaveBeenCalled()
})
