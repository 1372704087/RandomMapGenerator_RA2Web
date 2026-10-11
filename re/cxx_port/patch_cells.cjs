// 可靠的 .map 瓦片补丁工具：用 core lzo + 标准 Format5 分块重写 IsoMapPack5
// 用法: node patch_cells.cjs <in.map> <out.map> <mode>
//   mode=subtile0: 所有 subtile>0 的格改为 0
//   mode=lat55:    bbox 内(可用环境变量 BBOX=x0,y0,x1,y1 覆盖)所有格改为 t55/s0
'use strict';
const fs = require('fs');
const path = require('path');
const { lzo1xCompress } = require(path.join(__dirname, '..', '..', 'packages', 'core', 'dist', 'rmg', 'cxx', 'mapFile.js'));
const { MapFile } = require('G:/cncmaps-ts/dist/formats/map/MapFile.js');

const [inp, outp, mode] = process.argv.slice(2);
const W = parseInt(process.env.MAPW || '77', 10);
const H = parseInt(process.env.MAPH || '85', 10);

const mf = new MapFile(fs.readFileSync(inp));
// 收集层序 cells: [dx][dy/2], dx 0..2W-2
const tiles = [];
for (const t of mf.Tiles) tiles.push(t);
console.log('cells:', tiles.length);

const bbox = process.env.BBOX ? process.env.BBOX.split(',').map(Number) : null;
let patched = 0;
for (const t of tiles) {
    if (mode === 'subtile0') {
        if (t.SubTile !== 0) { t.SubTile = 0; ++patched; }
    } else if (mode === 'cellrect') {
        const dx0=+process.env.DX0, dx1=+process.env.DX1, dz0=+process.env.DZ0, dz1=+process.env.DZ1;
        const dyz=t.Dy-t.Z;
        if(t.Dx>=dx0&&t.Dx<=dx1&&dyz>=dz0&&dyz<=dz1){
            if(t.TileNum!==55||t.SubTile!==0){t.TileNum=55;t.SubTile=0;++patched;}
        }
    } else if (mode === 'raise2') {
        const black = new Set(JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '.tmp_oracle', 'batch20', '05_blackcells.json'), 'utf8')));
        if (black.has(t.Rx + ',' + t.Ry)) { t.Z = Math.min(10, t.Z + 2); ++patched; }
    } else if (mode === 'lat55' && bbox) {
        const x = t.Dx * 30 - 120 + 15, y = (t.Dy - t.Z) * 15 - 75 + 15;
        if (x >= bbox[0] && x <= bbox[2] && y >= bbox[1] && y <= bbox[3]) {
            if (t.TileNum !== 55 || t.SubTile !== 0) { t.TileNum = 55; t.SubTile = 0; ++patched; }
        }
    }
}
console.log('patched:', patched);

// 重编 11B 流: [rx u16][ry u16][tile i32][sub u8][z u8][ice u8], 层序
const stream = Buffer.alloc(tiles.length * 11 + 4);
let di = 0;
for (const t of tiles) {
    stream.writeUInt16LE(t.Rx & 0xffff, di);
    stream.writeUInt16LE(t.Ry & 0xffff, di + 2);
    const tv = t.TileNum < 0 ? 0 : t.TileNum;
    stream.writeInt32LE(tv, di + 4);
    stream[di + 8] = t.SubTile & 0xff;
    stream[di + 9] = t.Z & 0xff;
    stream[di + 10] = 0;
    di += 11;
}
// 分块 LZO (8192) + base64, 用 core 的压缩器(已验证与 cncmaps 解码器兼容)
const chunks = [];
for (let off = 0; off < stream.length; off += 8192) {
    const len = Math.min(8192, stream.length - off);
    const payload = Buffer.alloc(len + Math.floor(len / 16) + 64 + 3);
    const n = lzo1xCompress(stream.subarray(off, off + len), len, payload);
    const hdr = Buffer.alloc(4);
    hdr.writeUInt16LE(n, 0);
    hdr.writeUInt16LE(len, 2);
    chunks.push(hdr, payload.subarray(0, n));
}
const b64 = Buffer.concat(chunks).toString('base64');

const text = fs.readFileSync(inp, 'utf8').replace(/\r\n/g, '\n');
const lines = text.split('\n');
const start = lines.findIndex((l) => l.trim() === '[IsoMapPack5]');
let end = lines.length;
for (let i = start + 1; i < lines.length; ++i) { if (/^\[/i.test(lines[i])) { end = i; break; } }
const body = [];
for (let pos = 0, line = 1; pos < b64.length; pos += 70) body.push(line++ + '=' + b64.substr(pos, 70));
fs.writeFileSync(outp, [...lines.slice(0, start + 1), ...body, '', ...lines.slice(end)].join('\n'));
console.log('written', outp);
