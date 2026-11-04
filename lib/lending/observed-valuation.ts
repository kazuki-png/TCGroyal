import {z} from 'zod'

const history=z.object({history:z.array(z.object({price:z.number().int().positive().max(1_000_000_000),condition:z.string().trim().min(1).max(80),size:z.string().max(40).optional().default('')})).max(300)})
export type ObservedMarket={fetchedAt:string;prices:number[]}

// This is a bounded sample of returned sales, not a claim of lifetime coverage.
// Convert multi-card lots to a per-card price before taking the arithmetic mean.
export function observeMarket(payload:unknown,now=new Date(),conditions:readonly string[]=['PSA10']):ObservedMarket{
 const rows=history.parse(payload).history.filter(row=>conditions.includes(row.condition))
 const prices=rows.map(row=>{
  const size=row.size.normalize('NFKC').trim(),quantity=size===''?1:Number(/^(\d{1,3})枚$/.exec(size)?.[1])
  if(!Number.isInteger(quantity)||quantity<1||quantity>100)throw Error('取引価格の枚数単位を確認できません。')
  return row.price/quantity
 })
 return {fetchedAt:now.toISOString(),prices}
}
export function valueObservedMarket(market:ObservedMarket,quantity:number,now=new Date()){
 const unavailable=(reason:string)=>({amountJpy:null,score:null,ltvPercent:null,reason})
 const age=now.getTime()-Date.parse(market.fetchedAt)
 if(!Number.isFinite(age)||age<0||age>=300000)return unavailable('価格データの期限が切れています。再計算してください。')
 if(!Number.isInteger(quantity)||quantity<1||quantity>100)return unavailable('枚数を確認してください。')
 if(market.prices.length>300||market.prices.some(price=>!Number.isFinite(price)||price<=0||price>1_000_000_000))return unavailable('成約価格を確認できません。')
 if(!market.prices.length)return unavailable('同じ鑑定状態の取引履歴がありません（取得できた過去最大300件の範囲）。個別にご相談ください。')
 const mean=market.prices.reduce((sum,price)=>sum+price,0)/market.prices.length
 const amountJpy=Math.floor(mean*30/100)*quantity
 return {amountJpy,score:null,ltvPercent:30 as const,reason:`取得できた同じ鑑定状態の過去${market.prices.length}件（最大300件）の1枚あたり平均取引価格の30%を、1円未満切り捨てで参考計算しています。`}
}
