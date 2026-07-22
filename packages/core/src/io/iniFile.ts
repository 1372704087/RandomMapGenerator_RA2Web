/**
 * INI 文件读写库
 *
 * 移植自 C# Rampastring.Tools.IniFile / IniSection。
 * 用于解析和生成红警2地图文件（.map / .yrm）的 INI 格式。
 *
 * 特性：
 * - 保留段落插入顺序（数组存储）
 * - 保留键值对插入顺序（数组存储）
 * - 段名和键名查找大小写不敏感（匹配 RA2 引擎行为），输出保留原始大小写
 * - 支持行注释（; 开头）和行内注释（值后的 ; 注释）
 * - 支持从字符串或 Uint8Array 构造
 */

/** 一行最多保留的字符数，用于 IsoMapPack5 等段落分行写入 */
const DEFAULT_LINE_WIDTH = 0; // 0 = 不自动换行

/**
 * INI 段落，对应 C# Rampastring.Tools.IniSection。
 *
 * 内部使用数组保存键的顺序，同时用 Map 做大小写不敏感的快速查找。
 */
export class IniSection {
  private readonly sectionName: string;
  /** 键名数组（保留原始大小写和插入顺序） */
  private readonly keyList: string[] = [];
  /** 值数组（与 keyList 一一对应） */
  private readonly valueList: string[] = [];
  /** 小写键名 -> 在 keyList 中的索引，用于大小写不敏感查找 */
  private readonly keyLookup: Map<string, number> = new Map();

  constructor(sectionName: string) {
    this.sectionName = sectionName;
  }

  /** 段落名称（只读） */
  public get SectionName(): string {
    return this.sectionName;
  }

  /**
   * 获取所有键名（按插入顺序，保留原始大小写）。
   * 对应 C# IniSection.Keys 属性。
   */
  public get Keys(): string[] {
    return [...this.keyList];
  }

  /**
   * 添加键值对。如果键已存在则覆盖值。
   * 对应 C# IniSection.AddKey(key, value)。
   */
  public AddKey(key: string, value: string): void {
    const lowerKey = key.toLowerCase();
    const existing = this.keyLookup.get(lowerKey);
    if (existing !== undefined) {
      this.valueList[existing] = value;
    } else {
      const idx = this.keyList.length;
      this.keyList.push(key);
      this.valueList.push(value);
      this.keyLookup.set(lowerKey, idx);
    }
  }

  /**
   * 设置键值对。如果键已存在则覆盖，否则追加。
   * 对应 C# IniSection.SetStringValue(key, value)。
   */
  public SetStringValue(key: string, value: string): void {
    this.AddKey(key, value);
  }

  /**
   * 获取键对应的字符串值，不存在时返回默认值。
   * 对应 C# IniSection.GetStringValue(key, defaultValue)。
   */
  public GetStringValue(key: string, defaultValue: string): string {
    const idx = this.keyLookup.get(key.toLowerCase());
    if (idx !== undefined) {
      return this.valueList[idx];
    }
    return defaultValue;
  }

  /**
   * 获取键对应的整数值，不存在或解析失败时返回默认值。
   * 对应 C# IniSection.GetIntValue(key, defaultValue)。
   */
  public GetIntValue(key: string, defaultValue: number): number {
    const idx = this.keyLookup.get(key.toLowerCase());
    if (idx !== undefined) {
      const parsed = parseInt(this.valueList[idx], 10);
      return isNaN(parsed) ? defaultValue : parsed;
    }
    return defaultValue;
  }

  /**
   * 检查键是否存在。
   * 对应 C# IniSection.KeyExists(key)。
   */
  public KeyExists(key: string): boolean {
    return this.keyLookup.has(key.toLowerCase());
  }

  /**
   * 移除指定键。返回是否成功移除。
   */
  public RemoveKey(key: string): boolean {
    const idx = this.keyLookup.get(key.toLowerCase());
    if (idx === undefined) {
      return false;
    }
    this.keyList.splice(idx, 1);
    this.valueList.splice(idx, 1);
    // 重建索引（因为 splice 后索引偏移）
    this.keyLookup.clear();
    for (let i = 0; i < this.keyList.length; i++) {
      this.keyLookup.set(this.keyList[i].toLowerCase(), i);
    }
    return true;
  }

  /**
   * 将段落内容序列化为 INI 文本行数组（不含段落头）。
   */
  public toLines(): string[] {
    const lines: string[] = [];
    for (let i = 0; i < this.keyList.length; i++) {
      lines.push(`${this.keyList[i]}=${this.valueList[i]}`);
    }
    return lines;
  }

  /**
   * 清空所有键值对。
   */
  public clear(): void {
    this.keyList.length = 0;
    this.valueList.length = 0;
    this.keyLookup.clear();
  }
}

/**
 * INI 文件，对应 C# Rampastring.Tools.IniFile。
 *
 * 支持从字符串或 Uint8Array 解析，也可创建空文件后逐步填充。
 * 调用 WriteIniFile() 获取序列化后的字符串。
 */
export class IniFile {
  /** 段落数组（保留插入顺序） */
  private readonly sectionList: IniSection[] = [];
  /** 小写段名 -> 在 sectionList 中的索引，用于大小写不敏感查找 */
  private readonly sectionLookup: Map<string, number> = new Map();
  /** 文件级注释（写入时放在文件开头） */
  public comment: string = '';

  /**
   * 构造 INI 文件。
   *
   * @param input 可选的输入内容。传入字符串则直接解析；
   *              传入 Uint8Array 则按 UTF-8 解码后解析；
   *              不传则创建空文件。
   */
  constructor(input?: string | Uint8Array) {
    if (input !== undefined && input !== null) {
      if (typeof input === 'string') {
        this.parse(input);
      } else {
        this.parse(new TextDecoder('utf-8').decode(input));
      }
    }
  }

  // ─── 段落操作 ───────────────────────────────────────────

  /**
   * 获取指定名称的段落。不存在时返回 null。
   * 对应 C# IniFile.GetSection(name)。
   */
  public GetSection(name: string): IniSection | null {
    const idx = this.sectionLookup.get(name.toLowerCase());
    if (idx !== undefined) {
      return this.sectionList[idx];
    }
    return null;
  }

  /**
   * 添加段落（按名称创建）。如果段落已存在则返回已有段落（不清空）。
   * 对应 C# IniFile.AddSection(name)。
   *
   * @returns 新建或已存在的 IniSection
   */
  public AddSection(name: string): IniSection;

  /**
   * 添加整个段落对象。如果同名段落已存在则替换（保留原位置）。
   * 对应 C# IniFile.AddSection(IniSection)。
   */
  public AddSection(section: IniSection): void;

  public AddSection(nameOrSection: string | IniSection): IniSection | void {
    if (typeof nameOrSection === 'string') {
      const name = nameOrSection;
      const existing = this.sectionLookup.get(name.toLowerCase());
      if (existing !== undefined) {
        return this.sectionList[existing];
      }
      const section = new IniSection(name);
      const idx = this.sectionList.length;
      this.sectionList.push(section);
      this.sectionLookup.set(name.toLowerCase(), idx);
      return section;
    } else {
      const section = nameOrSection;
      const name = section.SectionName;
      const existing = this.sectionLookup.get(name.toLowerCase());
      if (existing !== undefined) {
        // 替换已有段落，保持位置不变
        this.sectionList[existing] = section;
      } else {
        const idx = this.sectionList.length;
        this.sectionList.push(section);
        this.sectionLookup.set(name.toLowerCase(), idx);
      }
    }
  }

  /**
   * 移除指定名称的段落。返回是否成功移除。
   * 对应 C# IniFile.RemoveSection(name)。
   */
  public RemoveSection(name: string): boolean {
    const idx = this.sectionLookup.get(name.toLowerCase());
    if (idx === undefined) {
      return false;
    }
    this.sectionList.splice(idx, 1);
    // 重建索引
    this.sectionLookup.clear();
    for (let i = 0; i < this.sectionList.length; i++) {
      this.sectionLookup.set(this.sectionList[i].SectionName.toLowerCase(), i);
    }
    return true;
  }

  /**
   * 检查段落是否存在。
   * 对应 C# IniFile.SectionExists(name)。
   */
  public SectionExists(name: string): boolean {
    return this.sectionLookup.has(name.toLowerCase());
  }

  /**
   * 将指定段落移到段落列表最前面。
   * 对应 C# IniFile.MoveSectionToFirst(name)。
   * 用于 PreviewPack 等需要特定段落顺序的场景。
   */
  public MoveSectionToFirst(name: string): void {
    const idx = this.sectionLookup.get(name.toLowerCase());
    if (idx === undefined || idx === 0) {
      return;
    }
    const [section] = this.sectionList.splice(idx, 1);
    this.sectionList.unshift(section);
    // 重建索引
    this.sectionLookup.clear();
    for (let i = 0; i < this.sectionList.length; i++) {
      this.sectionLookup.set(this.sectionList[i].SectionName.toLowerCase(), i);
    }
  }

  /**
   * 获取所有段落名称（按插入顺序）。
   * 对应 C# IniFile.GetSections()。
   */
  public GetSections(): string[] {
    return this.sectionList.map((s) => s.SectionName);
  }

  // ─── 便捷读写 ───────────────────────────────────────────

  /**
   * 获取指定段落中指定键的字符串值。
   * 对应 C# IniFile.GetStringValue(section, key, default)。
   */
  public GetStringValue(section: string, key: string, defaultValue: string): string {
    const sec = this.GetSection(section);
    if (sec === null) {
      return defaultValue;
    }
    return sec.GetStringValue(key, defaultValue);
  }

  /**
   * 设置指定段落中指定键的字符串值。
   * 如果段落不存在则自动创建。
   * 对应 C# IniFile.SetStringValue(section, key, value)。
   */
  public SetStringValue(section: string, key: string, value: string): void {
    let sec = this.GetSection(section);
    if (sec === null) {
      sec = this.AddSection(section);
    }
    sec.SetStringValue(key, value);
  }

  /**
   * 获取指定段落中指定键的整数值。
   * 对应 C# IniFile.GetIntValue(section, key, default)。
   */
  public GetIntValue(section: string, key: string, defaultValue: number): number {
    const sec = this.GetSection(section);
    if (sec === null) {
      return defaultValue;
    }
    return sec.GetIntValue(key, defaultValue);
  }

  /**
   * 检查指定段落中是否存在指定键。
   * 对应 C# IniFile.KeyExists(section, key)。
   */
  public KeyExists(section: string, key: string): boolean {
    const sec = this.GetSection(section);
    if (sec === null) {
      return false;
    }
    return sec.KeyExists(key);
  }

  // ─── 序列化 ─────────────────────────────────────────────

  /**
   * 将 INI 文件序列化为字符串。
   * 对应 C# IniFile.WriteIniFile() / WriteIniFile(path)。
   *
   * 注意：C# 版写入到文件路径，TypeScript 版返回字符串，
   * 由调用者负责实际的文件 I/O。
   */
  public WriteIniFile(): string {
    const lines: string[] = [];

    // 写入文件级注释
    if (this.comment.length > 0) {
      const commentLines = this.comment.split('\n');
      for (const line of commentLines) {
        // 确保注释行以 ; 开头
        if (line.length === 0) {
          lines.push(';');
        } else if (line.startsWith(';')) {
          lines.push(line);
        } else {
          lines.push(`; ${line}`);
        }
      }
      lines.push('');
    }

    // 写入段落
    for (let i = 0; i < this.sectionList.length; i++) {
      const section = this.sectionList[i];
      // 段落之间空一行（除了文件开头）
      if (lines.length > 0 && lines[lines.length - 1] !== '') {
        lines.push('');
      }
      lines.push(`[${section.SectionName}]`);
      lines.push(...section.toLines());
    }

    // 文件末尾换行
    if (lines.length > 0) {
      lines.push('');
    }

    return lines.join('\n');
  }

  // ─── 解析 ───────────────────────────────────────────────

  /**
   * 解析 INI 格式字符串。
   *
   * 格式规则：
   * - [SectionName] 段落头
   * - key=value 键值对
   * - ; 开头的行为注释（跳过）
   * - 值中 ; 之后的内容为行内注释（去除）
   * - 空行跳过
   * - UTF-8 BOM 会被自动去除
   */
  private parse(content: string): void {
    // 去除 UTF-8 BOM
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }

    const lines = content.split(/\r\n|\r|\n/);
    let currentSection: IniSection | null = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();

      // 空行
      if (line.length === 0) {
        continue;
      }

      // 注释行（; 开头）
      if (line.startsWith(';')) {
        continue;
      }

      // 段落头 [SectionName]
      if (line.startsWith('[') && line.endsWith(']')) {
        const sectionName = line.slice(1, -1).trim();
        if (sectionName.length > 0) {
          // 如果段落不存在则创建，存在则切换到已有段落
          currentSection = this.GetSection(sectionName);
          if (currentSection === null) {
            currentSection = this.AddSection(sectionName);
          }
        }
        continue;
      }

      // 键值对 key=value
      const eqIndex = line.indexOf('=');
      if (eqIndex > 0 && currentSection !== null) {
        const key = line.slice(0, eqIndex).trim();
        let value = line.slice(eqIndex + 1);

        // 去除行内注释（; 之后的内容）
        const commentIndex = value.indexOf(';');
        if (commentIndex >= 0) {
          value = value.slice(0, commentIndex);
        }

        // 去除值两端的空白
        value = value.trim();

        currentSection.AddKey(key, value);
      }
    }
  }
}
