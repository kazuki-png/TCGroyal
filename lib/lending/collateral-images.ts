import 'server-only'
import type {CollateralItem} from './collateral-types'
import {createWorkflowClient} from './workflow-client'

function imageUrl(value:unknown,external:boolean):string|null{
 if(typeof value!=='string'||value.length>2000)return null
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&(!external||url.hostname==='cdn.snkrdunk.com')?url.href:null}catch{return null}
}

// Run only on actor-scoped RPC results. Images are display metadata, never a
// modification to the immutable collateral snapshot or a new provider search.
export async function withCollateralImages<T extends {collateral_items?:CollateralItem[]}>(records:T[]):Promise<T[]>{
 const items=records.flatMap(record=>record.collateral_items??[])
 const external=[...new Set(items.filter(item=>item.source==='snkrdunk'&&item.productId).map(item=>item.productId!))]
 const catalog=[...new Set(items.filter(item=>item.source==='catalog'&&item.cardUid).map(item=>item.cardUid!))]
 if(!external.length&&!catalog.length)return records
 const images=new Map<string,string>(),signal=AbortSignal.timeout(2500)
 try{
  const db=createWorkflowClient()
  await Promise.all([load(external,true),load(catalog,false)])
  async function load(ids:string[],provider:boolean){
   const column=provider?'product_id':'public_uid'
   for(let start=0;start<ids.length&&!signal.aborted;start+=100){
    try{
     let query=db.from(provider?'lending_card_references':'cards').select(`${column},image_url`).in(column,ids.slice(start,start+100))
     if(provider)query=query.eq('provider','snkrdunk')
     const {data,error}=await query.abortSignal(signal)
     if(error)continue
     for(const row of data??[]){const url=imageUrl(row.image_url,provider);if(url)images.set(`${provider?'snkrdunk':'catalog'}:${'product_id' in row?row.product_id:row.public_uid}`,url)}
    }catch{break}
   }
  }
 }catch{/* Reference outages must not hide the customer's transaction. */}
 return records.map(record=>({...record,collateral_items:record.collateral_items?.map(item=>{
  const key=item.source==='snkrdunk'?item.productId:item.source==='catalog'?item.cardUid:null
  return {...item,imageUrl:key?images.get(`${item.source}:${key}`)??null:null}
 })}))
}
