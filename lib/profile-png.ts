// Decode every scanline/filter, validate CRC/chunk structure, and re-encode only
// pixels. Original metadata, polyglot tails and animation chunks never survive.
import {inflateSync,deflateSync} from 'node:zlib';
import {Buffer} from 'node:buffer';
import {PHOTO_BYTES} from './profile-photo';
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
function crc(b:Uint8Array){let c=0xffffffff;for(const n of b){c^=n;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(tag:string,data:Uint8Array){const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);out.write(tag,4,'ascii');out.set(data,8);out.writeUInt32BE(crc(out.subarray(4,-4)),out.length-4);return out;}
export function normalizeProfilePng(input:Uint8Array){
 const b=Buffer.from(input);const fail=()=>{throw Error('The photo could not be decoded as a 256 × 256 PNG. Choose another photo.');};
 if(b.length>PHOTO_BYTES||b.length<45||!b.subarray(0,8).equals(signature))return fail();
 let at=8,channels=0,ended=false,idat=false,afterData=false;const pieces:Buffer[]=[];
 while(at+12<=b.length){const len=b.readUInt32BE(at);if(len>b.length-at-12)return fail();const tag=b.toString('ascii',at+4,at+8),data=b.subarray(at+8,at+8+len);if(crc(b.subarray(at+4,at+8+len))!==b.readUInt32BE(at+8+len))return fail();
  if(at===8){if(tag!=='IHDR'||len!==13||data.readUInt32BE(0)!==256||data.readUInt32BE(4)!==256||data[8]!==8||![2,6].includes(data[9])||data[10]||data[11]||data[12])return fail();channels=data[9]===6?4:3;}
  else if(tag==='IDAT'){if(afterData||!channels)return fail();pieces.push(data);idat=true;}
  else if(tag==='IEND'){if(len||!idat)return fail();at+=12;ended=true;break;}
  else {if(['IHDR','acTL','fcTL','fdAT','PLTE','tRNS'].includes(tag)||tag[0]===tag[0].toUpperCase())return fail();if(idat)afterData=true;}
  at+=len+12;
 }
 if(!ended||at!==b.length)return fail();const stride=256*channels,expected=(stride+1)*256;
 let raw:Buffer;try{const decoded=inflateSync(Buffer.concat(pieces),{maxOutputLength:expected+1,info:true}) as unknown as {buffer:Buffer;engine:{bytesWritten:number}};if(decoded.engine.bytesWritten!==pieces.reduce((n,x)=>n+x.length,0))return fail();raw=decoded.buffer;}catch{return fail();}if(raw.length!==expected)return fail();
 const pixels=Buffer.alloc(stride*256);for(let y=0;y<256;y++){const filter=raw[y*(stride+1)];if(filter>4)return fail();for(let x=0;x<stride;x++){const a=x>=channels?pixels[y*stride+x-channels]:0,c=y&&x>=channels?pixels[(y-1)*stride+x-channels]:0,up=y?pixels[(y-1)*stride+x]:0;let prediction=0;if(filter===1)prediction=a;if(filter===2)prediction=up;if(filter===3)prediction=Math.floor((a+up)/2);if(filter===4){const p=a+up-c,pa=Math.abs(p-a),pb=Math.abs(p-up),pc=Math.abs(p-c);prediction=pa<=pb&&pa<=pc?a:pb<=pc?up:c;}pixels[y*stride+x]=(raw[y*(stride+1)+1+x]+prediction)&255;}}
 const rgba=Buffer.alloc((256*4+1)*256);for(let y=0;y<256;y++)for(let x=0;x<256;x++){const source=y*stride+x*channels,target=y*1025+1+x*4;rgba[target]=pixels[source];rgba[target+1]=pixels[source+1];rgba[target+2]=pixels[source+2];rgba[target+3]=channels===4?pixels[source+3]:255;}
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(256);ihdr.writeUInt32BE(256,4);ihdr[8]=8;ihdr[9]=6;return Buffer.concat([signature,chunk('IHDR',ihdr),chunk('IDAT',deflateSync(rgba)),chunk('IEND',new Uint8Array())]);
}
