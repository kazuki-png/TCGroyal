import {serviceErrorMessage} from './service-errors';
// Never replay mutations after an uncertain transport failure.
export async function mobileFetch(url: string, options: RequestInit): Promise<Response> {
 // Expo SDK 58 advertises zstd/br. Keep Preview JSON transport uncompressed for compatibility.
 const headers=new Headers(options.headers);
 if(!headers.has('Accept-Encoding'))headers.set('Accept-Encoding','identity');
 try{return await fetch(url,{...options,headers})}
 catch(error){throw Error(serviceErrorMessage(error,'通信に失敗しました。接続診断を実行してください。'))}
}
