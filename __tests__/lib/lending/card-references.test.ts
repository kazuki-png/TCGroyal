// @vitest-environment node
import {beforeEach,expect,it,vi} from 'vitest'
vi.mock('server-only',()=>({}))
const mocks=vi.hoisted(()=>({from:vi.fn(),upsert:vi.fn(),abortSignal:vi.fn()}))
vi.mock('@/lib/lending/workflow-client',()=>({createWorkflowClient:()=>({from:mocks.from})}))
import {saveCardReferences} from '@/lib/lending/card-references'
const card={productId:'91395',name:'コイキングごっこピカチュウ',cardNumber:'150/XY-P',category:'pokemon' as const,imageUrl:'https://cdn.snkrdunk.com/card.webp',sourceUrl:'https://snkrdunk.com/apparels/91395'}
beforeEach(()=>{vi.clearAllMocks();mocks.from.mockReturnValue({upsert:mocks.upsert});mocks.upsert.mockReturnValue({abortSignal:mocks.abortSignal});mocks.abortSignal.mockResolvedValue({error:null})})
it('upserts only provider metadata once per product without resetting first seen or storing prices',async()=>{
 await saveCardReferences([card,{...card,name:'更新名'}])
 expect(mocks.from).toHaveBeenCalledWith('lending_card_references')
 expect(mocks.upsert).toHaveBeenCalledWith([{provider:'snkrdunk',product_id:'91395',name:'更新名',card_number:'150/XY-P',category:'pokemon',image_url:card.imageUrl,source_url:card.sourceUrl,last_seen_at:expect.any(String)}],{onConflict:'provider,product_id'})
})
it('bounds DB calls and preserves search availability when persistence fails',async()=>{
 const warn=vi.spyOn(console,'warn').mockImplementation(()=>{})
 mocks.abortSignal.mockRejectedValueOnce(Error('private connection detail'))
 await expect(saveCardReferences([card])).resolves.toBeUndefined()
 expect(mocks.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));expect(warn).toHaveBeenCalledWith('lending_card_reference_save_failed')
 warn.mockRestore();await saveCardReferences([]);expect(mocks.from).toHaveBeenCalledTimes(1)
})
