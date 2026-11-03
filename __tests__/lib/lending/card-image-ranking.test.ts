// @vitest-environment node
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest'
import sharp from 'sharp'
vi.mock('server-only',()=>({}))
const remote=vi.hoisted(()=>vi.fn())
vi.mock('@/lib/security/safeRemoteFetch',()=>({fetchPublicRemoteUrl:remote}))
import {rankCardImages} from '@/lib/lending/card-image-ranking'
import type {DiscoveryCard} from '@/lib/lending/discovery-types'
const cards:DiscoveryCard[]=[1,2,3].map(id=>({id:String(id),name:'ライチュウ',cardNumber:'',category:'pokemon',kind:'external',productId:String(id),cardUid:null,imageUrl:`https://cdn.snkrdunk.com/${id}.png`}))
const response=(order:number[])=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({order})}]}],usage:{input_tokens:900,output_tokens:30}})
beforeEach(async()=>{vi.stubEnv('OPENAI_API_KEY','fixture-not-real');vi.stubGlobal('fetch',vi.fn());const png=await sharp({create:{width:2,height:2,channels:3,background:'#ffff00'}}).png().toBuffer();remote.mockImplementation(async()=>new Response(new Uint8Array(png)))})
afterEach(()=>{vi.resetAllMocks();vi.unstubAllGlobals();vi.unstubAllEnvs()})
describe('bounded candidate visual comparison',()=>{
 it('compares original and normalized candidate images once, validates order and records usage',async()=>{
  vi.mocked(fetch).mockResolvedValue(response([2,0,1]));const usage=vi.fn()
  expect((await rankCardImages(Buffer.from('query'),cards,usage)).map(card=>card.id)).toEqual(['3','1','2'])
  expect(fetch).toHaveBeenCalledOnce();expect(remote).toHaveBeenCalledTimes(3);expect(usage).toHaveBeenCalledWith({inputTokens:900,outputTokens:30})
  const body=JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
  expect(body.store).toBe(false);expect(body.input[1].content.filter((value:{type:string})=>value.type==='input_image')).toHaveLength(4)
  expect(body.input[1].content.every((value:{image_url?:string})=>!value.image_url||value.image_url.startsWith('data:image/jpeg;base64,'))).toBe(true)
 })
 it('rejects duplicate/out-of-range model indexes and does not bind an unknown card',async()=>{
  for(const order of [[0,0,1],[0,1,9]]){vi.mocked(fetch).mockResolvedValueOnce(response(order));await expect(rankCardImages(Buffer.alloc(1),cards,vi.fn())).rejects.toThrow()}
 })
 it('skips untrusted hosts and cannot make a comparison with fewer than two usable images',async()=>{
  await expect(rankCardImages(Buffer.alloc(1),cards.map(card=>({...card,imageUrl:'https://127.0.0.1/private'})),vi.fn())).rejects.toThrow('visual_candidates_unavailable')
  expect(remote).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled()
 })
})
