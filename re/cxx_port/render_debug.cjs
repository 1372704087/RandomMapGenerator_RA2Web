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
    const palObj = tile != null ? tile.Palette : null;
    let bgrMutated = 0;
    if (palObj) {
        const pre = palObj.getBgrBytes();
        const pre105 = pre[105 * 3] + ',' + pre[105 * 3 + 1] + ',' + pre[105 * 3 + 2];
        const r2 = recTmpDraw.call(this, tile, tmp, ds);
        const post = palObj.getBgrBytes();
        bgrMutated = (post !== pre || post[105 * 3] !== pre[105 * 3] || post[105 * 3 + 1] !== pre[105 * 3 + 1] || post[105 * 3 + 2] !== pre[105 * 3 + 2]) ? 1 : 0;
        if (bgrMutated) (globalThis).__bgrMut = ((globalThis).__bgrMut || 0) + 1;
        var __pre105 = pre105;
        var __drawR = r2;
    } else {
        var __drawR = recTmpDraw.call(this, tile, tmp, ds);
    }
    const r = __drawR;
    // [单像素追踪] (2752,264)
    if (tile != null && tmp != null && tile.SubTile < tmp.Images.length) {
        const imgT = tmp.Images[tile.SubTile];
        const bw2 = tmp.BlockWidth, bh2 = tmp.BlockHeight, hc = bw2 >> 1, hcy = bh2 >> 1;
        const left2 = Math.trunc(tile.Dx * bw2 / 2);
        const top2 = Math.trunc((tile.Dy - tile.Z) * bh2 / 2);
        const row2 = 339 - top2;
        let hit = null;
        if (row2 >= 0 && row2 < hcy) {
            const off2 = 2752 - (left2 + hc - 2 - 2 * row2);
            const cnt2 = 4 * (row2 + 1);
            if (off2 >= 0 && off2 < cnt2) hit = { rIdx: 2 * row2 * (row2 + 1) + off2, zone: 'top' };
        } else if (row2 >= hcy && row2 < bh2) {
            const k2 = row2 - hcy;
            const off2 = 2752 - (left2 + 2 + 2 * k2);
            const cnt2 = 4 * (hcy - k2 - 1);
            if (off2 >= 0 && off2 < cnt2) hit = { rIdx: 2 * hcy * (hcy + 1) + [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14].slice(0, k2).reduce((acc, j) => acc + 4 * (hcy - j - 1), 0) + off2, zone: 'bot' };
        }
        if (hit && imgT.TileData) {
            const pv2 = imgT.TileData[hit.rIdx];
            const zb2 = Math.trunc((tile.Rx + tile.Ry) * bh2 / 2);
            const zv2 = imgT.ZData ? zb2 - imgT.ZData[hit.rIdx] : -999999;
            const pal2 = tile.Palette;
            const b2 = pal2 ? pal2.getBgrBytes() : null;
            const rgb2 = b2 && pv2 > 0 && pv2 < 256 ? b2[pv2*3] + ',' + b2[pv2*3+1] + ',' + b2[pv2*3+2] : 'skip';
            (globalThis).__pixLog = (globalThis).__pixLog || [];
            (globalThis).__pixLog.push({ tn: tile.TileNum, Dx: tile.Dx, Dy: tile.Dy, Z: tile.Z, rx: tile.Rx, ry: tile.Ry, zone: hit.zone, rIdx: hit.rIdx, pv: pv2, zv: zv2, rgb: rgb2 });
        }
        if (imgT.hasExtraData && imgT.ExtraData) {
            const exL = left2 + imgT.ExtraX - imgT.X, exT = top2 + imgT.ExtraY - imgT.Y;
            const exX = 2752 - exL, exY = 339 - exT;
            if (exX >= 0 && exY >= 0 && exX < imgT.ExtraWidth && exY < imgT.ExtraHeight) {
                const ri2 = exY * imgT.ExtraWidth + exX;
                const pv3 = imgT.ExtraData[ri2];
                const zb3 = Math.trunc((tile.Rx + tile.Ry) * bh2 / 2);
                const zv3 = imgT.ExtraZData ? zb3 - imgT.ExtraZData[ri2] : -999999;
                const pal3 = tile.Palette;
                const b3 = pal3 ? pal3.getBgrBytes() : null;
                const rgb3 = b3 && pv3 > 0 && pv3 < 256 ? b3[pv3*3] + ',' + b3[pv3*3+1] + ',' + b3[pv3*3+2] : 'skip(' + pv3 + ')';
                (globalThis).__pixLog.push({ tn: tile.TileNum, Dx: tile.Dx, Dy: tile.Dy, Z: tile.Z, zone: 'EXTRA', pv: pv3, zv: zv3, rgb: rgb3 });
            }
        }
    }
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
            tileDataLen: img.TileData ? img.TileData.length : -1, zDataLen: img.ZData ? img.ZData.length : -1, tmpId: tid, tileDataDump: img.TileData, zDumpRef: img.ZData,
            pal: tile.Palette ? (tile.Palette.Name || '?') + '/amb' + tile.Palette.ambientMult.toFixed(3) : null,
            extra: img.hasExtraData ? {
                l: Math.trunc(tile.Dx * tmp.BlockWidth / 2) + img.ExtraX - img.X,
                t: Math.trunc((tile.Dy - tile.Z) * tmp.BlockHeight / 2) + img.ExtraY - img.Y,
                w: img.ExtraWidth, h: img.ExtraHeight,
                data: img.ExtraData, z: img.ExtraZData,
            } : null,
            bgrRef: tile.Palette ? tile.Palette.getBgrBytes() : null,
        });
    }
    return r;
};

// 3) 计数层 (最外层, 最先执行)
const layerCount = {};
let theaterDraws = 0;
const origTheaterDraw = Theater.prototype.Draw;
const __pxX = 2752, __pxY = 339;
Theater.prototype.Draw = function (obj, ds) {
    const cn = obj && obj.constructor ? obj.constructor.name : '?';
    theaterDraws++;
    layerCount[cn] = (layerCount[cn] || 0) + 1;
    const idx0 = (__pxY * ds.Width + __pxX) * 3, zi = __pxY * ds.Width + __pxX;
    const r0 = ds.data[idx0], g0 = ds.data[idx0 + 1], b0 = ds.data[idx0 + 2], z0 = ds.getZBuffer()[zi];
    const ret = origTheaterDraw.call(this, obj, ds);
    const r1 = ds.data[idx0], g1 = ds.data[idx0 + 1], b1 = ds.data[idx0 + 2], z1 = ds.getZBuffer()[zi];
    if (r0 !== r1 || g0 !== g1 || b0 !== b1 || z0 !== z1) {
        (globalThis).__pxLog2 = (globalThis).__pxLog2 || [];
        (globalThis).__pxLog2.push({ type: cn, name: obj.Name || (obj.Drawable ? obj.Drawable.Name : ''), tn: obj.TileNum, rx: obj.Rx, ry: obj.Ry, before: r0 + ',' + g0 + ',' + b0 + '/z' + z0, after: r1 + ',' + g1 + ',' + b1 + '/z' + z1 });
    }
    return ret;
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
console.log('bgr 中途变异次数:', (globalThis).__bgrMut || 0);
{
    const l2 = (globalThis).__pxLog2 || [];
    console.log('像素(surface 2752,339) 被这些物件写入:', l2.length);
    for (const e of l2.slice(0, 20)) console.log('  ', JSON.stringify(e));
}
{
    const log = (globalThis).__pixLog || [];
    console.log('像素(2752,339) 覆盖绘制数:', log.length);
    for (const e of log) console.log('  ', JSON.stringify(e));
}
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
    let blackPix = 0;
    const attribution = new Map();
    // z-test 精确回放（与 TmpRenderer 寻址逐行一致, bw=60 bh=30）
    const W = img.w;
    const writer = new Int32Array(W * img.h).fill(-1);
    const zCur = new Int32Array(W * img.h);
    const winPv = new Int32Array(W * img.h).fill(-1);
    for (let di = 0; di < drawLog.length; ++di) {
        const d = drawLog[di];
        const useZ = !!d.zDumpRef;
        const bw = d.bw, bh = d.bh, halfCx = bw >> 1, halfCy = bh >> 1;
        const zBase = Math.trunc((d.rx + d.ry) * bh / 2);
        const td = d.tileDataDump, zd = d.zDumpRef;
        let rIdx = 0;
        // 上半: row y: start = left+halfCx-2-2y, count = 4(y+1)
        for (let y = 0; y < halfCy; y++) {
            const cnt = 4 * (y + 1);
            let col = d.left + halfCx - 2 - 2 * y;
            const row = d.top + y;
            for (let c2 = 0; c2 < cnt; c2++, col++, rIdx++) {
                if (col < 0 || col >= W || row < 0 || row >= img.h) continue;
                const pv = td ? td[rIdx] : 0;
                if (pv === 0) continue;
                const gi = row * W + col;
                const zv = useZ ? zBase - zd[rIdx] : -0x40000000;
                if (!useZ || zv >= zCur[gi]) { writer[gi] = di; winPv[gi] = pv; if (useZ) zCur[gi] = zv; }
            }
        }
        // 下半: row halfCy+k: start = left+4+2k, count = 4(halfCy-k-1)
        for (let k = 0; k < bh - halfCy; k++) {
            const cnt = 4 * (halfCy - k - 1);
            if (cnt <= 0) break;
            let col = d.left + 2 + 2 * k;
            const row = d.top + halfCy + k;
            for (let c2 = 0; c2 < cnt; c2++, col++, rIdx++) {
                if (col < 0 || col >= W || row < 0 || row >= img.h) continue;
                const pv = td ? td[rIdx] : 0;
                if (pv === 0) continue;
                const gi = row * W + col;
                const zv = useZ ? zBase - zd[rIdx] : -0x40000000;
                if (!useZ || zv >= zCur[gi]) { writer[gi] = di; winPv[gi] = pv; if (useZ) zCur[gi] = zv; }
            }
        }
        // extra 矩形
        if (d.extra && d.extra.data) {
            const zd2 = d.extra.z;
            for (let yy = 0; yy < d.extra.h; yy++) {
                for (let xx = 0; xx < d.extra.w; xx++) {
                    const pv = d.extra.data[yy * d.extra.w + xx];
                    if (pv === 0) continue;
                    const col = d.extra.l + xx, row = d.extra.t + yy;
                    if (col < 0 || col >= W || row < 0 || row >= img.h) continue;
                    const gi = row * W + col;
                    const zv = zd2 ? zBase - zd2[yy * d.extra.w + xx] : -0x40000000;
                    if (!zd2 || zv >= zCur[gi]) { writer[gi] = di; if (zd2) zCur[gi] = zv; }
                }
            }
        }
    }
    for (let y = y0; y <= y1; ++y) {
        for (let x = x0; x <= x1; ++x) {
            const o = (y * img.w + x) * img.ch;
            if (!(img.data[o] < 15 && img.data[o + 1] < 15 && img.data[o + 2] < 15)) continue;
            ++blackPix;
            const di = writer[y * W + x];
            if (di < 0) { attribution.set('NO-WRITER', (attribution.get('NO-WRITER') || 0) + 1); continue; }
            const d = drawLog[di];
            const pvW = winPv[y * W + x];
            const rgbW = d.bgrRef && pvW >= 0 && pvW < 256 ? d.bgrRef[pvW*3] + ',' + d.bgrRef[pvW*3+1] + ',' + d.bgrRef[pvW*3+2] : '?';
            const k = 'WIN t' + d.tn + '/z' + d.Z + '/pv' + pvW + '/rgb' + rgbW;
            attribution.set(k, (attribution.get(k) || 0) + 1);
        }
    }
    console.log('黑像素:', blackPix, ' 胜者归因:', JSON.stringify([...attribution].sort((a, b) => b[1] - a[1]).slice(0, 12)));
    const badTmps = new Set();
    for (const [k, v] of attribution) { const m = k.match(/tmp(\d+)/); if (m) badTmps.add(+m[1]); }
    for (const tid of badTmps) {
        const t = tmpRefs[tid];
        t.Initialize();
        const lens = t.Images.map((im, i2) => 'f' + i2 + ':' + (im.TileData ? im.TileData.length : 'null')).join(' ');
        console.log('tmp' + tid + ' [' + (t.Name || '?') + '] frames=' + t.Images.length + ' ' + lens);
    }
}