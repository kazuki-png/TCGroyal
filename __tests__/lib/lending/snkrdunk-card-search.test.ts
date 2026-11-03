// @vitest-environment node
import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
vi.mock('@/lib/security/safeRemoteFetch',()=>({fetchPublicRemoteUrl:vi.fn()}));
vi.mock('@/lib/lending/card-references',()=>({saveCardReferences:vi.fn().mockResolvedValue(undefined)}));
import {fetchPublicRemoteUrl} from '@/lib/security/safeRemoteFetch';
import {saveCardReferences} from '@/lib/lending/card-references';
const product=(id=123)=>({id,localizedName:'検証カード [SV 001/100]',brands:[{id:'pokemon'}],apparelInfo:{isTradingCard:true},categories:[{name:'trading-card-single'}],primaryMedia:{imageUrl:'https://cdn.snkrdunk.com/fixture.webp'},minPrice:999999});
beforeEach(()=>{vi.resetModules();vi.clearAllMocks()});
afterEach(()=>vi.useRealTimers());
describe('Snkrdunk JSON card discovery',()=>{
 it('keeps promo identity while using the upstream space-delimited search syntax',async()=>{
  vi.mocked(fetchPublicRemoteUrl).mockResolvedValueOnce(Response.json({streetwears:[]}));
  const {searchSnkrdunkCards}=await import('@/lib/lending/snkrdunk-card-search');await searchSnkrdunkCards('150/XY-P','pokemon',1);
  expect(vi.mocked(fetchPublicRemoteUrl).mock.calls[0][0].searchParams.get('keyword')).toBe('150 XY-P');
 });
 it('uses dotted level syntax and a separately cached larger bounded image-search page',async()=>{
  vi.mocked(fetchPublicRemoteUrl).mockImplementation(async()=>Response.json({streetwears:[]}));
  const {searchSnkrdunkCards}=await import('@/lib/lending/snkrdunk-card-search');
  await searchSnkrdunkCards('ライチュウ LV32','pokemon',1,12);await searchSnkrdunkCards('ライチュウ LV32','pokemon',1);
  const urls=vi.mocked(fetchPublicRemoteUrl).mock.calls.map(call=>call[0]);
  expect(urls[0].searchParams.get('keyword')).toBe('ライチュウ LV.32');expect(urls.map(url=>url.searchParams.get('perPage'))).toEqual(['12','6']);
 });
 it('shares an eight-second budget across the keyword request and detail reads',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-03T00:00:00Z'));
  vi.mocked(fetchPublicRemoteUrl).mockImplementation(async url=>{
   if(url.pathname.endsWith('/search')){vi.setSystemTime(Date.now()+3000);return Response.json({streetwears:[{id:123,isTradingCard:true}]})}
   return Response.json(product());
  });
  const {searchSnkrdunkCards}=await import('@/lib/lending/snkrdunk-card-search');await searchSnkrdunkCards('時間制限','all',1);
  expect(vi.mocked(fetchPublicRemoteUrl).mock.calls.map(call=>call[1]?.timeoutMs)).toEqual([8000,5000]);
 });
 it('uses the verified keyword API, obtains Japanese details, and strips all market prices',async()=>{
  vi.mocked(fetchPublicRemoteUrl).mockResolvedValueOnce(Response.json({streetwears:[{id:123,isTradingCard:true},{id:456,isTradingCard:false}],sneakers:[{id:'ignore'}]})).mockResolvedValueOnce(Response.json(product()));
  const {searchSnkrdunkCards}=await import('@/lib/lending/snkrdunk-card-search');
  const result=await searchSnkrdunkCards('ピカチュウ','all',1);
  const url=vi.mocked(fetchPublicRemoteUrl).mock.calls[0][0];expect(url.href).toContain('https://snkrdunk.com/en/v1/search?');expect(url.searchParams.get('keyword')).toBe('ピカチュウ');expect(url.searchParams.get('perPage')).toBe('6');
  expect(result.cards).toEqual([{productId:'123',name:'検証カード [SV 001/100]',cardNumber:'SV 001/100',category:'pokemon',imageUrl:'https://cdn.snkrdunk.com/fixture.webp',sourceUrl:'https://snkrdunk.com/apparels/123'}]);
  expect(JSON.stringify(result)).not.toContain('999999');expect(fetchPublicRemoteUrl).toHaveBeenCalledTimes(2);
  expect(await searchSnkrdunkCards('ピカチュウ','all',1)).toEqual(result);expect(fetchPublicRemoteUrl).toHaveBeenCalledTimes(2);
  expect(saveCardReferences).toHaveBeenCalledExactlyOnceWith(result.cards);
 });
 it('does not treat HTTP failure or changed schemas as an empty successful search or retry them',async()=>{
  const {searchSnkrdunkCards}=await import('@/lib/lending/snkrdunk-card-search');
  vi.mocked(fetchPublicRemoteUrl).mockResolvedValueOnce(new Response('blocked',{status:403}));
  await expect(searchSnkrdunkCards('カード','all',1)).rejects.toThrow();expect(fetchPublicRemoteUrl).toHaveBeenCalledOnce();
  vi.mocked(fetchPublicRemoteUrl).mockResolvedValueOnce(Response.json({changed:[]}));
  await expect(searchSnkrdunkCards('カード','all',1)).rejects.toThrow();expect(fetchPublicRemoteUrl).toHaveBeenCalledTimes(2);
 });
 it('rejects another product ID and excludes boxes, apparel and arbitrary image hosts',async()=>{
  const {parseSnkrdunkCard}=await import('@/lib/lending/snkrdunk-card-search');
  expect(()=>parseSnkrdunkCard(product(),'999')).toThrow();
  expect(parseSnkrdunkCard({...product(),categories:[{name:'trading-card-box'}]},'123')).toBeNull();
  expect(parseSnkrdunkCard({...product(),apparelInfo:{isTradingCard:false}},'123')).toBeNull();
  expect(parseSnkrdunkCard({...product(),primaryMedia:{imageUrl:'https://evil.example/card.webp'}},'123')?.imageUrl).toBeNull();
 });
 it('coalesces concurrent searches and limits detail reads to two simultaneous requests',async()=>{
  let active=0,peak=0;
  vi.mocked(fetchPublicRemoteUrl).mockImplementation(async url=>{
   if(url.pathname.endsWith('/search'))return Response.json({streetwears:Array.from({length:6},(_,i)=>({id:i+1,isTradingCard:true}))});
   active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,5));active--;return Response.json(product(Number(url.pathname.split('/').at(-1))));
  });
  const {searchSnkrdunkCards}=await import('@/lib/lending/snkrdunk-card-search');
  const [a,b]=await Promise.all([searchSnkrdunkCards('同時検索','all',1),searchSnkrdunkCards('同時検索','all',1)]);
  expect(a).toEqual(b);expect(a.hasMore).toBe(true);expect(peak).toBe(2);expect(fetchPublicRemoteUrl).toHaveBeenCalledTimes(7);
 });
 it('bounds inputs and filters categories without inventing totals or quotes',async()=>{
  const {searchSnkrdunkCards}=await import('@/lib/lending/snkrdunk-card-search');
  await expect(searchSnkrdunkCards('','all',1)).rejects.toThrow();await expect(searchSnkrdunkCards('カード','all',101)).rejects.toThrow();expect(fetchPublicRemoteUrl).not.toHaveBeenCalled();
  vi.mocked(fetchPublicRemoteUrl).mockResolvedValueOnce(Response.json({streetwears:[{id:123,isTradingCard:true}]})).mockResolvedValueOnce(Response.json(product()));
  expect(await searchSnkrdunkCards('カード','onepiece',2)).toEqual({cards:[],page:2,hasMore:false});
 });
});
