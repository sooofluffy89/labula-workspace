import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir=await mkdtemp(path.join(tmpdir(),'labula-save-recovery-'));
try{
 const outfile=path.join(dir,'recovery.mjs');
 await build({stdin:{contents:"export * from './lib/save-recovery';export * from './lib/bulk-draft';export {reconcileDraft} from './lib/bulk';export {initialNotebook,newItem} from './lib/notebook';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile,logLevel:'silent'});
 const {saveRecoverySchema,MAX_NOTEBOOK_PAYLOAD_BYTES,MAX_DRAFT_BYTES,MAX_ORDINARY_DRAFT_BYTES,makeIngredientDraft,readIngredientDraft,restoreIngredientDraft,reconcileDraft,initialNotebook,newItem}=await import(outfile);
 const n=initialNotebook(),recipeId=n.recipes[0].id;
 n.items.push(newItem('Garlic'));
 const local=structuredClone(n);local.recipes[0].notes='A later local edit';
 const payload=' \n'+JSON.stringify(n,null,1)+'\n',localPayload=JSON.stringify(local,null,2);
 const recovery={id:crypto.randomUUID(),revision:17,payload,localPayload};
 assert.deepEqual(saveRecoverySchema.parse(recovery),recovery,'validation retains both original serialized notebooks exactly');
 const rows=reconcileDraft('Garlic',[],n.items);
 const file=makeIngredientDraft(n,recipeId,'Garlic\nSalt',rows,[],[],null,false,[],recovery);
 assert.equal(file.save.state,'unsubmitted','bulk was never sent');
 assert.deepEqual(file.priorSave,recovery);
 const restoredFile=readIngredientDraft(JSON.stringify(file));
 assert.equal(restoredFile.priorSave.payload,payload);assert.equal(restoredFile.priorSave.localPayload,localPayload);
 const latest=structuredClone(n);latest.items[0].name='Peeled garlic';latest.items[0].kind='prep';
 const restored=restoreIngredientDraft(restoredFile,latest,recipeId);
 assert.equal(restored.rows.length,2,'ordinary ingredient edits still reconcile after earlier-save recovery');
 assert.equal(restored.rows[0].target.id,n.items[0].id);
 assert.deepEqual(restored.needsReview,['garlic'],'changed selected items still require checking');
 assert.equal(restored.rows[1].name,'Salt');
 assert.deepEqual(restoredFile.priorSave,recovery,'reconciliation never rewrites the ordinary save receipt');

 for(const bad of [{id:'wrong'},{revision:-1},{revision:1.5},{revision:Number.MAX_SAFE_INTEGER+1},{revision:'17'},{payload:{}},{payload:'{broken'},{payload:'null'},{localPayload:'[]'},{extra:'unsupported'}])assert.equal(saveRecoverySchema.safeParse({...recovery,...bad}).success,false,JSON.stringify(bad));
 const invalidReference=structuredClone(n);invalidReference.recipes[0].inputs=[{itemId:'missing',amount:null,note:''}];
 const cyclic=structuredClone(n);cyclic.items[0].kind='prep';cyclic.items[0].inputs=[{itemId:cyclic.items[0].id,amount:null,note:''}];
 const malicious=JSON.stringify(n).replace('{','{"__proto__":{"polluted":true},');
 for(const badPayload of [JSON.stringify(invalidReference),JSON.stringify(cyclic),malicious])assert.equal(saveRecoverySchema.safeParse({...recovery,payload:badPayload}).success,false,'invalid or unsafe notebook rejected');
 assert.equal({}.polluted,undefined);
 const unicode=structuredClone(n);unicode.equipment.notes='界'.repeat(6000);
 const unicodePayload=JSON.stringify(unicode)+' '.repeat(MAX_NOTEBOOK_PAYLOAD_BYTES-JSON.stringify(unicode).length);
 assert.equal(unicodePayload.length,MAX_NOTEBOOK_PAYLOAD_BYTES);
 assert.equal(saveRecoverySchema.safeParse({...recovery,payload:unicodePayload}).success,false,'notebook payload limit measures UTF-8 bytes');

 // Two maximum-size valid requests may double in size when tabs are escaped in
 // the enclosing JSON. They must still be downloadable without relaxing the
 // ingredient-only limit or either notebook payload limit.
 const raw=JSON.stringify(n),large='\t'.repeat(MAX_NOTEBOOK_PAYLOAD_BYTES-Buffer.byteLength(raw))+raw;
 const largeRecovery={...recovery,payload:large,localPayload:large};
 assert.equal(Buffer.byteLength(large),MAX_NOTEBOOK_PAYLOAD_BYTES);
 const largeFile=makeIngredientDraft(n,recipeId,'Garlic',rows,[],[],null,false,[],largeRecovery);
 const serialized=JSON.stringify(largeFile);
 assert.ok(Buffer.byteLength(serialized)>MAX_ORDINARY_DRAFT_BYTES);
 assert.ok(Buffer.byteLength(serialized)<MAX_DRAFT_BYTES);
 assert.equal(readIngredientDraft(serialized).priorSave.payload,large);
 assert.equal(saveRecoverySchema.safeParse({...largeRecovery,payload:large+' '}).success,false);
 assert.equal(saveRecoverySchema.safeParse({...largeRecovery,localPayload:large+' '}).success,false);
 assert.throws(()=>readIngredientDraft(' '.repeat(MAX_DRAFT_BYTES+1)),/too large/);
 assert.throws(()=>readIngredientDraft(JSON.stringify({...file,text:'界'.repeat(250001)})),/too large/);

 const plain=makeIngredientDraft(n,recipeId,'Garlic',rows,[],[],null);
 assert.equal(plain.priorSave,undefined);
 const old={...plain};delete old.keptNames;
 assert.deepEqual(readIngredientDraft(JSON.stringify(old)).keptNames,[],'old version-1 files remain supported');
 const legacy=readIngredientDraft(JSON.stringify({recipeId,text:'Garlic',rows}));
 assert.equal(legacy.save.state,'unverified');assert.equal(legacy.priorSave,undefined);
 const oversizedPlain=JSON.stringify(plain)+' '.repeat(MAX_ORDINARY_DRAFT_BYTES);
 assert.throws(()=>readIngredientDraft(oversizedPlain),/too large/,'plain files retain 750 KB limit');
 assert.throws(()=>readIngredientDraft(JSON.stringify({...file,text:'x'.repeat(MAX_ORDINARY_DRAFT_BYTES)})),/too large/,'recovery files retain 750 KB ingredient envelope limit');
 const pending={id:crypto.randomUUID(),revision:17,command:{recipeId,rows}};
 assert.throws(()=>makeIngredientDraft(n,recipeId,'Garlic',rows,[],[],pending,false,[],recovery),/not a supported/,'two pending commands cannot share one draft');
 const pendingOnly=makeIngredientDraft(n,recipeId,'Garlic',rows,[],[],pending);
 assert.deepEqual(readIngredientDraft(JSON.stringify(pendingOnly)).save.recovery,pending,'existing bulk receipt files remain unchanged');
 console.log('Passed earlier-save recovery: exact request and local payload roundtrips; ordinary ingredient reconciliation; invalid/unsafe notebooks; UUID/revision validation; UTF-8 and escaped file size boundaries; old draft compatibility; mutually exclusive pending commands.');
}finally{await rm(dir,{recursive:true,force:true});}
