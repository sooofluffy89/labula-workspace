import {z} from 'zod';
import {validateNotebook,type Notebook,type RecipeInput} from './notebook';
import {patchDishVariant} from './dish-workspace';
import {applyWorkspaceMenuCommand,workspaceMenu,workspaceSourceToken} from './workspace-menu';
import type {AppliedRecord} from './review-v2/applied';
export const componentBulkSchema=z.object({view:z.enum(['dishes','house-made']),ids:z.array(z.string().min(1).max(100)).min(1).max(250),mode:z.enum(['add','replace']),componentId:z.string().min(1).max(100),fromId:z.string().min(1).max(100).optional(),keepMetadata:z.boolean()}).strict();
export const componentBulkCommandSchema=componentBulkSchema.extend({operationId:z.string().uuid(),sourceToken:z.string().min(1).max(100)});
export type ComponentBulkRequest=z.infer<typeof componentBulkSchema>;
export type ComponentBulkCommand=z.infer<typeof componentBulkCommandSchema>;
export type ComponentBulkRow={id:string;name:string;variant:string;before:RecipeInput[];after:RecipeInput[];changed:boolean;reason:string};
export type ComponentBulkPreview={revision:number;sourceToken:string;rows:ComponentBulkRow[];changed:number;reopened:number;componentName:string;fromName:string;legacyPlanBlock?:string};
export function changeComponentInputs(inputs:RecipeInput[],request:ComponentBulkRequest):RecipeInput[]{
 const next=structuredClone(inputs);if(request.mode==='add')return next.some(i=>i.itemId===request.componentId)?next:[...next,{itemId:request.componentId,amount:null,note:''}];
 if(!next.some(i=>i.itemId===request.fromId))return next;
 const exists=next.some(i=>i.itemId===request.componentId);
 return next.flatMap(input=>input.itemId!==request.fromId?[input]:exists?[]:[request.keepMetadata?{...input,itemId:request.componentId}:{itemId:request.componentId,amount:null,note:''}]);
}
export function prepareComponentBulk(n:Notebook,records:AppliedRecord[],raw:unknown,revision:number,now:string){
 const request=componentBulkSchema.parse(raw);
 if(new Set(request.ids).size!==request.ids.length)throw Error('Select each list once.');
 if(!n.items.some(i=>i.id===request.componentId))throw Error('The new component is no longer available.');
 if(request.mode==='replace'&&(!request.fromId||request.fromId===request.componentId||!n.items.some(i=>i.id===request.fromId)))throw Error('Choose two different existing components.');
 if(request.mode==='add'&&request.keepMetadata)throw Error('New components start with an unknown amount.');
 const projected=workspaceMenu(n,records,{revision,updatedAt:now,accountId:'preview',role:'owner'}),rows:ComponentBulkRow[]=[];let next=structuredClone(n);
 for(const id of request.ids){
  const recipe=request.view==='dishes'?projected.recipes.find(r=>r.id===id):undefined,item=request.view==='house-made'?projected.items.find(i=>i.id===id&&i.kind==='prep'):undefined;
  if(!recipe&&!item)throw Error('A selected list is no longer available.');
  const before=recipe?.inputs??item!.composition.inputs,after=changeComponentInputs(before,request),changed=JSON.stringify(before)!==JSON.stringify(after);
  rows.push({id,name:item?.name??projected.dishes.find(d=>d.id===recipe!.menuId)!.name,variant:recipe?.variant??'',before:structuredClone(before),after,changed,reason:changed?'Own list will need checking':request.mode==='add'?'Already included':'Original component is not present'});
  if(!changed)continue;
  if(recipe)next=patchDishVariant(next,id,{inputs:after,recorded:false});
  else {const current=workspaceMenu(next,records,{revision,updatedAt:now,accountId:'validation',role:'owner'}).items.find(i=>i.id===id)!;next=applyWorkspaceMenuCommand(next,records,{operationId:'00000000-0000-4000-8000-000000000001',itemId:id,baseToken:current.composition.token,inputs:after,method:current.method,yieldAmount:current.yieldAmount,reference:current.composition.reference,listConfirmed:false,confirmed:true},revision+1,now);}
 }
 // Check the final effective kitchen tree. Bought ingredients remain leaves.
 const finalView=workspaceMenu(next,records,{revision:revision+1,updatedAt:now,accountId:'validation',role:'owner'}),byId=new Map(finalView.items.map(i=>[i.id,i]));
 const done=new Set<string>(),visiting=new Set<string>();const visit=(id:string)=>{if(visiting.has(id))throw Error('This change would create a circular composition.');if(done.has(id))return;const item=byId.get(id);if(!item)throw Error('A component is no longer available.');visiting.add(id);if(item.kind==='prep')for(const part of item.composition.inputs)visit(part.itemId);visiting.delete(id);done.add(id);};
 for(const row of rows)if(row.changed)for(const input of row.after)visit(input.itemId);
 const preview:ComponentBulkPreview={revision,sourceToken:workspaceSourceToken({n,records}),rows,changed:rows.filter(r=>r.changed).length,reopened:rows.filter(r=>r.changed).length,componentName:n.items.find(i=>i.id===request.componentId)!.name,fromName:n.items.find(i=>i.id===request.fromId)?.name??''};
 return {next:validateNotebook(next),preview};
}
