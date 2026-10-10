# probe_img_readfn.py
# 从 exe 反推 .img 读取函数的布局逻辑
#
# 已知: exe 里 "RandMap.img" 字符串 VA=0x829ABC, push 引用点 5 处:
#   0x55358D / 0x595C60(读) / 0x5960D9(写) / 0x596214 / 0x596264
#   写入侧: 0x5960DE push "RandMap.img" -> 0x5960FC call 0x7B05C0 (文件写)
#
# 目的: 在 img 读写区找所有"立即数 = 样本头部特征值"的指令,
#       判断头字段是硬编码常量还是运行时变量。
# 样本头部特征: 1290(0x050A) 2049(0x0801) 768(0x0300) 157 79 237

import sys
sys.path.insert(0, '.')
from pe_probe import get_file, read_va
from capstone import Cs, CS_ARCH_X86, CS_MODE_32

data, ib, secs = get_file()

INTEREST = {
    1290: '1290(0x050A) magic0',
    2049: '2049(0x0801) magic1',
    768: '768(0x0300) 段头',
    157: '157(W sampleA)',
    79: '79(H sampleA)',
    237: '237(W sampleB)',
}

md = Cs(CS_ARCH_X86, CS_MODE_32)

for start, end, tag in [(0x595C00, 0x596300, 'img read/write zone'),
                        (0x553500, 0x553620, 'other ref site')]:
    body = bytes(read_va(data, secs, start, end - start))
    print('=== %s 0x%08X..0x%08X (%d B) ===' % (tag, start, end, len(body)))
    found = 0
    off = 0
    while off < len(body):
        ins = next(md.disasm(body[off:], start + off, count=1), None)
        if ins is None:
            off += 1
            continue
        ops = ins.op_str
        for val, name in INTEREST.items():
            hexes = ('0x%x' % val, '0x%X' % val)
            if any(h in ops for h in hexes) or ops.endswith(' %d' % val) or (', %d,' % val) in ops:
                print('   0x%08X  %-7s %s   <== %s' % (ins.address, ins.mnemonic, ops, name))
                found += 1
                break
        off += max(1, ins.size)
        if ins.mnemonic == 'ret':
            off += 1
    print('   hits %d\n' % found)
