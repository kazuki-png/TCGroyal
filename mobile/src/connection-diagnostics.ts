import {networkFailureCode,networkFailureSummary,diagnosticErrorDetail} from './network-errors';
export interface ConnectionCheck {label:string;ok:boolean;message:string;detail?:string}
export async function probeConnection(label:string,url:string,expected:'health'|'unauthenticated',headers:Record<string,string>={}):Promise<ConnectionCheck>{
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 let stage:'接続'|'応答読込'|'JSON解析'='接続',status:number|undefined;
 try{
  // No cookies or member token: test transport independently from login.
  const response=await fetch(url,{method:'GET',redirect:'manual',credentials:'omit',headers:{Accept:'application/json',...headers},signal:controller.signal});
  status=response.status;
  const json=response.headers.get('content-type')?.includes('application/json');
  if(json){
   stage='応答読込';const text=await response.text();stage='JSON解析';const data=JSON.parse(text);
   if(expected==='health'&&response.status===200)return {label,ok:true,message:'接続できました'};
   if(expected==='unauthenticated'&&response.status===401&&!data.protection&&typeof data.error==='string')return {label,ok:true,message:'APIへ到達できました（認証情報なしの確認）'};
   if(data.protection)return {label,ok:false,message:'Vercelのアクセス保護で止まっています'};
  }
  if([301,302,303,307,308].includes(response.status)||response.status===401&&!json)return {label,ok:false,message:`アクセス保護または転送を確認してください（HTTP ${response.status}）`};
  return {label,ok:false,message:`想定外の応答です（HTTP ${response.status}）`};
 }catch(error){const code=controller.signal.aborted?'timeout':networkFailureCode(error);return {label,ok:false,message:status===undefined?networkFailureSummary(code):`HTTP ${status}を受信しましたが、${stage}に失敗しました。`,detail:`段階：${stage}${status===undefined?'':` / HTTP ${status}`} / ${diagnosticErrorDetail(error)}`}}
 finally{clearTimeout(timer)}
}
