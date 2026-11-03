import {z} from 'zod'
import {collateralItems} from './collateral'
import {printedCardNumbers} from './card-identifiers'
export const declaredGrade=z.enum(['PSA10','other','ungraded'])
export const catalogInput=z.discriminatedUnion('action',[
 z.object({action:z.literal('discover'),query:z.string().trim().max(100).default(''),category:z.enum(['pokemon','onepiece','all']).default('all'),page:z.number().int().min(1).max(100).default(1)}).strict(),
 z.object({action:z.literal('quote_bundle'),items:collateralItems}).strict(),
 z.object({action:z.literal('search_snkrdunk'),query:z.string().trim().min(1).max(100),category:z.enum(['pokemon','onepiece','all']).default('all'),page:z.number().int().min(1).max(100).default(1)}).strict(),
 z.object({action:z.literal('search'),query:z.string().trim().max(100).default(''),category:z.enum(['pokemon','onepiece','all']).default('all'),page:z.number().int().min(1).max(10000).default(1)}).strict(),
 z.object({action:z.literal('assess'),cardUid:z.uuid(),declaredGrade,certInput:z.string().trim().max(250).default(''),imageRequestId:z.uuid().optional()}).strict(),
 z.object({action:z.literal('submit'),assessmentId:z.uuid(),key:z.uuid(),consent:z.literal(true),requestedAmount:z.string().regex(/^$|^[1-9]\d{0,7}$/).refine(v=>v===''||Number(v)<=10000000),notes:z.string().trim().max(1000).default('')}).strict(),
])
export const imageHints=z.object({name:z.string().trim().max(100).nullable(),cardNumber:z.string().trim().max(40).nullable(),category:z.enum(['pokemon','onepiece']).nullable(),setName:z.string().trim().max(100).nullable(),language:z.string().trim().max(40).nullable(),rarity:z.string().trim().max(40).nullable(),specificTerms:z.array(z.string().trim().min(1).max(40)).max(4).optional(),oldBack:z.boolean().nullable().optional()}).strict()
// PostgREST expressions must not contain caller-controlled filter syntax or wildcards.
export function catalogTokens(query:string){return query.normalize('NFKC').replace(/[^\p{L}\p{N}\s\-/]/gu,' ').trim().split(/\s+/).filter(Boolean).slice(0,6).map(s=>s.slice(0,60))}
export function imageSearchQuery(hints:z.infer<typeof imageHints>){
 // The printed number is generally more discriminating than an English name in a Japanese catalog.
 const number=printedCardNumbers(hints.cardNumber??'')[0]
 return number??catalogTokens(hints.name??'').join(' ').slice(0,100)
}

// Levels/HP/attack names are visible identifiers, never inferred catalog facts.
export function imageSearchPlan(hints:z.infer<typeof imageHints>){
 const name=catalogTokens(hints.name??'').join(' ').slice(0,70)
 const number=printedCardNumbers(hints.cardNumber??'')[0]
 const term=(hints.specificTerms??[]).map(value=>value.normalize('NFKC').replace(/\bLV[.\s]*(\d+)/gi,'LV$1')).map(value=>catalogTokens(value).join(' ')).find(Boolean)
 const steps:{query:string;tier:1|2|3|4}[]=[]
 if(number)steps.push({query:number,tier:1})
 if(name&&term)steps.push({query:(name+' '+term).slice(0,100),tier:2})
 if(name&&hints.category==='pokemon'&&(hints.oldBack===true||hints.oldBack===null))steps.push({query:(name+' 旧裏').slice(0,100),tier:3})
 if(name)steps.push({query:name,tier:4})
 return steps.filter((step,index)=>steps.findIndex(other=>other.query===step.query)===index)
}
