/**
 * 已知参数的真机对拍：`F:/YTLauncher/RandMap.Sed` + `RandMap.Map`。
 * 这是唯一「参数完全已知 + 真机结果」的配对 ⇒ 可做定向比对。
 */
const B='G:/ra2-web-mapgen/packages/core';
const fs=require('fs');
const {generateFullMap}=require(B+'/dist/rmg/pipeline.js');
const {deriveDimensions}=require(B+'/dist/rmg/options.js');
const {loadSed}=require(B+'/dist/rmg/sed.js');
const {parseTheaterIni}=require(B+'/dist/rmg/theater.js');
const {IniFile}=require(B+'/dist/io/iniFile.js');
const {decompressRange}=require(B+'/dist/format/minilzo.js');
const tables=parseTheaterIni(fs.readFileSync('G:/ra2-web-mapgen/packages/server/resources/theater/temperatmd.ini','utf8'),'TEMPERATE');

function parseIso(ini){ const sec=ini.GetSection('IsoMapPack5'); if(!sec)return null;
  const keys=sec.Keys.slice().sort((a,b)=>Number(a)-Number(b));
  const raw=Buffer.from(keys.map(k=>sec.GetStringValue(k,'')).join(''),'base64');
  let r=0; const parts=[];
  while(r+4<=raw.length){ const si=raw.readUInt16LE(r),so=raw.readUInt16LE(r+2); if(!si||!so)break; r+=4;
    const o=new Uint8Array(so+1024); decompressRange(new Uint8Array(raw),r,si,o,0); parts.push(Buffer.from(o.slice(0,so))); r+=si; }
  return Buffer.concat(parts); }
function tiles(buf){ const out=[];
  for(let o=0;o+11<=buf.length-4;o+=11){ const x=buf.readInt16LE(o),y=buf.readInt16LE(o+2),ti=buf.readInt32LE(o+4);
    if(x===0&&y===0&&ti===0)break; out.push({x,y,ti,sub:buf[o+8],lvl:buf[o+9],slope:buf[o+10]}); }
  return out; }
function stat(ts){ const lv={},tis=new Set(),subs=new Set();
  for(const t of ts){ lv[t.lvl]=(lv[t.lvl]||0)+1; tis.add(t.ti); subs.add(t.sub); }
  const ks=Object.keys(lv).map(Number).sort((a,b)=>a-b);
  return {n:ts.length,lvCount:ks.length,lvMin:ks[0],lvMax:ks[ks.length-1],
          lv,tiCount:tis.size,subCount:subs.size}; }
function show(tag, s){
  console.log('%s tile=%d Level=%d档(%d..%d) TileIdx=%d种 SubIdx=%d种',
    tag.padEnd(10), s.n, s.lvCount, s.lvMin, s.lvMax, s.tiCount, s.subCount);
  console.log('           level 分布:', Object.entries(s.lv).sort((a,b)=>Number(a[0])-Number(b[0])).map(([k,v])=>k+':'+v).join(' '));
}
// 真机
const real=new IniFile(fs.readFileSync('F:/YTLauncher/RandMap.Map','latin1'));
const h=real.GetSection('Header');
console.log('真机 Header: W=%d H=%d 起点=%d\n', h.GetIntValue('Width',-1), h.GetIntValue('Height',-1), h.GetIntValue('NumberStartingPoints',-1));
const realStat=stat(tiles(parseIso(real)));
show('真机', realStat);
// 我们：用 RandMap.Sed 的参数
const sed=loadSed(fs.readFileSync('F:/YTLauncher/RandMap.Sed').toString('latin1'));
console.log('\n我们用的参数:', JSON.stringify({seed:sed.seed,mapType:sed.mapType,players:sed.numPlayers,
  water:sed.waterAmount,ruggedness:sed.ruggedness,vegetation:sed.vegetation,
  tiberiumLayout:sed.tiberiumLayout,theater:sed.theater,regionSize:sed.regionSize,
  urbanPresence:sed.urbanPresence,resources:sed.resources}));
const dims=deriveDimensions(sed);
const t0=Date.now();
const {ini}=generateFullMap({seed:sed.seed,mapType:sed.mapType,waterAmount:sed.waterAmount,
  numPlayers:sed.numPlayers,ruggedness:sed.ruggedness,vegetation:sed.vegetation,
  tiberiumLayout:sed.tiberiumLayout,tiberium:sed.tiberium,resources:sed.resources,
  theater:sed.theater,dimensions:dims,tables},'Random Map');
const ourStat=stat(tiles(parseIso(new IniFile(ini))));
console.log('(耗时 %dms)\n', Date.now()-t0);
show('我们', ourStat);
// 差异
console.log('\n=== 差异 ===');
console.log('  Level 档数:  真机 %d  我们 %d', realStat.lvCount, ourStat.lvCount);
console.log('  Level 跨度: 真机 %d  我们 %d', realStat.lvMax-realStat.lvMin, ourStat.lvMax-ourStat.lvMin);
console.log('  TileIdx 种: 真机 %d  我们 %d', realStat.tiCount, ourStat.tiCount);
console.log('  SubIdx 种:  真机 %d  我们 %d', realStat.subCount, ourStat.subCount);
