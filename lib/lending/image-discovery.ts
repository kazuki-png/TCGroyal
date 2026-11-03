import 'server-only'
import {imageSearchPlan} from './catalog'
import {discoverCards} from './discovery'
import {rankImageCandidates} from './image-candidates'
import type {DiscoveryCard,ImageDiscoverySearch} from './discovery-types'

type VisualRank=(cards:DiscoveryCard[])=>Promise<DiscoveryCard[]>
// One extraction, at most four progressively broader queries, one optional visual comparison.
export async function discoverImageCards(hints:ImageDiscoverySearch['hints'],allowExternal:()=>Promise<boolean>,visualRank?:VisualRank):Promise<ImageDiscoverySearch>{
 const steps=imageSearchPlan(hints),pool:DiscoveryCard[]=[],deadline=Date.now()+20000
 let partial=false,searchQuery=steps[0]?.query??'',broad=false
 for(const {query,tier} of steps){
  if(Date.now()>=deadline){partial=true;break}
  searchQuery=query;broad ||= tier>=3
  try{
   const result=await discoverCards(query,hints.category??'all',1,await allowExternal(),12)
   partial ||= result.partial
   for(const card of result.cards){const index=pool.findIndex(prior=>prior.id===card.id);if(index<0)pool.push(card);else pool[index]=card}
   const ranked=rankImageCandidates(pool,hints,true,12)
   // A broad same-name match is not evidence that a level/number query succeeded.
   const strong=ranked.filter(card=>tier===1?card.imageMatch?.matchedOn.includes('number'):tier===2?card.imageMatch?.matchedOn.includes('specific'):true)
   if(strong.length>=3)break
  }catch{partial=true}
 }
 let ranked=rankImageCandidates(pool,hints,true,12)
 // Number matches are reliable anchors; broad queries must not move them down.
 const exact=rankImageCandidates(pool,hints).filter(card=>card.imageMatch?.matchedOn.includes('number'))
 let visualSort:ImageDiscoverySearch['visualSort']='not_needed'
 if(broad&&ranked.length>=2){
  if(visualRank){try{const reordered=await visualRank(ranked);const ids=new Set(ranked.map(card=>card.id));if(reordered.length!==ranked.length||new Set(reordered.map(card=>card.id)).size!==ids.size||reordered.some(card=>!ids.has(card.id)))throw Error('visual_order_invalid');ranked=reordered;visualSort='applied'}catch{visualSort='unavailable'}}
  else visualSort='unavailable'
 }
 const cards=[...exact,...ranked.filter(card=>!exact.some(prior=>prior.id===card.id))].slice(0,3)
 if(cards.length)return {cards,page:1,hasMore:false,partial,hints,searchQuery,visualSort}
 return {cards:[],page:1,hasMore:false,partial,hints,searchQuery,visualSort,message:partial?'候補検索を完了できませんでした。カード名・型番で検索するか、時間をおいてお試しください。':'候補を特定できませんでした。カード名・型番を修正して検索してください。'}
}
