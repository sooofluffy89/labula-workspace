import {z} from 'zod';
import {profileSchema,editableProfileSchema,validateProfile,sameProfile,effortBasis,type PrepProfile} from './prep-profile';
import {validateNotebook,type Notebook} from './notebook';
import {directUsage,compareUsage} from './direct-usage';
import {preparationProgress} from './prep-completion';

export const profileCommandSchema=z.object({itemId:z.string().min(1).max(100),base:profileSchema,next:profileSchema}).strict();
export type ProfileCommand=z.infer<typeof profileCommandSchema>;
export const profileReceiptSchema=z.object({id:z.string().uuid(),revision:z.number().int().nonnegative(),command:profileCommandSchema}).strict();
export type ProfileReceipt=z.infer<typeof profileReceiptSchema>;
const draftProfile=editableProfileSchema;
export const prepDraftSchema=z.object({format:z.literal('labula-preparation-draft'),version:z.literal(1),account:z.string().max(400),queue:z.array(z.string().max(100)).max(1000),cursor:z.number().int().min(0).max(1000),drafts:z.record(z.string().max(100),z.object({base:profileSchema,value:draftProfile,step:z.enum(['preparation','storage'])}).strict()),pending:profileReceiptSchema.nullable()}).strict();
export type PrepDraft=z.infer<typeof prepDraftSchema>;
export const prepDraftKey=(account:string)=>'labula-preparation-v1:'+account.toLowerCase();
export function readPrepDraft(content:string,account:string):PrepDraft{
 if(content.length>4000000)throw Error('This preparation draft is too large.');
 const d=prepDraftSchema.parse(JSON.parse(content,(key,value)=>{if(['__proto__','prototype','constructor'].includes(key))throw Error('Unsupported draft field.');return value;}));if(d.account.toLowerCase()!==account.toLowerCase())throw Error('This draft belongs to another account. Sign in with the account that created it.');
 if(new Set(d.queue).size!==d.queue.length)throw Error('This preparation draft has a repeated item.');
 // Older editors could retain a batch estimate after changing to per-order work.
 // Only reopen demonstrably mismatched draft answers; never rewrite a frozen receipt.
 for(const [id,entry] of Object.entries(d.drafts)){if(d.pending?.command.itemId===id)continue;const basis=effortBasis(entry.value.workflow);if(entry.value.effortBasis&&entry.value.effortBasis!==basis){entry.value.effort=null;entry.value.effortBasis=basis;}}
 return d;
}
export function preparationQueue(n:Notebook){const index=directUsage(n);return n.items.filter(i=>(index.itemDishes.get(i.id)?.size??0)>0).sort((a,b)=>compareUsage(index,a.id,b.id)).map(i=>i.id);}
export function applyProfileCommand(n:Notebook,c:ProfileCommand){
 const next=structuredClone(n),item=next.items.find(i=>i.id===c.itemId);if(!item)throw Error('This item was removed or merged. Keep your draft and open its current catalog entry.');
 if(!sameProfile(item.prepProfile,c.base))throw Error('These preparation answers changed. Load the latest answers and compare before saving.');
 item.prepProfile=validateProfile(c.next);return validateNotebook(next);
}
export function makePrepEntry(p:PrepProfile){return {base:structuredClone(p),value:structuredClone(p),step:'preparation' as const};}

export function hasPrepDraftChanges(d:PrepDraft|null){return !!d&&(!!d.pending||Object.values(d.drafts).some(e=>{try{return !sameProfile(validateProfile(e.value),e.base);}catch{return true;}}));}

export function changedPrepEntry(entry:PrepDraft['drafts'][string]){
 try{return !sameProfile(validateProfile(entry.value),entry.base);}catch{return true;}
}
export function resumePreparation(n:Notebook,d:PrepDraft|null){
 if(!d)return null;
 if(d.pending)return {itemId:d.pending.command.itemId,step:d.drafts[d.pending.command.itemId]?.step??'storage' as const,pending:true};
 const active=new Set(preparationQueue(n));
 const last=d.queue[d.cursor];
 const id=[last,...Object.keys(d.drafts).reverse()].find(id=>active.has(id)&&d.drafts[id]&&changedPrepEntry(d.drafts[id]));
 return id?{itemId:id,step:d.drafts[id].step,pending:false}:null;
}
export function initialPreparationSession(n:Notebook,d:PrepDraft|null,account:string,options:{remaining?:boolean;startItemId?:string;itemId?:string}={}){
 const eligible=options.remaining?preparationProgress(n).remaining.map(i=>i.item.id):preparationQueue(n);
 const session:PrepDraft=d?structuredClone(d):{format:'labula-preparation-draft',version:1,account,queue:[],cursor:0,drafts:{},pending:null};
 const resume=resumePreparation(n,session);
 const target=session.pending?.command.itemId??options.itemId??options.startItemId??(options.remaining?resume?.itemId??eligible[0]:session.queue[session.cursor]??eligible[0]);
 session.queue=[...session.queue.filter(id=>eligible.includes(id)),...eligible.filter(id=>!session.queue.includes(id))];
 // A pending request or local draft remains recoverable even after it leaves the active menu.
 if(target&&!session.queue.includes(target))session.queue.unshift(target);
 session.cursor=Math.max(0,session.queue.indexOf(target!));
 return session;
}
export function nextPreparationCursor(n:Notebook,s:PrepDraft,remaining:boolean){
 const needed=new Set((remaining?preparationProgress(n).remaining.map(i=>i.item.id):preparationQueue(n)));
 const active=new Set(preparationQueue(n));
 for(let i=s.cursor+1;i<s.queue.length;i++)if(needed.has(s.queue[i])||active.has(s.queue[i])&&s.drafts[s.queue[i]]&&changedPrepEntry(s.drafts[s.queue[i]]))return i;
 return null;
}
