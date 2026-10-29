import {describe,it,expect} from 'vitest'
import {observeMarket,saleInterval,valueObservedMarket} from '@/lib/lending/observed-valuation'
const now=new Date('2026-10-30T03:00:00Z'),fetchedAt=now.toISOString()
const row={price:400000,date:'2026/10/28',condition:'PSA10',size:''}
const payload=(count:number)=>({history:Array.from({length:count},()=>({...row}))})
describe('conservative 30 day liquidity valuation',()=>{
 it.each([[29,null,null],[30,1,40],[149,1,40],[150,2,50],[299,2,50],[300,3,60]])('requires confirmed threshold %s', (count,score,ltv)=>{
  const market=observeMarket(payload(count),now),value=valueObservedMarket(market,1,now)
  expect(value.score).toBe(score);expect(value.ltvPercent).toBe(ltv)
  expect(value.amountJpy).toBe(ltv===null?null:400000*ltv/100)
 })
 it('does not infer 30 days of volume from the latest 20 trades',()=>{
  expect(valueObservedMarket(observeMarket(payload(20),now),1,now).amountJpy).toBeNull()
 })
 it('counts only whole date intervals within the 30 day window, conservatively excluding the boundary',()=>{
  const market=observeMarket({history:[{...row,date:'2026/09/30'},{...row,date:'2026/10/01'},{...row,date:'29日前'},{...row,date:'28日前'}]},now)
  expect(market.count30d).toBe(3)
  expect(observeMarket({history:[{...row,date:'30日前'}]},now).count30d).toBe(0)
  expect(saleInterval('2026/10/28',now.getTime())?.[0]).toBe(Date.parse('2026-10-27T15:00:00Z'))
 })
 it.each(['2026/02/30','2026/13/01','2026/11/01','unknown'])('rejects ambiguous or impossible dates %s',date=>{
  expect(()=>observeMarket({history:[{...row,date}]},now)).toThrow()
 })
 it.each([{condition:'PSA9'},{size:'2枚'},{price:0},{price:1.2}])('rejects grade mixing, bulk lots and malformed prices',patch=>{
  expect(()=>observeMarket({history:[{...row,...patch}]},now)).toThrow()
 })
 it('requires five recent trades and rejects widely varying prices',()=>{
  const market=observeMarket(payload(30),now)
  expect(valueObservedMarket({...market,recentPrices:[1,2,3,4]},1,now).amountJpy).toBeNull()
  expect(valueObservedMarket({...market,recentPrices:[400000,400000,400000,400000,800000]},1,now).amountJpy).toBeNull()
  expect(valueObservedMarket({...market,recentPrices:[400000,400000,400000,400000,600000]},1,now).amountJpy).toBe(160000)
 })
 it('uses the median, rounds down and combines quantity without creating a loan',()=>{
  expect(valueObservedMarket({fetchedAt,count30d:150,recentPrices:[333333,333333,333333,340000,350000]},3,now)).toMatchObject({score:2,ltvPercent:50,amountJpy:498000})
 })
 it('rejects quantities exceeding observed daily capacity and stale snapshots',()=>{
  const market=observeMarket(payload(30),now)
  expect(valueObservedMarket(market,2,now).amountJpy).toBeNull()
  expect(valueObservedMarket(market,1,new Date(now.getTime()+300000)).amountJpy).toBeNull()
  expect(valueObservedMarket({...market,fetchedAt:'invalid'},1,now).amountJpy).toBeNull()
  expect(valueObservedMarket({...market,count30d:Infinity},1,now).amountJpy).toBeNull()
 })
})
