// @vitest-environment node
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
vi.mock('server-only',()=>({}))
vi.mock('@/lib/lending/local-config',()=>({isPreviewLendingEnabled:vi.fn(()=>true),isSameOriginRequest:vi.fn(()=>true),isLocalLendingEnabled:()=>false}))
const mocks=vi.hoisted(()=>({verify:vi.fn(),getUser:vi.fn(),createUser:vi.fn(),rpc:vi.fn(),from:vi.fn()}))
vi.mock('firebase-admin/app',()=>({cert:vi.fn(v=>v),getApps:()=>[],initializeApp:vi.fn(()=>({}))}))
vi.mock('firebase-admin/auth',()=>({getAuth:()=>({verifyIdToken:mocks.verify})}))
vi.mock('@/lib/lending/workflow-client',()=>({createWorkflowClient:()=>({auth:{admin:{getUserById:mocks.getUser,createUser:mocks.createUser}},rpc:mocks.rpc,from:mocks.from}),checkWorkflowRateLimit:async()=>({allowed:true})}))
import {firebasePhoneConfiguration,verifyFirebasePhone} from '@/lib/lending/firebase-auth'
import {normalizeMobilePhone} from '@/lib/lending/phone'
import {isPreviewLendingEnabled,isSameOriginRequest} from '@/lib/lending/local-config'
import {GET,POST} from '@/app/api/lending/phone/route'
import {getWorkflowActor} from '@/lib/lending/workflow-server'
const request=(body:unknown)=>new Request('https://preview.example/api/lending/phone',{method:'POST',headers:{Origin:'https://preview.example','Content-Type':'application/json'},body:JSON.stringify(body)})
beforeEach(()=>{
 vi.clearAllMocks();vi.mocked(isPreviewLendingEnabled).mockReturnValue(true);vi.mocked(isSameOriginRequest).mockReturnValue(true)
 vi.stubEnv('LENDING_FIREBASE_PROJECT_ID','tcg-lending-preview');vi.stubEnv('LENDING_FCM_SERVICE_ACCOUNT_JSON',JSON.stringify({project_id:'tcg-lending-preview',client_email:'test@example.invalid',private_key:'test-only'}));vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST','')
 mocks.verify.mockResolvedValue({uid:'firebase-customer',phone_number:'+819012345678',auth_time:Math.floor(Date.now()/1000),firebase:{sign_in_provider:'phone'}})
 mocks.getUser.mockResolvedValue({data:{user:null},error:{status:404}});mocks.createUser.mockResolvedValue({error:null});mocks.rpc.mockResolvedValue({error:null})
})
afterEach(()=>vi.unstubAllEnvs())
describe('Firebase phone authentication',()=>{
 it('normalizes Japanese mobile numbers, rejecting URLs, foreign and landline numbers',()=>{
  expect(normalizeMobilePhone('090-1234-5678')).toBe('+819012345678');expect(normalizeMobilePhone('+81 90 1234 5678')).toBe('+819012345678')
  for(const n of ['03-1234-5678','+16505553434','https://example.com','0901234567','819012345678'])expect(normalizeMobilePhone(n)).toBeNull()
  expect(normalizeMobilePhone('+16505550101',true)).toBe('+16505550101');expect(normalizeMobilePhone('+16505550101')).toBeNull()
 })
 it('fails closed in production, with mismatched credentials or when emulator bypass is set',()=>{
  vi.mocked(isPreviewLendingEnabled).mockReturnValue(false);expect(firebasePhoneConfiguration()).toBeNull()
  vi.mocked(isPreviewLendingEnabled).mockReturnValue(true);vi.stubEnv('LENDING_FIREBASE_PROJECT_ID','different-project');expect(firebasePhoneConfiguration()).toBeNull()
  vi.stubEnv('LENDING_FIREBASE_PROJECT_ID','tcg-lending-preview');vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST','localhost:9099');expect(firebasePhoneConfiguration()).toBeNull()
 })
 it('checks revocation through Admin SDK and derives a fixed customer identity',async()=>{
  const value=await verifyFirebasePhone('one.two.three',true)
  expect(mocks.verify).toHaveBeenCalledWith('one.two.three',true)
  expect(value.subjectHash).toMatch(/^[a-f0-9]{64}$/);expect(value.userId).toMatch(/^[a-f0-9-]{36}$/);expect(value.phone).toBe('+819012345678')
  expect(await verifyFirebasePhone('one.two.three',true)).toEqual(value)
 })
 it('rejects non-phone providers, stale authentication, revoked tokens and bad numbers',async()=>{
  for(const change of [{firebase:{sign_in_provider:'custom'}},{auth_time:1},{phone_number:'+16505553434'}]){
   mocks.verify.mockResolvedValueOnce({uid:'uid',phone_number:'+819012345678',auth_time:Math.floor(Date.now()/1000),firebase:{sign_in_provider:'phone'},...change})
   await expect(verifyFirebasePhone('one.two.three',true)).rejects.toThrow()
  }
  mocks.verify.mockRejectedValueOnce(Error('revoked'));await expect(verifyFirebasePhone('one.two.three')).rejects.toThrow()
 })
 it('returns availability without exposing credentials',async()=>{
  expect(await (await GET()).json()).toEqual({enabled:true,projectId:'tcg-lending-preview'})
  vi.stubEnv('LENDING_FCM_SERVICE_ACCOUNT_JSON','');expect((await POST(request({idToken:'one.two.three'}))).status).toBe(503)
  expect(mocks.createUser).not.toHaveBeenCalled()
 })
 it('rejects CSRF and caller-supplied roles before provisioning',async()=>{
  vi.mocked(isSameOriginRequest).mockReturnValue(false);expect((await POST(request({idToken:'a'.repeat(20)}))).status).toBe(403)
  vi.mocked(isSameOriginRequest).mockReturnValue(true);expect((await POST(request({idToken:'a'.repeat(20),role:'admin'}))).status).toBe(400)
  expect(mocks.createUser).not.toHaveBeenCalled()
 })
 it('provisions its own account and never trusts a supplied user ID or admin role',async()=>{
  const response=await POST(request({idToken:'token.signature.signature'}));expect(response.status).toBe(200)
  expect(mocks.createUser).toHaveBeenCalledWith(expect.objectContaining({id:expect.stringMatching(/^[a-f0-9-]{36}$/),email_confirm:false}))
  expect(mocks.rpc).toHaveBeenCalledWith('lending_bind_firebase_phone',expect.objectContaining({p_phone:'+819012345678'}))
  expect(await response.json()).not.toHaveProperty('token')
 })
 it('maps a verified Firebase token to a customer even when headers claim admin',async()=>{
  const identity=await verifyFirebasePhone('token.signature.signature')
  const q={select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn(async()=>({data:{user_id:identity.userId,phone:identity.phone},error:null}))};q.select.mockReturnValue(q);q.eq.mockReturnValue(q);mocks.from.mockReturnValue(q)
  const actor=await getWorkflowActor(new Request('https://preview.example',{headers:{Authorization:'Bearer token.signature.signature','x-lending-demo-role':'admin'}}))
  expect(actor).toEqual({id:identity.userId,role:'customer',demo:true})
 })
 it('rejects unmapped Firebase users and changed phone bindings',async()=>{
  const q={select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn(async()=>({data:null,error:null}))};q.select.mockReturnValue(q);q.eq.mockReturnValue(q);mocks.from.mockReturnValue(q)
  expect(await getWorkflowActor(new Request('https://preview.example',{headers:{Authorization:'Bearer token.signature.signature'}}))).toBeNull()
 })
})
