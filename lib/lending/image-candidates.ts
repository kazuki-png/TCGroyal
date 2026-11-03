import type {DiscoveryCard,ImageDiscoverySearch} from './discovery-types'

type Hints=ImageDiscoverySearch['hints']
const folded=(value:string)=>value.normalize('NFKC').toLowerCase().replace(/[‐‑–—]/g,'-')
const normalized=(value:string)=>folded(value).replace(/\s/g,'')
// Keep the numerator AND denominator. Reprints can share a numerator.
const numbers=(value:string):string[]=>folded(value).replace(/\s*\/\s*/g,'/').match(/[a-z]*\d+[a-z]*\/\d+[a-z]*|[a-z]+\d+-\d+[a-z]*/g)??[]

export function rankImageCandidates(cards:DiscoveryCard[],hints:Hints):DiscoveryCard[]{
 const expected=numbers(hints.cardNumber??'')
 const setCode=normalized(hints.setName??'').match(/^(?:sv|sm|s|xy|bw|dp|pt)\d+[a-z]*$/)?.[0]??folded(hints.cardNumber??'').match(/\b(?:sv|sm|s|xy|bw|dp|pt)\d+[a-z]*\b/)?.[0]
 const language=normalized(hints.language??'')
 const japanese=['ja','jp','japanese','日本語'].includes(language)
 const english=['en','english','英語'].includes(language)
 return cards.flatMap((card,index)=>{
  if(hints.category&&card.category!==hints.category)return []
  const fullText=folded(`${card.name} ${card.cardNumber}`),text=normalized(fullText),actual=numbers(card.cardNumber||card.name)
  if(expected.length&&actual.length&&!expected.some(number=>actual.includes(number)))return []
  // Only exclude explicit language labels; absence of a label is not evidence.
  if(japanese&&/英語版|english/.test(text)||english&&/日本語版|japanese/.test(text))return []
  const matchedOn:NonNullable<DiscoveryCard['imageMatch']>['matchedOn']=[]
  if(expected.length&&expected.some(number=>actual.includes(number)))matchedOn.push('number')
  if(setCode){
   const codes:string[]=fullText.match(/\b(?:sv|sm|s|xy|bw|dp|pt)\d+[a-z]*\b/g)??[]
   if(codes.length&&!codes.includes(setCode))return []
   if(codes.includes(setCode))matchedOn.push('set')
  }else if(hints.setName&&text.includes(normalized(hints.setName)))matchedOn.push('set')
  if(hints.name&&text.includes(normalized(hints.name)))matchedOn.push('name')
  if(hints.rarity&&fullText.split(/[^a-z0-9]+/).includes(normalized(hints.rarity)))matchedOn.push('rarity')
  const weights={number:100,set:30,name:10,rarity:3}
  return [{card:{...card,imageMatch:{matchedOn}},score:matchedOn.reduce((sum,field)=>sum+weights[field],0),index}]
 }).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,3).map(value=>value.card)
}
