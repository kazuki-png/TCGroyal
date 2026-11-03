import 'server-only'
import {catalogTokens,imageSearchQuery} from './catalog'
import {discoverCards} from './discovery'
import {rankImageCandidates} from './image-candidates'
import type {ImageDiscoverySearch} from './discovery-types'

// The caller extracts hints once. Fallback searches never call the image model.
export async function discoverImageCards(hints:ImageDiscoverySearch['hints'],allowExternal:()=>Promise<boolean>):Promise<ImageDiscoverySearch>{
 const primary=imageSearchQuery(hints)
 const fallback=catalogTokens(hints.name??'').join(' ').slice(0,100)
 const queries=[...new Set([primary,fallback].filter(Boolean))].slice(0,2)
 let partial=false,searchQuery=primary
 for(const query of queries){
  searchQuery=query
  try{
   const result=await discoverCards(query,hints.category??'all',1,await allowExternal())
   partial ||= result.partial
   const cards=rankImageCandidates(result.cards,hints)
   if(cards.length)return {cards,page:1,hasMore:false,partial,hints,searchQuery,message:'候補です。撮影したカードと型番・版・言語を確認して選択してください。'}
  }catch{partial=true}
 }
 return {cards:[],page:1,hasMore:false,partial,hints,searchQuery,message:partial?'候補検索を完了できませんでした。読み取った文字で検索するか、時間をおいてお試しください。':'候補を特定できませんでした。型番部分を撮り直すか、読み取った文字を修正して検索してください。'}
}
