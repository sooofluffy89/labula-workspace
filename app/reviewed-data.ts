'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {requestJson} from '@/lib/request-json';
import type {AppliedRecord} from '@/lib/review-v2/applied';
export type ReviewedRead={productionExcludedIds?:string[];records:AppliedRecord[]|null;loading:boolean;error:string;checkedAt:number|null;refresh:()=>Promise<void>};
export function useReviewedData(account:string,updatedAt?:string|null):ReviewedRead{
 const [state,setState]=useState<{productionExcludedIds?:string[];account:string;records:AppliedRecord[]|null;loading:boolean;error:string;checkedAt:number|null}>({account,records:null,loading:false,error:'',checkedAt:null});
 const epoch=useRef(0),flight=useRef<{account:string;promise:Promise<void>}|null>(null),previous=useRef('');
 const refresh=useCallback(()=>{
  if(!account)return Promise.resolve();if(flight.current?.account===account)return flight.current.promise;
  const seq=++epoch.current;setState(s=>s.account===account?{...s,loading:true,error:''}:{account,records:null,loading:true,error:'',checkedAt:null});
  const promise=(async()=>{try{const {res,body}=await requestJson<{productionExcludedIds?:string[];account:string;records:AppliedRecord[];error?:string}>('/api/reviewed-data',{cache:'no-store'});if(seq!==epoch.current)return;
   if(!res.ok){if(res.status===401||res.status===403)setState(s=>({...s,records:null}));throw Error(body.error??'Approved review data could not be checked.');}
   if(body.account?.toLowerCase()!==account.toLowerCase()){setState(s=>({...s,records:null}));throw Error('The signed-in account changed.');}
   setState({account,productionExcludedIds:body.productionExcludedIds,records:body.records,checkedAt:Date.now(),loading:false,error:''});
  }catch(e){if(seq===epoch.current)setState(s=>({...s,loading:false,error:(e as Error).message}));}finally{if(seq===epoch.current){flight.current=null;setState(s=>({...s,loading:false}));}}})();
  flight.current={account,promise};return promise;
 },[account]);
 useEffect(()=>{const serial=epoch;void refresh();return()=>{serial.current++;flight.current=null;};},[refresh]);
 useEffect(()=>{if(previous.current&&updatedAt&&previous.current!==updatedAt)void refresh();previous.current=updatedAt??'';},[updatedAt,refresh]);
 return {...(state.account===account?state:{records:null,loading:!!account,error:'',checkedAt:null}),refresh};
}
