/**
 * 连接 ID 编解码（指示图块位置 + SubTile + Z 三通道）
 *
 * 生成器的连接检测约定：在切片功能窗口外围的 4 条检测线上，指示图块
 * （TileNum == IndicatorNum）所在"行号 i"即连接类型。手工单元只用
 * pos 通道（SubTile = Z = 0，类型 0..5），切片的语义连接类可能远超 15 个，
 * 因此把高位拆进指示图块自身的 SubTile / Z 两个既有字段：
 *
 *   id = pos + 15 * (subTile + 16 * z)      pos ∈ 0..14, subTile ∈ 0..15, z ∈ 0..14
 *   容量 15 * 16 * 15 = 3600
 *
 * 手工单元的指示块实测全部 SubTile = Z = 0（2026-11-18 测量，SNOW 全部 59 个
 * 单元），解码结果与旧版"位置即类型"逐字节一致；原 %6 归一化（切片指纹
 * 0..14 压到 0..5 的权宜方案）已删除。
 */

/** 编码空间上限（含） */
export const CONNECTION_ID_MAX = 15 * 16 * 15 - 1;

/** 连接 ID → 指示图块三通道 */
export function encodeConnectionId(id: number): {
  pos: number;
  subTile: number;
  z: number;
} {
  if (!Number.isInteger(id) || id < 0 || id > CONNECTION_ID_MAX) {
    throw new Error(`连接 ID 超出编码空间: ${id}`);
  }
  const pos = id % 15;
  const rest = (id - pos) / 15;
  return { pos, subTile: rest % 16, z: Math.floor(rest / 16) };
}

/** 指示图块三通道 → 连接 ID（与 encodeConnectionId 互逆） */
export function decodeConnectionId(
  pos: number,
  subTile: number,
  z: number,
): number {
  return pos + 15 * (subTile + 16 * z);
}
