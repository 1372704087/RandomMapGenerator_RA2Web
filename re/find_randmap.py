import sys
sys.path.insert(0, '.')
from pe_probe import get_file, read_va

data, ib, secs = get_file()
blob = data

TARGETS = [b'RandMap', b'.img', b'.IMG', b'.map', b'.SED', b'.sed', b'RandMap.img']
for s in TARGETS:
    idx = -1
    hits = []
    while True:
        idx = blob.find(s, idx + 1)
        if idx < 0:
            break
        # 记录 VA 与上下文
        va = 0x400000 + idx
        ctx = blob[max(0, idx - 24): idx + len(s) + 24]
        txt = ''.join(chr(x) if 32 <= x < 127 else '.' for x in ctx)
        hits.append((va, txt))
        if len(hits) >= 6:
            break
    print('=== %r : %d 处 ===' % (s.decode('latin1'), len(hits)))
    for va, txt in hits:
        print('   0x%08X  ...%s...' % (va, txt))
    print()
