import 'server-only'
import {z} from 'zod'
import {fetchPublicRemoteUrl} from '@/lib/security/safeRemoteFetch'
import type {SnkrdunkCard,SnkrdunkCardSearch} from './snkrdunk-card-types'

const pageSize=6,ttl=5*60*1000
const cache=new Map<string,{until:number;result:SnkrdunkCardSearch}>()
const pending=new Map<string,Promise<SnkrdunkCardSearch>>()
const id=z.number().int().positive().max(999999999)
const searchSchema=z.object({streetwears:z.array(z.object({id,isTradingCard:z.boolean().optional()})).max(100)})
const productSchema=z.object({id,localizedName:z.string().trim().min(1).max(500),
 brands:z.array(z.object({id:z.string().max(100)})).max(20),
 apparelInfo:z.object({isTradingCard:z.boolean()}),
 categories:z.array(z.object({name:z.string().max(100)})).max(20),
 primaryMedia:z.object({imageUrl:z.string().max(2000)}).optional(),
})
async function json(url:URL){
 const response=await fetchPublicRemoteUrl(url,{timeoutMs:8000,maxBytes:256000,maxRedirects:0,headers:{Accept:'application/json','User-Agent':'TCG-Royal-Preview/1.13'}})
 if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw Error('スニダンのカード検索を利用できません。時間をおくか、登録カード検索・個別見積もりをご利用ください。')
 return response.json()
}
export function parseSnkrdunkCard(value:unknown,productId:string):SnkrdunkCard|null{
 const product=productSchema.parse(value)
 if(String(product.id)!==productId)throw Error('スニダンの商品情報が一致しません。検索し直してください。')
 const category=product.brands.some(b=>b.id==='pokemon')?'pokemon':product.brands.some(b=>b.id==='onepiece')?'onepiece':null
 if(!category||!product.apparelInfo.isTradingCard||!product.categories.some(c=>c.name==='trading-card-single'))return null
 let imageUrl:string|null=null
 try{const url=new URL(product.primaryMedia?.imageUrl??'');if(url.protocol==='https:'&&url.hostname==='cdn.snkrdunk.com'&&!url.username&&!url.password&&!url.port)imageUrl=url.href}catch{}
 return {productId,name:product.localizedName,category,cardNumber:product.localizedName.match(/\[([^\]]{1,100})\]/)?.[1]??'',imageUrl,sourceUrl:`https://snkrdunk.com/apparels/${productId}`}
}
export async function searchSnkrdunkCards(query:string,category:'all'|'pokemon'|'onepiece',page:number):Promise<SnkrdunkCardSearch>{
 if(!query.trim()||query.length>100||!Number.isInteger(page)||page<1||page>100)throw Error('カード名・型番を入力してください。')
 const key=JSON.stringify([query.trim(),category,page]),now=Date.now()
 for(const [entry,value] of cache)if(value.until<=now)cache.delete(entry)
 const saved=cache.get(key);if(saved)return saved.result
 const active=pending.get(key);if(active)return active
 if(pending.size>=10)throw Error('カード検索が混み合っています。少し待ってからお試しください。')
 const work=(async()=>{
  // Verified read-only Web API. This is not a contracted, version-stable partner API.
  const url=new URL('https://snkrdunk.com/en/v1/search')
  url.searchParams.set('keyword',query.trim());url.searchParams.set('perPage',String(pageSize));url.searchParams.set('page',String(page))
  const data=searchSchema.parse(await json(url)),candidates=[...new Set(data.streetwears.filter(p=>p.isTradingCard===true).map(p=>String(p.id)))].slice(0,pageSize)
  const cards:SnkrdunkCard[]=[]
  // Two simultaneous detail reads at most; obtain Japanese names and validate single-card categories.
  for(let offset=0;offset<candidates.length;offset+=2){
   const group=await Promise.all(candidates.slice(offset,offset+2).map(async productId=>parseSnkrdunkCard(await json(new URL(`https://snkrdunk.com/v1/apparels/${productId}`)),productId)))
   cards.push(...group.filter((card):card is SnkrdunkCard=>!!card&&(category==='all'||card.category===category)))
  }
  const result={cards,page,hasMore:page<100&&data.streetwears.length>=pageSize}
  if(cache.size>=60)cache.delete(cache.keys().next().value!)
  cache.set(key,{until:Date.now()+ttl,result});return result
 })()
 pending.set(key,work)
 try{return await work}finally{pending.delete(key)}
}
