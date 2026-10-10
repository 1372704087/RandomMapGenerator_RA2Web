"""在 .text 里找某个 VA 的全部 call 引用（x86-32 `E8 rel32`）。

口径说明（本文件踩过的坑）：
- 节表项 `VirtualAddress` 已是**绝对 VA**（0x401000 起），不是 RVA。
- `read_va` 用的换算是 `rva = va - IMAGE_BASE`，再拿 rva 去和节表的
  `VirtualAddress` 比 —— **两者不同口径**，直接混用会全表零命中。
  正确：section 命中判断用 `va - IMAGE_BASE`（RVA）对 `VirtualAddress`，
  文件偏移用 `PointerToRawData`。
- 因此这里直接复用 `read_va` 读整段 .text，索引 i 对应 `VA = 0x401000 + i`。
"""
import struct
import sys

sys.path.insert(0, __file__.rsplit("\\", 1)[0].rsplit("/", 1)[0])
from pe_probe import get_file, read_va  # noqa: E402

TEXT_VA = 0x401000


def find_calls(target, text_va=TEXT_VA, text_len=0x3E0000):
    data, _ib, secs = get_file()
    blob = read_va(data, secs, text_va, text_len)
    hits = []
    for i in range(len(blob) - 5):
        if blob[i] == 0xE8:
            rel = struct.unpack_from("<i", blob, i + 1)[0]
            src = text_va + i
            if src + 5 + rel == target:
                hits.append(src)
    return hits


if __name__ == "__main__":
    for arg in sys.argv[1:]:
        t = int(arg, 16)
        hs = find_calls(t)
        label = " ".join(hex(h) for h in hs) if hs else "(无直接 call)"
        print(f"callers of 0x{t:08X}: {label}")
