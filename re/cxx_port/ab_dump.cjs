// A/B diff for the gallery10 05-mountainous map (seed 0x5EED0005, env=4).
// Compares the TS map against the exe map cell-by-cell and dumps the
// (TileNum, SubTile, Z) of both sides for every differing cell, clustered
// by region — the black voids in the CCMaps render should show up here
// as (a) cells only present in one side, or (b) Tile/SubTile/Z mismatches.
'use strict';
const fs = require('fs');
const path = require('path');
const { MapFile } = require(path.join(__dirname, '..', '..', 'packages', 'core', 'dist', 'fileio.js'));

function load(p) {
    const mf = new MapFile();
    mf.CreateIsoTileList(fs.readFileSync(p, 'utf8'));
    const m = new Map();
    for (const t of mf.IsoTileList) m.set(`${t.Dx},${t.Dy}`, t);
    return m;
}

const exeMap = process.argv[2] || 'G:/MapGenerator_inst/x64/Release/rmg_inst_05.map';
const tsMap = process.argv[3] || 'G:/ra2-web-mapgen/.tmp_oracle/gallery10/05-mountainous-temperate-4p.map';
const A = load(exeMap);
const B = load(tsMap);
console.log(`exe cells=${A.size}  ts cells=${B.size}`);

let onlyA = 0, onlyB = 0, diff = 0;
const samples = [];
const keys = new Set([...A.keys(), ...B.keys()]);
for (const k of keys) {
    const a = A.get(k), b = B.get(k);
    if (!a) { ++onlyB; if (samples.length < 40) samples.push(`ONLY-TS ${k} tile=${b.TileNum} sub=${b.SubTile} z=${b.Z}`); continue; }
    if (!b) { ++onlyA; if (samples.length < 40) samples.push(`ONLY-EXE ${k} tile=${a.TileNum} sub=${a.SubTile} z=${a.Z}`); continue; }
    if (a.TileNum !== b.TileNum || a.Z !== b.Z || a.SubTile !== b.SubTile) {
        ++diff;
        if (samples.length < 40) samples.push(`DIFF ${k} exe=[${a.TileNum},${a.SubTile},${a.Z}] ts=[${b.TileNum},${b.SubTile},${b.Z}]`);
    }
}
console.log(`onlyExe=${onlyA} onlyTs=${onlyB} diffCells=${diff}`);
for (const s of samples) console.log(s);
