import 'server-only'
import {fetchPublicRemoteUrl} from '@/lib/security/safeRemoteFetch'
import {parseSnkrdunkCard} from './snkrdunk-card-search'
import {observeMarket,valueObservedMarket,type ObservedMarket} from './observed-valuation'
import type {CollateralItem} from './collateral-types'
import type {BundleEstimate} from './bundle-estimate-types'

type Snapshot={name:string;cardNumber:string;market:ObservedMarket}
const psa10=(grade:string)=>grade.normalize('NFKC').replace(/\s/g,'').toUpperCase()==='PSA10'
const cache=new Map<string,Snapshot>(),pending=new Map<string,Promise<Snapshot>>()
async function json(path:string){
 const response=await fetchPublicRemoteUrl(new URL(`https://snkrdunk.com${path}`),{timeoutMs:5000,maxBytes:256000,maxRedirects:0,headers:{Accept:'application/json','User-Agent':'TCG-Royal-Preview/1.15'}})
 if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw Error('market_unavailable')
 return response.json()
}
async function snapshot(productId:string):Promise<Snapshot>{
 if(!/^[1-9]\d{0,8}$/.test(productId))throw Error('invalid_product')
 const now=Date.now()
 for(const [key,value] of cache)if(now-Date.parse(value.market.fetchedAt)>=300000)cache.delete(key)
 const saved=cache.get(productId);if(saved)return saved
 const active=pending.get(productId);if(active)return active
 if(pending.size>=2)throw Error('market_busy')
 const work=(async()=>{
  // Fixed, observed Web API, not a contracted partner API. One bounded history
  // response per product, no crawling, pagination loops or automatic retries.
  const card=parseSnkrdunkCard(await json(`/v1/apparels/${productId}`),productId)
  if(!card)throw Error('unsupported_product')
  const market=observeMarket(await json(`/v1/apparels/${productId}/sales-history?page=1&per_page=300&condition_id=22`))
  const result={name:card.name,cardNumber:card.cardNumber,market}
  if(cache.size>=60)cache.delete(cache.keys().next().value!)
  cache.set(productId,result);return result
 })()
 pending.set(productId,work)
 try{return await work}finally{pending.delete(productId)}
}
export async function estimateBundle(items:CollateralItem[]):Promise<BundleEstimate>{
 const started=Date.now(),lines:BundleEstimate['lines']=[],quantities=new Map<string,number>()
 for(const item of items)if(item.source==='snkrdunk'&&item.productId)quantities.set(item.productId,(quantities.get(item.productId)??0)+item.quantity)
 const snapshots=new Map<string,Snapshot|null>()
 const ids=[...new Set(items.filter(item=>item.source==='snkrdunk'&&item.productId&&psa10(item.grade)).map(item=>item.productId!))]
 // Two reads in flight per process; a single basket gets a bounded time budget.
 for(let i=0;i<ids.length;i+=2){
  if(Date.now()-started>20000)break
  await Promise.all(ids.slice(i,i+2).map(async id=>{try{snapshots.set(id,await snapshot(id))}catch{snapshots.set(id,null)}}))
 }
 let expiresAt=Date.now()+300000
 for(const item of items){
  const line:BundleEstimate['lines'][number]={id:item.id,name:item.name,quantity:item.quantity,amountJpy:null,score:null,ltvPercent:null,reason:'登録カード・手入力カードは、サポートが商品対応を確認して個別査定します。'}
  if(item.source==='snkrdunk'&&item.productId){
   const data=snapshots.get(item.productId)
   if(!psa10(item.grade))line.reason='自動参考額はPSA10が対象です。その他の鑑定・未鑑定カードは個別査定します。'
   else if(!data)line.reason='成約データを取得できません。時間をおいて再計算するか、個別査定を依頼してください。'
   else{
    line.name=data.name;expiresAt=Math.min(expiresAt,Date.parse(data.market.fetchedAt)+300000)
    if(item.cardNumber.normalize('NFKC').trim()!==data.cardNumber.normalize('NFKC').trim())line.reason='選択した商品とカード番号が異なるため、個別査定します。'
    else{
     // Evaluate combined quantities before valuing individual lines; splitting
     // one product into multiple basket rows must not bypass the volume guard.
     const value=valueObservedMarket(data.market,quantities.get(item.productId)!)
     Object.assign(line,value,{amountJpy:value.amountJpy===null?null:value.amountJpy/quantities.get(item.productId)!*item.quantity})
    }
   }
  }
  lines.push(line)
 }
 const all=lines.every(line=>line.amountJpy!==null),total=Math.floor(lines.reduce((sum,line)=>sum+(line.amountJpy??0),0)/10000)*10000
 const amountJpy=all&&total>=100000?Math.min(total,10000000):null
 return {ruleVersion:'snkrdunk-observed-30d-v1',calculatedAt:new Date().toISOString(),expiresAt:new Date(expiresAt).toISOString(),status:amountJpy===null?'manual':'reference',amountJpy,lines,
  reason:!all?'個別査定が必要なカードが含まれるため、全体の参考額は提示していません。':total<100000?'合計参考額が最低融資額10万円を下回ります。個別にご相談ください。':'参考額は融資承認ではありません。現物検品・本人確認・最終見積もりへの同意が必要です。合計は1万円単位で切り下げ、上限1,000万円です。'}
}
