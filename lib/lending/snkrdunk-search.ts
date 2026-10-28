import 'server-only'
import { z } from 'zod'
import { fetchPublicRemoteUrl } from '@/lib/security/safeRemoteFetch'
const decode=(s:string)=>s.replace(/&(?:amp|quot|lt|gt|apos|#39|#\d+|#x[a-f0-9]+);/gi,v=>{
 const map:Record<string,string>={'&amp;':'&','&quot;':'"','&lt;':'<','&gt;':'>','&apos;':"'",'&#39;':"'"}
 if(map[v.toLowerCase()])return map[v.toLowerCase()]
 const n=v.toLowerCase().startsWith('&#x')?parseInt(v.slice(3,-1),16):parseInt(v.slice(2,-1),10)
 return n>0&&n<=0x10ffff?String.fromCodePoint(n):''
})
export function parseSnkrdunkSearch(html:string) {
 const result=new Map<string,{productId:string;name:string;sourceUrl:string}>()
 for(const match of html.matchAll(/<a\b([^>]{0,4000})>/gi)){
  const href=match[1].match(/\bhref="(?:https:\/\/snkrdunk\.com)?\/apparels\/([1-9]\d{0,8})\/?"/i)
  const label=match[1].match(/\baria-label="([^"]{1,1200})"/i)
  if(!href||!label)continue
  const name=decode(label[1]).replace(/\s+-\s+¥.*$/,'').trim()
  if(!name||/海外限定|購入いただけません/.test(name))continue
  result.set(href[1],{productId:href[1],name,sourceUrl:`https://snkrdunk.com/apparels/${href[1]}`})
  if(result.size>=12)break
 }
 return [...result.values()]
}
export async function searchSnkrdunk(query:string) {
 const url=new URL('https://snkrdunk.com/search');url.searchParams.set('keywords',query.slice(0,100))
 const r=await fetchPublicRemoteUrl(url,{timeoutMs:10000,maxBytes:2000000,maxRedirects:0,headers:{Accept:'text/html','User-Agent':'TCG-Royal-Research/0.2'}})
 if(!r.ok||!r.headers.get('content-type')?.includes('text/html'))throw Error('スニダンの商品検索を利用できません。商品IDで検索してください。')
 return parseSnkrdunkSearch(await r.text())
}
const schema=z.object({id:z.number().int().positive(),name:z.string().min(1).max(500),localizedName:z.string().min(1).max(500),
 productNumber:z.string().max(200),brands:z.array(z.object({id:z.string().max(100)})).max(20)})
export async function fetchSnkrdunkProduct(id:string) {
 if(!/^[1-9]\d{0,8}$/.test(id))throw Error('商品IDが不正です。')
 const r=await fetchPublicRemoteUrl(new URL(`https://snkrdunk.com/v1/apparels/${id}`),{timeoutMs:10000,maxBytes:256000,maxRedirects:0,headers:{Accept:'application/json','User-Agent':'TCG-Royal-Research/0.2'}})
 if(!r.ok||!r.headers.get('content-type')?.includes('json'))throw Error('スニダンの商品情報を取得できません。')
 const p=schema.parse(await r.json())
 if(String(p.id)!==id||!p.brands.some(b=>/pokemon|onepiece/i.test(b.id)))throw Error('ポケモンカード・ワンピース以外は自動査定できません。')
 return {productId:id,name:p.localizedName,englishName:p.name,productNumber:p.productNumber,sourceUrl:`https://snkrdunk.com/apparels/${id}`}
}
export function cardNumberMatches(psaNumber:string,productName:string) {
 const number=psaNumber.trim().replace(/^#/, '').toUpperCase()
 if(!number||number.length>40)return false
 const escaped=number.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
 return new RegExp(`(?:^|[\\s\\[(/])${escaped}(?=[\\s\\]/)]|$)`,'i').test(productName)
}
