// @vitest-environment node
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest'
import sharp from 'sharp'
vi.mock('server-only',()=>({}))
const mocks=vi.hoisted(()=>({access:vi.fn(),client:vi.fn(),rate:vi.fn(),search:vi.fn(),extract:vi.fn(),market:vi.fn(),external:vi.fn()}))
vi.mock('@/lib/lending/snkrdunk-card-search',()=>({searchSnkrdunkCards:mocks.external}))
vi.mock('@/lib/lending/api-guard',async()=>({...await vi.importActual<typeof import('@/lib/lending/api-guard')>('@/lib/lending/api-guard'),lendingAccess:mocks.access}))
vi.mock('@/lib/lending/workflow-client',()=>({createWorkflowClient:mocks.client,checkWorkflowRateLimit:mocks.rate}))
vi.mock('@/lib/lending/catalog-server',()=>({searchCatalog:mocks.search,catalogColumns:'public_uid,name,grade'}))
vi.mock('@/lib/lending/card-image',()=>({extractCardHints:mocks.extract}))
vi.mock('@/lib/lending/snkrdunk',()=>({fetchSnkrdunkSnapshot:mocks.market}))
import {POST as catalog} from '@/app/api/lending/catalog/route'
import {POST as image} from '@/app/api/lending/card-image/route'
const user='10000000-0000-4000-8000-000000000001',id='20000000-0000-4000-8000-000000000001'
const hints={name:'ピカチュウ',cardNumber:'025/165',category:'pokemon',setName:null,language:null,rarity:null}
const from=vi.fn(),rpc=vi.fn()
function query(data:unknown,error:unknown=null){
 const result={data,error};const q:Record<string,ReturnType<typeof vi.fn>>={};for(const key of ['insert','select','eq','gte','update'])q[key]=vi.fn(()=>q)
 q.single=vi.fn(async()=>result);q.maybeSingle=vi.fn(async()=>result);q.then=vi.fn(resolve=>Promise.resolve(result).then(resolve));return q
}
async function upload(consent='true',file?:Blob){
 const bytes=await sharp({create:{width:20,height:20,channels:3,background:'#ff0000'}}).jpeg().toBuffer()
 const form=new FormData();form.set('key',id);form.set('consent',consent);form.set('file',file??new Blob([new Uint8Array(bytes)],{type:'image/jpeg'}),'card.jpg')
 return new Request('https://preview.example/api/lending/card-image',{method:'POST',body:form})
}
const request=(body:unknown)=>new Request('https://preview.example/api/lending/catalog',{method:'POST',body:JSON.stringify(body)})
beforeEach(()=>{
 vi.clearAllMocks();vi.stubEnv('OPENAI_API_KEY','fixture-not-real');mocks.access.mockResolvedValue({id:user,role:'customer',demo:false});mocks.client.mockReturnValue({from,rpc});mocks.rate.mockResolvedValue({allowed:true});
 mocks.search.mockResolvedValue({cards:[],total:0,page:1});mocks.extract.mockResolvedValue({hints,usage:{inputTokens:1000,outputTokens:100},model:'fixture'});from.mockImplementation(()=>query({id}));rpc.mockResolvedValue({data:{id,reference:'TR-FIXTURE'},error:null})
})
afterEach(()=>vi.unstubAllEnvs())
describe('catalog and image routes',()=>{
 it('requires authentication, validates and rate limits external card search without DB writes or price calls',async()=>{
  mocks.external.mockResolvedValue({cards:[],page:1,hasMore:false});
  expect((await catalog(request({action:'search_snkrdunk',query:'ピカチュウ'}))).status).toBe(200);
  expect(mocks.external).toHaveBeenCalledWith('ピカチュウ','all',1);expect(mocks.client).not.toHaveBeenCalled();expect(mocks.market).not.toHaveBeenCalled();
  mocks.rate.mockResolvedValue({allowed:false});expect((await catalog(request({action:'search_snkrdunk',query:'ピカチュウ'}))).status).toBe(429);expect(mocks.external).toHaveBeenCalledOnce();
  expect((await catalog(request({action:'search_snkrdunk',query:' '}))).status).toBe(400);
  mocks.access.mockResolvedValue(Response.json({error:'login'},{status:401}));expect((await catalog(request({action:'search_snkrdunk',query:'ピカチュウ'}))).status).toBe(401);expect(mocks.external).toHaveBeenCalledOnce();
 })
 it('returns a useful failure when external search fails instead of claiming no results',async()=>{
  mocks.external.mockRejectedValue(Error('upstream private error'));const response=await catalog(request({action:'search_snkrdunk',query:'カード'}));
  expect(response.status).toBe(502);expect(await response.text()).not.toContain('private');expect(mocks.external).toHaveBeenCalledOnce();
 })
 it('ordinary search invokes only the catalog and never the price or image provider',async()=>{
  expect((await catalog(request({action:'search',query:'ピカチュウ'}))).status).toBe(200)
  expect(mocks.search).toHaveBeenCalledWith('ピカチュウ','all',1);expect(mocks.extract).not.toHaveBeenCalled();expect(mocks.market).not.toHaveBeenCalled()
 })
 it('requires consent and binds catalog submissions to the authenticated actor',async()=>{
  const body={action:'submit',assessmentId:id,key:id,requestedAmount:'',consent:true}
  expect((await catalog(request({...body,consent:false}))).status).toBe(400)
  expect((await catalog(request({...body,userId:id}))).status).toBe(400)
  expect((await catalog(request(body))).status).toBe(200)
  expect(rpc).toHaveBeenCalledWith('lending_catalog_submit',{p_actor:user,p_assessment:id,p_amount:null,p_notes:'',p_key:id})
 })
 it('allows uncertified cards and never uses PSA10 prices for an ungraded declaration',async()=>{
  const card={public_uid:id,name:'カード',category:'pokemon',grade:'PSA10',card_number:'1',buy_price:1000000,buy_price_updated_at:new Date().toISOString()}
  const cardQuery=query(card),saved=query({id});from.mockReturnValueOnce(cardQuery).mockReturnValueOnce(saved)
  expect((await catalog(request({action:'assess',cardUid:id,declaredGrade:'ungraded'}))).status).toBe(200)
  expect(saved.insert).toHaveBeenCalledWith(expect.objectContaining({cert_number:null,indicative_jpy:null,declared_grade:'ungraded'}));expect(mocks.market).not.toHaveBeenCalled()
 })
 it('rejects invalid certificate declarations before writing or calling providers',async()=>{
  expect((await catalog(request({action:'assess',cardUid:id,declaredGrade:'ungraded',certInput:'167034272'}))).status).toBe(400)
  expect(from).not.toHaveBeenCalled()
 })
 it('rejects absent sessions before uploading or submitting',async()=>{
  mocks.access.mockResolvedValue(Response.json({error:'login'},{status:401}))
  expect((await image(await upload())).status).toBe(401);expect((await catalog(request({action:'search'}))).status).toBe(401);expect(mocks.client).not.toHaveBeenCalled()
 })
 it('fails safely when the image key is absent or consent/file is invalid',async()=>{
  vi.stubEnv('OPENAI_API_KEY','');expect((await image(await upload())).status).toBe(503);vi.stubEnv('OPENAI_API_KEY','fixture')
  expect((await image(await upload('false'))).status).toBe(400)
  expect((await image(await upload('true',new Blob(['not image'])))).status).toBe(400)
  expect(mocks.extract).not.toHaveBeenCalled();expect(from).not.toHaveBeenCalled()
 })
 it('claims a request before calling once, strips metadata and records token usage',async()=>{
  const claim=query({id}),usage=query(null),saved=query(null);from.mockReturnValueOnce(claim).mockReturnValueOnce(usage).mockReturnValueOnce(saved)
  const r=await image(await upload());expect(r.status).toBe(200);expect((await r.json()).imageRequestId).toBe(id)
  expect(mocks.extract).toHaveBeenCalledOnce();expect(mocks.search).toHaveBeenCalledWith('025/165','pokemon')
  expect(claim.insert).toHaveBeenCalledWith({id,user_id:user,image_hash:expect.stringMatching(/^[a-f0-9]{64}$/)})
  expect(usage.update).toHaveBeenCalledWith({model:'fixture',input_tokens:1000,output_tokens:100})
  expect(saved.update).toHaveBeenCalledWith(expect.objectContaining({status:'completed'}))
 })
 it('does not charge another request while processing or after an uncertain failure',async()=>{
  from.mockReturnValueOnce(query(null,{code:'23505'})).mockReturnValueOnce(query({status:'processing'}))
  expect((await image(await upload())).status).toBe(409);expect(mocks.extract).not.toHaveBeenCalled()
 })
 it('does not call the provider at a daily limit or retry on a provider error',async()=>{
  mocks.rate.mockResolvedValue({allowed:false});expect((await image(await upload())).status).toBe(429);expect(mocks.extract).not.toHaveBeenCalled()
  mocks.rate.mockResolvedValue({allowed:true});mocks.extract.mockRejectedValue(Error('provider-secret-payload'))
  const r=await image(await upload());expect(r.status).toBe(502);expect(await r.text()).not.toContain('provider-secret');expect(mocks.extract).toHaveBeenCalledOnce()
 })
})
