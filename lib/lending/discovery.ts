import 'server-only'
import {searchCatalog} from './catalog-server'
import {searchSnkrdunkCards} from './snkrdunk-card-search'
import type {DiscoveryCard,DiscoverySearch} from './discovery-types'
import type {CatalogCard} from './catalog-types'

export const catalogDiscoveryCard=(card:CatalogCard):DiscoveryCard=>({id:`catalog:${card.public_uid}`,kind:'catalog',cardUid:card.public_uid,productId:null,name:card.name,cardNumber:card.card_number??'',category:card.category,imageUrl:card.image_url})
const normalize=(value:string)=>value.normalize('NFKC').toLocaleLowerCase('ja').replace(/\s+/g,' ').trim()
export async function discoverCards(query:string,category='all',page=1,externalAllowed=true,externalLimit:6|12=6):Promise<DiscoverySearch>{
 const [local,external]=await Promise.allSettled([
  searchCatalog(query,category,page),
  query.trim()&&externalAllowed?(externalLimit===6?searchSnkrdunkCards(query,category as 'all'|'pokemon'|'onepiece',page):searchSnkrdunkCards(query,category as 'all'|'pokemon'|'onepiece',page,externalLimit)):Promise.resolve(null),
 ])
 const cards:DiscoveryCard[]=external.status==='fulfilled'&&external.value?external.value.cards.map(card=>({id:`external:${card.productId}`,kind:'external',cardUid:null,productId:card.productId,name:card.name,cardNumber:card.cardNumber,category:card.category,imageUrl:card.imageUrl})):[]
 if(local.status==='fulfilled')cards.push(...local.value.cards.map(catalogDiscoveryCard))
 if(local.status==='rejected'&&external.status==='rejected')throw Error('discovery_unavailable')
 const seen=new Set<string>(),tokens=normalize(query).split(' ').filter(Boolean)
 const rank=(card:DiscoveryCard)=>tokens.reduce((sum,token)=>sum+(normalize(card.cardNumber)===token?10:normalize(`${card.name} ${card.cardNumber}`).includes(token)?1:0),0)
 const unique=cards.filter(card=>{
  // Only deduplicate an exact full name + printed number + game. Fuzzy names
  // must never silently bind another language, rarity or edition.
  const key=JSON.stringify([normalize(card.name),normalize(card.cardNumber),card.category])
  if(seen.has(key))return false;seen.add(key);return true
 }).sort((a,b)=>rank(b)-rank(a))
 const partial=local.status==='rejected'||external.status==='rejected'||!!query.trim()&&!externalAllowed
 return {cards:unique,page,hasMore:(local.status==='fulfilled'&&local.value.total>page*12)||(external.status==='fulfilled'&&!!external.value?.hasMore),partial,...(partial?{message:'一部の候補を取得できませんでした。表示中のカードから選ぶか、個別査定をご利用ください。'}:{})}
}
