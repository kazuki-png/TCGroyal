import {NativeModules,Platform} from 'react-native';
type TraceModule={clearEvents:()=>Promise<void>;getRecentEvents:()=>Promise<unknown>};
const nativeModule=Platform.OS==='android'?NativeModules.TcgNetworkDiagnostics as TraceModule|undefined:undefined;
export async function clearNativeNetworkEvents(){await nativeModule?.clearEvents()}
export async function nativeNetworkEvents():Promise<string[]>{
 const events=await nativeModule?.getRecentEvents();
 return Array.isArray(events)?events.filter((value):value is string=>typeof value==='string').slice(-80).map(value=>value.slice(0,400)):[];
}
