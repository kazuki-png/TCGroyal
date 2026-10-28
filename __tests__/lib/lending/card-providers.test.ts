// @vitest-environment node
import {afterEach,describe,expect,it,vi} from 'vitest'
vi.mock('server-only',()=>({}))
vi.mock('@/lib/security/safeRemoteFetch',()=>({fetchPublicRemoteUrl:vi.fn()}))
import {fetchPublicRemoteUrl} from '@/lib/security/safeRemoteFetch'
import {fetchPsaCertificate,parsePsaCertificate} from '@/lib/lending/psa-provider'
import {parseSnkrdunkSearch,cardNumberMatches,fetchSnkrdunkProduct} from '@/lib/lending/snkrdunk-search'
const cert='123456789'
const card={CertNumber:cert,SpecID:123,Year:'2024',Brand:'POKEMON JAPANESE SV8',Category:'TCG CARDS',CardNumber:'132',Subject:'PIKACHU ex',Variety:'SPECIAL ART RARE',CardGrade:'10',GradeDescription:'GEM MT 10',IsPSADNA:false,IsDualCert:false,ItemStatus:'Active'}
afterEach(()=>{vi.unstubAllEnvs();vi.resetAllMocks()})
describe('PSA certificate identity and eligibility',()=>{
 it('requires the exact cert, grade and supported card family',()=>{
  expect(parsePsaCertificate({PSACert:card},cert)).toMatchObject({certNumber:cert,subject:'PIKACHU ex',cardNumber:'132',eligible:true})
  expect(()=>parsePsaCertificate({PSACert:card},'999999999')).toThrow('一致')
  expect(parsePsaCertificate({PSACert:{...card,CardGrade:'9',GradeDescription:'MINT 9'}},cert).eligible).toBe(false)
  expect(parsePsaCertificate({PSACert:{...card,Brand:'TOPPS BASEBALL'}},cert).eligible).toBe(false)
 })
 it('rejects dual signatures and invalidated certs',()=>{
  for(const change of [{IsDualCert:true},{ItemStatus:'DEACTIVATED'},{IsPSADNA:true}])expect(()=>parsePsaCertificate({PSACert:{...card,...change}},cert)).toThrow('対象外')
 })
 it('does not pretend an API lookup succeeded without a token',async()=>{
  vi.stubEnv('PSA_API_ACCESS_TOKEN','');await expect(fetchPsaCertificate(cert)).rejects.toThrow('接続設定')
  expect(fetchPublicRemoteUrl).not.toHaveBeenCalled()
 })
 it('sends credentials only to the fixed PSA API and forbids redirects',async()=>{
  vi.stubEnv('PSA_API_ACCESS_TOKEN','test-only-token')
  vi.mocked(fetchPublicRemoteUrl).mockResolvedValue(Response.json({PSACert:card}))
  await fetchPsaCertificate(`https://www.psacard.com/cert/${cert}/psa`)
  expect(String(vi.mocked(fetchPublicRemoteUrl).mock.calls[0][0])).toBe(`https://api.psacard.com/publicapi/cert/GetByCertNumber/${cert}`)
  expect(vi.mocked(fetchPublicRemoteUrl).mock.calls[0][1]).toMatchObject({maxRedirects:0,headers:{Authorization:'bearer test-only-token'}})
 })
 it('rejects error bodies, even when PSA returns HTTP 200',async()=>{
  vi.stubEnv('PSA_API_ACCESS_TOKEN','test-only-token');vi.mocked(fetchPublicRemoteUrl).mockResolvedValue(Response.json({IsValidRequest:true,ServerMessage:'No data found'}))
  await expect(fetchPsaCertificate(cert)).rejects.toThrow('見つからない')
 })
 it('normalizes a pasted bearer prefix and surrounding whitespace',async()=>{
  vi.stubEnv('PSA_API_ACCESS_TOKEN','  Bearer test-only-token\n')
  vi.mocked(fetchPublicRemoteUrl).mockResolvedValue(Response.json({PSACert:card}))
  await fetchPsaCertificate(cert)
  expect(vi.mocked(fetchPublicRemoteUrl).mock.calls[0][1]?.headers).toMatchObject({Authorization:'bearer test-only-token'})
 })
 it('rejects invalid credential characters before they can reach a header exception',async()=>{
  vi.stubEnv('PSA_API_ACCESS_TOKEN','private\ncredential')
  await expect(fetchPsaCertificate(cert)).rejects.toThrow('保存形式')
  expect(fetchPublicRemoteUrl).not.toHaveBeenCalled()
 })
 it('reports upstream status without leaking tokens or provider error bodies',async()=>{
  vi.stubEnv('PSA_API_ACCESS_TOKEN','secret-test-token')
  const log=vi.spyOn(console,'warn').mockImplementation(()=>{})
  try{
   vi.mocked(fetchPublicRemoteUrl).mockResolvedValue(new Response('sensitive upstream body',{status:403,headers:{'Content-Type':'text/html'}}))
   await expect(fetchPsaCertificate(cert)).rejects.toThrow('HTTP 403')
   expect(log).toHaveBeenCalledWith('PSA API response rejected',{status:403,contentType:'text/html'})
   expect(JSON.stringify(log.mock.calls)).not.toMatch(/secret-test-token|sensitive upstream body/)
  }finally{log.mockRestore()}
 })
 it.each([403,429])('recognizes the reported daily quota body on HTTP %s without retrying',async status=>{
  vi.stubEnv('PSA_API_ACCESS_TOKEN','secret-test-token')
  const log=vi.spyOn(console,'warn').mockImplementation(()=>{})
  try{
   vi.mocked(fetchPublicRemoteUrl).mockResolvedValue(Response.json('API calls quota exceeded! maximum admitted 100 per Day. Please contact collectors-apis@collectors.com',{status}))
   await expect(fetchPsaCertificate(cert)).rejects.toThrow('1日100件')
   expect(fetchPublicRemoteUrl).toHaveBeenCalledTimes(1)
   expect(JSON.stringify(log.mock.calls)).not.toMatch(/secret-test-token|collectors-apis|quota exceeded/)
  }finally{log.mockRestore()}
 })
})
describe('Snkrdunk discovery',()=>{
 it('extracts bounded linked product candidates without treating prices as quotes',()=>{
  const html='<a href="https://snkrdunk.com/apparels/408333" class="tile" aria-label="ピカチュウex SAR [SV8 132/106] - ¥87,990"></a><a aria-label="偽の別ホスト - ¥99" href="https://evil.example/apparels/123"></a><a href="/apparels/4" aria-label="【海外限定】購入いただけません - ¥"></a>'
  expect(parseSnkrdunkSearch(html)).toEqual([{productId:'408333',name:'ピカチュウex SAR [SV8 132/106]',sourceUrl:'https://snkrdunk.com/apparels/408333'}])
 })
 it('matches card number boundaries rather than number substrings',()=>{
  expect(cardNumberMatches('#132','Pikachu ex SAR [SV8 132/106]')).toBe(true)
  expect(cardNumberMatches('132','PIKACHU [SV8 1132/106]')).toBe(false)
  expect(cardNumberMatches('132','PIKACHU [SV8 1320/106]')).toBe(false)
  expect(cardNumberMatches('.*','PIKACHU [132/106]')).toBe(false)
 })
 it('validates returned product IDs and supported brands',async()=>{
  vi.mocked(fetchPublicRemoteUrl).mockResolvedValue(Response.json({id:408333,name:'Pikachu ex [132/106]',localizedName:'ピカチュウex',productNumber:'pkmn-tcg-SV8-132',brands:[{id:'pokemon'}]}))
  expect((await fetchSnkrdunkProduct('408333')).productId).toBe('408333')
  vi.mocked(fetchPublicRemoteUrl).mockResolvedValue(Response.json({id:1,name:'shoe',localizedName:'shoe',productNumber:'shoe',brands:[{id:'nike'}]}))
  await expect(fetchSnkrdunkProduct('1')).rejects.toThrow('以外')
 })
})
