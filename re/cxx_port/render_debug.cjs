// 渲染调试: 运行时包装 cncmaps 的绘制入口, 统计跳过原因 + 记录绘制调用
'use strict';
const path = require('path');
const fs = require('fs');
const C = 'G:/cncmaps-ts/dist';
const { TileCollection } = require(path.join(C, 'engine/game/TileCollection.js'));
const { TmpRenderer } = require(path.join(C, 'rendering/TmpRenderer.js'));
const { TileDrawable } = require(path.join(C, 'engine/drawables/TileDrawable.js'));
const { RenderSettings } = require(path.join(C, 'shared/RenderSettings.js'));
const { RenderEngine } = require(path.join(C, 'engine/RenderEngine.js'));
const { logger } = require(path.join(C, 'shared/Log.js'));
const { Theater } = require(path.join(C, 'engine/game/Theater.js'));

// ---- 安装顺序: 先装的先被覆盖, 最后装的先执行。目标链: 计数→记录→跳过→原始 ----

// 1) 跳过原因层 (最内层, 紧贴原始 Draw)
const skips = new Map();
const bump = (k) => skips.set(k, (skips.get(k) || 0) + 1);
const origTmpDraw = TmpRenderer.prototype.Draw;
TmpRenderer.prototype.Draw = function (tile, tmp, ds) {
    if (tile != null) {
        if (tmp == null) bump('tmp:null#' + tile.TileNum);
        else if (tile.SubTile >= tmp.Images.length) bump(`subtileOOR#${tile.TileNum}(${tile.SubTile}>=${tmp.Images.length})`);
    }
    return origTmpDraw.call(this, tile, tmp, ds);
};
const origTileDraw = TileDrawable.prototype.Draw;
TileDrawable.prototype.Draw = function (obj, ds, shadows) {
    if (this.TsEntry == null) bump('tsEntry:null#' + (obj ? obj.TileNum : '?'));
    else {
        const f = this.TsEntry.GetTmpFile(obj);
        if (f == null) bump('tmpFile:null#' + (obj ? obj.TileNum : '?'));
    }
    return origTileDraw.call(this, obj, ds, shadows);
};
const origGetDrawable = TileCollection.prototype.GetDrawable;
TileCollection.prototype.GetDrawable = function (o) {
    const d = origGetDrawable.call(this, o);
    if (d == null || d.IsUndefined) {
        const tn = (o && typeof o === 'object') ? (o.TileNum ?? o.Number) : o;
        bump('GetDrawable:null#' + tn);
    }
    return d;
};

// 2) 记录层: 每次 TmpRenderer.Draw 记录 tile/帧/extra 信息
const drawLog = [];
const tmpIds = new WeakMap();
let tmpSeq = 0;
const tmpRefs = [];
const recTmpDraw = TmpRenderer.prototype.Draw;
TmpRenderer.prototype.Draw = function (tile, tmp, ds) {
    const r = recTmpDraw.call(this, tile, tmp, ds);
    if (tile != null && tmp != null && tile.SubTile < tmp.Images.length) {
        let tid = tmpIds.get(tmp);
        if (tid === undefined) { tid = tmpSeq++; tmpIds.set(tmp, tid); tmpRefs[tid] = tmp; }
        const img = tmp.Images[tile.SubTile];
        drawLog.push({
            Dx: tile.Dx, Dy: tile.Dy, Z: tile.Z, tn: tile.TileNum, st: tile.SubTile,
            rx: tile.Rx, ry: tile.Ry,
            left: Math.trunc(tile.Dx * tmp.BlockWidth / 2),
            top: Math.trunc((tile.Dy - tile.Z) * tmp.BlockHeight / 2),
            bw: tmp.BlockWidth, bh: tmp.BlockHeight,
            ex: img.hasExtraData ? img.ExtraX : 0, ey: img.hasExtraData ? img.ExtraY : 0,
            ews: img.hasExtraData ? img.ExtraWidth : 0, ehs: img.hasExtraData ? img.ExtraHeight : 0,
            images: tmp.Images.length,
            tileDataLen: img.TileData ? img.TileData.length : -1, zDataLen: img.ZData ? img.ZData.length : -1, tmpId: tid,
            pal: tile.Palette ? (tile.Palette.Name || '?') + '/amb' + tile.Palette.ambientMult.toFixed(3) : null,
        });
    }
    return r;
};

// 3) 计数层 (最外层, 最先执行)
const layerCount = {};
let theaterDraws = 0;
const origTheaterDraw = Theater.prototype.Draw;
Theater.prototype.Draw = function (obj, ds) {
    const cn = obj && obj.constructor ? obj.constructor.name : '?';
    theaterDraws++;
    layerCount[cn] = (layerCount[cn] || 0) + 1;
    return origTheaterDraw.call(this, obj, ds);
};
const origTileDrawCounted = TileDrawable.prototype.Draw;
TileDrawable.prototype.Draw = function (obj, ds, shadows) {
    layerCount['TileDrawable.Draw'] = (layerCount['TileDrawable.Draw'] || 0) + 1;
    return origTileDrawCounted.call(this, obj, ds, shadows);
};
const origTmpCounted = TmpRenderer.prototype.Draw;
TmpRenderer.prototype.Draw = function (tile, tmp, ds) {
    layerCount['TmpRenderer.Draw'] = (layerCount['TmpRenderer.Draw'] || 0) + 1;
    return origTmpCounted.call(this, tile, tmp, ds);
};

// ---- 运行 ----
const settings = new RenderSettings();
settings.ConfigureFromArgs(process.argv.slice(2));
const engine = new RenderEngine();
const result = engine.Render(settings);
logger.info('result=' + result);

const emptyFrames = new Map();
for (const d of drawLog) if (d.tileDataLen === 0) { const k = `t${d.tn}/s${d.st}`; emptyFrames.set(k, (emptyFrames.get(k) || 0) + 1); }
console.log('空 TileData 帧统计:', JSON.stringify([...emptyFrames].sort((a, b) => b[1] - a[1]).slice(0, 20)));
const totalByTile = new Map();
for (const d of drawLog) { const k = `t${d.tn}/s${d.st}`; totalByTile.set(k, (totalByTile.get(k) || 0) + 1); }
console.log('总绘制 top:', JSON.stringify([...totalByTile].sort((a, b) => b[1] - a[1]).slice(0, 12)));
fs.writeFileSync('.tmp_oracle/batch20/drawlog.json', JSON.stringify(drawLog.map((d) => { const { tileDataRef, zDataRef, ...rest } = d; return rest; })));
console.log('theaterDraws:', theaterDraws, ' 层计数:', JSON.stringify(layerCount));
if (skips.size === 0) console.log('NO SKIPS');
else for (const [k, v] of [...skips.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log('SKIP', k, 'x', v);

// ---- 黑像素归因 (ATTR=1): 黑簇 bbox 内逐黑像素找最后一次覆盖的 Draw, 报告帧像素索引 ----
if (process.env.ATTR === '1') {
    const zlib = require('zlib');
    function decodePng(p) {
        const b = fs.readFileSync(p); let off = 8, ihdr = null, idat = [];
        while (off < b.length) {
            const len = b.readUInt32BE(off), type = b.toString('ascii', off + 4, off + 8);
            if (type === 'IHDR') ihdr = { w: b.readUInt32BE(off + 8), h: b.readUInt32BE(off + 12), ct: b[off + 17] };
            else if (type === 'IDAT') idat.push(b.subarray(off + 8, off + 8 + len));
            else if (type === 'IEND') break;
            off += 12 + len;
        }
        const ch = ihdr.ct === 2 ? 3 : 4;
        const raw = zlib.inflateSync(Buffer.concat(idat));
        const stride = ihdr.w * ch, out = Buffer.alloc(ihdr.h * stride);
        let prev = Buffer.alloc(stride);
        for (let y = 0; y < ihdr.h; ++y) {
            const f = raw[y * (stride + 1)];
            const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
            const cur = out.subarray(y * stride, (y + 1) * stride);
            for (let x = 0; x < stride; ++x) {
                const a = x >= ch ? cur[x - ch] : 0, b2 = prev[x], c = x >= ch ? prev[x - ch] : 0;
                let v = row[x];
                if (f === 1) v = (v + a) & 255;
                else if (f === 2) v = (v + b2) & 255;
                else if (f === 3) v = (v + ((a + b2) >> 1)) & 255;
                else if (f === 4) {
                    const p = a + b2 - c, pa = Math.abs(p - a), pb = Math.abs(p - b2), pc = Math.abs(p - c);
                    v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b2 : c)) & 255;
                }
                cur[x] = v;
            }
            prev = cur;
        }
        return { w: ihdr.w, h: ihdr.h, ch, data: out };
    }
    const pngName = process.env.ATTR_PNG || '05dbg';
    const img = decodePng('.tmp_oracle/batch20/' + pngName + '.png');
    const zbn = fs.readFileSync('.tmp_oracle/batch20/' + pngName + '_zbuf.npy');
    const zhdrLen = zbn.readUInt16LE(8);
    const zdata = zbn.subarray(10 + zhdrLen);
    const bb = (process.env.ATTR_BBOX || '1950,264,2726,418').split(',').map(Number);
    const x0 = bb[0], y0 = bb[1], x1 = bb[2], y1 = bb[3];
    const attribution = new Map();
    let blackPix = 0;
    for (let y = y0; y <= y1; ++y) {
        for (let x = x0; x <= x1; ++x) {
            const o = (y * img.w + x) * img.ch;
            if (!(img.data[o] < 15 && img.data[o + 1] < 15 && img.data[o + 2] < 15)) continue;
            ++blackPix;
            let owner = null;
            for (const d of drawLog) {
                const lx = x - d.left, ly = y - d.top;
                if (lx < 0 || ly < 0 || lx >= d.bw || ly >= d.bh) continue;
                if (Math.abs(lx / (d.bw / 2) - 1) + Math.abs(ly / (d.bh / 2) - 1) > 1) continue;
                owner = { d, lx, ly };
            }
            if (!owner) { attribution.set('NO-DRAW', (attribution.get('NO-DRAW') || 0) + 1); continue; }
            const { d, lx, ly } = owner;
            const idx = d.tileDataLen > 0 ? (d.tileDataDump ? d.tileDataDump[ly * d.bw + lx] : -2) : -1;
            const zd = d.zDataRef ? d.zDataRef[ly * d.bw + lx] : -1;
            const k = `t${d.tn}/${d.pal}/idx${idx}`;
            attribution.set(k, (attribution.get(k) || 0) + 1);
        }
    }
    console.log('drawLog[0] keys:', drawLog[0] ? Object.keys(drawLog[0]).join(',') : 'EMPTY');
    console.log('drawLog[0].tileDataDump len:', drawLog[0] && drawLog[0].tileDataDump ? drawLog[0].tileDataDump.length : 'falsy');
    console.log('黑像素:', blackPix, ' 归因:', JSON.stringify([...attribution].sort((a, b) => b[1] - a[1]).slice(0, 8)));
    const badTmps = new Set();
    for (const [k, v] of attribution) { const m = k.match(/tmp(\d+)/); if (m) badTmps.add(+m[1]); }
    for (const tid of badTmps) {
        const t = tmpRefs[tid];
        t.Initialize();
        const lens = t.Images.map((im, i2) => 'f' + i2 + ':' + (im.TileData ? im.TileData.length : 'null')).join(' ');
        console.log('tmp' + tid + ' [' + (t.Name || '?') + '] frames=' + t.Images.length + ' ' + lens);
    }
}