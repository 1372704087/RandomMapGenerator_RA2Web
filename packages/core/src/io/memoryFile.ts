/**
 * 二进制流读取器
 *
 * 移植自 C# VirtualFile / MemoryFile（MapFormat.cs 第 29-297 行）。
 * 用于读取红警2地图文件中的二进制数据（IsoMapPack5、OverlayPack 等）。
 *
 * 所有多字节整数读取使用小端序（Little-Endian），
 * 与 RA2 地图文件格式和 C# BitConverter 在 x86/x64 上的行为一致。
 */

/**
 * 基于内存缓冲区的二进制流读取器。
 *
 * 对应 C# MemoryFile，底层为 byte[]。
 * TypeScript 版基于 Uint8Array + DataView 实现。
 */
export class MemoryFile {
  /** 底层字节缓冲区 */
  private readonly buffer: Uint8Array;
  /** 用于多字节读取的 DataView 视图 */
  private readonly dataView: DataView;
  /** 数据总长度（字节数） */
  private readonly size: number;
  /** 当前读位置 */
  private pos: number;

  /**
   * 构造 MemoryFile。
   *
   * @param buffer 字节缓冲区。可以是 Uint8Array 的视图（subarray），
   *               内部会正确处理 byteOffset 和 byteLength。
   */
  constructor(buffer: Uint8Array) {
    this.buffer = buffer;
    this.dataView = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength,
    );
    this.size = buffer.byteLength;
    this.pos = 0;
  }

  // ─── 属性 ───────────────────────────────────────────────

  /**
   * 当前读位置（可读写）。
   * 对应 C# VirtualFile.Position。
   */
  public get Position(): number {
    return this.pos;
  }

  public set Position(value: number) {
    this.pos = value;
  }

  /**
   * 数据总长度。
   * 对应 C# VirtualFile.Length。
   */
  public get Length(): number {
    return this.size;
  }

  /**
   * 剩余可读字节数。
   * 对应 C# VirtualFile.Remaining。
   */
  public get Remaining(): number {
    return this.size - this.pos;
  }

  /**
   * 是否已到达文件末尾。
   * 对应 C# VirtualFile.Eof。
   */
  public get Eof(): boolean {
    return this.Remaining <= 0;
  }

  // ─── 读取方法 ───────────────────────────────────────────

  /**
   * 读取指定数量的字节。
   * 对应 C# VirtualFile.Read(int numBytes)。
   *
   * 如果剩余字节不足，返回的实际数据长度可能小于 count，
   * 不足部分填充为 0（与 C# 行为一致）。
   *
   * @param count 要读取的字节数
   * @returns 新建的 Uint8Array，包含读取的数据
   */
  public Read(count: number): Uint8Array {
    const available = Math.min(count, this.Remaining);
    const result = new Uint8Array(count);
    if (available > 0) {
      result.set(this.buffer.subarray(this.pos, this.pos + available));
    }
    this.pos += available;
    return result;
  }

  /**
   * 读取 C 风格字符串（遇到 \0 终止，最多读取 count 字节）。
   * 对应 C# VirtualFile.ReadCString(int count)。
   *
   * @param count 最大读取字节数
   * @returns 截止到第一个 \0 之前的字符串
   */
  public ReadCString(count: number): string {
    const bytes = this.Read(count);
    let result = '';
    for (let i = 0; i < count; i++) {
      if (bytes[i] === 0) {
        break;
      }
      result += String.fromCharCode(bytes[i]);
    }
    return result;
  }

  /**
   * 读取 1 字节无符号整数（0~255）。
   * 对应 C# VirtualFile.ReadByte()。
   */
  public ReadByte(): number {
    return this.ReadUInt8();
  }

  /**
   * 读取 1 字节无符号整数（0~255）。
   * 对应 C# VirtualFile.ReadUInt8()。
   */
  public ReadUInt8(): number {
    return this.Read(1)[0];
  }

  /**
   * 读取 1 字节有符号整数（-128~127）。
   * 对应 C# VirtualFile.ReadSByte()。
   */
  public ReadSByte(): number {
    const b = this.ReadUInt8();
    // 将 0x80~0xFF 转换为负数
    return b > 0x7f ? b - 0x100 : b;
  }

  /**
   * 读取 2 字节有符号整数（小端序）。
   * 对应 C# VirtualFile.ReadInt16()。
   */
  public ReadInt16(): number {
    const b = this.Read(2);
    // 小端序：低字节在前
    const val = b[0] | (b[1] << 8);
    // 符号扩展
    return val > 0x7fff ? val - 0x10000 : val;
  }

  /**
   * 读取 2 字节无符号整数（小端序）。
   * 对应 C# VirtualFile.ReadUInt16()。
   */
  public ReadUInt16(): number {
    const b = this.Read(2);
    // 小端序：低字节在前，>>> 0 确保无符号
    return ((b[0] | (b[1] << 8)) >>> 0);
  }

  /**
   * 读取 4 字节有符号整数（小端序）。
   * 对应 C# VirtualFile.ReadInt32()。
   */
  public ReadInt32(): number {
    const b = this.Read(4);
    // 小端序：低字节在前
    const val =
      (b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0;
    // 符号扩展
    return val > 0x7fffffff ? val - 0x100000000 : val;
  }

  /**
   * 读取 4 字节无符号整数（小端序）。
   * 对应 C# VirtualFile.ReadUInt32()。
   */
  public ReadUInt32(): number {
    const b = this.Read(4);
    // 小端序：低字节在前，>>> 0 确保无符号
    return ((b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0);
  }

  /**
   * 读取 4 字节单精度浮点数（小端序，IEEE 754）。
   * 对应 C# VirtualFile.ReadFloat()。
   */
  public ReadFloat(): number {
    const b = this.Read(4);
    // 使用 DataView 进行 IEEE 754 转换
    const dv = new DataView(new ArrayBuffer(4));
    new Uint8Array(dv.buffer).set(b);
    return dv.getFloat32(0, true); // true = 小端序
  }

  // ─── 定位 ───────────────────────────────────────────────

  /**
   * 设置当前位置。
   * 对应 C# VirtualFile.Seek 的一部分功能。
   */
  public Seek(offset: number): void {
    this.pos = offset;
  }
}
