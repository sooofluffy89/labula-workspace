import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(path.join(tmpdir(),'labula-copy-'));
try{
 const outfile=path.join(dir,'copy.mjs');await build({entryPoints:['lib/bulk-input.ts'],bundle:true,platform:'node',format:'esm',outfile,logLevel:'silent'});
 const {copiedLines,transformCopiedLine,validKeptNames}=await import(outfile);
 const text='1. Salt\n2) Garlic\n(3) Ginger\n• Coriander\n- Sesame oil\n* Soy sauce\n\n5-spice powder\nStock (chicken, ginger)\n"Chilli, mild"';
 const lines=copiedLines(text);assert.equal(lines.length,6);assert.deepEqual(lines.map(l=>l.cleaned),['Salt','Garlic','Ginger','Coriander','Sesame oil','Soy sauce']);
 const mixed=copiedLines('1. Coriander, spring onion')[0];assert.equal(mixed.cleaned,'Coriander, spring onion');assert.deepEqual(mixed.parts,['Coriander','spring onion']);
 assert.deepEqual(copiedLines('Garlic; Ginger\tSalt')[0].parts,['Garlic','Ginger','Salt']);assert.deepEqual(copiedLines('蒜，姜')[0].parts,['蒜','姜']);
 assert.equal(copiedLines('Salt,')[0].parts,null,'do not silently discard empty list parts');
 assert.deepEqual(copiedLines('5-spice powder\n7-up\nChilli-garlic oil'),[]);
 assert.equal(transformCopiedLine('Salt\n1. Coriander, spring onion\nHouse sauce',mixed.key,mixed.parts),'Salt\nCoriander\nspring onion\nHouse sauce');
 assert.equal(transformCopiedLine(' 1. Salt\n1. Salt\nPepper','1. salt',['Salt']),'Salt\nSalt\nPepper','all repeated lines remain represented');
 assert.throws(()=>transformCopiedLine('Salt', 'salt', ['x'.repeat(161)]),/160/);
 const max=Array.from({length:149},(_,i)=>`Item ${i}`).join('\n')+'\nSalt, Pepper';assert.throws(()=>transformCopiedLine(max,'salt, pepper',['Salt','Pepper']),/exceed 150/);
 assert.deepEqual(validKeptNames('Chilli, mild',['chilli, mild','old, name']),['chilli, mild']);
 assert.equal(copiedLines('1. '+ 'x'.repeat(159))[0].cleaned.length,159,'long formatted input can be cleaned before name-length validation');
 console.log('Passed copied text: numbering, bullets, mixed separators, protected meaningful names, confirmed transformations, kept originals and limits without truncation.');
}finally{await rm(dir,{recursive:true,force:true});}
