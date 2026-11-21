/**
 * 地图触发链的文本编码（`[Triggers]` / `[Events]` / `[Actions]` / `[Tags]` / `[CellTags]`）。
 *
 * 格式来自 ModEnc（`Triggers`、`Events`、`Actions (maps)/RA2YR` 三页）与游戏自带
 * 模板地图（`packages/server/resources/MapUnits/*`）的实测对照：
 *
 *   [Triggers] ID=HOUSE,<linked>,NAME,DISABLED,EASY,NORMAL,HARD,TRANSFERABLE
 *   [Events]   ID=NUM,E1,E1P1,E1P2[,E1P3]                    ← NUM 是条件数量
 *   [Actions]  ID=NUM,A1,A1P1..A1P7,A2,A2P1..A2P7            ← NUM 是动作数量
 *   [Tags]     TAGID=<持久值 0/1/2>,NAME,TRIGGERID
 *   [CellTags] <y><xxx>=TAGID                                ← tag 必须挂到格子上
 *
 * 两个容易踩的点：
 * 1. `[Events]` / `[Actions]` 的值**第一个字段是数量**，不是动作号。少写这一位，
 *    引擎会把动作号当数量去读（例如 `102,0,…` 会被读成"102 个动作"）。
 * 2. `[Actions]` 每个动作有 **7 个参数**，其中 P7 一律按字母写：
 *    0=A、1=B、…、25=Z、26=AA。非 waypoint 类型的动作用 `A`（= waypoint 0）。
 */

/** 8 位大写十六进制 ID（与地图里的 `[Triggers]` 键一致）。 */
export function hexId(value: number): string {
  return value.toString(16).toUpperCase().padStart(8, '0');
}

/**
 * 动作 P7 的字母编码（ModEnc：0=A、1=B、…、25=Z、26=AA）。
 * 想给某个动作指一个 waypoint 时要走这里，直接写数字是不对的。
 */
export function waypointLetter(value: number): string {
  const n = Math.max(0, Math.round(value));
  let v = n;
  let out = '';
  do {
    out = String.fromCharCode(65 + (v % 26)) + out;
    v = Math.floor(v / 26) - 1;
  } while (v >= 0);
  return out;
}

/** 单条动作：动作号 + 6 个数字/字符串参数 + P7（字母或省略为 A）。 */
export interface ActionBlock {
  id: number;
  params?: Array<number | string>;
  /** P7：waypoint 类动作给 waypointLetter(n)，其它一律留空（写 A）。 */
  p7?: string;
}

/** 单条条件：事件号 + 参数（Event 13 是 `p[1] = 秒数`）。 */
export interface EventBlock {
  id: number;
  params?: Array<number | string>;
}

/** 构造一行 `[Actions]`：`NUM,A1,A1P1..A1P7,A2,...` */
export function formatActions(blocks: ActionBlock[]): string {
  const parts: string[] = [String(blocks.length)];
  for (const block of blocks) {
    parts.push(String(block.id));
    const params = block.params ?? [];
    for (let i = 0; i < 6; i++) parts.push(String(params[i] ?? 0));
    parts.push(block.p7 ?? waypointLetter(0));
  }
  return parts.join(',');
}

/** 构造一行 `[Events]`：`NUM,E1,E1P1,E1P2` */
export function formatEvents(blocks: EventBlock[]): string {
  const parts: string[] = [String(blocks.length)];
  for (const block of blocks) {
    parts.push(String(block.id));
    parts.push(String(block.params?.[0] ?? 0));
    parts.push(String(block.params?.[1] ?? 0));
  }
  return parts.join(',');
}

/** `[Waypoints]` / `[CellTags]` 的格子格式：`<y><xxx>`（y 不加前导零，x 补 3 位）。 */
export function formatWaypointCell(x: number, y: number): string {
  return `${y}${String(x).padStart(3, '0')}`;
}
