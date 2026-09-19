/**
 * 中立科技建筑（原生阶段 14，`0x005A95B0` / `0x00595400`）
 *
 * 反编译：`re/decomp/5A95B0_Tech_Neutral.c`、`595400_Tech_MapType2.c`。
 * 规则池：Rules[AI].NeutralTechBuildings（零售 6 项，已从 rulesmd.ini 实证）。
 *
 * 数量：MapType≠2 → U{0..4}（ftol(raw·5K) 拒绝 >4），每栋独立放置；
 *       MapType==2 → U{0,1,2}，每区一座（本移植按区数上限取前 n 区）。
 * 放置门（逐基础格）：clear + 无占位 + 同 level + LandType≠3 + 无水锁（+0x45）。
 * 位置：cell×256+0x80 leptons（emit 侧转 [Structures] 的 tile 坐标）。
 *
 * UNVERIFIED：建筑基础格足迹表（原生经 BuildingType vtable 取基础格清单，
 * 0x7FFF 终止）。缺省按 1×1 锚点门 —— 多格建筑可能跨上 LAT/坡；
 * 待接 rulesmd.ini 的 BuildingOutline/ Footprint 数据后替换。
 */

import { coordOfCell, WaterContext } from './water';
import { ftol, nextUniformRange, RANGE_K } from './x87';

/** 零售 NeutralTechBuildings（rulesmd.ini [AI] 实证） */
export const NEUTRAL_TECH_BUILDINGS: readonly string[] = [
  'CAAIRP',
  'CATHOSP',
  'CAOILD',
  'CAOUTP',
  'CAMACH',
  'CAPOWR',
];

/** 科技建筑（emit 侧转 [Structures]，Neutral 拥有） */
export interface TechStructure {
  name: string;
  xd: number;
  yd: number;
}

/** 槽链（598030(0, W²−1) + (0,0) 拒绝 ≤200；耗尽回退坐标 0） */
function pickSlotCoord(ctx: WaterContext): [number, number] {
  const { rng, scratch } = ctx;
  const W2 = scratch.size * scratch.size;
  for (let attempt = 0; attempt < 200; attempt++) {
    const slot = nextUniformRange(rng.next(), 0, W2 - 1);
    const s = scratch.slots[Math.min(slot, W2 - 1)];
    if (s.coord === 0) continue;
    return [s.coord & 0xffff, s.coord >>> 16];
  }
  return [0, 0];
}

/** 单栋放置：≤100 次锚点尝试；返回是否成功 */
function placeOne(
  ctx: WaterContext,
  name: string,
  structures: TechStructure[],
): boolean {
  const { cells } = ctx;
  for (let attempt = 0; attempt < 100; attempt++) {
    const [x, y] = pickSlotCoord(ctx);
    const cell = cells.cellAt(x, y);
    const level = cell.level;
    // 基础格门（缺省 1×1 锚点；足迹表待接 rules 数据）
    if (
      cells.inDiamondBounds(x, y) &&
      (cell.tile === 0 || cell.tile === 0xffff) &&
      cell.occupied === 0 &&
      cell.overlay === -1 &&
      cell.landType !== 3 &&
      cell.level === level &&
      ctx.scratch.at(x, y).waterLock === 0
    ) {
      structures.push({ name, xd: x, yd: y });
      // 占位（原生 BuildingClass 占据基础格；这里仅标 anchor，防止重叠）
      cell.occupied = 1;
      return true;
    }
  }
  return false;
}

/** `0x005A95B0`：MapType≠2 数量 U{0..4}；MapType==2 → U{0,1,2} 每区一座 */
export function placeTechBuildings(ctx: WaterContext): void {
  const { rng } = ctx;
  if (ctx.mapType === 2) {
    let n = 0;
    do {
      n = ftol(chopMulT(ctx.rng.next(), 3));
    } while (n > 2);
    for (let i = 0; i < n; i++) {
      const typeIdx = nextUniformRange(rng.next(), 0, NEUTRAL_TECH_BUILDINGS.length - 1);
      placeOne(
        ctx,
        NEUTRAL_TECH_BUILDINGS[Math.min(typeIdx, NEUTRAL_TECH_BUILDINGS.length - 1)],
        ctx.structures,
      );
    }
    return;
  }
  let count = 0;
  do {
    count = ftol(chopMulT(ctx.rng.next(), 5));
  } while (count > 4);
  for (let i = 0; i < count; i++) {
    const typeIdx = nextUniformRange(rng.next(), 0, NEUTRAL_TECH_BUILDINGS.length - 1);
    placeOne(
      ctx,
      NEUTRAL_TECH_BUILDINGS[Math.min(typeIdx, NEUTRAL_TECH_BUILDINGS.length - 1)],
      ctx.structures,
    );
  }
}

/** ftol(raw × nK)（nK = n·2^-32-1⁻ 常数族） */
import { chopMul } from './x87';
function chopMulT(draw: number, n: number): number {
  return ftol(chopMul(draw, n * RANGE_K));
}
