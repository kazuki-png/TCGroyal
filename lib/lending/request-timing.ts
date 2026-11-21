// Numeric durations only: no images, names, tokens or account identifiers.
export function requestTiming(){
 const started=performance.now(),durations=new Map<string,number>()
 return {
  async measure<T>(name:string,work:()=>Promise<T>):Promise<T>{
   const start=performance.now()
   try{return await work()}finally{durations.set(name,(durations.get(name)??0)+performance.now()-start)}
  },
  response(response:Response){
   durations.set('total',performance.now()-started)
   response.headers.set('Server-Timing',[...durations].map(([name,ms])=>`${name};dur=${ms.toFixed(1)}`).join(', '))
   return response
  },
 }
}
