// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import sharp from 'sharp'
vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ from:vi.fn(),upload:vi.fn(),rpc:vi.fn(),insert:vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({from:mocks.from,rpc:mocks.rpc,storage:{from:()=>({upload:mocks.upload})}}) }))
import { saveIdentityImage, ownsIdentityPath } from '@/lib/identity/documents'
const uid='11111111-1111-4111-8111-111111111111'
beforeEach(() => {
  vi.resetAllMocks()
  const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:null,error:null})}
  mocks.from.mockImplementation(table=>table==='identity_documents'?query:{insert:mocks.insert})
  mocks.insert.mockResolvedValue({error:null});mocks.upload.mockResolvedValue({error:null});mocks.rpc.mockResolvedValue({error:null})
})
it('rejects fake image bytes before storage access', async () => {
  await expect(saveIdentityImage(uid,new File(['<script>bad</script>'],'photo.jpg',{type:'image/jpeg'}),'license')).rejects.toThrow()
  expect(mocks.from).not.toHaveBeenCalled()
})
it('re-encodes actual pixels and strips metadata, while reserving cleanup before upload', async () => {
  const bytes=await sharp({create:{width:8,height:8,channels:3,background:'#000'}}).jpeg().withExif({IFD0:{Artist:'sensitive metadata'}}).toBuffer()
  const path=await saveIdentityImage(uid,new File([new Uint8Array(bytes)],'photo.jpg',{type:'image/jpeg'}),'license')
  expect(ownsIdentityPath(uid,path)).toBe(true)
  const output=await sharp(mocks.upload.mock.calls[0][1]).metadata();expect(output.format).toBe('jpeg');expect(output.exif).toBeUndefined()
  expect(mocks.insert.mock.invocationCallOrder[0]).toBeLessThan(mocks.upload.mock.invocationCallOrder[0])
})
it('does not commit a failed upload', async () => {
  mocks.upload.mockResolvedValue({error:{message:'offline'}})
  const bytes=await sharp({create:{width:1,height:1,channels:3,background:'#000'}}).png().toBuffer()
  await expect(saveIdentityImage(uid,new File([new Uint8Array(bytes)],'a.png'),'license')).rejects.toThrow()
  expect(mocks.rpc).not.toHaveBeenCalled()
})
