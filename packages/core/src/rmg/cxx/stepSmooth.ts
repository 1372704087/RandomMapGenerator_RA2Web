// [QUALITY-FIX] 末端台阶平滑 —— 消除 2~3 级可见落差（渲染黑洞的唯一成因）。
//
// 机制（2026-10-11 实证，见项目记忆 env34-black-holes-rootcause）：
//   RA2 可见立面只有两种合法形态——1 级（邻格瓦片菱形天然重叠 15px 遮住）
//   和 4 级（Cliff Set 立面件，由 cliffMask 的 level+4 门驱动 PlaceCliffPiece 铺设）。
//   2~3 级孤立台阶两者皆无：cliffMask 对它们不可见，placeCliffPiece 空手返回，
//   边界格留在平地瓦片 → 立面区域无像素可画 → 黑色菱形洞。
//   原版 exe 同病（drop3 可见面黑率 76.5% vs TS 67.4%），此 pass 让 TS 严格优于原版。
//
// 规则：只处理两个屏幕可见方向（(cx+1,cy) 与 (cx,cy+1)，即 (cx+cy) 增大的方向）。
//   - 低格 N 是严格局部最低 → 抬 N ∆=d-1，落差化成 1（只升不降，必有终止）
//   - 否则高格 C 是严格局部最高 → 降 C ∆=d-1（只降不升）
//   - 两者皆不满足（山脊/鞍点）→ 跳过记残差
//   - 任一端正交邻格是 shore 族（悬崖）瓦片 → 跳过（防止撕裂已有 Cliff Set 立面）
// 迭代到不动点；单格层值有界（升不超过高格-1，降不低于 0），必然终止。
import { Rmg } from './mapGen';
import { diag } from './diag';
import { CellIterator, i16 } from './types';

const DIRS: Array<[number, number]> = [[1, 0], [0, 1]]; // 仅屏幕可见方向

export function smoothPartialSteps(r: Rmg): void {
    if (r.work.count === 0) return;

    const levelAt = (x: number, y: number): number | null => {
        if (!r.cellExists(i16(x), i16(y))) return null;
        return r.cellAt(i16(x), i16(y)).level;
    };
    const isCliffArt = (x: number, y: number): boolean => {
        if (!r.cellExists(i16(x), i16(y))) return false;
        const t = r.cellAt(i16(x), i16(y)).isoTileTypeIndex;
        return t >= r.shoreTileIndex && t <= r.shoreTileIndex + 39;
    };

    let raised = 0;
    let lowered = 0;
    let residual = 0;
    let ops = 0;
    const OPS_CAP = 5000;

    // 工作队列：待检的可见面，键 = "ux,uy>lx,ly"（上格>下格，上格 = 屏幕更高一方，
    // 即 (cx+cy) 较小的一方）。层值变化后，该格作为上格和下格的四个可见面都重新入队。
    const faces = new Set<string>();
    const enqueueCell = (cx: number, cy: number): void => {
        // 本格作为上格：屏幕下方的两个邻格
        faces.add(cx + ',' + cy + '>' + (cx + 1) + ',' + cy);
        faces.add(cx + ',' + cy + '>' + cx + ',' + (cy + 1));
        // 本格作为下格：屏幕上方的两个邻格
        faces.add((cx - 1) + ',' + cy + '>' + cx + ',' + cy);
        faces.add(cx + ',' + (cy - 1) + '>' + cx + ',' + cy);
    };

    const it = new CellIterator();
    it.reset(r.cellSlots, r.size.mapWidth);
    for (let c = it.next(); c !== null; c = it.next()) {
        const cx = i16(c.mapCoords & 0xffff);
        const cy = i16(c.mapCoords >>> 16);
        enqueueCell(cx, cy);
    }

    while (faces.size > 0 && ops < OPS_CAP) {
        const key = faces.values().next().value as string;
        faces.delete(key);
        const [up, low] = key.split('>').map((s) => s.split(',').map(Number));
        const ux = up[0], uy = up[1], lx = low[0], ly = low[1];
        const uLevel = levelAt(ux, uy), lLevel = levelAt(lx, ly);
        if (uLevel === null || lLevel === null) continue;
        const d = uLevel - lLevel;
        if (d !== 2 && d !== 3) continue;

        // 低格是严格局部最低（4 邻 ≥ 自身）→ 安全抬升
        const lowIsMin = [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => {
            const n = levelAt(lx + dx, ly + dy);
            return n === null || n >= lLevel;
        });
        // 高格是严格局部最高（4 邻 ≤ 自身）→ 安全下降
        const upIsMax = [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => {
            const n = levelAt(ux + dx, uy + dy);
            return n === null || n <= uLevel;
        });
        // 任一端贴悬崖瓦片 → 不动（避免撕裂 Cliff Set 立面）
        const touchesCliff = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) =>
            isCliffArt(ux + dx, uy + dy) || isCliffArt(lx + dx, ly + dy));

        if (touchesCliff) { ++residual; continue; }
        ++ops;

        if (lowIsMin) {
            const cell = r.cellAt(i16(lx), i16(ly));
            cell.level = lLevel + (d - 1);
            ++raised;
            enqueueCell(lx, ly);
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
                enqueueCell(lx + dx, ly + dy);
        } else if (upIsMax) {
            const cell = r.cellAt(i16(ux), i16(uy));
            cell.level = uLevel - (d - 1);
            ++lowered;
            enqueueCell(ux, uy);
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
                enqueueCell(ux + dx, uy + dy);
        } else {
            ++residual;
        }
    }

    if (raised + lowered + residual > 0)
        diag(`STEP-SMOOTH raised=${raised} lowered=${lowered} residual=${residual}`);
}
