import {z} from 'zod'
import {liquidityTier} from './valuation'

const DAY=86400000
const history=z.object({history:z.array(z.object({price:z.number().int().positive().max(1_000_000_000),date:z.string().min(1).max(40),condition:z.literal('PSA10'),size:z.enum(['','1枚'])})).max(300)})
export type ObservedMarket={fetchedAt:string;count30d:number;recentPrices:number[]}

// Include a sale only when its entire possible date interval falls within the
// window. Relative dates have no exact timestamp, so allow an extra day on
// either side. This deliberately undercounts boundary sales; it never projects
// a truncated page into an estimated total or calls the count an exact average.
export function saleInterval(value:string,now:number):[number,number]|null{
 const relative=/^(\d{1,3})(秒|分|時間|日)前$/.exec(value)
 if(relative){const n=Number(relative[1]),unit=relative[2]==='日'?DAY:relative[2]==='時間'?3600000:relative[2]==='分'?60000:1000;return [now-(n+1)*unit,Math.min(now,now-Math.max(0,n-1)*unit)]}
 const match=/^(\d{4})\/(\d{2})\/(\d{2})$/.exec(value)
 if(!match)return null
 const y=Number(match[1]),m=Number(match[2]),d=Number(match[3]),utc=Date.UTC(y,m-1,d)
 const check=new Date(utc)
 if(check.getUTCFullYear()!==y||check.getUTCMonth()!==m-1||check.getUTCDate()!==d)return null
 const start=utc-9*3600000 // Snkrdunk Japanese calendar date, JST.
 return start>now?null:[start,Math.min(start+DAY,now)]
}
export function observeMarket(payload:unknown,now=new Date()):ObservedMarket{
 const rows=history.parse(payload).history,time=now.getTime()
 const dated=rows.map(row=>{const interval=saleInterval(row.date,time);if(!interval)throw Error('成約日を確認できません。');return {...row,interval}})
 return {fetchedAt:now.toISOString(),count30d:dated.filter(row=>row.interval[0]>=time-30*DAY).length,
  recentPrices:dated.filter(row=>row.interval[0]>=time-7*DAY).slice(0,20).map(row=>row.price)}
}
export function valueObservedMarket(market:ObservedMarket,quantity:number,now=new Date()){
 const manual=(reason:string)=>({amountJpy:null,score:null,ltvPercent:null,reason})
 const age=now.getTime()-Date.parse(market.fetchedAt)
 if(!Number.isFinite(age)||age<0||age>=300000)return manual('価格データの期限が切れています。再計算してください。')
 if(!Number.isInteger(quantity)||quantity<1||quantity>100)return manual('枚数を確認してください。')
 if(!Number.isInteger(market.count30d)||market.count30d<0||market.count30d>300)return manual('成約件数を確認できません。')
 const tier=liquidityTier(market.count30d/30)
 if(!tier)return manual('30日間の成約を30件以上確認できないため、個別査定します。')
 if(quantity>Math.floor(market.count30d/30))return manual('まとめて預ける枚数が確認できた1日あたりの成約件数を超えるため、個別査定します。')
 const prices=[...market.recentPrices].sort((a,b)=>a-b)
 if(prices.length<5||prices.length>20||prices.some(price=>!Number.isSafeInteger(price)||price<=0||price>1_000_000_000))return manual('直近7日間の成約価格を5件以上確認できないため、個別査定します。')
 if(prices.at(-1)!>prices[0]*1.5)return manual('成約価格のばらつきが大きいため、個別査定します。')
 const middle=Math.floor(prices.length/2),median=prices.length%2?prices[middle]:Math.floor((prices[middle-1]+prices[middle])/2)
 const amountJpy=Math.floor(median*tier.ltvPercent/100/1000)*1000*quantity
 return {amountJpy,score:tier.score,ltvPercent:tier.ltvPercent,reason:'確認できた30日間の成約件数の下限で判定。直近7日間・最大20件の成約価格の中央値から参考計算しています。'}
}
