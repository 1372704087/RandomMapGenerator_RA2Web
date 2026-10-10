"""独立 PE32 定点探针 —— 不依赖 IDA / Ghidra，直接读 gamemd.exe 字节并 capstone 反汇编。

用途：为 ra2-web-mapgen 的 RMG 阶段 18 补齐 sub_7228B0 / sub_7233A0 的规格
（IDA 不可用时的替代路径）。

目标：F:/RA2YRLauncher/gamemd.exe（YR 1.001，ImageBase=0x400000）

用法：
  python pe_probe.py bytes   0x007228B0 96
  python pe_probe.py dis     0x007228B0 0x120
  python pe_probe.py calls   0x00598960 0xBC8     # 只列 call 目标，便于看阶段顺序
  python pe_probe.py u32     0x0089F688 4
"""
import struct
import sys

EXE = r"F:/RA2YRLauncher/gamemd.exe"
IMAGE_BASE = 0x400000


def load_sections(data):
    e_lfanew = struct.unpack_from("<I", data, 0x3C)[0]
    coff = e_lfanew + 4
    num_sections = struct.unpack_from("<H", data, coff + 2)[0]
    opt_size = struct.unpack_from("<H", data, coff + 16)[0]
    opt = coff + 20
    image_base = struct.unpack_from("<I", data, opt + 28)[0]
    sec = opt + opt_size
    sections = []
    for i in range(num_sections):
        off = sec + 40 * i
        name = data[off : off + 8].rstrip(b"\0").decode("latin1")
        # 节表项布局（PE32）：+8 VirtualSize, +12 VirtualAddress,
        #                     +16 SizeOfRawData, +20 PointerToRawData
        vsize, va_, raw_size, raw_ptr = struct.unpack_from("<IIII", data, off + 8)
        sections.append((name, va_, vsize, raw_ptr, raw_size))
    return image_base, sections


_cache = {}


def read_va(data, sections, va, size):
    """读 VA 起的 size 字节（跨节自动拼接）。"""
    rva = va - IMAGE_BASE
    out = b""
    remaining = size
    cur = rva
    while remaining > 0:
        sec = None
        for name, sva, vsize, raw_ptr, raw_size in sections:
            if sva <= cur < sva + max(vsize, raw_size):
                sec = (name, sva, vsize, raw_ptr, raw_size)
                break
        if sec is None:
            out += b"\x00" * remaining
            break
        name, sva, vsize, raw_ptr, raw_size = sec
        delta = cur - sva
        avail = raw_size - delta
        take = min(remaining, avail)
        if take <= 0:
            out += b"\x00" * remaining
            break
        out += data[raw_ptr + delta : raw_ptr + delta + take]
        cur += take
        remaining -= take
    return out


def get_file(path=EXE):
    if path not in _cache:
        with open(path, "rb") as f:
            data = f.read()
        image_base, sections = load_sections(data)
        _cache[path] = (data, image_base, sections)
    return _cache[path]


def main(argv):
    if len(argv) < 3:
        print(__doc__)
        return 1
    cmd = argv[1]
    va = int(argv[2], 16)
    arg = argv[3] if len(argv) > 3 else "64"
    data, _image_base, sections = get_file()

    if cmd == "bytes":
        n = int(arg, 0)
        b = read_va(data, sections, va, n)
        for i in range(0, len(b), 16):
            chunk = b[i : i + 16]
            hexs = " ".join(f"{x:02X}" for x in chunk)
            print(f"{va + i:08X}  {hexs}")
    elif cmd == "dis":
        import capstone

        n = int(arg, 0)
        code = read_va(data, sections, va, n)
        md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
        md.detail = False
        for ins in md.disasm(code, va):
            print(f"{ins.address:08X}  {ins.mnemonic:<8} {ins.op_str}")
    elif cmd == "calls":
        import capstone

        n = int(arg, 0)
        code = read_va(data, sections, va, n)
        md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
        for ins in md.disasm(code, va):
            if ins.mnemonic == "call":
                print(f"{ins.address:08X}  call  {ins.op_str}")
    elif cmd == "f64":
        n = int(arg, 0)
        b = read_va(data, sections, va, 8 * n)
        for i in range(n):
            v = struct.unpack_from("<d", b, 8 * i)[0]
            print(f"{va + 8 * i:08X}  f64  {v!r}  (bits 0x{v.hex()})")
    elif cmd == "u32":
        n = int(arg, 0)
        b = read_va(data, sections, va, 4 * n)
        for i in range(n):
            v = struct.unpack_from("<I", b, 4 * i)[0]
            print(f"{va + 4 * i:08X}  u32  {v}  (0x{v:08X})")
    else:
        print(__doc__)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
