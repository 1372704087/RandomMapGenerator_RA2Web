/**
 * 可注入种子的伪随机数发生器（切片管线的所有随机都从这里取数）。
 *
 * 镜像 C# System.Random 的公开 API：
 *   - Next(max)        -> [0, max)
 *   - Next(min, max)   -> [min, max)
 *   - NextDouble()     -> [0, 1)
 *
 * 用线性同余发生器，给同一个 seed 就能复现同一串取值 —— 这是「同种子 ⇒
 * 逐字节相同的地图」的前提。不传 seed 时退回 Date.now()，行为与改造前一致。
 *
 * 单独成文件是因为 `WorkingMap`（生成）和 `MapFile`（落盘时写 [Lighting]/[Digest]）
 * 都要用；放 workingMap 里会让 fileio 反向依赖 workingMap，形成循环引用。
 */
export class Random {
  /** 本实例的种子（已裁到 31 位）。便于回显/记录。 */
  public readonly Seed: number;
  private state: number;

  constructor(seed?: number) {
    const s = seed === undefined || !Number.isFinite(seed) ? Date.now() : seed;
    this.Seed = s & 0x7fffffff;
    this.state = this.Seed;
  }

  private next(): number {
    // LCG constants (same family as glibc / ANSI C)
    this.state = (this.state * 1103515245 + 12345) & 0x7fffffff;
    return this.state / 0x80000000; // [0, 1)
  }

  public NextDouble(): number {
    return this.next();
  }

  /** Next(max) -> [0, max)  or  Next(min, max) -> [min, max) */
  public Next(minOrMax: number, max?: number): number {
    if (max === undefined) {
      return Math.floor(this.next() * minOrMax);
    }
    return Math.floor(this.next() * (max - minOrMax)) + minOrMax;
  }
}
