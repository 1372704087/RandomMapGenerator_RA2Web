/**
 * 悬崖落片（原生 `sub_578E60` = `PlaceCliffs`）—— **阶段 9 的主链**。
 *
 * 依据 `yaoyaojiang/MapGenerator`（同源 C++ 复刻，带 IDA 地址注释）的
 * `MapGenMakingSub.cpp` + `MapGenRiver.cpp`。
 *
 * 【为什么必须补这一块】
 * 此前 `cliff.ts` 只移植了 `sub_5A19E0`（`FixCliffLevels`），而它的三个分支
 * 全部以「本格已经是崖族 tile」为前提 —— 我们从来没有把 cliff tile 写进格子，
 * ⇒ 这个函数**一直是空转**，对拍里 `cliff 恒 0`。
 * `FixCliffLevels` 是**收尾修正**，不是落片；落片是本文件。
 *
 * 【驱动 `sub_578E60`（`PlaceCliffs`）逐条】
 *  1. work 数组（`dword_ABED10`）按需分配 `workSide²` 个 80 字节 cell；
 *  2. 每个 work cell 的 **byte(+74) 使能位**置 1（`sub_58C2C0`）；
 *  3. `sub_4A8BF0` ResetPreviewState（本移植无预览态，空）；
 *  4. **Pass 1**：蛇形遍历全图，逐格 `CliffPass(cell, -1)`，返回 0 即中止；
 *  5. **Pass 2**：再走一遍，对每格 `SlopeIndex == 0 && IsPlaceholderTile` 调
 *     `PlaceCliffPiece(cell, -1)`，返回 0 即中止；
 *  6. 清 isotile 选择 / 拆 CurrentBuilding；
 *  7. 若是本次分配的 work 数组则释放。
 *
 * 【Pass 1：`CliffPass` = `sub_579010`】
 * 用 `CliffMask` 算出「恰好高 4 阶」的邻格方向位图，然后：
 *   - 主判据 `(mask & 0x88) == 0x88 || (mask & 0x22) == 0x22 || hit`；
 *   - `hit` 由 ①对角双高 ②四条「跨一格对探」③七组位形 累积而成；
 *  - 命中则 `cell->Level += 4`（**+4 不是 +1**），并对 8 邻**递归**自身
 *     （返回结果丢弃，只靠 `mark` 去重）。
 * work mark 冲突（`mark > 0 && mark != mode && mode != -1`）返回 false 中止。
 *
 * 【Pass 2：`PlaceCliffPiece` = `sub_579620`】
 * `roll = RandomFloatRange(0,5)`、`mask = CliffMask(cell)`，
 * 按位形查表挑出 CliffSet 家族内 **1..40 号槽**，盖章 `CliffSet + slot - 1`。
 * 12 个槽是固定的（1/2/8/18/21/22/26/33/34/38/39/40），其余是
 * `roll % 3 + base` 变体，两条路径用 `roll & 1` 掷硬币二选一。
 *
 * 【`CliffMask` = `sub_579B70`】
 * 8 位掩码，每位代表「那个方向恰好高 4 阶**且不是崖族 tile**」：
 * `N 0x80 / NE 0x01 / E 0x02 / SE 0x04 / S 0x08 / SW 0x10 / W 0x20 / NW 0x40`。
 * ⚠ 判「是否崖族」用的是 **`Height(+0x11A)`**（我们叫 `subTile`），
 *   **不是** `SlopeIndex(+0x11C)`。原版两个字段都读，各管各的。
 *
 * 【`ResolveCliffVariant` = `sub_5A1350`】
 * 5 组 3 槽簇（4-6 / 8-10 / 11-13 / 14-16 / 22-24）+ 槽 28↔29 互换 +
 * 槽 34-36 内部随机，各掷一次 RNG；其余槽原样返回。
 */

import { DIRECTION_OFFSETS } from './cell';
import type { NativeCell } from './native';
import { isClearTile } from './water';
import type { WaterContext } from './water';
import type { TheaterTables } from './theater';
import { RmgRng } from './rng';

// ─── 崖族足迹表（`kCliffFootprints`，`MapGenRiver.cpp:2590`）─────────────────
//
// w/h = 该崖片占几列几行；mask = 哪些 (row,col) 真有图（bit = row*w + col）；
// z = 逐格写入 Height 的列序（`PlaceIsoTile` 的 `fp->z[zIndex++]`）。
const CLIFF_FOOTPRINTS: ReadonlyArray<readonly [number, number, number, number[]]> = [
  [2, 3, 0x2d, [4, 0, 4, 0]], //  1 cliff01
  [1, 2, 0x03, [4, 0]], //  2 cliff02
  [2, 3, 0x2d, [4, 0, 4, 0]], //  3 cliff03
  [2, 3, 0x2d, [4, 0, 4, 0]], //  4 cliff04
  [2, 2, 0x0f, [4, 4, 0, 0]], //  5 cliff05
  [2, 2, 0x0f, [4, 4, 0, 0]], //  6 cliff06
  [2, 2, 0x0f, [4, 4, 0, 0]], //  7 cliff07
  [1, 2, 0x03, [4, 0]], //  8 cliff08
  [2, 2, 0x07, [4, 0, 0]], //  9 cliff09
  [2, 2, 0x07, [4, 0, 0]], // 10 cliff10
  [2, 2, 0x07, [4, 0, 0]], // 11 cliff11
  [1, 1, 0x01, [0]], // 12 cliff12
  [1, 1, 0x01, [0]], // 13 cliff13
  [1, 1, 0x01, [0]], // 14 cliff14
  [2, 2, 0x0f, [4, 0, 4, 0]], // 15 cliff15
  [2, 2, 0x0f, [4, 0, 4, 0]], // 16 cliff16
  [2, 2, 0x0f, [4, 0, 4, 0]], // 17 cliff17
  [2, 1, 0x03, [4, 0]], // 18 cliff18
  [3, 2, 0x33, [4, 0, 4, 0]], // 19 cliff19
  [3, 2, 0x33, [4, 0, 4, 0]], // 20 cliff20
  [3, 2, 0x33, [4, 0, 4, 0]], // 21 cliff21
  [2, 1, 0x03, [4, 0]], // 22 cliff22
  [2, 1, 0x03, [4, 4]], // 23 cliff23
  [2, 1, 0x03, [4, 4]], // 24 cliff24
  [2, 1, 0x03, [4, 4]], // 25 cliff25
  [1, 1, 0x01, [4]], // 26 cliff26
  [2, 2, 0x07, [4, 4, 4]], // 27 cliff27
  [2, 2, 0x0e, [4, 4, 4]], // 28 cliff28
  [1, 1, 0x01, [4]], // 29 cliff29
  [1, 1, 0x01, [4]], // 30 cliff30
  [2, 2, 0x07, [4, 4, 4]], // 31 cliff31
  [2, 2, 0x0e, [4, 4, 4]], // 32 cliff32
  [1, 1, 0x01, [4]], // 33 cliff33
  [1, 1, 0x01, [4]], // 34 cliff34
  [1, 2, 0x03, [4, 4]], // 35 cliff35
  [1, 2, 0x03, [4, 4]], // 36 cliff36
  [1, 2, 0x03, [4, 4]], // 37 cliff37
  [1, 1, 0x01, [4]], // 38 cliff38
  [1, 1, 0x01, [4]], // 39 cliff39
  [1, 1, 0x01, [4]], // 40 cliff40
];

/** `CliffCellsInX`：该崖片族内槽号的列数（`sub_3169`，槽外返回 1） */
export function cliffCellsInX(tile: number, cliffSet: number): number {
  const slot = tile - cliffSet;
  if (slot < 0 || slot >= CLIFF_FOOTPRINTS.length) return 1;
  return CLIFF_FOOTPRINTS[slot][0];
}

// ─── RNG（`R250Random`，`MapGen.cpp`）────────────────────────────────────────

/** `RandomFloatRange(lo,hi)` = `sub_598030`：`trunc(Next·(hi−lo+1)·2⁻³¹ + lo)`，上界拒绝 */
function randomFloatRange(rng: RmgRng, lo: number, hi: number): number {
  const range = (hi - lo + 1) >>> 0;
  for (;;) {
    const r = rng.next();
    const x = (r >>> 0) * range * 4.656612873077392e-10 + lo;
    const v = x | 0; // F2I64 = 向零截断
    if ((v >>> 0) <= (hi >>> 0)) return v;
  }
}

/** `DrawZeroOrOne`：`trunc(Next·2·2⁻³¹)`，拒绝 >1 */
function drawZeroOrOne(rng: RmgRng): number {
  for (let guard = 0; guard < 1000; guard++) {
    const v = Math.trunc(rng.next() * 4.656612873077392e-10 * 2);
    if (v <= 1) return v;
  }
  return 0;
}

/** `{1,2}` 抽样：`F2I64(Next·2⁻³¹ + 1.0)`（`ResolveCliffVariant` 里那些 `+1.0` 的抽法） */
function drawOneOrTwo(rng: RmgRng): number {
  return Math.trunc(rng.next() * 4.656612873077392e-10 + 1);
}

// ─── 族判定 ─────────────────────────────────────────────────────────────────

function inFam(t: number, base: number, len: number): boolean {
  return base >= 0 && t >= base && t < base + len;
}

/**
 * `IsCliffFamilyTile` = `sub_4863D0`。
 *
 * 顺序与原版一致：CliffSet(40) → 四个瀑布(4，各带 Height 附加判定)
 * → CliffRamps(20) → WaterCaves(4) → BridgeSet(16) → WoodBridgeSet(16)
 * → DestroyableCliffs(2) → WaterCliffs(28)。
 *
 * ⚠ 四个瀑布族在**首片与第四片**上还额外查 `Height(+0x11A)`（我们 `subTile`）：
 *   东(0/3): `h != 0 && h != 4`；西(1/3): `h != 1 && h != 3`
 *   南(2/3): `h >= 2`；北(3/3): `h != 2 && h != 3`。中间两片恒真。
 */
export function isCliffFamilyTile(cell: NativeCell, t: TheaterTables): boolean {
  const tile = cell.tile;
  const height = cell.subTile;

  if (inFam(tile, t.cliffSet, 40)) return true;

  const falls = [t.waterfallEast, t.waterfallWest, t.waterfallSouth, t.waterfallNorth];
  for (let i = 0; i < 4; i++) {
    const base = falls[i];
    if (base < 0 || tile < base || tile >= base + 4) continue;
    if (tile !== base && tile !== base + 3) return true; // 中间两片直接真
    if (i === 0) return height !== 0 && height !== 4;
    if (i === 1) return height !== 1 && height !== 3;
    if (i === 2) return height >= 2;
    return height !== 2 && height !== 3;
  }

  if (inFam(tile, t.cliffRamps, 20)) return true;
  if (inFam(tile, t.waterCaves, 4)) return true;
  if (inFam(tile, t.bridges, 16)) return true;
  if (inFam(tile, t.woodBridges, 16)) return true;
  if (inFam(tile, t.destroyableCliffs, 2)) return true;
  if (t.waterCliffs < 0) return false;
  return tile >= t.waterCliffs && tile < t.waterCliffs + 28;
}

/** `IsPlaceholderTile` = `sub_486380`：tile 0（合法 clear 占位）或 0xFFFF */
function isPlaceholder(cell: NativeCell): boolean {
  return cell.tile === 0 || cell.tile === 0xffff;
}

// ─── work 数组视图（`dword_ABED10` 的两个字段）─────────────────────────────
//
// `byte(+74)` 使能位 ⇒ 复用 `ScratchSlot.shoreEnabled`（+0x4A，74 正是它）。
// `data[14]`（偏移 56 = 0x38）⇒ **就是** `ScratchSlot.regionId`，
// 也正是 `cliff.ts::cliffDrops` 抄的那个字段 —— 不另开数组，两处共享同一语义。
function workEnabled(ctx: WaterContext, x: number, y: number): number {
  return ctx.scratch.at(x, y).shoreEnabled;
}
function workMark(ctx: WaterContext, x: number, y: number): number {
  return ctx.scratch.at(x, y).regionId;
}
function setWorkMark(ctx: WaterContext, x: number, y: number, v: number): void {
  ctx.scratch.at(x, y).regionId = v;
}

// ─── `CliffMask` = `sub_579B70` ─────────────────────────────────────────────

/** 每个方向对应的掩码位（N 0x80 / NE 0x01 / E 0x02 / SE 0x04 / S 0x08 / SW 0x10 / W 0x20 / NW 0x40） */
const CLIFF_BIT = [0x80, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40] as const;

function cliffMaskAt(ctx: WaterContext, x: number, y: number): number {
  const { cells, theater } = ctx;
  if (!cells.inDiamondBounds(x, y)) return 0;
  if (workEnabled(ctx, x, y) === 0) return 0;

  const level = cells.cellAt(x, y).level;
  let mask = 0;
  for (let d = 0; d < 8; d++) {
    const o = DIRECTION_OFFSETS[d];
    const nx = x + o[0];
    const ny = y + o[1];
    if (!cells.inDiamondBounds(nx, ny)) continue;
    const n = cells.cellAt(nx, ny);
    if (n.level !== level + 4) continue; // 恰好高**一阶**（阶 = 4）
    if (isCliffFamilyTile(n, theater)) continue; // 崖族不算「更高」
    mask |= CLIFF_BIT[d];
  }
  return mask;
}

// ─── Pass 1：`CliffPass` = `sub_579010` ─────────────────────────────────────

function cliffPass(ctx: WaterContext, x: number, y: number, mode: number): boolean {
  const { cells } = ctx;
  if (!cells.inDiamondBounds(x, y)) return true;

  const mask = cliffMaskAt(ctx, x, y);

  let hit = false;
  if ((mask & 0xa0) === 0xa0 && (mask & 0x11) === 0x11) hit = true;

  // 四条「跨一格对探」：自己一侧高 ⇒ 去看对面隔一格的邻格朝外那位。
  // ⚠ 这四条是对**汇编**核过的，不是伪码直译（伪码在此处漏掉了偏移）。
  if ((mask & 0x20) !== 0 && (cliffMaskAt(ctx, x + 1, y) & 0x02) !== 0) hit = true; // W 高 → 东探 E
  if ((mask & 0x02) !== 0 && (cliffMaskAt(ctx, x - 1, y) & 0x20) !== 0) hit = true; // E 高 → 西探 W
  if ((mask & 0x08) !== 0 && (cliffMaskAt(ctx, x, y - 1) & 0x80) !== 0) hit = true; // S 高 → 北探 N
  if ((mask & 0x80) !== 0 && (cliffMaskAt(ctx, x, y + 1) & 0x08) !== 0) hit = true; // N 高 → 南探 S

  if (
    (mask & 0x11) === 0x11 &&
    ((mask & 0x0a) !== 0x0a || (mask & 0xe0) !== 0) &&
    ((mask & 0xa0) !== 0xa0 || (mask & 0x0e) !== 0)
  ) {
    hit = true;
  }
  if (
    (mask & 0x44) === 0x44 &&
    ((mask & 0x28) !== 0x28 || (mask & 0x83) !== 0) &&
    ((mask & 0x82) !== 0x82 || (mask & 0x38) !== 0)
  ) {
    hit = true;
  }
  if (
    (mask & 0x2c) === 0x24 ||
    (mask & 0xa1) === 0x21 ||
    (mask & 0x1a) === 0x12 ||
    (mask & 0xc2) === 0x42 ||
    (mask & 0x0b) === 0x09 ||
    (mask & 0x68) === 0x48 ||
    (mask & 0x86) === 0x84 ||
    (mask & 0xb0) === 0x90
  ) {
    hit = true;
  }

  if (!((mask & 0x88) === 0x88 || (mask & 0x22) === 0x22 || hit)) return true;

  const mark = workMark(ctx, x, y);
  if (mark > 0 && mark !== mode && mode !== -1) return false;

  cells.cellAt(x, y).level = (cells.cellAt(x, y).level + 4) & 0xff;
  setWorkMark(ctx, x, y, mode);

  for (let d = 0; d < 8; d++) {
    const o = DIRECTION_OFFSETS[d];
    cliffPass(ctx, x + o[0], y + o[1], mode); // 返回值丢弃，只靠 mark 去重
  }
  return true;
}

// ─── Pass 2：`PlaceCliffPiece` = `sub_579620` ───────────────────────────────

/**
 * 崖片盖章（`PlaceIsoTile` 在 genCode = -1、lo = hi = 0 这一路下的行为）。
 *
 * 该配置下 `PlaceIsoTile` 的三重门（`sub_57B64a` 判定）实际只剩两条：
 *  - 已有 tile 且非占位 ⇒ **跳过该格**（genCode = -1 走 LABEL_36），不报错；
 *  - 是占位格 ⇒ 写入 `IsoTileTypeIndex = tile`、`Height = 子格号`、`Level = level + z`。
 *
 * ⚠ `Height` 必须落在该 tile **自己**的 `CellsInX × CellsInY` 网格里，
 * 否则 `RecalcAttributes` 会把整格擦成 0xFFFF。温带崖片 TMP 全是 1×1
 * ⇒ 任何 `h > 0` 都被钳回 0。
 */
function stampCliffPiece(
  ctx: WaterContext,
  tile: number,
  cx: number,
  cy: number,
  level: number,
  genCode: number,
): boolean {
  const { cells } = ctx;
  const slot = tile - ctx.theater.cliffSet;
  const fp = CLIFF_FOOTPRINTS[slot];
  if (!fp) return false;
  const [w, h, mask, zs] = fp;
  if (h <= 0) return true;

  let placed = true;
  let zIndex = 0;
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      if (((mask >>> (row * w + col)) & 1) === 0) continue; // 无图 = 跳过
      const z = zs[zIndex] ?? 0;
      zIndex++;

      const x = cx + col;
      const y = cy + row;
      if (!cells.inDiamondBounds(x, y)) continue;

      const cell = cells.cellAt(x, y);
      const wc = workMark(ctx, x, y);

      // genCode = -1 ⇒ 首两条分支都走不到（LBC 判断要 `genCode != -1`）
      if (wc === genCode) {
        // 同 mark 的重复 stamp：原版按 kShoreVariantTurn 判转向冲突，
        // 崖片不在岸线 42 族内 ⇒ 不触发，直接继续。
        continue;
      }
      if (!isPlaceholder(cell)) {
        continue; // LABEL_36：已有内容就留着
      }
      setWorkMark(ctx, x, y, genCode);

      if (isPlaceholder(cell)) {
        // 温带崖片 TMP 是 1×1 ⇒ 子格号恒 0
        const subCell = 0;
        cell.tile = tile;
        cell.subTile = subCell;
        cell.level = (level + z) & 0xff;
        continue;
      }
      // 走到这里说明 stamp 中途撞上已占用格：原版置 `*placed=false` 并中止
      placed = false;
      return false;
    }
  }
  if (placed) return true;
  return true; // 原版 `return true`（`0x57b6b3`），placed 另行传给调用者
}

// ─── `ResolveCliffVariant` = `sub_5A1350` ───────────────────────────────────

/**
 * 把一个崖片 tile 换成它的旋转/翻转同族件。
 * 5 组 3 槽簇各掷一次 RNG；槽 28↔29 直接互换；槽 34-36 内部随机。
 */
export function resolveCliffVariant(
  ctx: WaterContext,
  tile: number,
): number {
  const base = ctx.theater.cliffSet;
  const slot = tile - base;
  const coin = () => drawZeroOrOne(ctx.rng);

  switch (slot) {
    case 4:
      return base + drawOneOrTwo(ctx.rng) + 4; // +5 / +6
    case 5:
      return base + 2 * coin() + 4; // +4 / +6
    case 6:
      return base + coin() + 4; // +4 / +5
    case 8:
      return base + drawOneOrTwo(ctx.rng) + 8;
    case 9:
      return base + 2 * coin() + 8;
    case 10:
      return base + coin() + 8;
    case 11:
      return base + drawOneOrTwo(ctx.rng) + 11;
    case 12:
      return base + 2 * coin() + 11;
    case 13:
      return base + coin() + 11;
    case 14:
      return base + drawOneOrTwo(ctx.rng) + 14;
    case 15:
      return base + 2 * coin() + 14;
    case 16:
      return base + coin() + 14;
    case 22:
      return base + drawOneOrTwo(ctx.rng) + 22;
    case 23:
      return base + 2 * coin() + 22;
    case 24:
      return base + coin() + 22;
    case 28:
      return base + 29; // 直接互换
    case 29:
      return base + 28;
    case 34:
      return base + randomFloatRange(ctx.rng, 1, 2) + 34; // +35 / +36
    case 35:
      return base + 2 * randomFloatRange(ctx.rng, 0, 1) + 34;
    case 36:
      return base + randomFloatRange(ctx.rng, 0, 1) + 34;
    default:
      return tile;
  }
}

// ─── `CorrectCliffTiles` = `sub_5A17F0` ─────────────────────────────────────

/**
 * 崖片转向修正：某崖片格与其 S / E 邻格**同 tile 但更低**（`Height` 更大）时，
 * 换成 `ResolveCliffVariant` 给出的同族件，锚在邻格自己的基格上。
 *
 * `Height = col + row·CellsInX` ⇒ 基格 = `(nx − H%w, ny − H/w)`。
 */
function correctCliffTiles(ctx: WaterContext): number {
  const { cells, theater } = ctx;
  if (theater.cliffSet < 0) return 0;
  let fixed = 0;

  const stamp = (nx: number, ny: number, tile: number) => {
    const newTile = resolveCliffVariant(ctx, tile);
    if (newTile === tile) return;
    const cellsInX = cliffCellsInX(tile, theater.cliffSet);
    const h = cells.cellAt(nx, ny).subTile;
    const cellX = nx - (h % cellsInX);
    const cellY = ny - Math.floor(h / cellsInX);
    // 原版走 `PlaceWaterDetailTile`，这里直接对基格起手盖章
    stampCliffPiece(ctx, newTile, cellX, cellY, cells.cellAt(nx, ny).level, workMark(ctx, cellX, cellY));
    fixed++;
  };

  const entries = collectAll(ctx);
  for (const [x, y] of entries) {
    const tile = cells.cellAt(x, y).tile;
    if (tile < theater.cliffSet || tile >= theater.cliffSet + 40) continue;

    // S = dir4 = (0,+1)，E = dir2 = (+1,0)
    for (const d of [4, 2]) {
      const o = DIRECTION_OFFSETS[d];
      const nx = x + o[0];
      const ny = y + o[1];
      if (!cells.inDiamondBounds(nx, ny)) continue;
      const n = cells.cellAt(nx, ny);
      if (n.tile === tile && cells.cellAt(x, y).subTile > n.subTile) stamp(nx, ny, tile);
    }
  }
  return fixed;
}

// ─── 全图蛇形遍历快照 ──────────────────────────────────────────────────────

function collectAll(ctx: WaterContext): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const lim = ctx.cells.mapW + ctx.cells.mapH + 4;
  for (let y = 0; y < lim; y++) {
    for (let x = 0; x < lim; x++) {
      if (!ctx.cells.inDiamondBounds(x, y)) continue;
      out.push([x, y]);
    }
  }
  return out;
}

// ─── 驱动：`PlaceCliffs` = `sub_578E60` ─────────────────────────────────────

export interface CliffPlaceResult {
  /** Pass 1 抬升过的格数 */
  raised: number;
  /** Pass 2 落下的崖片格数 */
  pieces: number;
  /** 修正过的崖片数 */
  corrected: number;
  /** 实际用到的 CliffSet 槽号集合（1..40） */
  slotsUsed: Set<number>;
}

/**
 * 悬崖落片主入口（阶段 9 的主体）。
 *
 * 原生调用序：`CliffPass` 全图扫（填洼）→ `PlaceCliffPiece` 逐占位格落片
 * → （`PlaceCliffs` 外）`CorrectCliffTiles` 转向修正
 * → （更外）`FixCliffLevels` = 我们已有的 `cliffDrops`。
 */
export function placeCliffs(ctx: WaterContext): CliffPlaceResult {
  const { cells, scratch, theater } = ctx;
  const res: CliffPlaceResult = {
    raised: 0,
    pieces: 0,
    corrected: 0,
    slotsUsed: new Set<number>(),
  };
  if (theater.cliffSet < 0) return res;

  // ---- 2. 全 work cell 使能（`sub_58C2C0`）------------------------------
  for (let i = 0; i < scratch.slots.length; i++) scratch.slots[i].shoreEnabled = 1;

  const entries = collectAll(ctx);

  // ---- 4. Pass 1：CliffPass 填洼 ---------------------------------------
  {
    let pass = true;
    for (const [x, y] of entries) {
      if (!pass) break;
      const before = cells.cellAt(x, y).level;
      pass = cliffPass(ctx, x, y, -1);
      if (cells.cellAt(x, y).level !== before) res.raised++;
    }
  }

  // ---- 5. Pass 2：逐占位格落一片崖 -------------------------------------
  {
    let pass = true;
    for (const [x, y] of entries) {
      if (!pass) break;
      const cell = cells.cellAt(x, y);
      if (cell.slope !== 0) continue; // SlopeIndex != 0 跳过
      if (!isPlaceholder(cell)) continue;
      pass = placeCliffPiece(ctx, x, y, -1);
    }
  }

  // 统计实际用到的槽（Pass 2 之后格子上的崖片 tile）
  for (const [x, y] of entries) {
    const tile = cells.cellAt(x, y).tile;
    const slot = tile - theater.cliffSet;
    if (slot >= 0 && slot < 40) res.slotsUsed.add(slot + 1);
  }
  const countCliffCells = () => {
    let n = 0;
    for (const [x, y] of entries) {
      const tile = cells.cellAt(x, y).tile;
      if (tile >= theater.cliffSet && tile < theater.cliffSet + 40) n++;
    }
    return n;
  };
  res.pieces = countCliffCells();

  // ---- CorrectCliffTiles ------------------------------------------------
  res.corrected = correctCliffTiles(ctx);
  return res;
}

// ─── `PlaceCliffPiece` = `sub_579620` 本体 ─────────────────────────────────

function placeCliffPiece(ctx: WaterContext, x: number, y: number, genCode: number): boolean {
  const { cells, theater } = ctx;
  if (!isPlaceholder(cells.cellAt(x, y))) return true;

  const roll = randomFloatRange(ctx.rng, 0, 5);
  const mask = cliffMaskAt(ctx, x, y);
  let slot = 0;

  if ((mask & 0xa0) === 0xa0) {
    // 对角双高（W|N）：看 S 邻的 W 位与 E 邻的 N 位定内角
    const southMask = cliffMaskAt(ctx, x, y + 1); // dir4 = S
    const eastMask = cliffMaskAt(ctx, x + 1, y); // dir2 = E
    // ⚠ 原版第二个探针是「东邻的 N 位」，不是有符号比较 `eastMask < 0`
    // （CliffMask 只会返回 0..255，`< 0` 是死代码，会把内角格错发到 9/10/11）
    if ((southMask & 0x20) !== 0 || (eastMask & 0x80) !== 0) slot = 34;
    else slot = (roll % 3) + 9;
    if (slot <= 0) return true;
    return commitCliff(ctx, x, y, slot, genCode);
  }

  if ((mask & 0x82) === 0x82) return commitCliff(ctx, x, y, 39, genCode); // N|E
  if ((mask & 0x0a) === 0x0a) return commitCliff(ctx, x, y, 33, genCode); // SE|S
  if ((mask & 0x28) === 0x28) return commitCliff(ctx, x, y, 40, genCode); // S|W

  if ((mask & 0x02) === 0) {
    // ── E 位未置 ──
    if ((mask & 0x20) !== 0) {
      // W 置
      const southMask = cliffMaskAt(ctx, x, y + 1);
      if ((mask & 0x10) === 0 || (mask & 0x0c) !== 0 || (southMask & 0x28) === 0x28) {
        slot = 18;
      } else {
        slot = (roll % 3) + 15;
      }
    } else if ((mask & 0x08) !== 0) {
      // S 置
      const eastMask = cliffMaskAt(ctx, x + 1, y);
      const seMask = cliffMaskAt(ctx, x + 1, y + 1);
      if ((mask & 0x04) === 0 || (mask & 0x03) !== 0 || (eastMask & 0x0a) === 0x0a) {
        slot = (mask & 0x06) !== 0 || (seMask & 0x08) !== 0 || (roll & 1) === 0 ? 26 : 21;
      } else {
        slot = (roll % 3) + 23;
      }
    } else if ((mask & 0x80) !== 0) {
      // N 置
      const eastMask = cliffMaskAt(ctx, x + 1, y);
      if ((mask & 0x01) === 0 || (mask & 0x06) !== 0 || (eastMask & 0x82) === 0x82) {
        slot = 8;
      } else {
        slot = (roll % 3) + 5;
      }
    } else {
      return placeCliffTail(ctx, x, y, mask, roll, genCode);
    }

    if (slot <= 0) return true;
    return commitCliff(ctx, x, y, slot, genCode);
  }

  // ── E 位置 ──
  const southMask = cliffMaskAt(ctx, x, y + 1);
  const seMask = cliffMaskAt(ctx, x + 1, y + 1);
  if ((mask & 0x04) !== 0 && (mask & 0x18) === 0 && (southMask & 0x0a) !== 0x0a) {
    slot = (roll % 3) + 35;
    if (slot <= 0) return true;
    return commitCliff(ctx, x, y, slot, genCode);
  }
  slot = (mask & 0x0c) !== 0 || (seMask & 0x02) !== 0 || (roll & 1) === 0 ? 38 : 1;
  return commitCliff(ctx, x, y, slot, genCode);
}

/** `LABEL_73`：E/W/S/N 全未置时的共享尾部 */
function placeCliffTail(
  ctx: WaterContext,
  x: number,
  y: number,
  mask: number,
  roll: number,
  genCode: number,
): boolean {
  let slot: number;
  if ((mask & 0x01) !== 0) {
    slot = 2; // NE
  } else if ((mask & 0x04) !== 0) {
    slot = (roll & 1) + 29; // SE
  } else if ((mask & 0x10) !== 0) {
    slot = 22; // SW
  } else if ((mask & 0x40) === 0) {
    return true; // NW 也没置 → 不落片
  } else {
    slot = (roll % 3) + 12;
  }
  if (slot <= 0) return true;
  return commitCliff(ctx, x, y, slot, genCode);
}

/**
 * 落片前的朝向修正 + 盖章。
 *
 * 两处端口扩展（原版没有，但会留可见的缝）：
 *  - 竖墙 35/36/37（1×2，南侧还要落一格）被非占位格占住 ⇒ 换成 C38；
 *  - 横墙 23/24/25（2×1，东侧还要落一格）被占住 ⇒ 换成 C26。
 *  否则撞坡修剪会把幸存格换成内角片 C34，朝向接不上。
 */
function commitCliff(
  ctx: WaterContext,
  x: number,
  y: number,
  slotIn: number,
  genCode: number,
): boolean {
  const { cells, theater } = ctx;
  let slot = slotIn;

  if (slot >= 35 && slot <= 37) {
    const sy = y + 1;
    if (cells.inDiamondBounds(x, sy) && !isPlaceholder(cells.cellAt(x, sy))) slot = 38;
  } else if (slot >= 23 && slot <= 25) {
    const ex = x + 1;
    if (cells.inDiamondBounds(ex, y) && !isPlaceholder(cells.cellAt(ex, y))) slot = 26;
  }

  const tile = theater.cliffSet + slot - 1;
  const level = cells.cellAt(x, y).level;
  const ok = stampCliffPiece(ctx, tile, x, y, level, genCode);
  return ok;
}

/** 崖片占用到的格数（诊断用） */
export function countCliffCells(ctx: WaterContext): number {
  const { cells, theater } = ctx;
  if (theater.cliffSet < 0) return 0;
  let n = 0;
  const lim = cells.mapW + cells.mapH + 4;
  for (let y = 0; y < lim; y++) {
    for (let x = 0; x < lim; x++) {
      if (!cells.inDiamondBounds(x, y)) continue;
      const tile = cells.cellAt(x, y).tile;
      if (tile >= theater.cliffSet && tile < theater.cliffSet + 40) n++;
    }
  }
  return n;
}

/** 供测试用：崖片槽号 → 该槽的 footprint（w,h,mask,z） */
export function cliffFootprintOf(slot1: number): readonly [number, number, number, number[]] | null {
  return CLIFF_FOOTPRINTS[slot1 - 1] ?? null;
}

/** 复用的判定导出（cliff.ts 的 cliffDrops 需要同族测试） */
export { isPlaceholder as isPlaceholderTile, isCliffFamilyTile as isCliffFamily };

/** isClearTile 的再导出，方便外部统一 import */
export { isClearTile };