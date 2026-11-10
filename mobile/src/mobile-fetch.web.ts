import {serviceErrorMessage} from './service-errors';
export async function mobileFetch(url:string,options:RequestInit):Promise<Response>{
 const headers=new Headers(options.headers);
 // The browser supplies these headers itself, including the real Origin for CSRF checks.
 headers.delete('Accept-Encoding');headers.delete('Origin');
 try{return await fetch(url,{...options,headers})}
 catch(error){throw Error(serviceErrorMessage(error,'通信に失敗しました。接続を確認してください。'))}
}
