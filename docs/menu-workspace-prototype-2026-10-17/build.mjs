import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('./',import.meta.url);
let html=await readFile(new URL('index.template.html',root),'utf8');
for(const [marker,file] of [['/* PROTOTYPE_STYLES */','styles.css'],['/* PROTOTYPE_MODEL */','model.js'],['/* PROTOTYPE_APP */','app.js']])html=html.replace(marker,await readFile(new URL(file,root),'utf8'));
await writeFile(new URL('index.html',root),html);
const page=html.replace('<html lang="en">','<html lang="en" data-embed="page">').replace('</style>','\nhtml[data-embed="page"] body{height:900px;min-height:900px;}\n@media(max-width:760px){html[data-embed="page"] body{height:840px;min-height:840px;}}\n</style>');
await writeFile(new URL('page.html',root),page);
console.log(`Built standalone HTML (${Buffer.byteLength(html)} bytes) and Page HTML (${Buffer.byteLength(page)} bytes).`);
