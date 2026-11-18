/**
 * 切片拼接可行性量化实验（只读资源，不写 resources/MapUnits 任何文件）
 *
 * 流程：
 *   1. 用当前 SNOW 手工池生成一张 100x100 源图（R0 基线，同时留作切片源）
 *   2. splitFullMap 切片（skipPartial=true 的「完整切片」池，UI 推荐口径）
 *   3. 从切片文件读回原始连接 ID（%15）与 AbstractMapUnit 读回值（%6）
 *   4. 兼容性矩阵：手工池 / 切片池(%15) / 切片池(%6) / 混合池 —— 各方向可配对数、
 *      全约束候选数分布
 *   5. 生成实验（直接驱动 WorkingMap 流水线，捕获日志）：
 *        R0 = 手工池（基线）
 *        R1 = 纯切片池（+ 源图 spawn 切片 + 原版 tiberium + empty）
 *        R2 = 混合池（手工 + 切片）
 *      统计：候选数直方图 / 回溯 / 中断 / 回填空地 / 切片使用率 /
 *      复原率（切片是否回到源图原位）/ 接缝真实性（真邻居 vs 桶碰撞）
 *   6. 三张成品图渲染预览 PNG + summary.json 到 scratch/slice-exp/
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import {
  WorkingMap,
  AbstractMapUnit,
  MapFile,
  IniFile,
} from '../packages/core/dist/index.js';
import {
  loadAllResources,
  getTheaterResources,
  getGlobalResources,
} from '../packages/server/dist/resourceLoader.js';
import { splitFullMap, splitSpawnUnitsForTheater } from '../packages/server/dist/splitter.js';
import { generateMap } from '../packages/server/dist/generator.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'scratch', 'slice-exp');
fs.mkdirSync(OUT, { recursive: true });

const SIZE = parseInt(process.env.EXP_SIZE ?? '100', 10);
const PLAYERS = { NW: 1, SE: 1 };

// ---------------------------------------------------------------------------
// PNG 编码（裸 RGB → PNG，用于预览证据）
// ---------------------------------------------------------------------------
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function savePng(file, width, height, rgb) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    for (let x = 0; x < stride; x++) {
      raw[y * (stride + 1) + 1 + x] = rgb[y * stride + x];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png);
}

// ---------------------------------------------------------------------------
// 0. 资源加载 & SNOW 几何参数
// ---------------------------------------------------------------------------
console.log('=== [0] 加载资源（只读） ===');
loadAllResources();
const snow = getTheaterResources('SNOW');
if (!snow) throw new Error('SNOW resources missing');
const cfg = snow.config;
const gRes = getGlobalResources();

const settings = new IniFile(cfg.settingsContent);
const [W, H] = settings.GetStringValue('settings', 'MapUnitSize', '15x15').split('x').map((s) => parseInt(s, 10));
const [SX, SY] = settings.GetStringValue('settings', 'TopCorner', '13,13').split(',').map((s) => parseInt(s, 10));
const indMap = new MapFile();
indMap.CreateIsoTileList(cfg.indicatorMapContent);
const IND = indMap.IsoTileList[0].TileNum;
console.log(`SNOW: unit ${W}x${H}, topCorner ${SX},${SY}, indicatorNum=${IND}`);
console.log(`手工单元: ${cfg.mapUnitFiles.length} 个文件（含 spawn/tiberium/empty）`);

// ---------------------------------------------------------------------------
// 1. R0 基线源图（手工池直接生成）
// ---------------------------------------------------------------------------
console.log(`\n=== [1] 生成 SNOW 源图 ${SIZE}x${SIZE}（R0 基线） ===`);
const src = await generateMap({ theaterType: 'SNOW', width: SIZE, height: SIZE, playerLocations: PLAYERS });
fs.writeFileSync(path.join(OUT, 'source.map'), src.mapContent);
console.log(`源图: ${src.fileName}, ${src.mapContent.length} bytes`);

// 源图网格原点（与 splitMap 的 OX/OY 对齐逻辑一致）
const srcMap = new MapFile();
srcMap.CreateIsoTileList(src.mapContent);
let minRx = Infinity, minRy = Infinity;
for (const t of srcMap.IsoTileList) {
  if (t.Rx < minRx) minRx = t.Rx;
  if (t.Ry < minRy) minRy = t.Ry;
}
const OX = Math.floor(minRx / W) * W, OY = Math.floor(minRy / H) * H;
const AX = OX / W, AY = OY / H;
console.log(`源图 minRx=${minRx}, minRy=${minRy} → 网格偏移 AX=${AX}, AY=${AY}`);
const srcZStats = zCliffStats(buildZMap(srcMap.IsoTileList));
console.log(`源图 z 台阶基线: ${srcZStats.pairs} 邻对, |Δz|≥2 占 ${srcZStats.cliffPct.toFixed(2)}%, 平均|Δz|=${srcZStats.meanDz.toFixed(3)}`);

// ---------------------------------------------------------------------------
// 2. 切片
// ---------------------------------------------------------------------------
console.log('\n=== [2] 切片 ===');
const slicesAll = splitFullMap('SNOW', src.mapContent, { skipEmpty: true, skipPartial: false });
const slices = splitFullMap('SNOW', src.mapContent, { skipEmpty: true, skipPartial: true });
console.log(`skipPartial=false: ${slicesAll.length} 张; skipPartial=true(推荐): ${slices.length} 张`);
const spawnSlices = splitSpawnUnitsForTheater('SNOW', src.mapContent);
console.log(`spawn 切片: ${spawnSlices.length} 个`);

// ---------------------------------------------------------------------------
// 3. 连接 ID 读回（原始 %15 + AbstractMapUnit %6 校验）
// ---------------------------------------------------------------------------
console.log('\n=== [3] 切片连接 ID 读回 ===');
WorkingMap.Initialize(SIZE, SIZE, cfg); // 设置 MapUnitWidth/StartingX/Y/IndicatorNum 静态量
WorkingMap.SterilizeMapUnit({ ...cfg, mapUnitFiles: [] });

function sliceRawIds(content) {
  const mf = new MapFile();
  mf.CreateIsoTileList(content);
  const out = { nw: -1, ne: -1, sw: -1, se: -1, weight: 0 };
  for (const t of mf.IsoTileList) {
    if (t.TileNum !== IND) continue;
    // 连接 ID 编码：pos + 15*(subTile + 16*z)（core tile/connectionId.ts）
    const decode = (pos) => pos + 15 * (t.SubTile + 16 * t.Z);
    if (t.Rx === SX - 3) out.nw = decode(t.Ry - SY);
    if (t.Rx === SX + W + 2) out.se = decode(t.Ry - SY);
    if (t.Ry === SX - 3) out.ne = decode(t.Rx - SY);
    if (t.Ry === SX + W + 2) out.sw = decode(t.Rx - SY);
    if (t.Rx < SX - 5) out.weight++;
  }
  return out;
}

const CONN_PROP = { nw: 'NWConnectionType', ne: 'NEConnectionType', sw: 'SWConnectionType', se: 'SEConnectionType' };

const sliceRecords = []; // {name, raw:{nw..}, unit:{nw..}}
for (const s of slices) {
  const raw = sliceRawIds(s.content);
  const unit = new AbstractMapUnit();
  unit.Initialize({ name: `${s.name}.map`, fullName: `${s.name}.map` }, s.content);
  sliceRecords.push({ name: s.name, gridX: s.gridX, gridY: s.gridY, raw, unit });
}
// 校验：AbstractMapUnit 读回 == 从指示块解码的 ID（应逐字节一致）
let mismatch = 0;
for (const r of sliceRecords) {
  for (const d of ['nw', 'ne', 'sw', 'se']) {
    if (r.unit[CONN_PROP[d]] !== r.raw[d]) mismatch++;
  }
}
console.log(`切片 ${sliceRecords.length} 张读回完成；解码校验不一致项: ${mismatch}`);
const idCounts = {};
for (const r of sliceRecords) for (const d of ['nw', 'ne', 'sw', 'se']) idCounts[r.raw[d]] = (idCounts[r.raw[d]] ?? 0) + 1;
console.log('连接类 ID 分布:', JSON.stringify(idCounts));

// ---------------------------------------------------------------------------
// 4. 兼容性矩阵
// ---------------------------------------------------------------------------
console.log('\n=== [4] 兼容性矩阵 ===');
function typeView(u) {
  // 切片记录用解码 ID（= AbstractMapUnit 读回值）；手工单元用自身接口号
  if (u.raw) return { nw: u.raw.nw, ne: u.raw.ne, sw: u.raw.sw, se: u.raw.se };
  return { nw: u.NWConnectionType, ne: u.NEConnectionType, sw: u.SWConnectionType, se: u.SEConnectionType };
}
function partnerStats(pool, label) {
  // 对每个 u：四方向各有多少 v 可接（v 的对面接口 == u 的本侧接口）
  const per = pool.map((u) => {
    const t = typeView(u);
    const cnt = (pred) => pool.reduce((acc, v) => acc + (pred(typeView(v)) ? 1 : 0), 0);
    return {
      left: cnt((v) => v.se === t.nw),
      right: cnt((v) => v.nw === t.se),
      up: cnt((v) => v.sw === t.ne),
      down: cnt((v) => v.ne === t.sw),
      full: cnt((v) => v.se === t.nw && v.nw === t.se && v.sw === t.ne && v.ne === t.sw),
    };
  });
  const avg = (k) => per.reduce((a, b) => a + b[k], 0) / per.length;
  const zeroPct = (k) => (100 * per.filter((p) => p[k] === 0).length) / per.length;
  const max = (k) => Math.max(...per.map((p) => p[k]));
  const fullZeroPct = zeroPct('full');
  console.log(
    `[${label}] n=${pool.length} | 方向可配对均值 L/R/U/D = ` +
      `${avg('left').toFixed(1)}/${avg('right').toFixed(1)}/${avg('up').toFixed(1)}/${avg('down').toFixed(1)} | ` +
      `方向零配对占比 L/R/U/D = ${zeroPct('left').toFixed(0)}/${zeroPct('right').toFixed(0)}/${zeroPct('up').toFixed(0)}/${zeroPct('down').toFixed(0)}% | ` +
      `全约束(4向邻居已定)候选均值=${avg('full').toFixed(2)}, 全零占比=${fullZeroPct.toFixed(1)}%, max=${max('full')}`,
  );
  return { per };
}

const hmNormal = snow.cachedAbstractMapUnitList.filter(
  (u) => u.MapUnitName !== 'empty' && !u.MapUnitName.includes('spawn') && !u.MapUnitName.includes('tiberium'),
);
console.log(`手工普通单元: ${hmNormal.length} 个`);
partnerStats(hmNormal, '手工');

const rawPool = sliceRecords; // typeView 用解码 ID（= 语义连接类）
partnerStats(rawPool, '切片(语义类)');
const mixed = [...hmNormal, ...rawPool];
partnerStats(mixed, '混合(语义类)');

// ---------------------------------------------------------------------------
// 5. 生成实验（直接驱动流水线 + 日志捕获）
// ---------------------------------------------------------------------------
console.log('\n=== [5] 生成实验 ===');

const origFiles = cfg.mapUnitFiles;
const origSpawnTib = origFiles.filter((f) => /spawn|tiberium/i.test(f.name));
const origNormal = origFiles.filter((f) => f.name !== 'empty.map' && !/spawn|tiberium/i.test(f.name));
const emptyFile = origFiles.filter((f) => f.name === 'empty.map');
const tibOnly = origSpawnTib.filter((f) => /tiberium/i.test(f.name));

const sliceFiles = slices.map((s) => ({ name: `${s.name}.map`, content: s.content }));
const spawnSliceFiles = spawnSlices.map((s) => ({ name: `${s.name}.map`, content: s.content }));

const pools = {
  'R0-baseline': [...origNormal, ...origSpawnTib, ...emptyFile],
  'R1-slices': [...sliceFiles, ...spawnSliceFiles, ...tibOnly, ...emptyFile],
  'R2-mixed': [...origNormal, ...sliceFiles, ...spawnSliceFiles, ...tibOnly, ...emptyFile],
};

const rawByName = new Map(sliceRecords.map((r) => [r.name, r.raw]));
const isSliceName = (n) => /^split_\d+_\d+$/.test(n);
const gridByName = new Map(sliceRecords.map((r) => [r.name, [r.gridX, r.gridY]]));
const inPool = new Set(pools['R1-slices'].map((f) => f.name.replace(/\.map$/, '')));

function countEmptyOnMap() {
  let total = 0, empty = 0;
  for (let i = 0; i < WorkingMap.AbstractMapMemberMatrix.length; i++) {
    for (let j = 0; j < WorkingMap.AbstractMapMemberMatrix[i].length; j++) {
      const m = WorkingMap.AbstractMapMemberMatrix[i][j];
      if (m.IsOnMap) {
        total++;
        if (m.MapUnitName === 'empty' && !m.Placed) empty++;
      }
    }
  }
  return { total, empty };
}

/** 终图 z 连续性：相邻格 |Δz|≥2 视为硬台阶（悬崖/洞的特征） */
function buildZMap(tileList) {
  const m = new Map();
  for (const t of tileList) m.set(`${t.Rx},${t.Ry}`, t.Z);
  return m;
}
function zCliffStats(zMap) {
  let pairs = 0, cliffs = 0, sumDz = 0;
  for (const [key, z] of zMap) {
    const [x, y] = key.split(',').map(Number);
    for (const nk of [`${x + 1},${y}`, `${x},${y + 1}`]) {
      const nz = zMap.get(nk);
      if (nz === undefined) continue;
      pairs++;
      const d = Math.abs(nz - z);
      sumDz += d;
      if (d >= 2) cliffs++;
    }
  }
  return { pairs, cliffs, cliffPct: pairs ? (100 * cliffs) / pairs : 0, meanDz: pairs ? sumDz / pairs : 0 };
}

function runOne(label, mapUnitFiles) {
  console.log(`\n--- ${label} (pool=${mapUnitFiles.length} files) ---`);
  const config = { ...cfg, mapUnitFiles };
  const stats = { candBlocks: 0, candSizes: [], choose: [], deletes: 0, struggle: 0, aborts: 0, fillFail: 0, fillCount: 0, successMsg: 0, deferred: 0 };
  const origLog = console.log, origWarn = console.warn, origErr = console.error;
  let block = 0;
  console.log = (...a) => {
    const s = a.join(' ');
    if (s === 'Valid map unit list:') { block = 0; stats.candBlocks++; return; }
    if (s.startsWith('  Name: ')) { block++; return; }
    const m = /^Choose (.+) to place in \[(\d+),(\d+)\]$/.exec(s);
    if (m) { stats.candSizes.push(block); block = 0; stats.choose.push({ name: m[1], x: +m[2], y: +m[3] }); return; }
    if (s.includes('No valid map unit to place')) stats.aborts++;
    if (s.includes('Successfully place all map units')) stats.successMsg++;
    const mc = /^Counts: (\d+)$/.exec(s);
    if (mc) stats.fillCount = +mc[1];
  };
  console.warn = (...a) => {
    const s = a.join(' ');
    if (s.startsWith('Delete [')) { stats.deletes++; return; }
    if (s.includes('is removed because it will cause further struggle')) { stats.struggle++; return; }
    if (s.startsWith('Deferred [')) { stats.deferred++; return; }
    origWarn('[warn] ' + s);
  };
  console.error = (...a) => {
    const s = a.join(' ');
    if (s.includes('Failed to fill empty unit map')) stats.fillFail++;
    origErr('[err] ' + s);
  };
  try {
    const tStart = Date.now();
    WorkingMap.Initialize(SIZE, SIZE, config);
    WorkingMap.SterilizeMapUnit(config);
    WorkingMap.PlacePlayerLocation(PLAYERS.NW, 'NW');
    WorkingMap.PlacePlayerLocation(PLAYERS.SE, 'SE');
    const t0 = Date.now();
    WorkingMap.SetMapUnitByEntropy();
    const entropyMs = Date.now() - t0;
    const afterOrder = countEmptyOnMap();
    WorkingMap.FillRemainingEmptyUnitMap();
    const afterFill = countEmptyOnMap();
    // 记录最终仍为 empty 的 AMMM 格（PlaceMapUnitByAbsMapMatrix 会给它们铺 empty 模板）
    const emptyCellSet = new Set();
    const specialCellSet = new Set(); // spawn / tiberium 格
    for (let i = 0; i < WorkingMap.AbstractMapMemberMatrix.length; i++) {
      for (let j = 0; j < WorkingMap.AbstractMapMemberMatrix[i].length; j++) {
        const m = WorkingMap.AbstractMapMemberMatrix[i][j];
        if (!m.IsOnMap || m.Placed) continue;
        if (m.MapUnitName === 'empty') emptyCellSet.add(`${i},${j}`);
        if (/spawn|tiberium/i.test(m.MapUnitName)) specialCellSet.add(`${i},${j}`);
      }
    }
    WorkingMap.PlaceMapUnitByAbsMapMatrix();
    WorkingMap.ReadyForMiniMap(8);

    // 切片使用统计
    const slicePlaced = stats.choose.filter((c) => isSliceName(c.name));
    const hmPlaced = stats.choose.filter((c) => !isSliceName(c.name) && c.name !== 'empty');
    // 复原率：切片放回源图原位
    let correct = 0, expectedExists = 0;
    for (const c of slicePlaced) {
      const g = gridByName.get(c.name);
      if (!g) continue;
      const expX = g[0] + AX, expY = g[1] + AY;
      if (inPool.has(c.name)) expectedExists++;
      if (c.x === expX && c.y === expY) correct++;
    }
    // 切片接缝来源：源图相邻（grid 坐标差 1）vs 语义类撮合（非源相邻）
    let seamSrcAdj = 0, seamMatched = 0, seamHmHm = 0, seamHmSlice = 0;
    const nm = (x, y) => (WorkingMap.IsValidAMMM(x, y) ? WorkingMap.AbstractMapMemberMatrix[x][y].MapUnitName : null);
    const placed = (x, y) => { const n = nm(x, y); return n && n !== 'empty'; };
    const srcAdjacent = (na, nb) => {
      const ga = gridByName.get(na), gb = gridByName.get(nb);
      if (!ga || !gb) return false;
      return (Math.abs(ga[0] - gb[0]) === 1 && ga[1] === gb[1]) || (Math.abs(ga[1] - gb[1]) === 1 && ga[0] === gb[0]);
    };
    for (let x = 0; x < WorkingMap.AbstractMapMemberMatrix.length; x++) {
      for (let y = 0; y < WorkingMap.AbstractMapMemberMatrix[x].length; y++) {
        if (!placed(x, y)) continue;
        const a = nm(x, y);
        const bR = nm(x + 1, y); // 东邻
        const bD = nm(x, y + 1); // 南邻
        if (bR && bR !== 'empty') {
          if (isSliceName(a) && isSliceName(bR)) (srcAdjacent(a, bR) ? seamSrcAdj++ : seamMatched++);
          else if (isSliceName(a) || isSliceName(bR)) seamHmSlice++;
          else seamHmHm++;
        }
        if (bD && bD !== 'empty') {
          if (isSliceName(a) && isSliceName(bD)) (srcAdjacent(a, bD) ? seamSrcAdj++ : seamMatched++);
          else if (isSliceName(a) || isSliceName(bD)) seamHmSlice++;
          else seamHmHm++;
        }
      }
    }
    // 空地成因分析：需求侧无搭档（某类全池无提供者）vs 组合缺失（各类有搭档
    // 但无单元同时满足多条需求）。前者要修池构成，后者要防饿死放置。
    const classOf = new Map();
    for (const u of WorkingMap.AbstractMapUnitList) {
      classOf.set(u.MapUnitName, { nw: u.NWConnectionType, ne: u.NEConnectionType, sw: u.SWConnectionType, se: u.SEConnectionType });
    }
    let missPartner = 0, missCombo = 0, emptyChecked = 0;
    const missExamples = [];
    for (let x = 0; x < WorkingMap.AbstractMapMemberMatrix.length; x++) {
      for (let y = 0; y < WorkingMap.AbstractMapMemberMatrix[x].length; y++) {
        const m = WorkingMap.AbstractMapMemberMatrix[x][y];
        // 注意：PlaceMapUnitByAbsMapMatrix 会给所有在图格子（含 empty 名）置 Placed，
        // 所以这里只看名字，不看 Placed
        if (!m.IsOnMap || m.MapUnitName !== 'empty') continue;
        emptyChecked++;
        const sides = [
          { side: 'nw', nb: [x - 1, y], opp: 'se' },
          { side: 'ne', nb: [x, y - 1], opp: 'sw' },
          { side: 'sw', nb: [x, y + 1], opp: 'ne' },
          { side: 'se', nb: [x + 1, y], opp: 'nw' },
        ];
        const demands = [];
        for (const s of sides) {
          const [nx, ny] = s.nb;
          if (!WorkingMap.IsValidAMMM(nx, ny)) continue;
          const n = WorkingMap.AbstractMapMemberMatrix[nx][ny];
          if (!n.IsOnMap || n.MapUnitName === 'empty') continue;
          const nc = classOf.get(n.MapUnitName);
          if (!nc) continue;
          demands.push({ side: s.side, c: nc[s.opp] });
        }
        if (demands.length === 0) {
          missCombo++;
          continue;
        }
        const noPartner = demands.filter((d) => {
          let found = false;
          for (const u of WorkingMap.AbstractMapUnitList) {
            if (u.MapUnitName === 'empty') continue;
            if (u[d.side.toUpperCase() + 'ConnectionType'] === d.c) { found = true; break; }
          }
          return !found;
        });
        if (noPartner.length > 0) {
          missPartner++;
          if (missExamples.length < 6) missExamples.push(`[${x},${y}] 需求 ${noPartner.map((d) => `${d.side}=${d.c}`).join(',')} 全池无搭档`);
        } else {
          missCombo++;
          if (missExamples.length < 6) missExamples.push(`[${x},${y}] 组合缺失: ${demands.map((d) => `${d.side}=${d.c}`).join(',')}`);
        }
      }
    }
    origLog(`  空地成因: 需求无搭档=${missPartner}, 组合缺失=${missCombo} (共 ${emptyChecked} 格)`);
    for (const e of missExamples) origLog(`    · ${e}`);

    // 使用次数
    const useTimes = WorkingMap.AbstractMapUnitList
      .map((u) => ({ name: u.MapUnitName, n: u.UseTimes }))
      .filter((u) => u.n > 0)
      .sort((a, b) => b.n - a.n);
    const sliceUnitsUsed = useTimes.filter((u) => isSliceName(u.name)).length;
    // 渲染预览
    const mapFile = new MapFile();
    mapFile.IsoTileList = WorkingMap.CreateTileList(gRes.minimapContent);
    const pv = MapFile.RenderPreview(mapFile.IsoTileList, SIZE, SIZE, snow.bottomSpace);
    savePng(path.join(OUT, `${label}.png`), pv.width, pv.height, pv.data);
    const zStats = zCliffStats(buildZMap(mapFile.IsoTileList));
    // 台阶归因：两端任一端落在「最终 empty 的 AMMM 格」→ 空地致；
    // 落在 spawn/tiberium 格 → 特殊单元致；其余为正常地形台阶
    const cellOwner = (x, y) => `${Math.floor(x / W)},${Math.floor(y / H)}`;
    let cliffAtEmpty = 0, cliffAtSpecial = 0;
    {
      const zMap = buildZMap(mapFile.IsoTileList);
      for (const [key, z] of zMap) {
        const [x, y] = key.split(',').map(Number);
        for (const [nx, ny] of [[x + 1, y], [x, y + 1]]) {
          const nz = zMap.get(`${nx},${ny}`);
          if (nz === undefined || Math.abs(nz - z) < 2) continue;
          const owners = [cellOwner(x, y), cellOwner(nx, ny)];
          if (owners.some((o) => emptyCellSet.has(o))) cliffAtEmpty++;
          else if (owners.some((o) => specialCellSet.has(o))) cliffAtSpecial++;
        }
      }
    }

    const candHist = {};
    for (const c of stats.candSizes) candHist[c <= 3 ? '<=3' : c <= 10 ? '4-10' : c <= 30 ? '11-30' : '>30'] = (candHist[c <= 3 ? '<=3' : c <= 10 ? '4-10' : c <= 30 ? '11-30' : '>30'] ?? 0) + 1;
    origLog(`  在图格子: ${afterFill.total}, 放置选择 ${stats.choose.length} 次（切片 ${slicePlaced.length}, 手工 ${hmPlaced.length}）`);
    origLog(`  SetMapUnitByOrder 后未填: ${afterOrder.empty}; Fill 后未填(回填空地): ${afterFill.empty}`);
    origLog(`  候选数直方图: ${JSON.stringify(candHist)}`);
    origLog(`  回溯删除=${stats.deletes}, NE剪枝=${stats.struggle}, 中断=${stats.aborts}, 延迟格=${stats.deferred}, 填充失败=${stats.fillFail}, 熵序耗时=${entropyMs}ms, 总耗时=${Date.now() - tStart}ms`);
    origLog(`  切片使用: ${sliceUnitsUsed}/${sliceRecords.length} 张被用过至少一次`);
    origLog(`  复原率(切片回原位): ${correct}/${slicePlaced.length} = ${((100 * correct) / Math.max(1, slicePlaced.length)).toFixed(1)}%`);
    origLog(`  切片接缝: 源图相邻=${seamSrcAdj}, 语义撮合=${seamMatched}, 手工+切片=${seamHmSlice}, 手工+手工=${seamHmHm}`);
    origLog(`  z 连续性: ${zStats.pairs} 邻对, |Δz|≥2 占 ${zStats.cliffPct.toFixed(2)}% (源图基线 ${srcZStats.cliffPct.toFixed(2)}%), 平均|Δz|=${zStats.meanDz.toFixed(3)}`);
    origLog(`  台阶归因: 邻接空地格 ${cliffAtEmpty}/${zStats.cliffs}, 邻接spawn/tiberium格 ${cliffAtSpecial}/${zStats.cliffs}`);
    return { label, afterOrder, afterFill, stats: { ...stats, candSizes: undefined }, correct, slicePlaced: slicePlaced.length, seamSrcAdj, seamMatched, seamHmSlice, seamHmHm, sliceUnitsUsed, zStats, cliffAtEmpty, cliffAtSpecial, useTimes: useTimes.slice(0, 12) };
  } finally {
    console.log = origLog; console.warn = origWarn; console.error = origErr;
  }
}

const results = {};
for (const [label, pool] of Object.entries(pools)) {
  results[label] = runOne(label, pool);
}

// ---------------------------------------------------------------------------
// 6. 汇总
// ---------------------------------------------------------------------------
const summary = {
  size: SIZE, players: PLAYERS,
  slicesAll: slicesAll.length, slicesFull: slices.length, spawnSlices: spawnSlices.length,
  hmNormal: hmNormal.length,
  results,
};
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(`\n=== 完成，产物在 ${OUT}（source.map / 3 张预览 PNG / summary.json） ===`);
