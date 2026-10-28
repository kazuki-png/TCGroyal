// @vitest-environment node
import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest'
import sharp from 'sharp'
vi.mock('server-only',()=>({}))
vi.mock('@/lib/lending/api-guard',async()=>{const actual=await vi.importActual<typeof import('@/lib/lending/api-guard')>('@/lib/lending/api-guard');return {...actual,lendingAccess:vi.fn()}})
vi.mock('@/lib/lending/workflow-client',()=>({createWorkflowClient:vi.fn(),checkWorkflowRateLimit:vi.fn()}))
vi.mock('@/lib/lending/push',()=>({sendFcmTest:vi.fn()}))
vi.mock('@/lib/lending/psa-provider',async()=>{const a=await vi.importActual<typeof import('@/lib/lending/psa-provider')>('@/lib/lending/psa-provider');return {...a,fetchPsaCertificate:vi.fn()}})
vi.mock('@/lib/lending/snkrdunk-search',async()=>{const a=await vi.importActual<typeof import('@/lib/lending/snkrdunk-search')>('@/lib/lending/snkrdunk-search');return {...a,searchSnkrdunk:vi.fn(),fetchSnkrdunkProduct:vi.fn()}})
vi.mock('@/lib/lending/snkrdunk',()=>({fetchSnkrdunkSnapshot:vi.fn()}))
import {lendingAccess} from '@/lib/lending/api-guard'
import {createWorkflowClient} from '@/lib/lending/workflow-client'
import {fetchSnkrdunkProduct,searchSnkrdunk} from '@/lib/lending/snkrdunk-search'
import {fetchSnkrdunkSnapshot} from '@/lib/lending/snkrdunk'
import {fetchPsaCertificate} from '@/lib/lending/psa-provider'
import {POST as cards} from '@/app/api/lending/cards/route'
import {POST as documents,DELETE as deleteDocument} from '@/app/api/lending/documents/route'
import {POST as notifications} from '@/app/api/lending/notifications/route'
import {GET as reviews} from '@/app/api/lending/reviews/route'
import {POST as identity} from '@/app/api/lending/identity/route'
const user='10000000-0000-4000-8000-000000000001',id='20000000-0000-4000-8000-000000000001'
const queries=new Map<string,ReturnType<typeof query>>()
function query(data:unknown){const q:{[key:string]:ReturnType<typeof vi.fn>}={};for(const k of ['select','eq','neq','in','order','limit','gt','contains','insert','update','delete'])q[k]=vi.fn(()=>q);q.single=vi.fn(async()=>({data,error:null}));q.maybeSingle=vi.fn(async()=>({data,error:null}));q.then=vi.fn(resolve=>Promise.resolve({data,error:null}).then(resolve));return q}
const upload=vi.fn(),remove=vi.fn(),rpc=vi.fn()
const from=vi.fn((name:string)=>{if(!queries.has(name))queries.set(name,query(null));return queries.get(name)!})
const req=(path:string,body:unknown)=>new Request(`https://preview.example/api/lending/${path}`,{method:'POST',headers:{Origin:'https://preview.example','Content-Type':'application/json'},body:JSON.stringify(body)})
beforeEach(()=>{
 vi.stubEnv('LENDING_DOCUMENT_UPLOAD_ENABLED','true')
 vi.resetAllMocks();queries.clear();
 vi.mocked(lendingAccess).mockResolvedValue({id:user,role:'customer',demo:true})
 vi.mocked(createWorkflowClient).mockReturnValue({from,rpc,storage:{from:()=>({upload,remove})}} as unknown as ReturnType<typeof createWorkflowClient>)
 upload.mockResolvedValue({error:null});remove.mockResolvedValue({error:null});rpc.mockResolvedValue({data:id,error:null})
})
afterEach(()=>vi.unstubAllEnvs())
describe('owner-scoped PSA lookup reuse',()=>{
 const certificate={verifiedBy:'psa_api' as const,certNumber:'167034272',specId:123,year:'2024',brand:'POKEMON JAPANESE SV8',category:'TCG CARDS',cardNumber:'132',subject:'PIKACHU ex',variety:'SPECIAL ART RARE',grade:'10',gradeDescription:'GEM MT 10',eligible:true,sourceUrl:'https://www.psacard.com/cert/167034272/psa',fetchedAt:new Date().toISOString()}
 it('reuses only a matching unexpired official record belonging to the actor',async()=>{
  const q=query({id,certificate,expires_at:new Date(Date.now()+3600000).toISOString()});queries.set('lending_certificate_lookups',q)
  vi.mocked(searchSnkrdunk).mockResolvedValue([])
  const r=await cards(req('cards',{action:'lookup',certInput:'167034272'}));expect(r.status).toBe(200)
  expect(await r.json()).toMatchObject({id,cacheHit:true,certificate:{verifiedBy:'psa_api',fetchedAt:certificate.fetchedAt}})
  expect(q.eq).toHaveBeenCalledWith('user_id',user);expect(q.eq).toHaveBeenCalledWith('cert_number','167034272')
  expect(q.contains).toHaveBeenCalledWith('certificate',{verifiedBy:'psa_api'})
  expect(fetchPsaCertificate).not.toHaveBeenCalled();expect(q.insert).not.toHaveBeenCalled()
 })
 it.each(['manual','expired'])('fetches fresh evidence instead of using %s cached data',async kind=>{
  const stored=kind==='manual'?{...certificate,verifiedBy:'user_entered'}:certificate
  const q=query({id,certificate:stored,expires_at:new Date(Date.now()+(kind==='expired'?-1:3600000)).toISOString()});queries.set('lending_certificate_lookups',q)
  vi.mocked(fetchPsaCertificate).mockResolvedValue(certificate);vi.mocked(searchSnkrdunk).mockResolvedValue([])
  const r=await cards(req('cards',{action:'lookup',certInput:'167034272'}));expect(r.status).toBe(200);expect((await r.json()).cacheHit).toBe(false)
  expect(fetchPsaCertificate).toHaveBeenCalledTimes(1);expect(q.insert).toHaveBeenCalledWith(expect.objectContaining({user_id:user,certificate}))
 })
 it('does not spend external API quota when cache storage is unavailable',async()=>{
  const q=query(null);q.maybeSingle.mockResolvedValue({data:null,error:{message:'offline'}});queries.set('lending_certificate_lookups',q)
  expect((await cards(req('cards',{action:'lookup',certInput:'167034272'}))).status).toBe(502)
  expect(fetchPsaCertificate).not.toHaveBeenCalled()
 })
})
describe('PSA → real market assessment safety',()=>{
 const certificate={verifiedBy:'user_entered',certNumber:'99999999',eligible:true,cardNumber:'132'}
 const setup=()=>{
  queries.set('lending_certificate_lookups',query({id,user_id:user,cert_number:'99999999',certificate,expires_at:new Date(Date.now()+86400000).toISOString()}))
  queries.set('lending_product_mappings',query([{card_uid:id}]))
  queries.set('lending_assessments',query({id,quote_id:null}))
  vi.mocked(fetchSnkrdunkProduct).mockResolvedValue({productId:'408333',name:'ピカチュウ [SV8 132/106]',englishName:'PIKACHU [132/106]',productNumber:'pkmn-tcg-SV8-132',sourceUrl:'https://snkrdunk.com/apparels/408333'})
  vi.mocked(fetchSnkrdunkSnapshot).mockResolvedValue({floorPriceJpy:1000000} as Awaited<ReturnType<typeof fetchSnkrdunkSnapshot>>)
 }
 it('never grants a loan quote to a manually entered label, even with a verified catalog mapping',async()=>{
  setup();const r=await cards(req('cards',{action:'assess',lookupId:id,productId:'408333',confirmed:true}));expect(r.status).toBe(200)
  const d=await r.json();expect(d.quote).toBeNull();expect(d.requiresReview).toBe(true);expect(rpc).not.toHaveBeenCalled()
  expect(queries.get('lending_certificate_lookups')!.eq).toHaveBeenCalledWith('user_id',user)
  expect(queries.get('lending_assessments')!.insert).toHaveBeenCalledWith(expect.objectContaining({user_id:user,estimate_jpy:400000,quote_id:null}))
 })
 it('refuses mismatched card numbers before saving an assessment',async()=>{
  setup();vi.mocked(fetchSnkrdunkProduct).mockResolvedValue({productId:'408333',name:'別カード [131/106]',englishName:'OTHER 131/106',productNumber:'pkmn-tcg-SV8-131',sourceUrl:'https://snkrdunk.com/apparels/408333'})
  expect((await cards(req('cards',{action:'assess',lookupId:id,productId:'408333',confirmed:true}))).status).toBe(409)
  expect(queries.get('lending_assessments')!.insert).not.toHaveBeenCalled()
 })
 it('rejects caller-supplied ownership and missing review consent',async()=>{
  expect((await cards(req('cards',{action:'request',assessmentId:id,consent:true,user_id:'other'}))).status).toBe(400)
  expect((await cards(req('cards',{action:'request',assessmentId:id,consent:false}))).status).toBe(400)
 })
 it('explicitly marks manual labels and requires an acknowledgement',async()=>{
  queries.set('lending_certificate_lookups',query({id}));vi.mocked(searchSnkrdunk).mockResolvedValue([])
  const r=await cards(req('cards',{action:'manual_lookup',certInput:'99999999',subject:'PIKACHU ex',cardNumber:'132',brand:'pokemon',grade:'10',unverifiedConfirmed:true}))
  expect(r.status).toBe(200);expect((await r.json()).certificate.verifiedBy).toBe('user_entered')
 })
})
describe('identity upload and ownership',()=>{
 it('requires explicit enablement before accepting document uploads',async()=>{
  vi.stubEnv('LENDING_DOCUMENT_UPLOAD_ENABLED','')
  expect((await documents(req('documents',{verified:true}))).status).toBe(404)
  expect(createWorkflowClient).not.toHaveBeenCalled()
 })
 it('does not fake JPKI completion from client-side flags',async()=>{
  expect((await identity(req('identity',{verified:true,method:'jpki'}))).status).toBe(503)
  expect(createWorkflowClient).not.toHaveBeenCalled()
 })
 async function request(bytes:Uint8Array,type='drivers_license',side='front'){
  const f=new FormData();f.append('file',new File([new Uint8Array(bytes)],'test.jpg'));f.append('documentType',type);f.append('side',side);f.append('consent','true')
  return new Request('https://preview.example/api/lending/documents',{method:'POST',headers:{Origin:'https://preview.example'},body:f})
 }
 it('decodes and re-encodes an actual image into private owner-scoped storage',async()=>{
  const bytes=await sharp({create:{width:4,height:4,channels:3,background:'#fff'}}).png().toBuffer()
  const r=await documents(await request(bytes));expect(r.status).toBe(200)
  expect(rpc).toHaveBeenCalledWith('lending_begin_document',expect.objectContaining({p_actor:user,p_type:'drivers_license',p_path:expect.stringMatching(new RegExp(`^${user}/`))}))
  const meta=await sharp(upload.mock.calls[0][1]).metadata();expect(meta.format).toBe('jpeg');expect(meta.exif).toBeUndefined()
  expect(upload.mock.calls[0][2]).toMatchObject({upsert:false,cacheControl:'0'})
 })
 it('rejects HTML disguised as an image and My Number back-side uploads',async()=>{
  expect((await documents(await request(Buffer.from('<svg><script>alert(1)</script></svg>')))).status).toBe(400)
  expect((await documents(await request(Buffer.from('bytes'),'mynumber_front','back'))).status).toBe(400)
  expect(upload).not.toHaveBeenCalled();expect(rpc).not.toHaveBeenCalled()
 })
 it('does not remove an object when the requested document is not owned by the actor',async()=>{
  const r=await deleteDocument(new Request(`https://preview.example/api/lending/documents?id=${id}`,{method:'DELETE'}))
  expect(r.status).toBe(404);expect(remove).not.toHaveBeenCalled();expect(queries.get('lending_documents')!.eq).toHaveBeenCalledWith('user_id',user)
 })
 it('prevents deleting an in-progress upload',async()=>{
  queries.set('lending_documents',query({id,storage_path:`${user}/x.jpg`,status:'uploading',uploaded_at:new Date().toISOString()}))
  expect((await deleteDocument(new Request(`https://preview.example/api/lending/documents?id=${id}`,{method:'DELETE'}))).status).toBe(409)
  expect(remove).not.toHaveBeenCalled()
 })
})
describe('notification and review boundaries',()=>{
 it('reports missing FCM credentials without pretending to send',async()=>{
  vi.stubEnv('LENDING_FCM_SERVICE_ACCOUNT_JSON','')
  expect((await notifications(req('notifications',{action:'register',token:'test-token-at-least-20-chars',platform:'android'}))).status).toBe(503)
 })
 it('does not send to a device outside the caller-owned query',async()=>{
  vi.stubEnv('LENDING_FCM_SERVICE_ACCOUNT_JSON','test-only')
  expect((await notifications(req('notifications',{action:'test',deviceId:id}))).status).toBe(404)
  expect(queries.get('lending_push_devices')!.eq).toHaveBeenCalledWith('user_id',user)
 })
 it('denies customer access to document review and signed URLs',async()=>{
  expect((await reviews(new Request(`https://preview.example/api/lending/reviews?documentId=${id}`))).status).toBe(403)
  expect(createWorkflowClient).not.toHaveBeenCalled()
 })
})
