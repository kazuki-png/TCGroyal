import {z} from 'zod'
export const declaredGrade=z.enum(['PSA10','other','ungraded'])
export const catalogInput=z.discriminatedUnion('action',[
 z.object({action:z.literal('search'),query:z.string().trim().max(100).default(''),category:z.enum(['pokemon','onepiece','all']).default('all'),page:z.number().int().min(1).max(10000).default(1)}).strict(),
 z.object({action:z.literal('assess'),cardUid:z.uuid(),declaredGrade,certInput:z.string().trim().max(250).default(''),imageRequestId:z.uuid().optional()}).strict(),
 z.object({action:z.literal('submit'),assessmentId:z.uuid(),key:z.uuid(),consent:z.literal(true),requestedAmount:z.string().regex(/^$|^[1-9]\d{0,7}$/).refine(v=>v===''||Number(v)<=10000000),notes:z.string().trim().max(1000).default('')}).strict(),
])
export const imageHints=z.object({name:z.string().trim().max(100).nullable(),cardNumber:z.string().trim().max(40).nullable(),category:z.enum(['pokemon','onepiece']).nullable(),setName:z.string().trim().max(100).nullable(),language:z.string().trim().max(40).nullable(),rarity:z.string().trim().max(40).nullable()}).strict()
// PostgREST expressions must not contain caller-controlled filter syntax or wildcards.
export function catalogTokens(query:string){return query.normalize('NFKC').replace(/[^\p{L}\p{N}\s\-/]/gu,' ').trim().split(/\s+/).filter(Boolean).slice(0,6).map(s=>s.slice(0,60))}
export function imageSearchQuery(hints:z.infer<typeof imageHints>){
 // The printed number is generally more discriminating than an English name in a Japanese catalog.
 return catalogTokens(hints.cardNumber||hints.name||'').join(' ').slice(0,100)
}
