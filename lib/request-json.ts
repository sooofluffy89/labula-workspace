export const REQUEST_TIMEOUT_MS=30_000;
export class RequestTimeoutError extends Error {
 constructor(){super('The connection took too long. The save may have reached the server. Retry to check its result safely.');this.name='RequestTimeoutError';}
}
// No application state is changed inside the work promise: a late reply is harmless.
export async function requestJson<T>(url:string,init:RequestInit={}):Promise<{res:Response;body:T}>{
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{reject(new RequestTimeoutError());controller.abort();},REQUEST_TIMEOUT_MS);});
 try{return await Promise.race([(async()=>{const res=await fetch(url,{...init,signal:controller.signal});const body=await res.json() as T;return {res,body};})(),deadline]);}
 finally{clearTimeout(timer);}
}
