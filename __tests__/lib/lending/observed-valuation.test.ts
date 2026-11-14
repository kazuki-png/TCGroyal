import {describe,it,expect} from 'vitest'
import {observeMarket,valueObservedMarket} from '@/lib/lending/observed-valuation'
const now=new Date('2026-11-04T03:00:00Z'),fetchedAt=now.toISOString()
const row={price:400000,date:'2026/11/03',condition:'PSA10',size:''}
const market=(prices:number[])=>({fetchedAt,prices})
describe('three calendar month sales and volume tiers',()=>{
 it('quotes a single recent trade at thirty percent',()=>{
  const data=observeMarket({history:[row]},now)
  expect(valueObservedMarket(data,1,now)).toMatchObject({amountJpy:120000,score:null,ltvPercent:30})
  expect(valueObservedMarket(market([1000]),1,now).amountJpy).toBe(300)
 })
 it('uses the arithmetic mean including outliers, rather than the median or a liquidity tier',()=>{
  expect(valueObservedMarket(market([10000,10000,100000]),1,now).amountJpy).toBe(12000)
  expect(valueObservedMarket(market([333333]),3,now).amountJpy).toBe(299997)
 })
 it('normalizes multi-card lots before averaging and excludes other declared grades',()=>{
  const data=observeMarket({history:[{...row,price:20000,size:'2枚'},{...row,price:50000,condition:'PSA9'}]},now)
  expect(data.prices).toEqual([10000]);expect(valueObservedMarket(data,2,now).amountJpy).toBe(6000)
  expect(observeMarket({history:[{...row,condition:'PSA9'}]},now,['PSA9']).prices).toEqual([400000])
 })
 it('uses consultation only for an empty matching history; invalid data and stale data remain distinct',()=>{
  expect(valueObservedMarket(market([]),1,now)).toMatchObject({amountJpy:null,reason:expect.stringContaining('同じ鑑定状態')})
  expect(valueObservedMarket(market([1000]),1,new Date(now.getTime()+300000)).reason).toContain('期限')
  expect(valueObservedMarket(market([NaN]),1,now).reason).toContain('確認できません')
  expect(valueObservedMarket(market([1000]),0,now).reason).toContain('枚数')
 })
 it.each([{price:0},{price:1.2},{size:'unknown'}])('rejects malformed amounts or unknown lot units',patch=>{
  expect(()=>observeMarket({history:[{...row,...patch}]},now)).toThrow()
 })
})

it.each([[1,30],[9,30],[10,40],[29,40],[30,50],[300,50]])('uses %i transactions for the %i percent tier',(count,percent)=>{
 const value=valueObservedMarket(market(Array(count).fill(10000)),2,now);
 expect(value).toMatchObject({amountJpy:10000*percent/100*2,valuationJpy:20000,ltvPercent:percent});
});
it('excludes old, unknown and future dates before counting trades',()=>{
 const data=observeMarket({history:[row,{...row,date:'2020/01/01'},{...row,date:'2026/12/01'},{...row,date:'unknown'},{...row,date:'3ヶ月前'}]},now);
 expect(data.prices).toHaveLength(1);
 expect(observeMarket({history:[{...row,date:'2020/01/01'}]},now).prices).toHaveLength(0);
});
it('uses a calendar-month cutoff, including its exact boundary',()=>{
 const end=new Date('2026-05-31T03:00:00Z');
 const data=observeMarket({history:[{...row,date:'2026-02-28T03:00:00Z'},{...row,date:'2026-02-28T02:59:59Z'},{...row,date:'1日前'}]},end);
 expect(data.prices).toHaveLength(2);
});
