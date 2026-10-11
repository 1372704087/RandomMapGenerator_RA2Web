// 缩图: node downscale.cjs <in.png> <out.png> <除数>
'use strict';
const fs = require('fs');
const zlib = require('zlib');
function decodePng(p){const b=fs.readFileSync(p);let off=8,ihdr=null,idat=[];
while(off<b.length){const len=b.readUInt32BE(off),type=b.toString('ascii',off+4,off+8);
if(type==='IHDR')ihdr={w:b.readUInt32BE(off+8),h:b.readUInt32BE(off+12),ct:b[off+17]};
else if(type==='IDAT')idat.push(b.subarray(off+8,off+8+len));else if(type==='IEND')break;off+=12+len;}
const ch=ihdr.ct===2?3:4;const raw=zlib.inflateSync(Buffer.concat(idat));const stride=ihdr.w*ch,out=Buffer.alloc(ihdr.h*stride);
let prev=Buffer.alloc(stride);
for(let y=0;y<ihdr.h;++y){const f=raw[y*(stride+1)];const row=raw.subarray(y*(stride+1)+1,(y+1)*(stride+1));const cur=out.subarray(y*stride,(y+1)*stride);
for(let x=0;x<stride;++x){const a=x>=ch?cur[x-ch]:0,b2=prev[x],c=x>=ch?prev[x-ch]:0;let v=row[x];
if(f===1)v=(v+a)&255;else if(f===2)v=(v+b2)&255;else if(f===3)v=(v+((a+b2)>>1))&255;
else if(f===4){const p=a+b2-c,pa=Math.abs(p-a),pb=Math.abs(p-b2),pc=Math.abs(p-c);v=(v+(pa<=pb&&pa<=pc?a:pb<=pc?b2:c))&255;}cur[x]=v;}prev=cur;}
return {w:ihdr.w,h:ihdr.h,ch,data:out};}
function encodePng(w,h,rgb){const raw=Buffer.alloc((w*3+1)*h);
for(let y=0;y<h;++y){raw[y*(w*3+1)]=0;rgb.copy(raw,y*(w*3+1)+1,y*w*3,(y+1)*w*3);}
const idat=zlib.deflateSync(raw,{level:6});const cs=[];const t=[];for(let n=0;n<256;++n){let c=n;for(let k=0;k<8;++k)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}
const crc=b=>{let c=0xffffffff;for(const x of b)c=t[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
const ch2=(ty,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(ty),d]);const cr=Buffer.alloc(4);cr.writeUInt32BE(crc(td));return Buffer.concat([l,td,cr]);};
const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=2;
cs.push(Buffer.from([137,80,78,71,13,10,26,10]),ch2('IHDR',ih),ch2('IDAT',idat),ch2('IEND',Buffer.alloc(0)));return Buffer.concat(cs);}
const [inp,outp,fac]=process.argv.slice(2);
const img=decodePng(inp);
const f=parseInt(fac||'5');
const cw=Math.round(img.w/f),chh=Math.round(img.h/f);
const rgb=Buffer.alloc(cw*chh*3);
for(let y=0;y<chh;++y)for(let x=0;x<cw;++x){
  let r=0,g=0,b=0,n=0;
  for(let sy=0;sy<f;++sy)for(let sx=0;sx<f;++sx){const yy=y*f+sy,xx=x*f+sx;if(yy>=img.h||xx>=img.w)continue;const o=(yy*img.w+xx)*img.ch;r+=img.data[o];g+=img.data[o+1];b+=img.data[o+2];++n;}
  const doo=(y*cw+x)*3;rgb[doo]=r/n;rgb[doo+1]=g/n;rgb[doo+2]=b/n;
}
fs.writeFileSync(outp,encodePng(cw,chh,rgb));
console.log('saved',outp,cw+'x'+chh);
