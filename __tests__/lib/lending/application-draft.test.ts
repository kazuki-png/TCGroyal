import {describe,expect,it} from 'vitest'
import {parseApplicationDraft} from '@/mobile/src/application-draft'
const card={id:'10000000-0000-4000-8000-000000000001',name:'カード',cardNumber:'123/100',grade:'未鑑定',condition:'',quantity:2,source:'manual',cardUid:null,productId:null}
const raw=(items:unknown[])=>JSON.stringify({version:1,items,updatedAt:'2026-11-01'})
describe('application draft',()=>{
 it('starts empty and preserves an editable selection',()=>{expect(parseApplicationDraft(null).items).toEqual([]);expect(parseApplicationDraft(raw([card])).items).toEqual([card]);expect(parseApplicationDraft(raw([{...card,quantity:0}])).items[0].quantity).toBe(0)})
 it('restores request fields and preserves compatibility with old drafts',()=>{expect(parseApplicationDraft(raw([card]))).toMatchObject({requestedAmount:'',notes:''});expect(parseApplicationDraft(JSON.stringify({version:1,items:[card],requestedAmount:'250000',notes:'相談メモ'}))).toMatchObject({requestedAmount:'250000',notes:'相談メモ'});expect(()=>parseApplicationDraft(JSON.stringify({version:1,items:[card],requestedAmount:'100,000'}))).toThrow()})
 it('retains reference images across restart while allowing older drafts without images',()=>{expect(parseApplicationDraft(raw([{...card,imageUrl:'https://cdn.snkrdunk.com/card.webp'}])).items[0].imageUrl).toBe('https://cdn.snkrdunk.com/card.webp');expect(parseApplicationDraft(raw([{...card,imageUrl:'file:///private.jpg'}])).items[0].imageUrl).toBeUndefined()})
 it('allowlists fields and never retains credentials or documents',()=>{expect(JSON.stringify(parseApplicationDraft(raw([{...card,password:'SECRET',document:'IMAGE',bankAccount:'BANK'}])))).not.toMatch(/SECRET|IMAGE|BANK/)})
 it('rejects corrupt, oversized and duplicate entries',()=>{for(const input of ['{',raw([{...card,quantity:101}]),raw([{...card,quantity:60},{...card,id:'20000000-0000-4000-8000-000000000001',quantity:60}]),raw([card,card]),raw([{...card,source:'unknown'}])])expect(()=>parseApplicationDraft(input)).toThrow()})
})
