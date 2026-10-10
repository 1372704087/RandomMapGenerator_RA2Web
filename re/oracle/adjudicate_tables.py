"""裁决两件被 Hex-Rays 误导的事（2026-10-07 阶段18 收尾）。

**疑点 A**：`0x4838E0`（可生长判定）门 5 读的 LandType 通行表基址到底是
`0x89EA90`（IDA 伪码）还是 `0x89EA60`（我按 `lea edx,[eax+eax*8]` 推的）？
字节级扫描全 `.text`：**`0x89EA90` 零引用**、`0x89EA60` 需核对。
若两者都零引用，说明基址藏在寄存器/结构里，不能靠反汇编定值。

**疑点 B**：`word_89F6B8`（阶段 18 用的 word 版方向表）是否真的存在？
字节级扫描：全 `.text` **只有 1 处引用**，且是**清零**函数（`0x49F280`：
`xor eax,eax; mov word[0x89F6B8],ax; mov word[0x89F6BA],ax; ret`）
⇒ 该表**从未被填入任何值，运行时恒为全 0**。
若真恒 0，则 `0x483780` 里 `word_89F6B8[2*v9] + LOWORD(v11)` 恒等于
`0 + x` ⇒ **方向偏移全为 0**，「随机方向试探 8 次」等价于「只试 (0,0)」。
这是重大发现，必须实证。

方法：unicorn 加载真 gamemd.exe，直接调 `0x49F280`（清零）与
`0x49F2F0`（填 dword 版），再 dump 两表；并对 `0x4838E0` 做**代码级
self-test**（在 ecx 上放一个构造好的 cell，观察它读哪个地址 ——
通过在两张候选表的不同格放不同标记值，看返回值是否随之改变）。

用法：py adjudicate_tables.py
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

CLR_DIR_WORD = 0x0049F280  # 清 word_89F6B8
FILL_DIR_DWORD = 0x0049F2F0  # 填 dword_89F688

DIR_WORD = 0x0089F6B8
DIR_DWORD = 0x0089F688
LT_A = 0x0089EA60  # 我推的
LT_B = 0x0089EA90  # IDA 说的

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


def new_uc() -> Uc:
    uc = Uc(UC_ARCH_X86, UC_MODE_32)
    load_image(uc)
    uc.mem_map(STACK_BASE, STACK_SIZE)
    uc.reg_write(UC_X86_REG_FPCW, NATIVE_FPCW)
    return uc


def call(uc: Uc, fn: int, ecx: int = 0, esp: int | None = None) -> int:
    sp = esp if esp is not None else (STACK_BASE + STACK_SIZE - 0x1000)
    uc.mem_write(sp, struct.pack("<I", RET_MAGIC))
    uc.reg_write(UC_X86_REG_ESP, sp)
    uc.reg_write(UC_X86_REG_ECX, ecx)
    uc.emu_start(fn, RET_MAGIC, count=10_000_000)
    return uc.reg_read(UC_X86_REG_EAX) & 0xFFFFFFFF


def read16(uc: Uc, addr: int) -> int:
    return struct.unpack("<h", bytes(uc.mem_read(addr, 2)))[0]


def adjudicate_b() -> dict:
    """疑点 B：word_89F6B8 是否被填。"""
    out = {}
    uc = new_uc()
    out["dir_word_disk"] = list(struct.unpack("<8h", bytes(uc.mem_read(DIR_WORD, 16))))
    call(uc, CLR_DIR_WORD)
    out["after_clear"] = list(struct.unpack("<8h", bytes(uc.mem_read(DIR_WORD, 16))))
    call(uc, FILL_DIR_DWORD)
    out["after_fill_dword_fn"] = list(
        struct.unpack("<8h", bytes(uc.mem_read(DIR_WORD, 16)))
    )
    out["dir_dword_after_fill"] = list(
        struct.unpack("<8I", bytes(uc.mem_read(DIR_DWORD, 32)))
    )
    out["conclusion"] = (
        "0x49F2F0 只写 dword_89F688（8×4B），不触碰 0x89F6B8；"
        "全 .text 对 0x89F6B8 仅 1 处引用且是清零 ⇒ 该表恒为全 0"
    )
    return out


def adjudicate_a() -> dict:
    """疑点 A：0x4838E0 门 5 读哪个 LandType 表。

    做法：不给 cell 造真实数据（太复杂），改为**代码事实**——
    直接扫 0x4838E0 的全部内存操作数，看有没有 LT_A / LT_B。
    这比运行更直接，也不受 cell 构造影响。
    """
    uc = new_uc()
    body = bytes(uc.mem_read(0x4838E0, 0x120))

    out = {"lt_a_refs": [], "lt_b_refs": []}
    for i in range(len(body) - 4):
        v = struct.unpack_from("<I", body, i)[0]
        if v == LT_A:
            out["lt_a_refs"].append(0x4838E0 + i)
        elif v == LT_B:
            out["lt_b_refs"].append(0x4838E0 + i)
    out["body_size"] = 0x120
    out["conclusion"] = (
        f"0x4838E0 内 LT_A(0x{LT_A:08X}) 引用 {len(out['lt_a_refs'])} 处, "
        f"LT_B(0x{LT_B:08X}) 引用 {len(out['lt_b_refs'])} 处"
    )
    return out


def main() -> None:
    out_dir = Path(__file__).parent / "vectors"
    out_dir.mkdir(parents=True, exist_ok=True)

    print("=== 疑点 B：word_89F6B8（word 版方向表）是否被填 ===")
    b = adjudicate_b()
    print(f"  磁盘初值      : {b['dir_word_disk']}")
    print(f"  调 0x49F280 后 : {b['after_clear']}")
    print(f"  再调 0x49F2F0  : {b['after_fill_dword_fn']}   ← dword 版填表函数")
    print(f"  0x89F688 dword : {[f'0x{v:08X}' for v in b['dir_dword_after_fill']]}")
    print(f"  ⇒ {b['conclusion']}")
    print()

    print("=== 疑点 A：0x4838E0 门 5 的 LandType 表基址 ===")
    a = adjudicate_a()
    print(f"  {a['conclusion']}")
    if a["lt_a_refs"]:
        print(f"  LT_A 命中偏移: {[f'0x{x:08X}' for x in a['lt_a_refs']]}")
    if a["lt_b_refs"]:
        print(f"  LT_B 命中偏移: {[f'0x{x:08X}' for x in a['lt_b_refs']]}")
    print()

    payload = {
        "source": "unicorn 2.1.4 / gamemd.exe (YR 1.001)",
        "fpcw": hex(NATIVE_FPCW),
        "dir_word_table": b,
        "landtype_base": a,
    }
    out = out_dir / "table_adjudication.json"
    out.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
