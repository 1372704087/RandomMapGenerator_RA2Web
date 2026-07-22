/**
 * IO 模块入口
 *
 * 红警2地图生成器核心库的 IO 层，包含：
 * - IniFile / IniSection：INI 格式文件读写（移植自 Rampastring.Tools）
 * - MemoryFile：二进制流读取（移植自 C# VirtualFile / MemoryFile）
 */

export { IniFile, IniSection } from './iniFile';
export { MemoryFile } from './memoryFile';
