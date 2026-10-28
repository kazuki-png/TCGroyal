// @vitest-environment node
import {describe,expect,it,vi} from 'vitest'
vi.mock('server-only',()=>({}))
import {PSA_CERT_CACHE_MS,readCachedPsaCertificate} from '@/lib/lending/psa-provider'
const cert='167034272',now=Date.parse('2026-10-27T00:00:00Z')
const cached={verifiedBy:'psa_api',certNumber:cert,specId:123,year:'2024',brand:'POKEMON JAPANESE SV8',category:'TCG CARDS',cardNumber:'132',subject:'PIKACHU ex',variety:'SPECIAL ART RARE',grade:'10',gradeDescription:'GEM MT 10',fetchedAt:new Date(now-60000).toISOString(),eligible:true,sourceUrl:'https://untrusted.example'}
describe('PSA certificate cache boundaries',()=>{
 it('preserves the original fetch time and reconstructs the official URL',()=>{
  expect(readCachedPsaCertificate(cached,cert,now)).toMatchObject({eligible:true,fetchedAt:cached.fetchedAt,sourceUrl:`https://www.psacard.com/cert/${cert}/psa`})
 })
 it('never treats manual data, mismatched certs or incomplete records as API evidence',()=>{
  expect(readCachedPsaCertificate({...cached,verifiedBy:'user_entered'},cert,now)).toBeNull()
  expect(readCachedPsaCertificate(cached,'99999999',now)).toBeNull()
  expect(readCachedPsaCertificate({verifiedBy:'psa_api'},cert,now)).toBeNull()
 })
 it('rejects future timestamps and expires at exactly 24 hours',()=>{
  expect(readCachedPsaCertificate({...cached,fetchedAt:new Date(now+1).toISOString()},cert,now)).toBeNull()
  expect(readCachedPsaCertificate({...cached,fetchedAt:new Date(now-PSA_CERT_CACHE_MS).toISOString()},cert,now)).toBeNull()
 })
 it('recomputes eligibility instead of trusting a saved eligible flag',()=>{
  expect(readCachedPsaCertificate({...cached,grade:'9',gradeDescription:'MINT 9',eligible:true},cert,now)?.eligible).toBe(false)
  expect(readCachedPsaCertificate({...cached,brand:'TOPPS BASEBALL',eligible:true},cert,now)?.eligible).toBe(false)
 })
})
