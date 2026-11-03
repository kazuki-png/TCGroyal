// @vitest-environment node
import {beforeEach,describe,expect,it,vi} from 'vitest'
const state=vi.hoisted(()=>({exists:true,size:4}))
vi.mock('../../../mobile/node_modules/expo-file-system/build/index.js',()=>({File:class {
 constructor(public uri:string){}
 get exists(){return state.exists}get size(){return state.size}
 name='card.jpg';type='image/jpeg'
 async bytes(){return new Uint8Array([0xff,0xd8,0xff,0xd9])}
}}))
import {appendImageFile} from '../../../mobile/src/image-upload'
import {installFormDataPatch} from '../../../mobile/node_modules/expo/src/winter/FormData'
import {convertFormDataAsync} from '../../../mobile/node_modules/expo/src/winter/fetch/convertFormData'
class NativeFormData {_parts:unknown[]=[]}
const PatchedFormData=installFormDataPatch(NativeFormData as unknown as typeof FormData)
beforeEach(()=>{state.exists=true;state.size=4})
describe('Expo native image multipart encoding',()=>{
 it('reproduces the legacy URI failure and encodes a native File with actual image bytes',async()=>{
  const legacy=new PatchedFormData();legacy.append('file',{uri:'file:///card.jpg',name:'card.jpg',type:'image/jpeg'})
  await expect(convertFormDataAsync(legacy as unknown as FormData)).rejects.toThrow('Unsupported FormDataPart implementation')
  const form=new PatchedFormData() as unknown as FormData
  appendImageFile(form,'file:///card.jpg');form.append('consent','true')
  const {body,boundary}=await convertFormDataAsync(form,'fixture-boundary')
  const text=new TextDecoder().decode(body);expect(boundary).toBe('fixture-boundary');expect(text).toContain('filename="card.jpg"');expect(text).toContain('image/jpeg');expect(text).toContain('name="consent"');expect(text).not.toContain('file:///')
  expect(Buffer.from(body).includes(Buffer.from([0xff,0xd8,0xff,0xd9]))).toBe(true)
 })
 it('rejects missing, oversized and remote files before sending',()=>{
  const form=new PatchedFormData() as unknown as FormData
  expect(()=>appendImageFile(form,'https://example.com/image.jpg')).toThrow('端末の写真')
  state.exists=false;expect(()=>appendImageFile(form,'file:///missing.jpg')).toThrow('読み込めません')
  state.exists=true;state.size=3*1024*1024+1;expect(()=>appendImageFile(form,'content://media/card.jpg')).toThrow('3MB')
  expect([...form.entries()]).toEqual([])
 })
})
