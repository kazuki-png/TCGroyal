// @vitest-environment node
import {afterEach,describe,it,expect,vi} from 'vitest';
import {probeConnection} from '../../../mobile/src/connection-diagnostics';
import {mobileFetch} from '../../../mobile/src/mobile-fetch';
import {networkFailureCode,diagnosticErrorDetail} from '../../../mobile/src/network-errors';
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers()});
describe('mobile connection diagnostics',()=>{
 it('distinguishes an HTTP response body/JSON failure from failure to reach the server',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('invalid-json',{status:401,headers:{'Content-Type':'application/json'}})));
  const result=await probeConnection('API','https://preview.example','unauthenticated');
  expect(result.ok).toBe(false);expect(result.message).toContain('HTTP 401');expect(result.detail).toContain('JSON解析');
 })
 it('preserves native TLS exception details through a nested cause without printing secrets',async()=>{
  const error={message:'fetch failed',cause:{message:'javax.net.ssl.SSLHandshakeException: Trust anchor not found'}};
  expect(networkFailureCode(error)).toBe('tls');
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(error));
  const result=await probeConnection('API','https://preview.example','unauthenticated');
  expect(result.message).toContain('TLS');expect(result.detail).toContain('SSLHandshakeException');
  const token='eyJ01234567890123456789.abcdefghijklmnopqrstuv.signature';
  const detail=diagnosticErrorDetail({message:`fetch failed https://fixture.example?secret=private Bearer ${token} password=private`,stack:'never-include-stack'});
  expect(detail).not.toContain('private');expect(detail).not.toContain(token);expect(detail).not.toContain('never-include-stack');
 })
 it('requests uncompressed business JSON and preserves existing request headers',async()=>{
  const fetch=vi.fn().mockResolvedValue(Response.json({}));vi.stubGlobal('fetch',fetch);
  await mobileFetch('https://preview.example',{method:'POST',headers:{Authorization:'Bearer fixture','Content-Type':'application/json'},body:'{}'});
  const headers=fetch.mock.calls[0][1].headers as Headers;
  expect(headers.get('Accept-Encoding')).toBe('identity');expect(headers.get('Authorization')).toBe('Bearer fixture');expect(headers.get('Content-Type')).toBe('application/json');expect(fetch).toHaveBeenCalledOnce();
 })
 it('treats an application 401 as reachable without sending login information',async()=>{
  const fetch=vi.fn().mockResolvedValue(Response.json({error:'ログインが必要です。'},{status:401}));vi.stubGlobal('fetch',fetch);
  expect(await probeConnection('API','https://preview.example/api/lending/account','unauthenticated')).toMatchObject({ok:true});
  expect(fetch.mock.calls[0][1]).toMatchObject({method:'GET',credentials:'omit',redirect:'manual'});
  expect(fetch.mock.calls[0][1].headers).toEqual({Accept:'application/json'});
 })
 it.each([
  new Response('Protected by Vercel Authentication',{status:401,headers:{'Content-Type':'text/html'}}),
  Response.json({protection:{vercel_auth_enabled:true}},{status:401}),
  new Response(null,{status:302,headers:{Location:'https://vercel.com/sso'}}),
 ])('does not mistake Vercel protection for application reachability',async response=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response));
  expect(await probeConnection('API','https://preview.example/api/lending/account','unauthenticated')).toMatchObject({ok:false});
 })
 it('labels an Android DNS failure separately from authentication',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(Error('fetch failed: java.net.UnknownHostException: Unable to resolve host "fixture.invalid"')));
  const result=await probeConnection('API','https://fixture.invalid','unauthenticated');
  expect(result.ok).toBe(false);expect(result.message).toContain('DNS');expect(result.message).not.toContain('有効期限');
 })
 it('times out a stalled transport check',async()=>{
  vi.useFakeTimers();vi.stubGlobal('fetch',vi.fn((_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))))));
  const result=probeConnection('API','https://preview.example','unauthenticated');await vi.advanceTimersByTimeAsync(12000);
  expect((await result).message).toContain('時間内');
 })
 it('does not retry a mutation after an uncertain network failure',async()=>{
  const fetch=vi.fn().mockRejectedValue(Error('fetch failed: java.net.UnknownHostException'));vi.stubGlobal('fetch',fetch);
  await expect(mobileFetch('https://preview.example/api/lending/catalog',{method:'POST',body:'fixture'})).rejects.toThrow('DNS');
  expect(fetch).toHaveBeenCalledOnce();
 })
 it('does not turn an HTTP error response into a transport retry',async()=>{
  const response=Response.json({error:'conflict'},{status:409}),fetch=vi.fn().mockResolvedValue(response);vi.stubGlobal('fetch',fetch);
  expect(await mobileFetch('https://preview.example',{method:'POST'})).toBe(response);expect(fetch).toHaveBeenCalledOnce();
  expect(networkFailureCode(Error('conflict'))).toBeNull();
 })
})
