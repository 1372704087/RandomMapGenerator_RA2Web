"""抓 RMG 运行时真值（方向偏移表 + LandType 通行表）—— unicorn 直跑真 gamemd.exe。

解决 2026-10-07 阶段 18 移植发现的两个阻塞项：

1. `g_DirectionOffsets 0x0089F688`（dword 版）与 `word_89F6B8`（word 版）
   **磁盘全 0、运行时填充**。且 `0x49F2F0` 填入 `0x89F688` 的值含重复项
   （下标 4≡2、6≡5，缺 E 与 SW），与仓里 `cell.ts` 的
   `DIRECTION_OFFSETS`（N,NE,E,SE,S,SW,W,NW）**不一致**。
   ⇒ 必须取运行时真值裁决。

2. `byte_89EA90[36 * landType]`（LandType 通行表，9 项 × 36 字节）
   同样磁盘全 0，是 `0x4838E0` 门 5 的唯一判据。

方法：直接调填表函数 `0x49F2F0`（方向表），或在跑完 map-prep 的
仿真态里 dump 两表。方向表最可靠 = **直接调用 `0x49F2F0`**，
它只写常量、不依赖地图状态。

LandType 表 `0x89EA90` 由谁填需先定位；若无法单点调用，
则从 `0x4838E0` 的实际读取路径反推（见文末 TODO）。

用法：
  py dump_runtime_tables.py
输出：
  vectors/runtime_tables.json
"""

import json
import struct
from pathlib import Path

from unicorn import UC_ARCH_X86, UC_MODE_32, Uc
from unicorn.x86_const import (
    UC_X86_REG_ECX,
    UC_X86_REG_EAX,
    UC_X86_REG_ESP,
    UC_X86_REG_FPCW,
)

GAMEMD = Path(r"F:\Red-Alert-2-Yuris-Revenge\gamemd.exe")
IMAGE_BASE = 0x00400000
IMAGE_SIZE = 0x00A00000
STACK_BASE = 0x10000000
STACK_SIZE = 0x00100000
RET_MAGIC = 0x30000000

FILL_DIRECTIONS = 0x0049F2F0  # DirectionOffsets_Filler

DIR_TBL_DWORD = 0x0089F688  # dword 版：8 项，每项 (x|y<<16)
DIR_TBL_WORD = 0x0089F6B8  # word 版：交错 (x0,y0,x1,y1,...)
LANDTYPE_TBL = 0x0089EA90  # byte[36*landType]

NATIVE_FPCW = 0x0E7F
N_DIR = 8


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


def new_uc() -> Uc:
    uc = Uc(UC_ARCH_X86, UC_MODE_32)
    load_image(uc)
    uc.mem_map(STACK_BASE, STACK_SIZE)
    uc.reg_write(UC_X86_REG_FPCW, NATIVE_FPCW)
    return uc


def call(uc: Uc, fn: int, ecx: int = 0) -> int:
    sp = STACK_BASE + STACK_SIZE - 0x1000
    uc.mem_write(sp, struct.pack("<I", RET_MAGIC))
    uc.reg_write(UC_X86_REG_ESP, sp)
    uc.reg_write(UC_X86_REG_ECX, ecx)
    uc.emu_start(fn, RET_MAGIC, count=1_000_000)
    return uc.reg_read(UC_X86_REG_EAX) & 0xFFFFFFFF


def s16(v: int) -> int:
    """dword 低/高 16 位按有符号解释。"""
    return v - 0x10000 if v & 0x8000 else v


def unpack_dword(v: int) -> tuple[int, int]:
    """原生打包：x = 低 16 位，y = 高 16 位（均有符号）。"""
    return s16(v & 0xFFFF), s16((v >> 16) & 0xFFFF)


# 原生方向名（按 cell.ts 现有约定 N,NE,E,SE,S,SW,W,NW）
DIR_NAMES = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]


def dump_direction_tables() -> dict:
    uc = new_uc()
    # 磁盘初值（应为全 0）
    before = uc.mem_read(DIR_TBL_DWORD, N_DIR * 4)
    # 调填表函数 —— 它是 __cdecl 无参（伪码里无 arg 使用）
    call(uc, FILL_DIRECTIONS)
    after_dword = bytes(uc.mem_read(DIR_TBL_DWORD, N_DIR * 4))
    after_word = bytes(uc.mem_read(DIR_TBL_WORD, N_DIR * 4))

    dword_vals = list(struct.unpack("<%dI" % N_DIR, after_dword))
    # word 版是交错 (x0,y0,x1,y1,...) —— 取 2*N_DIR 个 word
    word_vals = list(struct.unpack("<%dh" % (N_DIR * 2), after_word))

    tbl = {
        "disk_before_all_zero": all(b == 0 for b in before),
        "dword_raw": [f"0x{v:08X}" for v in dword_vals],
        "dword_decoded_xy": [list(unpack_dword(v)) for v in dword_vals],
        "word_raw": word_vals,
        "word_decoded_pairs": [
            [word_vals[2 * i], word_vals[2 * i + 1]] for i in range(N_DIR)
        ],
    }

    # 与仓里 cell.ts 的 DIRECTION_OFFSETS 比对
    repo = [(0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1)]
    tbl["repo_DIRECTION_OFFSETS"] = [list(p) for p in repo]
    match = [list(unpack_dword(v)) == list(p) for v, p in zip(dword_vals, repo)]
    tbl["per_index_match_vs_repo"] = match
    tbl["all_match"] = all(match)
    return tbl


def dump_landtype_table() -> dict:
    """LandType 通行表 0x89EA90 —— 定位填表者，未定则只报磁盘状态。"""
    uc = new_uc()
    raw = bytes(uc.mem_read(LANDTYPE_TBL, 36 * 9))
    return {
        "addr": f"0x{LANDTYPE_TBL:08X}",
        "entry_size": 36,
        "entries": 9,
        "disk_all_zero": all(b == 0 for b in raw),
        "disk_bytes": list(raw),
        "note": "运行时填充；填表者待定位（见规格 §4）。"
        "在定位前无法静态定值。",
    }


def main() -> None:
    out_dir = Path(__file__).parent / "vectors"
    out_dir.mkdir(parents=True, exist_ok=True)

    dirs = dump_direction_tables()
    print("=== 方向偏移表 g_DirectionOffsets 0x0089F688 ===")
    print(f"  磁盘初值全 0: {dirs['disk_before_all_zero']}")
    for i, (raw, (x, y)) in enumerate(
        zip(dirs["dword_raw"], dirs["dword_decoded_xy"])
    ):
        nm = DIR_NAMES[i]
        repo = dirs["repo_DIRECTION_OFFSETS"][i]
        ok = "==" if [x, y] == repo else "!="  # 与仓里现表对比
        print(f"  [{i}] {nm:<2} {raw}  -> (x={x:+d}, y={y:+d})   repo{ok}{repo}")
    print(f"  全部与 repo 一致: {dirs['all_match']}")
    print()
    print("=== word 版 0x0089F6B8（交错 x,y）===")
    for i, p in enumerate(dirs["word_decoded_pairs"]):
        print(f"  [{i}] {DIR_NAMES[i]:<2} (x={p[0]:+d}, y={p[1]:+d})")

    lt = dump_landtype_table()
    print()
    print("=== LandType 通行表 0x0089EA90 ===")
    print(f"  磁盘全 0: {lt['disk_all_zero']}  （运行时填充，填表者待定位）")

    payload = {
        "source": "unicorn 2.1.4 / gamemd.exe (YR 1.001)",
        "fpcw": hex(NATIVE_FPCW),
        "direction_tables": dirs,
        "landtype_table": lt,
    }
    out = out_dir / "runtime_tables.json"
    out.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    print(f"\nwrote {out}")


if __name__ == "__main__":
    main()
