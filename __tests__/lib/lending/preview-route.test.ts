// @vitest-environment node
import {describe,it,expect,vi} from 'vitest'
import {POST} from '@/app/api/admin/lending/preview/route'
describe('retired administrator price integration',()=>{
 it('returns Gone without any external request',async()=>{const network=vi.fn();vi.stubGlobal('fetch',network);try{const response=await POST();expect(response.status).toBe(410);expect(response.headers.get('cache-control')).toBe('private, no-store');expect(await response.text()).toContain('融資管理');expect(network).not.toHaveBeenCalled()}finally{vi.unstubAllGlobals()}})
})