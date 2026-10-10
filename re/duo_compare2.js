/**
 * 双样本对拍：同一 MapType 才可比。
 *  - 样本 A：MapType=1（温带 2 人）vs 基线 `rmg_real_randommap.yrm`
 *  - 样本 B：MapType=4（温带 8 人）无基线 ⇒ 只报自身结构
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

function parseIso(ini){
  const sec=ini.GetSection('IsoMapPack5'); if(!sec) return null;
  const keys=sec.Keys.slice().sort((a,b)=>Number(a)-Number(b));
  const raw=Buffer.from(keys.map(k=>sec.GetStringValue(k,'')).join(''),'base64');
  let r=0; const parts=[];
  while(r+4<=raw.length){ const si=raw.readUInt16LE(r),so=raw.readUInt16LE(r+2); if(!si||!so)break; r+=4;
    const o=new Uint8Array(so+1024); decompressRange(new Uint8Array(raw),r,si,o,0); parts.push(Buffer.from(o.slice(0,so))); r+=si; }
  return Buffer.concat(parts);
}
function tiles(buf){ const out=[]; if(!buf)return out;
  for(let o=0;o+11<=buf.length-4;o+=11){ const x=buf.readInt16LE(o),y=buf.readInt16LE(o+2),ti=buf.readInt32LE(o+4);
    if(x===0&&y===0&&ti===0)break; out.push({x,y,ti,sub:buf[o+8],lvl:buf[o+9]}); }
  return out; }
function stats(ts){
  const lv={}, tis=new Set();
  for(const t of ts){ lv[t.lvl]=(lv[t.lvl]||0)+1; tis.add(t.ti); }
  const lvKeys=Object.keys(lv).map(Number).sort((a,b)=>a-b);
  return { n:ts.length, lvCount:lvKeys.length, lvMin:lvKeys[0], lvMax:lvKeys[lvKeys.length-1],
           tiCount:tis.size, tiMax:Math.max(...tis), subCount:new Set(ts.map(t=>t.sub)).size };
}
function report(tag, ini){
  const f=new IniFile(ini); const ts=tiles(parseIso(f));
  const s=stats(ts);
  console.log('%s tile=%d  Level档=%d(范围%d..%d)  TileIndex种=%d(max %d)  Sub种=%d  段=%d  W/H=%d/%d',
    tag, s.n, s.lvCount, s.lvMin, s.lvMax, s.tiCount, s.tiMax, s.subCount,
    f.GetSections().length, f.GetIntValue('Header','Width',0), f.GetIntValue('Header','Height',0));
  return s;
}
function run(sedName, tag){
  const sed=loadSed(fs.readFileSync(B+'/src/test/fixtures/'+sedName).toString('latin1'));
  const dims=deriveDimensions(sed);
  const {ini}=generateFullMap({seed:sed.seed,mapType:sed.mapType,waterAmount:sed.waterAmount,
    numPlayers:sed.numPlayers,ruggedness:sed.ruggedness,vegetation:sed.vegetation,
    tiberiumLayout:sed.tiberiumLayout,tiberium:sed.tiberium,resources:sed.resources,
    theater:sed.theater,dimensions:dims,tables},'Random Map');
  console.log('\n--- %s (seed=%d mapType=%d players=%d water=%d) ---', tag, sed.seed, sed.mapType, sed.numPlayers, sed.waterAmount);
  return report(tag, ini);
}
console.log('=== 基线 ===');
report('基线  ', new IniFile(fs.readFileSync(B+'/src/test/fixtures/rmg_real_randommap.yrm','latin1')).WriteIniFile());
run('randmap_maptype1_2p.sed','MT1');
run('randmap_maptype4_8p.sed','MT4');
