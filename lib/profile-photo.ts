export const PHOTO_BYTES=350*1024;
export const PHOTO_BODY_BYTES=500*1024;
export async function readPhotoInput(file:{size:number;arrayBuffer:()=>Promise<ArrayBuffer>}){
 if(file.size>10*1024*1024)throw Error('Choose a photo smaller than 10 MB.');
 validatePhotoInput(new Uint8Array(await file.arrayBuffer()));
}
export type OwnProfile={accountId:string;name:string;email:string;role:'owner'|'manager'|'cook'|'legacy';active:boolean;revision:number;hasPhoto:boolean;updatedAt:string|null};
export function profileInitials(name:string){const words=name.trim().split(/\s+/u).filter(Boolean);return (words.length>1?Array.from(words[0])[0]+Array.from(words.at(-1)!)[0]:Array.from(words[0]??'').slice(0,2).join('')).toLocaleUpperCase()||'?';}
export function profileRole(role:OwnProfile['role']){return role==='owner'?'Owner':role==='manager'?'Manager':'Cook';}
export function validatePhotoInput(bytes:Uint8Array){
 if(bytes.length>10*1024*1024)throw Error('Choose a photo smaller than 10 MB.');
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let width=0,height=0,type='';
 if(bytes.length>=24&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n)){
  type='image/png';width=v.getUint32(16);height=v.getUint32(20);let at=8;
  while(at+12<=bytes.length){const len=v.getUint32(at),tag=String.fromCharCode(...bytes.slice(at+4,at+8));if(tag==='acTL'||tag==='fcTL'||tag==='fdAT')throw Error('Animated images are not supported.');if(len>bytes.length-at-12)throw Error('This PNG is damaged. Choose another photo.');at+=12+len;}
 }else if(bytes[0]===255&&bytes[1]===216){
  type='image/jpeg';let at=2;
  while(at+4<=bytes.length){if(bytes[at++]!==255)throw Error('This JPEG is damaged.');while(bytes[at]===255)at++;const marker=bytes[at++];if(marker===218||marker===217)break;if(marker===1||marker>=208&&marker<=215)continue;const len=v.getUint16(at);if(len<2||at+len>bytes.length)throw Error('This JPEG is damaged.');if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){if(len<8)throw Error('This JPEG is damaged.');height=v.getUint16(at+3);width=v.getUint16(at+5);break;}at+=len;}
 }else if(bytes.length>=30&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'){
  type='image/webp';let at=12;while(at+8<=bytes.length){const tag=String.fromCharCode(...bytes.slice(at,at+4)),len=v.getUint32(at+4,true),p=at+8;if(p+len>bytes.length)throw Error('This WebP is damaged.');if(tag==='ANIM'||tag==='ANMF'||tag==='VP8X'&&(bytes[p]&2))throw Error('Animated images are not supported.');if(tag==='VP8X'&&len>=10){width=1+bytes[p+4]+(bytes[p+5]<<8)+(bytes[p+6]<<16);height=1+bytes[p+7]+(bytes[p+8]<<8)+(bytes[p+9]<<16);}if(tag==='VP8 '&&len>=10){width=v.getUint16(p+6,true)&16383;height=v.getUint16(p+8,true)&16383;}if(tag==='VP8L'&&len>=5){const bits=v.getUint32(p+1,true);width=1+(bits&16383);height=1+((bits>>>14)&16383);}at=p+len+(len&1);}
 }else throw Error('Choose a JPEG, PNG or WebP photo. HEIC and animated images are not supported.');
 if(!width||!height||width>8192||height>8192||width*height>20_000_000)throw Error('This photo is too large to process. Choose one with fewer than 20 million pixels (maximum 8192 per side).');return {width,height,type};
}
