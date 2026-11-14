import {z} from 'zod'
const history=z.object({history:z.array(z.object({price:z.number().int().positive().max(1_000_000_000),date:z.string().optional(),condition:z.string().trim().min(1).max(80),size:z.string().max(40).optional().default('')})).max(300)})
export type ObservedMarket={fetchedAt:string;prices:number[]}
const DAY=86400000;
// Calendar months, in Japan time, clamped at month end (not a fixed 90 days).
export function monthsBefore(now:Date,months:number){
 const japan=new Date(now.getTime()+9*3600000),day=japan.getUTCDate();
 japan.setUTCDate(1);japan.setUTCMonth(japan.getUTCMonth()-months);
 const end=new Date(Date.UTC(japan.getUTCFullYear(),japan.getUTCMonth()+1,0)).getUTCDate();
 japan.setUTCDate(Math.min(day,end));return japan.getTime()-9*3600000;
}
export function saleTime(value:string|undefined,now:Date):number|null{
 if(!value)return null;
 const s=value.normalize('NFKC').trim();
 if(s==='たった今'||s==='今')return now.getTime();
 const relative=/^(\d+)\s*(秒|分|時間|日|週間|か月|ヶ月|カ月|年)前$/.exec(s);
 if(relative){const n=Number(relative[1]),unit=relative[2];if(!Number.isSafeInteger(n))return null;
  // Rounded month/year labels do not establish an exact date at the boundary.
  if(['か月','ヶ月','カ月','年'].includes(unit))return unit==='年'||n>=3?null:monthsBefore(now,n);
  return now.getTime()-n*({秒:1000,分:60000,時間:3600000,日:DAY,週間:7*DAY}[unit]??Infinity);
 }
 const date=/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(s);
 if(date){const y=Number(date[1]),m=Number(date[2]),d=Number(date[3]),t=Date.UTC(y,m-1,d);const check=new Date(t);return check.getUTCFullYear()===y&&check.getUTCMonth()===m-1&&check.getUTCDate()===d?t-9*3600000:null;}
 if(!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(s))return null;
 const t=Date.parse(s);return Number.isFinite(t)?t:null;
}
export function observeMarket(payload:unknown,now=new Date(),conditions:readonly string[]=['PSA10']):ObservedMarket{
 const cutoff=monthsBefore(now,3);
 const rows=history.parse(payload).history.filter(row=>{const t=saleTime(row.date,now);return conditions.includes(row.condition)&&t!==null&&t>=cutoff&&t<=now.getTime()});
 const prices=rows.map(row=>{const size=row.size.normalize('NFKC').trim(),quantity=size===''?1:Number(/^(\d{1,3})枚$/.exec(size)?.[1]);if(!Number.isInteger(quantity)||quantity<1||quantity>100)throw Error('取引価格の枚数単位を確認できません。');return row.price/quantity});
 return {fetchedAt:now.toISOString(),prices};
}
export function valueObservedMarket(market:ObservedMarket,quantity:number,now=new Date()){
 const unavailable=(reason:string)=>({amountJpy:null,valuationJpy:null,score:null,ltvPercent:null,reason});
 const age=now.getTime()-Date.parse(market.fetchedAt);
 if(!Number.isFinite(age)||age<0||age>=300000)return unavailable('価格データの期限が切れています。再計算してください。');
 if(!Number.isInteger(quantity)||quantity<1||quantity>100)return unavailable('枚数を確認してください。');
 if(market.prices.length>300||market.prices.some(price=>!Number.isFinite(price)||price<=0||price>1_000_000_000))return unavailable('成約価格を確認できません。');
 if(!market.prices.length)return unavailable('直近3か月の同じ鑑定状態の取引履歴を確認できないため、個別査定となります。');
 const mean=market.prices.reduce((sum,price)=>sum+price,0)/market.prices.length;
 const ltvPercent=market.prices.length>=30?50:market.prices.length>=10?40:30;
 return {amountJpy:Math.floor(mean*ltvPercent/100)*quantity,valuationJpy:Math.floor(mean)*quantity,score:null,ltvPercent,reason:`直近3か月の確認済み${market.prices.length}件（取得上限300件）の平均を評価額とし、取引件数に応じた${ltvPercent}%で計算。正式条件は現物確認後に確定します。`};
}
