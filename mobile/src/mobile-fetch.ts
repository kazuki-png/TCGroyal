import {serviceErrorMessage} from './service-errors';
// Never replay mutations after an uncertain transport failure.
export async function mobileFetch(url: string, options: RequestInit): Promise<Response> {
 try{return await fetch(url,options)}
 catch(error){throw Error(serviceErrorMessage(error,'通信に失敗しました。接続診断を実行してください。'))}
}
