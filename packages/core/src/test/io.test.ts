/**
 * IO 层测试
 *
 * 使用 Node.js 内置测试运行器 (node:test)。
 * 测试覆盖：
 * - INI 读写循环
 * - MoveSectionToFirst
 * - INI 大小写不敏感查找
 * - INI 注释处理
 * - MemoryFile 各种读取方法
 * - 端序正确性（小端序）
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IniFile, IniSection, MemoryFile } from '../io/index';

// ═══════════════════════════════════════════════════════════
//  INI 文件测试
// ═══════════════════════════════════════════════════════════

describe('IniFile - 基本读写', () => {
  it('空构造创建空文件', () => {
    const ini = new IniFile();
    assert.deepEqual(ini.GetSections(), []);
    assert.equal(ini.WriteIniFile(), '');
  });

  it('从字符串构造并读取段落和键值', () => {
    const content = [
      '[Basic]',
      'Name=Test Map',
      'MaxPlayer=2',
      '',
      '[Map]',
      'Size=0,0,50,40',
      'Theater=TEMPERATE',
    ].join('\n');

    const ini = new IniFile(content);

    assert.equal(ini.SectionExists('Basic'), true);
    assert.equal(ini.SectionExists('NonExistent'), false);

    assert.equal(ini.GetStringValue('Basic', 'Name', ''), 'Test Map');
    assert.equal(ini.GetStringValue('Map', 'Size', ''), '0,0,50,40');
    assert.equal(ini.GetStringValue('Map', 'Theater', ''), 'TEMPERATE');

    // 不存在的键返回默认值
    assert.equal(ini.GetStringValue('Basic', 'NotFound', 'default'), 'default');
    // 不存在的段落返回默认值
    assert.equal(ini.GetStringValue('NoSection', 'key', 'fallback'), 'fallback');
  });

  it('GetIntValue 正确解析整数', () => {
    const ini = new IniFile('[Settings]\nWidth=100\nHeight=200');
    assert.equal(ini.GetIntValue('Settings', 'Width', 0), 100);
    assert.equal(ini.GetIntValue('Settings', 'Height', 0), 200);
    assert.equal(ini.GetIntValue('Settings', 'Missing', 42), 42);
  });

  it('KeyExists 检查键是否存在', () => {
    const ini = new IniFile('[Section]\nKey1=value1');
    assert.equal(ini.KeyExists('Section', 'Key1'), true);
    assert.equal(ini.KeyExists('Section', 'key1'), true); // 大小写不敏感
    assert.equal(ini.KeyExists('Section', 'Key2'), false);
    assert.equal(ini.KeyExists('NoSection', 'Key1'), false);
  });
});

describe('IniFile - 读写循环', () => {
  it('写入后重新加载验证数据一致', () => {
    const ini = new IniFile();

    // 模拟 RA2 地图文件结构
    ini.SetStringValue('Basic', 'Name', 'Test Random Map');
    ini.SetStringValue('Basic', 'GameMode', 'standard');
    ini.SetStringValue('Basic', 'MaxPlayer', '4');

    ini.SetStringValue('Map', 'Size', '0,0,80,60');
    ini.SetStringValue('Map', 'LocalSize', '2,5,76,52');
    ini.SetStringValue('Map', 'Theater', 'TEMPERATE');

    // 序列化
    const output = ini.WriteIniFile();

    // 重新加载
    const reloaded = new IniFile(output);

    assert.equal(reloaded.GetStringValue('Basic', 'Name', ''), 'Test Random Map');
    assert.equal(reloaded.GetStringValue('Basic', 'GameMode', ''), 'standard');
    assert.equal(reloaded.GetStringValue('Basic', 'MaxPlayer', ''), '4');
    assert.equal(reloaded.GetStringValue('Map', 'Size', ''), '0,0,80,60');
    assert.equal(reloaded.GetStringValue('Map', 'LocalSize', ''), '2,5,76,52');
    assert.equal(reloaded.GetStringValue('Map', 'Theater', ''), 'TEMPERATE');
  });

  it('Base64 数据读写循环（模拟 IsoMapPack5）', () => {
    const ini = new IniFile();

    // 模拟分行的 Base64 数据
    const longBase64 = 'ww0AIA4UAAEA//8AAAAAABMAAgD//0MBAAAUKCkAFSgrABIAA+EEEygpABQoKQAVKCkAFi';
    const section = ini.AddSection('IsoMapPack5');
    section.SetStringValue('1', longBase64.slice(0, 70));
    section.SetStringValue('2', longBase64.slice(70));

    const output = ini.WriteIniFile();
    const reloaded = new IniFile(output);

    const reloadedSection = reloaded.GetSection('IsoMapPack5');
    assert.notEqual(reloadedSection, null);
    if (reloadedSection) {
      assert.equal(reloadedSection.GetStringValue('1', ''), longBase64.slice(0, 70));
      assert.equal(reloadedSection.GetStringValue('2', ''), longBase64.slice(70));
    }
  });

  it('SetStringValue 自动创建段落', () => {
    const ini = new IniFile();
    ini.SetStringValue('NewSection', 'Key', 'Value');

    assert.equal(ini.SectionExists('NewSection'), true);
    assert.equal(ini.GetStringValue('NewSection', 'Key', ''), 'Value');
  });

  it('更新已有键的值', () => {
    const ini = new IniFile('[Section]\nKey=old');
    ini.SetStringValue('Section', 'Key', 'new');

    assert.equal(ini.GetStringValue('Section', 'Key', ''), 'new');

    // 重新加载验证
    const reloaded = new IniFile(ini.WriteIniFile());
    assert.equal(reloaded.GetStringValue('Section', 'Key', ''), 'new');
  });
});

describe('IniFile - 段落顺序与 MoveSectionToFirst', () => {
  it('保留段落插入顺序', () => {
    const content = [
      '[Header]',
      '[Basic]',
      '[Map]',
      '[IsoMapPack5]',
      '[Preview]',
    ].join('\n');

    const ini = new IniFile(content);
    assert.deepEqual(ini.GetSections(), [
      'Header',
      'Basic',
      'Map',
      'IsoMapPack5',
      'Preview',
    ]);
  });

  it('MoveSectionToFirst 将段落移到最前', () => {
    const content = [
      '[Header]',
      '[Basic]',
      '[Map]',
      '[Preview]',
      '[PreviewPack]',
    ].join('\n');

    const ini = new IniFile(content);

    // 模拟 InjectThumb 中的调用顺序
    ini.MoveSectionToFirst('PreviewPack');
    ini.MoveSectionToFirst('Preview');
    ini.MoveSectionToFirst('Header');

    const sections = ini.GetSections();
    assert.deepEqual(sections, [
      'Header',
      'Preview',
      'PreviewPack',
      'Basic',
      'Map',
    ]);
  });

  it('MoveSectionToFirst 不影响段落内容', () => {
    const ini = new IniFile('[A]\nKeyA=1\n[B]\nKeyB=2');
    ini.MoveSectionToFirst('B');

    assert.equal(ini.GetStringValue('B', 'KeyB', ''), '2');
    assert.equal(ini.GetStringValue('A', 'KeyA', ''), '1');
  });

  it('MoveSectionToFirst 对不存在的段落无副作用', () => {
    const ini = new IniFile('[A]\n[B]');
    ini.MoveSectionToFirst('NonExistent');
    assert.deepEqual(ini.GetSections(), ['A', 'B']);
  });

  it('MoveSectionToFirst 对已在首位的段落无副作用', () => {
    const ini = new IniFile('[A]\n[B]\n[C]');
    ini.MoveSectionToFirst('A');
    assert.deepEqual(ini.GetSections(), ['A', 'B', 'C']);
  });
});

describe('IniFile - AddSection / RemoveSection', () => {
  it('AddSection(name) 创建新段落并返回', () => {
    const ini = new IniFile();
    const section = ini.AddSection('TestSection');

    assert.notEqual(section, null);
    assert.equal(section.SectionName, 'TestSection');
    assert.equal(ini.SectionExists('TestSection'), true);
  });

  it('AddSection(name) 对已存在段落返回已有实例', () => {
    const ini = new IniFile('[Existing]\nKey=value');
    const section = ini.AddSection('Existing');

    // 不应清空已有内容
    assert.equal(section.GetStringValue('Key', ''), 'value');
  });

  it('AddSection(IniSection) 添加整个段落对象', () => {
    const ini = new IniFile();

    const unitSection = new IniSection('Units');
    unitSection.AddKey('0', 'GDI,100,200,0');
    unitSection.AddKey('1', 'NOD,300,400,0');

    ini.AddSection(unitSection);

    assert.equal(ini.SectionExists('Units'), true);
    assert.equal(ini.GetStringValue('Units', '0', ''), 'GDI,100,200,0');
    assert.equal(ini.GetStringValue('Units', '1', ''), 'NOD,300,400,0');
  });

  it('AddSection(IniSection) 替换同名段落保留位置', () => {
    const ini = new IniFile('[A]\nKeyA=old\n[B]\nKeyB=old');
    // 段落顺序: A, B

    const newSection = new IniSection('A');
    newSection.AddKey('KeyA', 'NewValue');

    ini.AddSection(newSection);

    // A 仍在第一个位置
    assert.deepEqual(ini.GetSections(), ['A', 'B']);
    // 内容被替换
    assert.equal(ini.GetStringValue('A', 'KeyA', ''), 'NewValue');
  });

  it('RemoveSection 移除段落', () => {
    const ini = new IniFile('[A]\n[B]\n[C]');
    assert.equal(ini.RemoveSection('B'), true);
    assert.deepEqual(ini.GetSections(), ['A', 'C']);
  });

  it('RemoveSection 不存在的段落返回 false', () => {
    const ini = new IniFile('[A]');
    assert.equal(ini.RemoveSection('NonExistent'), false);
    assert.deepEqual(ini.GetSections(), ['A']);
  });
});

describe('IniFile - 大小写不敏感', () => {
  it('段落名查找大小写不敏感', () => {
    const ini = new IniFile('[Basic]\nName=test');
    assert.equal(ini.GetSection('basic') !== null, true);
    assert.equal(ini.GetSection('BASIC') !== null, true);
    assert.equal(ini.GetSection('Basic') !== null, true);
  });

  it('键名查找大小写不敏感', () => {
    const ini = new IniFile('[Section]\nMyKey=value');
    assert.equal(ini.GetStringValue('Section', 'mykey', ''), 'value');
    assert.equal(ini.GetStringValue('Section', 'MYKEY', ''), 'value');
    assert.equal(ini.GetStringValue('Section', 'MyKey', ''), 'value');
  });

  it('输出保留原始大小写', () => {
    const ini = new IniFile();
    ini.SetStringValue('MySection', 'MyKey', 'value');
    const output = ini.WriteIniFile();

    assert.ok(output.includes('[MySection]'));
    assert.ok(output.includes('MyKey=value'));
  });
});

describe('IniFile - 注释处理', () => {
  it('跳过行注释（; 开头）', () => {
    const content = [
      '; This is a comment',
      '; Another comment',
      '[Section]',
      'Key=value',
      '; Inline section comment',
    ].join('\n');

    const ini = new IniFile(content);
    assert.equal(ini.GetStringValue('Section', 'Key', ''), 'value');
  });

  it('去除行内注释（值后的 ; 注释）', () => {
    const content = '[Section]\nKey=value;this is a comment';
    const ini = new IniFile(content);
    assert.equal(ini.GetStringValue('Section', 'Key', ''), 'value');
  });

  it('行内注释不影响 Base64 值（不含分号）', () => {
    const content = '[Pack]\n1=abcDEF123+/=';
    const ini = new IniFile(content);
    assert.equal(ini.GetStringValue('Pack', '1', ''), 'abcDEF123+/=');
  });

  it('Comment 属性写入文件头注释', () => {
    const ini = new IniFile();
    ini.SetStringValue('Section', 'Key', 'value');
    ini.comment = 'Generated by RA2 Map Generator';
    const output = ini.WriteIniFile();

    assert.ok(output.startsWith('; Generated by RA2 Map Generator'));
    assert.ok(output.includes('[Section]'));
    assert.ok(output.includes('Key=value'));
  });

  it('Comment 多行写入', () => {
    const ini = new IniFile();
    ini.comment = 'Line1\nLine2\n; Already a comment';
    const output = ini.WriteIniFile();

    assert.ok(output.includes('; Line1'));
    assert.ok(output.includes('; Line2'));
    assert.ok(output.includes('; Already a comment'));
  });
});

describe('IniFile - 从 Uint8Array 构造', () => {
  it('从 Uint8Array 构造（UTF-8 编码）', () => {
    const content = '[Section]\nKey=value';
    const bytes = new TextEncoder().encode(content);

    const ini = new IniFile(bytes);
    assert.equal(ini.GetStringValue('Section', 'Key', ''), 'value');
  });

  it('处理 UTF-8 BOM', () => {
    const content = '\uFEFF[Section]\nKey=value';
    const bytes = new TextEncoder().encode(content);

    const ini = new IniFile(bytes);
    assert.equal(ini.SectionExists('Section'), true);
    assert.equal(ini.GetStringValue('Section', 'Key', ''), 'value');
  });

  it('从字符串构造也处理 BOM', () => {
    const content = '\uFEFF[Section]\nKey=value';
    const ini = new IniFile(content);
    assert.equal(ini.SectionExists('Section'), true);
    assert.equal(ini.GetStringValue('Section', 'Key', ''), 'value');
  });
});

describe('IniFile - 键值对顺序', () => {
  it('保留段落内键值对插入顺序', () => {
    const content = [
      '[Section]',
      'Zebra=3',
      'Apple=1',
      'Mango=2',
    ].join('\n');

    const ini = new IniFile(content);
    const section = ini.GetSection('Section');
    assert.notEqual(section, null);
    if (section) {
      assert.deepEqual(section.Keys, ['Zebra', 'Apple', 'Mango']);
    }
  });

  it('写入后键顺序不变', () => {
    const ini = new IniFile();
    ini.SetStringValue('S', 'C', '3');
    ini.SetStringValue('S', 'A', '1');
    ini.SetStringValue('S', 'B', '2');

    const output = ini.WriteIniFile();
    const reloaded = new IniFile(output);
    const section = reloaded.GetSection('S');
    assert.notEqual(section, null);
    if (section) {
      assert.deepEqual(section.Keys, ['C', 'A', 'B']);
    }
  });
});

describe('IniSection - 独立测试', () => {
  it('AddKey 和 GetStringValue', () => {
    const section = new IniSection('Test');
    section.AddKey('Key1', 'Value1');
    section.AddKey('Key2', 'Value2');

    assert.equal(section.GetStringValue('Key1', ''), 'Value1');
    assert.equal(section.GetStringValue('Key2', ''), 'Value2');
    assert.equal(section.GetStringValue('Key3', 'default'), 'default');
  });

  it('AddKey 覆盖已存在的键', () => {
    const section = new IniSection('Test');
    section.AddKey('Key', 'old');
    section.AddKey('Key', 'new');
    assert.equal(section.GetStringValue('Key', ''), 'new');
  });

  it('Keys 属性返回所有键名', () => {
    const section = new IniSection('Test');
    section.AddKey('A', '1');
    section.AddKey('B', '2');
    section.AddKey('C', '3');
    assert.deepEqual(section.Keys, ['A', 'B', 'C']);
  });

  it('GetIntValue 解析整数', () => {
    const section = new IniSection('Test');
    section.AddKey('Num', '42');
    assert.equal(section.GetIntValue('Num', 0), 42);
    assert.equal(section.GetIntValue('Missing', 99), 99);
  });

  it('RemoveKey 移除键', () => {
    const section = new IniSection('Test');
    section.AddKey('A', '1');
    section.AddKey('B', '2');
    section.AddKey('C', '3');

    assert.equal(section.RemoveKey('B'), true);
    assert.equal(section.KeyExists('B'), false);
    assert.deepEqual(section.Keys, ['A', 'C']);
    assert.equal(section.RemoveKey('NonExistent'), false);
  });
});

// ═══════════════════════════════════════════════════════════
//  MemoryFile 测试
// ═══════════════════════════════════════════════════════════

describe('MemoryFile - 属性', () => {
  it('Length 和 Position', () => {
    const buf = new Uint8Array([1, 2, 3, 4, 5]);
    const mf = new MemoryFile(buf);

    assert.equal(mf.Length, 5);
    assert.equal(mf.Position, 0);
    assert.equal(mf.Remaining, 5);
    assert.equal(mf.Eof, false);
  });

  it('Position 可设置', () => {
    const buf = new Uint8Array([1, 2, 3, 4, 5]);
    const mf = new MemoryFile(buf);

    mf.Position = 3;
    assert.equal(mf.Position, 3);
    assert.equal(mf.Remaining, 2);
  });

  it('Eof 在末尾时为 true', () => {
    const buf = new Uint8Array([1, 2]);
    const mf = new MemoryFile(buf);

    mf.Read(2);
    assert.equal(mf.Eof, true);
    assert.equal(mf.Remaining, 0);
  });
});

describe('MemoryFile - ReadByte / ReadUInt8 / ReadSByte', () => {
  it('ReadByte 读取无符号字节 (0~255)', () => {
    const buf = new Uint8Array([0x00, 0x7f, 0x80, 0xff]);
    const mf = new MemoryFile(buf);

    assert.equal(mf.ReadByte(), 0x00);
    assert.equal(mf.ReadByte(), 0x7f);
    assert.equal(mf.ReadByte(), 0x80);
    assert.equal(mf.ReadByte(), 0xff);
  });

  it('ReadUInt8 等同于 ReadByte', () => {
    const buf = new Uint8Array([0x42]);
    const mf = new MemoryFile(buf);
    assert.equal(mf.ReadUInt8(), 0x42);
  });

  it('ReadSByte 读取有符号字节 (-128~127)', () => {
    const buf = new Uint8Array([0x00, 0x7f, 0x80, 0xff]);
    const mf = new MemoryFile(buf);

    assert.equal(mf.ReadSByte(), 0);
    assert.equal(mf.ReadSByte(), 127);
    assert.equal(mf.ReadSByte(), -128); // 0x80
    assert.equal(mf.ReadSByte(), -1);   // 0xff
  });
});

describe('MemoryFile - ReadInt16 / ReadUInt16（小端序）', () => {
  it('ReadUInt16 读取无符号 16 位整数（小端序）', () => {
    // 小端序: 低字节在前
    // 0x0100 = 256, 0xFFFF = 65535, 0x3412 = 13330
    const buf = new Uint8Array([0x00, 0x01, 0xFF, 0xFF, 0x12, 0x34]);
    const mf = new MemoryFile(buf);

    assert.equal(mf.ReadUInt16(), 0x0100); // 256
    assert.equal(mf.ReadUInt16(), 0xffff); // 65535
    assert.equal(mf.ReadUInt16(), 0x3412); // 13330
  });

  it('ReadInt16 读取有符号 16 位整数（小端序）', () => {
    // 小端序: 低字节在前
    // 0x0100 = 256, 0xFFFF = -1, 0x0080 = -32768
    const buf = new Uint8Array([0x00, 0x01, 0xFF, 0xFF, 0x00, 0x80]);
    const mf = new MemoryFile(buf);

    assert.equal(mf.ReadInt16(), 256);
    assert.equal(mf.ReadInt16(), -1);
    assert.equal(mf.ReadInt16(), -32768);
  });

  it('ReadUInt16 边界值', () => {
    // 0x0000 = 0, 0xFFFF = 65535
    const buf = new Uint8Array([0x00, 0x00, 0xFF, 0xFF]);
    const mf = new MemoryFile(buf);

    assert.equal(mf.ReadUInt16(), 0);
    assert.equal(mf.ReadUInt16(), 65535);
  });
});

describe('MemoryFile - ReadInt32 / ReadUInt32（小端序）', () => {
  it('ReadUInt32 读取无符号 32 位整数（小端序）', () => {
    // 小端序: 最低字节在前
    // 0x78563412 = 2018915346
    const buf = new Uint8Array([0x12, 0x34, 0x56, 0x78]);
    const mf = new MemoryFile(buf);
    assert.equal(mf.ReadUInt32(), 0x78563412);
  });

  it('ReadUInt32 最大值', () => {
    // 0xFFFFFFFF = 4294967295
    const buf = new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]);
    const mf = new MemoryFile(buf);
    assert.equal(mf.ReadUInt32(), 4294967295);
  });

  it('ReadInt32 读取有符号 32 位整数（小端序）', () => {
    // 0x78563412 = 2018915346 (正数)
    const buf1 = new Uint8Array([0x12, 0x34, 0x56, 0x78]);
    const mf1 = new MemoryFile(buf1);
    assert.equal(mf1.ReadInt32(), 0x78563412);

    // 0xFFFFFFFF = -1
    const buf2 = new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]);
    const mf2 = new MemoryFile(buf2);
    assert.equal(mf2.ReadInt32(), -1);

    // 0x00000080 = 128
    const buf3 = new Uint8Array([0x80, 0x00, 0x00, 0x00]);
    const mf3 = new MemoryFile(buf3);
    assert.equal(mf3.ReadInt32(), 128);
  });

  it('ReadInt32 最小值', () => {
    // 0x80000000 = -2147483648
    const buf = new Uint8Array([0x00, 0x00, 0x00, 0x80]);
    const mf = new MemoryFile(buf);
    assert.equal(mf.ReadInt32(), -2147483648);
  });
});

describe('MemoryFile - ReadFloat（小端序 IEEE 754）', () => {
  it('ReadFloat 读取 1.0', () => {
    // IEEE 754 小端序: 1.0 = 0x3F800000 -> 字节 [0x00, 0x00, 0x80, 0x3F]
    const buf = new Uint8Array([0x00, 0x00, 0x80, 0x3f]);
    const mf = new MemoryFile(buf);
    assert.equal(mf.ReadFloat(), 1.0);
  });

  it('ReadFloat 读取 0.5', () => {
    // 0.5 = 0x3F000000 -> [0x00, 0x00, 0x00, 0x3F]
    const buf = new Uint8Array([0x00, 0x00, 0x00, 0x3f]);
    const mf = new MemoryFile(buf);
    assert.equal(mf.ReadFloat(), 0.5);
  });

  it('ReadFloat 读取 -1.0', () => {
    // -1.0 = 0xBF800000 -> [0x00, 0x00, 0x80, 0xBF]
    const buf = new Uint8Array([0x00, 0x00, 0x80, 0xbf]);
    const mf = new MemoryFile(buf);
    assert.equal(mf.ReadFloat(), -1.0);
  });

  it('ReadFloat 读取 0.0', () => {
    const buf = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    const mf = new MemoryFile(buf);
    assert.equal(mf.ReadFloat(), 0.0);
  });

  it('ReadFloat 读取 PI 近似值', () => {
    // 3.14159265... ≈ 0x40490FDB -> [0xDB, 0x0F, 0x49, 0x40]
    const buf = new Uint8Array([0xdb, 0x0f, 0x49, 0x40]);
    const mf = new MemoryFile(buf);
    assert.ok(Math.abs(mf.ReadFloat() - 3.14159265) < 0.0001);
  });
});

describe('MemoryFile - Read(count)', () => {
  it('读取指定数量的字节', () => {
    const buf = new Uint8Array([1, 2, 3, 4, 5]);
    const mf = new MemoryFile(buf);

    const result = mf.Read(3);
    assert.equal(result.length, 3);
    assert.equal(result[0], 1);
    assert.equal(result[1], 2);
    assert.equal(result[2], 3);
    assert.equal(mf.Position, 3);
  });

  it('读取全部字节', () => {
    const buf = new Uint8Array([10, 20, 30]);
    const mf = new MemoryFile(buf);

    const result = mf.Read(3);
    assert.deepEqual(Array.from(result), [10, 20, 30]);
    assert.equal(mf.Eof, true);
  });

  it('剩余不足时返回 0 填充（匹配 C# 行为）', () => {
    const buf = new Uint8Array([1, 2]);
    const mf = new MemoryFile(buf);

    const result = mf.Read(5);
    assert.equal(result.length, 5);
    assert.equal(result[0], 1);
    assert.equal(result[1], 2);
    assert.equal(result[2], 0);
    assert.equal(result[3], 0);
    assert.equal(result[4], 0);
    assert.equal(mf.Eof, true);
  });
});

describe('MemoryFile - ReadCString', () => {
  it('读取 C 风格字符串（遇到 \\0 终止）', () => {
    // "Hello" + \0 + padding
    const buf = new Uint8Array([
      0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x00, 0x00,
    ]);
    const mf = new MemoryFile(buf);

    assert.equal(mf.ReadCString(8), 'Hello');
    assert.equal(mf.Position, 8);
  });

  it('没有 \\0 时读取全部 count 字节', () => {
    const buf = new Uint8Array([0x41, 0x42, 0x43]); // "ABC"
    const mf = new MemoryFile(buf);

    assert.equal(mf.ReadCString(3), 'ABC');
  });

  it('空字符串（首字节为 \\0）', () => {
    const buf = new Uint8Array([0x00, 0x41, 0x42]);
    const mf = new MemoryFile(buf);

    assert.equal(mf.ReadCString(3), '');
    assert.equal(mf.Position, 3);
  });
});

describe('MemoryFile - 连续读取（模拟 IsoMapPack5 解析）', () => {
  it('按 IsoTile 结构连续读取', () => {
    // IsoTile 结构: rx(UInt16) + ry(UInt16) + tilenum(Int16)
    //              + zero1(Int16) + subtile(UInt8) + z(UInt8) + zero2(UInt8)
    // 共 11 字节
    const buf = new Uint8Array([
      // rx = 0x0001 (小端: 01 00)
      0x01, 0x00,
      // ry = 0x0002
      0x02, 0x00,
      // tilenum = 0x0003
      0x03, 0x00,
      // zero1 = 0
      0x00, 0x00,
      // subtile = 0x04
      0x04,
      // z = 0x05
      0x05,
      // zero2 = 0
      0x00,
    ]);

    const mf = new MemoryFile(buf);

    assert.equal(mf.ReadUInt16(), 1);   // rx
    assert.equal(mf.ReadUInt16(), 2);   // ry
    assert.equal(mf.ReadInt16(), 3);    // tilenum
    assert.equal(mf.ReadInt16(), 0);    // zero1
    assert.equal(mf.ReadByte(), 4);     // subtile
    assert.equal(mf.ReadByte(), 5);     // z
    assert.equal(mf.ReadByte(), 0);     // zero2
    assert.equal(mf.Eof, true);
  });

  it('混合读取多种类型', () => {
    const buf = new Uint8Array([
      0xFF,                          // byte: 255
      0x80,                          // sbyte: -128
      0x34, 0x12,                    // uint16: 0x1234 = 4660
      0x78, 0x56,                    // int16: 0x5678 = 22136
      0x78, 0x56, 0x34, 0x12,        // uint32: 0x12345678
    ]);
    const mf = new MemoryFile(buf);

    assert.equal(mf.ReadByte(), 255);
    assert.equal(mf.ReadSByte(), -128);
    assert.equal(mf.ReadUInt16(), 0x1234);
    assert.equal(mf.ReadInt16(), 0x5678);
    assert.equal(mf.ReadUInt32(), 0x12345678);
  });

  it('Position 重置后可重新读取', () => {
    const buf = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    const mf = new MemoryFile(buf);

    assert.equal(mf.ReadUInt16(), 0x0201);
    mf.Position = 0;
    assert.equal(mf.ReadUInt16(), 0x0201);
  });
});

describe('MemoryFile - subarray 视图支持', () => {
  it('从 Uint8Array 子视图构造', () => {
    const full = new Uint8Array([0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00]);
    // 取中间 2 字节
    const view = full.subarray(2, 4);
    const mf = new MemoryFile(view);

    assert.equal(mf.Length, 2);
    assert.equal(mf.ReadUInt16(), 0xFFFF);
  });
});
