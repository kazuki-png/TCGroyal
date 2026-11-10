import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import * as SecureStore from './secure-storage';
import {randomUUID} from 'expo-crypto';
import {createChunkedAuthStorage} from './chunked-auth-storage';
import {parseApplicationDraft,type ApplicationDraft,type ApplicationForm} from './application-draft';
import type {CollateralItem} from '../../lib/lending/collateral-types';
const options:SecureStore.SecureStoreOptions={keychainService:'tcg-royal-lending-draft',keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY};
const storage=createChunkedAuthStorage({get:key=>SecureStore.getItemAsync(key,options),set:(key,value)=>SecureStore.setItemAsync(key,value,options),remove:key=>SecureStore.deleteItemAsync(key,options)},randomUUID);
const storageKey=(key:string)=>`draft.${key.replace(/[^a-z0-9._-]/gi,'-')}`;
export const clearApplicationDraft=(key:string)=>storage.removeItem(storageKey(key));
export function useApplicationDraft(key:string|null){
 const [snapshot,setSnapshot]=useState<{key:string;draft:ApplicationDraft}|null>(null),[error,setError]=useState('');
 const current=useRef(key);useLayoutEffect(()=>{current.current=key},[key]);
 useEffect(()=>{let live=true;if(key)void storage.getItem(storageKey(key)).then(raw=>{const draft=parseApplicationDraft(raw);if(live){setSnapshot({key,draft});setError('')}}).catch(()=>{if(live){setSnapshot({key,draft:parseApplicationDraft(null)});setError('下書きを復元できませんでした。保存済み内容を確認するには再起動してください。')}});return()=>{live=false}},[key]);
 const ready=!!key&&snapshot?.key===key;
 function save(items:CollateralItem[],form:ApplicationForm){
  if(!key||!ready)return;
  let draft:ApplicationDraft;try{draft=parseApplicationDraft(JSON.stringify({version:1,items,...form,updatedAt:new Date().toISOString()}))}catch{setError('カード明細・希望額・相談内容を確認してください。');return}setSnapshot({key,draft});setError('');
  void storage.setItem(storageKey(key),JSON.stringify(draft)).catch(()=>{if(current.current===key)setError('下書きを保存できません。このまま閉じると変更が失われる場合があります。')});
 }
 const form={requestedAmount:ready?snapshot.draft.requestedAmount:'',notes:ready?snapshot.draft.notes:''};
 function change(items:CollateralItem[]){save(items,items.length?form:{requestedAmount:'',notes:''})}
 function changeForm(patch:Partial<ApplicationForm>){if(ready)save(snapshot.draft.items,{...form,...patch})}
 return {items:ready?snapshot.draft.items:[],form,changeForm,ready,error:ready?error:'',change};
}
