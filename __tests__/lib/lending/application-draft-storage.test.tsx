import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
vi.mock('@/mobile/node_modules/react/index.js',async()=>vi.importActual('react'));
const mocks=vi.hoisted(()=>({read:vi.fn(),write:vi.fn(),remove:vi.fn()}));
vi.mock('@/mobile/node_modules/expo-secure-store/build/SecureStore.js',()=>({getItemAsync:mocks.read,setItemAsync:mocks.write,deleteItemAsync:mocks.remove,WHEN_UNLOCKED_THIS_DEVICE_ONLY:1}));
vi.mock('@/mobile/node_modules/expo-crypto/build/Crypto.js',()=>({randomUUID:()=>crypto.randomUUID()}));
import {useApplicationDraft,clearApplicationDraft} from '@/mobile/src/use-application-draft';
const card={id:'10000000-0000-4000-8000-000000000001',name:'カード',cardNumber:'',quantity:1,grade:'未鑑定',condition:'',source:'manual' as const,productId:null,cardUid:null};
const saved=new Map<string,string>();
beforeEach(()=>{vi.clearAllMocks();saved.clear();mocks.read.mockImplementation(async key=>saved.get(key)??null);mocks.write.mockImplementation(async(key,value)=>{saved.set(key,value)});mocks.remove.mockImplementation(async key=>{saved.delete(key)})});
afterEach(cleanup);
describe('encrypted account scoped application draft',()=>{
 it('restores after remount and never shows another account draft',async()=>{
  const first=renderHook(({account})=>useApplicationDraft(account),{initialProps:{account:'tcg:inbox:v1:owner-a'}});await waitFor(()=>expect(first.result.current.ready).toBe(true));act(()=>first.result.current.change([card]));await waitFor(()=>expect(mocks.write).toHaveBeenCalled());act(()=>first.result.current.changeForm({requestedAmount:'250000',notes:'相談メモ'}));await waitFor(()=>expect(first.result.current.form.requestedAmount).toBe('250000'));await waitFor(()=>expect([...saved.values()].some(value=>value.includes('250000'))).toBe(true));first.unmount();
  const second=renderHook(({account})=>useApplicationDraft(account),{initialProps:{account:'tcg:inbox:v1:owner-a'}});await waitFor(()=>expect(second.result.current.items).toEqual([card]));expect(second.result.current.form).toEqual({requestedAmount:'250000',notes:'相談メモ'});second.rerender({account:'tcg:inbox:v1:owner-b'});expect(second.result.current.items).toEqual([]);await waitFor(()=>expect(second.result.current.ready).toBe(true));expect(second.result.current.items).toEqual([]);expect(second.result.current.form).toEqual({requestedAmount:'',notes:''});
  expect([...saved.keys()].every(key=>!key.includes(':'))).toBe(true);
 })
 it('clears pending saved content on explicit logout and reports failed saves',async()=>{
  const {result}=renderHook(()=>useApplicationDraft('owner'));await waitFor(()=>expect(result.current.ready).toBe(true));act(()=>result.current.change([card]));await clearApplicationDraft('owner');expect([...saved.keys()].some(key=>key.endsWith('.head'))).toBe(false);
  mocks.write.mockRejectedValueOnce(Error('storage'));act(()=>result.current.change([card]));await waitFor(()=>expect(result.current.error).toContain('保存できません'));
 })
})
