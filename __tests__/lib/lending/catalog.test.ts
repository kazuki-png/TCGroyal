import {describe,it,expect} from 'vitest'
import {catalogInput,catalogTokens,imageHints,imageSearchQuery,imageSearchPlan} from '@/lib/lending/catalog'
describe('catalog discovery boundary',()=>{
 it('normalizes Japanese/Latin numbers and removes filter control characters',()=>{
  expect(catalogTokens(' ピカチュウ １２３/ＳＶ ,%_().* ')).toEqual(['ピカチュウ','123/SV'])
  expect(catalogTokens('a b c d e f g')).toHaveLength(6)
 })
 it('does not assume a certificate or require PSA for selection',()=>{
  expect(catalogInput.parse({action:'assess',cardUid:'20000000-0000-4000-8000-000000000001',declaredGrade:'ungraded'}).action).toBe('assess')
  expect(catalogInput.safeParse({action:'submit',assessmentId:'20000000-0000-4000-8000-000000000001',key:'30000000-0000-4000-8000-000000000001',requestedAmount:'',consent:true,indicativeAmount:999999}).success).toBe(false)
 })
 it('requires submission consent, bounded amounts and valid paging',()=>{
  expect(catalogInput.safeParse({action:'search',page:0}).success).toBe(false)
  expect(catalogInput.safeParse({action:'search',query:'a'.repeat(101)}).success).toBe(false)
  expect(catalogInput.safeParse({action:'submit',assessmentId:'20000000-0000-4000-8000-000000000001',key:'30000000-0000-4000-8000-000000000001',requestedAmount:'10000001',consent:true}).success).toBe(false)
 })
 it('uses a visible level before vintage/name queries and never assumes old-back when unknown',()=>{
  const hints=imageHints.parse({name:'ライチュウ',cardNumber:'026',category:'pokemon',setName:null,language:'日本語',rarity:null,specificTerms:['LV.32','HP70'],oldBack:true})
  expect(imageSearchPlan(hints).map(step=>step.query)).toEqual(['ライチュウ LV32','ライチュウ 旧裏','ライチュウ'])
  expect(imageSearchPlan({...hints,oldBack:null}).map(step=>step.query)).not.toContain('ライチュウ 旧裏')
  expect(imageSearchPlan({...hints,category:'onepiece'}).map(step=>step.query)).not.toContain('ライチュウ 旧裏')
 })
 it('prefers printed card number and leaves unreadable images without a search',()=>{
  const hints=imageHints.parse({name:'PIKACHU',cardNumber:'025/165',category:'pokemon',setName:null,language:null,rarity:null})
  expect(imageSearchQuery(hints)).toBe('025/165')
  expect(imageSearchQuery({...hints,cardNumber:'１５０ / ＸＹ－Ｐ SAR'})).toBe('150/XY-P')
  expect(imageSearchQuery({...hints,cardNumber:'167034272',name:null})).toBe('')
  expect(imageSearchQuery({...hints,name:null,cardNumber:null})).toBe('')
  expect(imageHints.safeParse({...hints,grade:'PSA10'}).success).toBe(false)
 })
})
