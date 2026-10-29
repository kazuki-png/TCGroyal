import {act,cleanup,renderHook} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
vi.mock('@/mobile/node_modules/react/index.js',async()=>vi.importActual('react'));
const mocks=vi.hoisted(()=>({api:vi.fn()}));
vi.mock('@/mobile/src/api',()=>({lendingApi:mocks.api}));
import {useReferenceEstimate} from '@/mobile/src/use-reference-estimate';
import type {CollateralItem} from '@/lib/lending/collateral-types';
const item:CollateralItem={id:'30000000-0000-4000-8000-000000000001',name:'カード',cardNumber:'001',quantity:1,grade:'PSA10',condition:'良好',source:'snkrdunk',productId:'123',cardUid:null};
const estimate={status:'reference',amountJpy:100000,expiresAt:'2099-01-01T00:00:00Z'};
const tick=async(ms=600)=>act(async()=>{await vi.advanceTimersByTimeAsync(ms)});
beforeEach(()=>{vi.useFakeTimers();vi.clearAllMocks();mocks.api.mockResolvedValue({estimate})});
afterEach(()=>{cleanup();vi.useRealTimers()});
describe('automatic card reference calculation',()=>{
 it('calculates on selection exactly once, without a button, polling or render loops',async()=>{
  const {result,rerender}=renderHook(({items})=>useReferenceEstimate(items),{initialProps:{items:[] as CollateralItem[]}});
  await tick();expect(mocks.api).not.toHaveBeenCalled();rerender({items:[item]});expect(result.current.loading).toBe(true);await tick();
  expect(mocks.api).toHaveBeenCalledOnce();expect(result.current.estimate).toEqual(estimate);rerender({items:[{...item}]});await tick(60000);expect(mocks.api).toHaveBeenCalledOnce();
 })
 it('debounces rapid candidate and quantity changes and recalculates the final quantity',async()=>{
  const {rerender}=renderHook(({items})=>useReferenceEstimate(items),{initialProps:{items:[item]}});
  await tick(200);rerender({items:[{...item,productId:'456'}]});await tick(200);rerender({items:[{...item,productId:'456',quantity:3}]});await tick();
  expect(mocks.api).toHaveBeenCalledOnce();expect(mocks.api.mock.calls[0][1].body.items[0]).toMatchObject({productId:'456',quantity:3});
 })
 it('ignores condition typing but invalidates immediately when the grade changes',async()=>{
  const {result,rerender}=renderHook(({items})=>useReferenceEstimate(items),{initialProps:{items:[item]}});await tick();
  rerender({items:[{...item,condition:'追加メモ'}]});await tick();expect(mocks.api).toHaveBeenCalledOnce();
  rerender({items:[{...item,grade:'未鑑定'}]});expect(result.current.estimate).toBeNull();await tick();expect(mocks.api).toHaveBeenCalledTimes(2);
 })
 it('aborts old requests and discards late responses after another card is selected',async()=>{
  let complete!:(value:unknown)=>void;mocks.api.mockImplementationOnce(()=>new Promise(resolve=>{complete=resolve}));
  const {result,rerender,unmount}=renderHook(({items})=>useReferenceEstimate(items),{initialProps:{items:[item]}});await tick();const signal=mocks.api.mock.calls[0][1].signal;
  rerender({items:[{...item,productId:'456'}]});expect(signal.aborted).toBe(true);await tick();expect(result.current.estimate).toEqual(estimate);
  await act(async()=>complete({estimate:{amountJpy:999999}}));expect(result.current.estimate).toEqual(estimate);unmount();
 })
 it('does not retry failures automatically; explicit refresh retries once',async()=>{
  mocks.api.mockRejectedValueOnce(Error('temporarily unavailable'));const {result}=renderHook(()=>useReferenceEstimate([item]));await tick();expect(result.current.error).toBe('temporarily unavailable');await tick(60000);expect(mocks.api).toHaveBeenCalledOnce();
  act(()=>result.current.refresh());await tick();expect(mocks.api).toHaveBeenCalledTimes(2);expect(result.current.estimate).toEqual(estimate);
 })
 it('skips invalid or disabled baskets and aborts on unmount',async()=>{
  const {rerender,unmount}=renderHook(({items,enabled})=>useReferenceEstimate(items,enabled),{initialProps:{items:[{...item,quantity:0}],enabled:true}});await tick();expect(mocks.api).not.toHaveBeenCalled();
  rerender({items:[item],enabled:false});await tick();expect(mocks.api).not.toHaveBeenCalled();rerender({items:[item],enabled:true});await tick();const signal=mocks.api.mock.calls[0][1].signal;unmount();expect(signal.aborted).toBe(true);
 })
});
