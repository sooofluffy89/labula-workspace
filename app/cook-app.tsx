'use client';
import {useCallback} from 'react';
import {ProfilePageBar} from './profile';
import {InformationProvider} from './information-detail';
import {StockWorkflow} from './stock-workflow';

const request={view:'evening' as const,serial:0};
export default function CookApp({account}:{account:string}){
 const ignore=useCallback(()=>{},[]);
 return <InformationProvider key={account} account={account} operationsOnly><main className="app-frame"><ProfilePageBar/><StockWorkflow account={account} active request={request} onExit={ignore} onDraft={ignore} operationsOnly/></main></InformationProvider>;
}
