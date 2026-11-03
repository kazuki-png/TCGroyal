import {describe,expect,it} from 'vitest'
import {rankImageCandidates} from '@/lib/lending/image-candidates'
import type {DiscoveryCard,ImageDiscoverySearch} from '@/lib/lending/discovery-types'
const hints:ImageDiscoverySearch['hints']={name:'ピカチュウ',cardNumber:'132/106',category:'pokemon',setName:'SV8',language:'日本語',rarity:'SAR'}
const card=(id:string,name:string,cardNumber='SV8 132/106'):DiscoveryCard=>({id,name,cardNumber,category:'pokemon',imageUrl:null,kind:'external',productId:id,cardUid:null})
describe('image candidate identity evidence',()=>{
 it('ranks full number + set above name-only candidates without inventing a confidence percentage',()=>{
  const result=rankImageCandidates([card('name','ピカチュウ',''),card('exact','ピカチュウ SAR [SV8 132/106]')],hints)
  expect(result.map(c=>c.id)).toEqual(['exact','name'])
  expect(result[0].imageMatch?.matchedOn).toEqual(['number','set','name','rarity'])
  expect(result[1].imageMatch?.matchedOn).toEqual(['name'])
 })
 it('excludes different denominators, explicit languages, sets and games',()=>{
  const cards=[card('denominator','ピカチュウ','132/165'),card('set','ピカチュウ','SV7 132/106'),card('english','ピカチュウ 英語版'),{...card('game','ピカチュウ'),category:'onepiece'}]
  expect(rankImageCandidates(cards,hints)).toEqual([])
 })
 it('preserves One Piece prefixes and handles full-width numbers and slash spacing',()=>{
  const onepiece={...hints,name:'ルフィ',cardNumber:'OP01-001',category:'onepiece' as const,setName:null,language:null,rarity:null}
  expect(rankImageCandidates([{...card('correct','ルフィ','OP01-001'),category:'onepiece'},{...card('wrong','ルフィ','OP02-001'),category:'onepiece'}],onepiece).map(c=>c.id)).toEqual(['correct'])
  expect(rankImageCandidates([card('wide','ピカチュウ','ＳＶ８ １３２ / １０６')],hints)[0].imageMatch?.matchedOn).toContain('number')
 })
 it('shows at most three candidates and never automatically picks one',()=>{
  expect(rankImageCandidates(Array.from({length:6},(_,i)=>card(String(i),'ピカチュウ')),hints)).toHaveLength(3)
  expect(rankImageCandidates([card('one','ピカチュウ')],{...hints,cardNumber:null,setName:null,rarity:null})[0]).not.toHaveProperty('selected')
 })
})
