// @vitest-environment node
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest'
vi.mock('server-only',()=>({}))
import {extractCardHints} from '@/lib/lending/card-image'
const hints={name:'ピカチュウ',cardNumber:'025/165',category:'pokemon',setName:null,language:null,rarity:null}
const response=(text:unknown,status='completed')=>Response.json({status,output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(text)}]}],usage:{input_tokens:1400,output_tokens:100}})
beforeEach(()=>{vi.stubEnv('OPENAI_API_KEY','fixture-token-not-real');vi.stubGlobal('fetch',vi.fn())})
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()})
describe('bounded card image provider',()=>{
 it('uses one image-analysis request with no storage and validated structured output',async()=>{
  vi.mocked(fetch).mockResolvedValue(response(hints))
  expect((await extractCardHints(Buffer.from('fixture-image'))).hints).toEqual(hints)
  expect(fetch).toHaveBeenCalledOnce()
  const [url,options]=vi.mocked(fetch).mock.calls[0];expect(url).toBe('https://api.openai.com/v1/responses')
  const body=JSON.parse(options!.body as string);expect(body.store).toBe(false);expect(body.text.format.strict).toBe(true);expect(body.max_output_tokens).toBe(600)
 })
 it('does not contact OpenAI if not configured',async()=>{
  vi.stubEnv('OPENAI_API_KEY','');await expect(extractCardHints(Buffer.alloc(1))).rejects.toThrow('unconfigured');expect(fetch).not.toHaveBeenCalled()
 })
 it('rejects failed, refused, incomplete and out-of-schema responses without retries',async()=>{
  for(const result of [new Response('secret provider payload',{status:429}),response(hints,'incomplete'),response({...hints,name:'a'.repeat(101)}),Response.json({status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'no'}]}]})]){
   vi.mocked(fetch).mockResolvedValueOnce(result);await expect(extractCardHints(Buffer.alloc(1))).rejects.toThrow()
  }
  expect(fetch).toHaveBeenCalledTimes(4)
 })
})
