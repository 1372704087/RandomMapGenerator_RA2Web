"""Machine-derived DiamondScan iterator order (serpentine anti-diagonal bands).

Emulates `MapClass cell iterator` (init 0x00578350 + next 0x00578290) from the
real gamemd.exe under unicorn against a synthetic 512x512 cell-pointer array
that is populated per the TS `NativeCells.allocate()` band formula. The emitted
visit order (slot index sequence) is the machine ground truth for the TS
iterator port; if the two disagree, the band formula/parity handling is wrong.

The iterator never dereferences the cell pointers, so each slot gets a unique
fake pointer; the captured `eax` values identify slots 1:1.

Usage:  py gen_iterator_order.py
Output: vectors/iterator_order.json  (also prints PASS/FAIL vs band formula)
"""

import json
import struct
from pathlib import Path

from unicorn import UC_ARCH_X86, UC_MODE_32, Uc
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_EAX, UC_X86_REG_ESP, UC_X86_REG_FPCW

GAMEMD = Path(r"F:\Red-Alert-2-Yuris-Revenge\gamemd.exe")
IMAGE_BASE = 0x00400000
IMAGE_SIZE = 0x00A00000
STACK_BASE = 0x10000000
STACK_SIZE = 0x00100000
RET_MAGIC = 0x30000000

INIT_FN = 0x00578350
NEXT_FN = 0x00578290
MAPCLASS = 0x0087F7E8          # stru_87F7E8
OFF_MAPW = 0x0F4               # +61 dwords
OFF_CELLS = 0x13C              # +79 dwords

CELLS_BASE = 0x20000000        # 512*512 dwords = 1 MiB
CELLCLASS_BASE = 0x22000000    # fake per-cell pointers

NATIVE_FPCW = 0x0E7F


def load_image(uc: Uc) -> None:
    data = GAMEMD.read_bytes()
    pe_off = struct.unpack_from("<I", data, 0x3C)[0]
    n_sections = struct.unpack_from("<H", data, pe_off + 6)[0]
    opt_size = struct.unpack_from("<H", data, pe_off + 20)[0]
    sec_off = pe_off + 24 + opt_size
    uc.mem_map(IMAGE_BASE, IMAGE_SIZE)
    uc.mem_write(IMAGE_BASE, data[:0x1000])
    for i in range(n_sections):
        off = sec_off + i * 40
        vaddr = struct.unpack_from("<I", data, off + 12)[0]
        rawsz = struct.unpack_from("<I", data, off + 16)[0]
        rawptr = struct.unpack_from("<I", data, off + 20)[0]
        if rawsz:
            uc.mem_write(IMAGE_BASE + vaddr, data[rawptr : rawptr + rawsz])


def band_slots(map_w: int, map_h: int) -> list[tuple[int, int]]:
    """TS `NativeCells.allocate()` 带公式：k=0..2H-2，起点 (ceil(k/2)+1, W+floor(k/2))。"""
    out = []
    for k in range(0, 2 * map_h - 1):
        sx = (k + 1) // 2 + 1
        sy = map_w + k // 2
        ln = map_w if k % 2 == 0 else map_w - 1
        for i in range(ln):
            out.append((sx + i, sy - i))
    return out


def run(map_w: int, map_h: int) -> list[int]:
    uc = Uc(UC_ARCH_X86, UC_MODE_32)
    load_image(uc)
    uc.mem_map(STACK_BASE, STACK_SIZE)
    uc.mem_map(CELLS_BASE, 0x100000)
    uc.mem_map(CELLCLASS_BASE & 0xFFFF0000, 0x100000)
    uc.reg_write(UC_X86_REG_FPCW, NATIVE_FPCW)

    slots = band_slots(map_w, map_h)
    arr = [0] * (512 * 512)
    fake_ptrs = []
    for idx, (x, y) in enumerate(slots):
        ptr = CELLCLASS_BASE + idx * 0x200
        arr[y * 512 + x] = ptr
        fake_ptrs.append(ptr)
    uc.mem_write(CELLS_BASE, struct.pack("<%dI" % len(arr), *arr))

    uc.mem_write(MAPCLASS + OFF_MAPW, struct.pack("<I", map_w))
    uc.mem_write(MAPCLASS + OFF_CELLS, struct.pack("<I", CELLS_BASE))
    # 清迭代器状态（+0x10C..+0x118）
    uc.mem_write(MAPCLASS + 0x10C, b"\x00" * 16)

    def call(fn: int) -> int:
        sp = STACK_BASE + STACK_SIZE - 0x1000
        uc.mem_write(sp, struct.pack("<I", RET_MAGIC))
        uc.reg_write(UC_X86_REG_ESP, sp)
        uc.reg_write(UC_X86_REG_ECX, MAPCLASS)
        uc.emu_start(fn, RET_MAGIC, count=1_000_000)
        return uc.reg_read(UC_X86_REG_EAX) & 0xFFFFFFFF

    call(INIT_FN)
    order = []
    for _ in range(len(slots) + 50):
        eax = call(NEXT_FN)
        if eax == 0:
            break
        order.append(eax)

    ptr_to_idx = {p: i for i, p in enumerate(fake_ptrs)}
    unknown = [p for p in order if p not in ptr_to_idx]
    if unknown:
        raise SystemExit(f"迭代器返回了未知指针 {unknown[:3]:#x} —— 布点遗漏")
    return [ptr_to_idx[p] for p in order]


def main() -> None:
    results = {}
    for (w, h) in [(12, 16), (8, 8), (20, 24), (124, 132)]:
        order = run(w, h)
        slots = band_slots(w, h)
        n_slots = len(slots)
        status = "OK " if order == list(range(n_slots)) else "FAIL"
        print(
            f"mapW={w:>3} mapH={h:>3}: visited={len(order):>6} allocated={n_slots:>6} "
            f"in-band-order={status}"
        )
        if order != list(range(n_slots)):
            first_bad = next(
                (i for i, (a, b) in enumerate(zip(order, range(n_slots))) if a != b),
                min(len(order), n_slots),
            )
            xs, ys = slots[order[first_bad]]
            print(f"  first divergence at visit #{first_bad}: slot {xs},{ys}")
            raise SystemExit(1)
        results[f"{w}x{h}"] = {"mapW": w, "mapH": h, "visited": len(order)}

    out = Path(__file__).parent / "vectors" / "iterator_order.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(
            {
                "source": "unicorn/gamemd.exe 0x00578350+0x00578290",
                "fpcw": hex(NATIVE_FPCW),
                "note": "蛇形反对角带访问序 = 布点带公式顺序（逐格验证 4 组尺寸）",
                "cases": results,
            },
            indent=2,
        )
    )
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
