'use client';
import {useEffect,useRef,useState,type ComponentProps} from 'react';
import {Dialog as DialogPrimitive} from 'radix-ui';
import {DialogOverlay,DialogPortal} from '@/components/ui/dialog';
import type {EveningState} from '@/lib/evening-client';
import {rowFeedback} from '@/lib/stock-feedback';

// Only a new receipt observed on this mounted surface can pulse. History never replays.
export function useSavePulse(token:string|null,eligible=true,context=''){
 const previous=useRef({token,context}),[pulse,setPulse]=useState<string|null>(null);
 useEffect(()=>{
  const changed=previous.current.context!==context||previous.current.token!==token;
  const newContext=previous.current.context!==context;
  previous.current={token,context};
  if(!changed&&eligible)return;
  // Ineligible receipts are consumed, never replayed after discard, polling or recovery.
  setPulse(!newContext&&changed&&eligible?token:null);
  if(!token||!changed||!eligible||newContext)return;
  const timer=window.setTimeout(()=>setPulse(null),1500);
  return()=>window.clearTimeout(timer);
 },[token,context,eligible]);
 return eligible&&!!token&&pulse===token;
}
export function StockRow({state,kind,itemId,children,...props}:ComponentProps<'div'>&{state:EveningState;kind:'answer'|'ready';itemId:string}){
 const feedback=rowFeedback(state,kind,itemId),pulse=useSavePulse(feedback.receiptId,feedback.ackEligible,`${state.snapshot?.accountId}:${state.snapshot?.check?.id}`);
 return <div {...props} data-sync={feedback.pending?'pending':pulse?'saved':'idle'}>
  {children}<span className="stock-sync-marker" aria-hidden="true"/>
  <span className="stock-row-feedback" data-shared={pulse}>{feedback.label||(pulse?'✓ Shared':'\u00a0')}</span>
 </div>;
}
export function StockProgress({value,total,label}:{value:number;total:number;label:string}){
 // Mount at the actual value. CSS only interpolates subsequent changes.
 const count=Math.max(0,Math.min(value,total));
 if(!total)return null;
 return <div className="stock-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={count} aria-valuetext={`${count} of ${total}; choices, not saved requests`}><span style={{transform:`scaleX(${count/total})`}}/></div>;
}
// Compose the existing Radix primitives to scope overlay motion without modifying the shared dialog.
export function StockConfirmationContent({children,className='',...props}:ComponentProps<typeof DialogPrimitive.Content>){
 return <DialogPortal><DialogOverlay className="stock-confirm-overlay"/><DialogPrimitive.Content {...props} data-slot="dialog-content" className={'stock-confirm-content evening-confirm '+className}>{children}</DialogPrimitive.Content></DialogPortal>;
}
