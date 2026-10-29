import {describe,it,expect} from 'vitest'
import {catalogInput,catalogTokens,imageHints,imageSearchQuery} from '@/lib/lending/catalog'
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
 it('prefers printed card number and leaves unreadable images without a search',()=>{
  const hints=imageHints.parse({name:'PIKACHU',cardNumber:'025/165',category:'pokemon',setName:null,language:null,rarity:null})
  expect(imageSearchQuery(hints)).toBe('025/165')
  expect(imageSearchQuery({...hints,name:null,cardNumber:null})).toBe('')
  expect(imageHints.safeParse({...hints,grade:'PSA10'}).success).toBe(false)
 })
})
