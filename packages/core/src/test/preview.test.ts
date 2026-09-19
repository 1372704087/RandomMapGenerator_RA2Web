/**
 * 雷达预览渲染的对拍测试
 *
 * 用 core 自己的 API 造一张 4×4 小图（TileNum=0 清地 ×2 + 宝石覆盖 ×1 + 其余 -1），
 * 配上极简 minimap.ini，断言：尺寸、minimap 基色、高度明暗、覆盖物紫色、空格白色。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MapFile } from '../fileio';
import { Theater } from '../tile/enums';
import { Overlay } from '../tile/overlay';
import { renderMapPreview } from '../preview';

const MINIMAP = '[TEMPERATE]\n0=10,20,30,40,50,60\n';

function buildTinyMap(): { content: string; mf: MapFile } {
  const mf = new MapFile();
  mf.MapTheater = Theater.TEMPERATE;
  mf.CreateEmptyMap(4, 4);
  // 格 0：清地 + 高度 4（明暗 +7）
  mf.IsoTileList[0].TileNum = 0;
  mf.IsoTileList[0].Z = 4;
  // 格 1：清地 + 宝石覆盖（OverlayID 30 ∈ [27,38] → 紫）
  mf.IsoTileList[1].TileNum = 0;
  const ov = new Overlay(30, 1);
  ov.Tile = mf.IsoTileList[1];
  mf.OverlayList.push(ov);
  // 其余格保持 -1
  return { content: mf.SaveFullMap(undefined, { bottomSpace: 0 }), mf };
}

function pixelAt(preview: ReturnType<typeof renderMapPreview>, tile: { Dx: number; Dy: number }): number[] {
  const px = tile.Dx;
  const py = (tile.Dy - (tile.Dx & 1)) / 2;
  const off = (py * preview.width + px) * 3;
  return [preview.rgb[off], preview.rgb[off + 1], preview.rgb[off + 2]];
}

test('预览 - 尺寸 = (2W−1) × H', () => {
  const { content } = buildTinyMap();
  const p = renderMapPreview(content, MINIMAP, 'TEMPERATE');
  assert.equal(p.width, 7);
  assert.equal(p.height, 4);
  assert.equal(p.rgb.length, 7 * 4 * 3);
});

test('预览 - minimap 基色 + 高度明暗（Z=4 → +7）', () => {
  const { content, mf } = buildTinyMap();
  const p = renderMapPreview(content, MINIMAP, 'TEMPERATE');
  assert.deepEqual(pixelAt(p, mf.IsoTileList[0]), [17, 27, 37]);
});

test('预览 - 宝石覆盖渲染为紫色（含高度明暗）', () => {
  const { content, mf } = buildTinyMap();
  const p = renderMapPreview(content, MINIMAP, 'TEMPERATE');
  // 紫 (132,0,132)，Z=0 → 明暗 -1 → (131,0,131)
  assert.deepEqual(pixelAt(p, mf.IsoTileList[1]), [131, 0, 131]);
});

test('预览 - 未赋值格（-1）渲染为白色', () => {
  const { content, mf } = buildTinyMap();
  const p = renderMapPreview(content, MINIMAP, 'TEMPERATE');
  const blank = mf.IsoTileList.find((t) => t.TileNum === -1);
  assert.ok(blank);
  assert.deepEqual(pixelAt(p, blank), [255, 255, 255]);
});

test('预览 - minimap 缺段时回落白色底（不抛错）', () => {
  const { content } = buildTinyMap();
  const p = renderMapPreview(content, '', 'TEMPERATE');
  assert.equal(p.width, 7);
});
