import 'server-only'
import {fetchPublicRemoteUrl} from '@/lib/security/safeRemoteFetch'
import {parseSnkrdunkCard} from './snkrdunk-card-search'
import {observeMarket,valueObservedMarket,type ObservedMarket} from './observed-valuation'
import type {CollateralItem} from './collateral-types'
import type {BundleEstimate} from './bundle-estimate-types'
import {marketGrade} from './market-grades'
import {saveCardReferences} from './card-references'

type Snapshot={name:string;cardNumber:string;market:ObservedMarket}
const cache=new Map<string,Snapshot>(),pending=new Map<string,Promise<Snapshot>>()
async function json(path:string){
 const response=await fetchPublicRemoteUrl(new URL(`https://snkrdunk.com${path}`),{timeoutMs:5000,maxBytes:256000,maxRedirects:0,headers:{Accept:'application/json','User-Agent':'TCG-Royal-Preview/1.15'}})
 if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw Error('market_unavailable')
 return response.json()
}
async function snapshot(productId:string,grade:NonNullable<ReturnType<typeof marketGrade>>):Promise<Snapshot>{
 if(!/^[1-9]\d{0,8}$/.test(productId))throw Error('invalid_product')
 const now=Date.now()
 for(const [key,value] of cache)if(now-Date.parse(value.market.fetchedAt)>=300000)cache.delete(key)
 const key=productId+':'+grade.key
 const saved=cache.get(key);if(saved)return saved
 const active=pending.get(key);if(active)return active
 if(pending.size>=2)throw Error('market_busy')
 const work=(async()=>{
  // Fixed, observed Web API, not a contracted partner API. One bounded history
  // sample per grade category, no crawling, pagination loops or retries.
  const card=parseSnkrdunkCard(await json(`/v1/apparels/${productId}`),productId)
  if(!card)throw Error('unsupported_product')
  await saveCardReferences([card])
  const prices:number[]=[]
  // The selected categories share a total cap of 300 returned transactions.
  const pageSize=Math.floor(300/grade.ids.length)
  for(const [index,condition] of grade.ids.entries()){
   const part=observeMarket(await json(`/v1/apparels/${productId}/sales-history?page=1&per_page=${pageSize}&condition_id=${condition}`),new Date(),[grade.labels[index]])
   if(part.prices.length>pageSize)throw Error('history_limit_changed')
   prices.push(...part.prices)
  }
  const market={fetchedAt:new Date().toISOString(),prices}
  const result={name:card.name,cardNumber:card.cardNumber,market}
  if(cache.size>=60)cache.delete(cache.keys().next().value!)
  cache.set(key,result);return result
 })()
 pending.set(key,work)
 try{return await work}finally{pending.delete(key)}
}
export async function estimateBundle(items:CollateralItem[]):Promise<BundleEstimate>{
 const started=Date.now(),lines:BundleEstimate['lines']=[]
 const snapshots=new Map<string,Snapshot|null>()
 const requests=new Map<string,{id:string;grade:NonNullable<ReturnType<typeof marketGrade>>}>()
 for(const item of items){const grade=marketGrade(item.grade);if(item.source==='snkrdunk'&&item.productId&&grade)requests.set(item.productId+':'+grade.key,{id:item.productId,grade})}
 const entries=[...requests.entries()]
 // Two product/grade reads in flight; never share cached prices across grades.
 for(let i=0;i<entries.length;i+=2){
  if(Date.now()-started>20000)break
  await Promise.all(entries.slice(i,i+2).map(async([key,{id,grade}])=>{try{snapshots.set(key,await snapshot(id,grade))}catch{snapshots.set(key,null)}}))
 }
 let expiresAt=Date.now()+300000
 for(const item of items){
  const line:BundleEstimate['lines'][number]={id:item.id,name:item.name,quantity:item.quantity,amountJpy:null,score:null,ltvPercent:null,reason:'登録カード・手入力カードは、サポートが商品対応を確認して個別査定します。'}
  if(item.source==='snkrdunk'&&item.productId){
   const grade=marketGrade(item.grade),data=grade?snapshots.get(item.productId+':'+grade.key):null
   if(!grade)line.reason='同じ鑑定区分の取引を特定できません。鑑定会社・グレードを確認して個別にご相談ください。'
   else if(!data)line.reason='成約データを取得できません。時間をおいて再計算するか、個別査定を依頼してください。'
   else{
    line.name=data.name;expiresAt=Math.min(expiresAt,Date.parse(data.market.fetchedAt)+300000)
    if(item.cardNumber.normalize('NFKC').trim()!==data.cardNumber.normalize('NFKC').trim())line.reason='選択した商品とカード番号が異なるため、個別査定します。'
    else{
     Object.assign(line,valueObservedMarket(data.market,item.quantity))
    }
   }
  }
  lines.push(line)
 }
 const all=lines.every(line=>line.amountJpy!==null),total=lines.reduce((sum,line)=>sum+(line.amountJpy??0),0)
 const amountJpy=all?Math.min(total,10000000):null
 return {ruleVersion:'snkrdunk-observed-average-30pct-v2',calculatedAt:new Date().toISOString(),expiresAt:new Date(expiresAt).toISOString(),status:amountJpy===null?'manual':'reference',amountJpy,lines,
  reason:!all?'同じ鑑定状態の取引履歴がないカードや、データを取得できなかったカードは個別相談となります。算出済みの金額はカード別に表示します。':'取得できた同じ鑑定状態の過去取引の平均単価の30%です。参考額は融資承認ではありません。合計上限は1,000万円、正式な条件は現物確認後に確定します。'}
}
