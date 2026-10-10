/**
 * 全样本对拍（含 theater 分类维度）。
 * ⚠ 只有 MapType=1 可与基线直接比；MT4 只报自身结构。
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

function cls(ti){
  const t=tables;
  if(ti>=t.cliffSet && ti<t.cliffSet+16*14) return 'cliff';
  if(ti>=t.waterSet && ti<t.waterSet+14) return 'water';
  if(ti>=t.shorePieces && ti<t.shorePieces+42) return 'shore';
  if(ti>=t.rampBase && ti<t.rampBase+19) return 'ramp';
  if(ti===t.greenTile) return 'green';
  if(ti===t.sandTile) return 'sand';
  if(ti===0) return 'clear';
  if(ti>=t.sandTile && ti<=t.greenTile) return 'ground';
  return 'other';
}
function report(tag, ini){
  const f=new IniFile(ini); const ts=tiles(parseIso(f));
  const lv={},tis=new Set(),subs=new Set(),byCls={};
  for(const t of ts){ lv[t.lvl]=(lv[t.lvl]||0)+1; tis.add(t.ti); subs.add(t.sub);
    const c=cls(t.ti); byCls[c]=(byCls[c]||0)+1; }
  const ks=Object.keys(lv).map(Number).sort((a,b)=>a-b);
  console.log('%s tile=%d Level=%d档(%d..%d) TileIdx=%d种 SubIdx=%d种 W/H=%d/%d',
    tag.padEnd(22), ts.length, ks.length, ks[0], ks[ks.length-1], tis.size, subs.size,
    f.GetIntValue('Header','Width',0), f.GetIntValue('Header','Height',0));
  console.log('%s 族分布: %s', ' '.repeat(22),
    Object.entries(byCls).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+':'+v).join(' '));
  return {n:ts.length, lvCount:ks.length, tiCount:tis.size, subCount:subs.size};
}
function run(f, tag){
  try{
    const sed=loadSed(fs.readFileSync(B+'/src/test/fixtures/'+f).toString('latin1'));
    const dims=deriveDimensions(sed);
    const t0=Date.now();
    const {ini}=generateFullMap({seed:sed.seed,mapType:sed.mapType,waterAmount:sed.waterAmount,
      numPlayers:sed.numPlayers,ruggedness:sed.ruggedness,vegetation:sed.vegetation,
      tiberiumLayout:sed.tiberiumLayout,tiberium:sed.tiberium,resources:sed.resources,
      theater:sed.theater,dimensions:dims,tables},'Random Map');
    const ms=Date.now()-t0;
    console.log('\n--- %s (seed=%d mt=%d p=%d w=%d) %dms ---', tag, sed.seed, sed.mapType, sed.numPlayers, sed.waterAmount, ms);
    return report(tag, ini);
  }catch(e){ console.log('%s ✗ 失败: %s', tag, String(e).slice(0,90)); return null; }
}
console.log('theater: cliffSet=%d waterSet=%d shore=%d ramp=%d green=%d sand=%d',
  tables.cliffSet,tables.waterSet,tables.shorePieces,tables.rampBase,tables.greenTile,tables.sandTile);
console.log('\n=== 基线（MapType=1 温带）===');
report('baseline', new IniFile(fs.readFileSync(B+'/src/test/fixtures/rmg_real_randommap.yrm','latin1')).WriteIniFile());
console.log('\n=== 我们的 ===');
run('randmap_maptype1_2p.sed','MT1(2p,真机同型)');
run('randmap_maptype4_8p.sed','MT4(8p)');
run('randmap_maptype4_theater1.sed','MT4(theater1)');
run('save4823_maptype4_theater1.sed','MT4(save4823)');
run('save0029_maptype1_width0.sed','MT1(width0)');
