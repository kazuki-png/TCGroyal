import {useLayoutEffect,useRef} from 'react';
import {appBackActions} from './back-actions';
export function useAppBack(active:boolean,priority:number,handle:()=>boolean){
 const latest=useRef(handle);
 useLayoutEffect(()=>{latest.current=handle},[handle]);
 useLayoutEffect(()=>{if(active)return appBackActions.register(priority,()=>latest.current())},[active,priority]);
}
