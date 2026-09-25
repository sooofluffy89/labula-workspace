'use client';
import {useCallback} from 'react';
import {StockWorkflow} from './stock-workflow';

const request={view:'evening' as const,serial:0};
export default function CookApp({account}:{account:string}){
 const ignore=useCallback(()=>{},[]);
 return <main className="app-frame"><StockWorkflow account={account} active request={request} onExit={ignore} onDraft={ignore} operationsOnly/></main>;
}
