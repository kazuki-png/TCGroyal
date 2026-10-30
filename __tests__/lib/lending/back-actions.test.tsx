import {act,cleanup,renderHook} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
vi.mock('@/mobile/node_modules/react/index.js',async()=>vi.importActual('react'));
import {BackActions,appBackActions} from '@/mobile/src/back-actions';
import {useAppBack} from '@/mobile/src/use-app-back';
afterEach(cleanup);
describe('Android layered back navigation',()=>{
 it('delegates roots to Android and removes handlers after leaving a detail',()=>{
  const back=new BackActions();expect(back.dispatch()).toBe(false);
  const pop=vi.fn(()=>true),remove=back.register(10,pop);expect(back.dispatch()).toBe(true);expect(pop).toHaveBeenCalledOnce();remove();expect(back.dispatch()).toBe(false);
 });
 it('returns one layer at a time, from editing to settings to inbox to root',()=>{
  const back=new BackActions(),seen:string[]=[];
  const removeInbox=back.register(10,()=>{seen.push('inbox');removeInbox();return true});
  const removeSettings=back.register(40,()=>{seen.push('settings');removeSettings();return true});
  const removeEditing=back.register(50,()=>{seen.push('editing');removeEditing();return true});
  expect(back.dispatch()).toBe(true);expect(seen).toEqual(['editing']);expect(back.dispatch()).toBe(true);expect(seen).toEqual(['editing','settings']);expect(back.dispatch()).toBe(true);expect(seen).toEqual(['editing','settings','inbox']);expect(back.dispatch()).toBe(false);
 });
 it('lets modal close requests share the same dispatch and consumes back during a pending mutation',()=>{
  const back=new BackActions(),pop=vi.fn(()=>true);back.register(40,pop);const unblock=back.register(90,()=>true);expect(back.dispatch()).toBe(true);expect(pop).not.toHaveBeenCalled();unblock();expect(back.dispatch()).toBe(true);expect(pop).toHaveBeenCalledOnce();
 });
 it('does not fall through to a second action on the same back event',()=>{
  const back=new BackActions(),root=vi.fn(()=>true);back.register(10,root);back.register(30,()=>true);expect(back.dispatch()).toBe(true);expect(root).not.toHaveBeenCalled();
 });
 it('allows a handler to delegate and orders equal priorities by newest registration',()=>{
  const back=new BackActions(),seen:string[]=[];back.register(10,()=>{seen.push('older');return true});back.register(10,()=>{seen.push('newer');return false});expect(back.dispatch()).toBe(true);expect(seen).toEqual(['newer','older']);
 });
 it('unregisters hidden tab handlers, preserves their state, and restores them only when visible',()=>{
  const pop=vi.fn(()=>true);const {rerender,unmount}=renderHook(({active})=>useAppBack(active,30,pop),{initialProps:{active:true}});
  expect(appBackActions.dispatch()).toBe(true);rerender({active:false});expect(appBackActions.dispatch()).toBe(false);expect(pop).toHaveBeenCalledOnce();rerender({active:true});expect(appBackActions.dispatch()).toBe(true);unmount();expect(appBackActions.dispatch()).toBe(false);
 });
 it('uses current callbacks without leaking handlers across rerenders',()=>{
  const initial=vi.fn(()=>true),current=vi.fn(()=>true);const {rerender}=renderHook(({handle})=>useAppBack(true,10,handle),{initialProps:{handle:initial}});rerender({handle:current});act(()=>{expect(appBackActions.dispatch()).toBe(true)});expect(initial).not.toHaveBeenCalled();expect(current).toHaveBeenCalledOnce();
 });
});
