 'use client';
import {useEffect,useState} from 'react';
import {requestJson} from '@/lib/request-json';
import {Button} from '@/components/ui/button';
export function ReviewStatus({onOpen}:{onOpen:()=>void}){
 const [s,set]=useState<{started:boolean;answered:number;remaining:number;openChecks:number;record?:string}|null>(null),[error,setError]=useState(false);
 useEffect(()=>{let alive=true;requestJson('/api/review-status').then(({res,body})=>{if(alive){if(res.ok)set(body as typeof s);else setError(true);}}).catch(()=>{if(alive)setError(true);});return()=>{alive=false;};},[]);
 return <details className="review-status"><summary>Kitchen review{s?.started?` · ${s.answered} of 8 cases answered`:''}</summary><p className="muted small">{s?.started?`${s.remaining} cases to answer · ${s.openChecks} checks open`:error?'Open the review to check its latest status.':'Eight focused cases about repeated preparation work. Estimates and unknown answers are welcome.'}</p><Button variant="outline" onClick={onOpen}>{s?.started?'Continue review':'Open kitchen review'}</Button></details>;
}
