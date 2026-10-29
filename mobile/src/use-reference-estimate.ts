import {useEffect,useState} from 'react';
import type {CollateralItem} from '../../lib/lending/collateral-types';
import type {BundleEstimate} from '../../lib/lending/bundle-estimate-types';
import {lendingApi} from './api';

export function useReferenceEstimate(items:CollateralItem[],enabled=true){
 // Condition notes do not change the price calculation. Keep them out of the
 // dependency so typing a note cannot trigger repeated provider requests.
 const key=JSON.stringify(items.map(item=>({...item,condition:''})));
 const [retry,setRetry]=useState(0);
 const [state,setState]=useState<{key:string;retry:number;estimate:BundleEstimate|null;error:string;loading:boolean}|null>(null);
 const valid=items.length>0&&items.length<=20&&items.every(item=>Number.isInteger(item.quantity)&&item.quantity>=1&&item.quantity<=100)&&items.reduce((sum,item)=>sum+item.quantity,0)<=100;
 const active=enabled&&valid;
 useEffect(()=>{
  if(!active)return;
  let live=true;const controller=new AbortController();let timeout:ReturnType<typeof setTimeout>|undefined;
  // Debounce quantity/grade edits and rapid candidate changes. A new key aborts
  // the old request; its late result must never replace the current selection.
  const timer=setTimeout(()=>{
   setState({key,retry,estimate:null,error:'',loading:true});
   timeout=setTimeout(()=>controller.abort(),45000);
   void lendingApi<{estimate:BundleEstimate}>('/catalog',{body:{action:'quote_bundle',items:JSON.parse(key)},signal:controller.signal})
    .then(data=>{if(live)setState({key,retry,estimate:data.estimate,error:'',loading:false})})
    .catch(cause=>{if(live)setState({key,retry,estimate:null,error:cause instanceof Error?cause.message:'参考額を取得できません。個別査定を依頼できます。',loading:false})})
    .finally(()=>clearTimeout(timeout));
  },600);
  return()=>{live=false;clearTimeout(timer);clearTimeout(timeout);controller.abort()};
 },[key,active,retry]);
 const current=active&&state?.key===key&&state.retry===retry?state:null;
 return {estimate:current?.estimate??null,error:current?.error??'',loading:active&&(!current||current.loading),refresh:()=>setRetry(value=>value+1)};
}
