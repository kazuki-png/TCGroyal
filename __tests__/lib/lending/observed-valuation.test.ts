import {describe,it,expect} from 'vitest'
import {observeMarket,valueObservedMarket} from '@/lib/lending/observed-valuation'
const now=new Date('2026-11-04T03:00:00Z'),fetchedAt=now.toISOString()
const row={price:400000,date:'2020/01/01',condition:'PSA10',size:''}
const market=(prices:number[])=>({fetchedAt,prices})
describe('average historical sales at thirty percent',()=>{
 it('quotes a single old trade without recent-volume or minimum-price requirements',()=>{
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
