# IDA round 6: region infrastructure + hills RNG upstream + start-point helpers
import os
import ida_auto
import ida_funcs
import ida_hexrays
import idc

OUT = r"G:\ra2-web-mapgen\re\decomp"
os.makedirs(OUT, exist_ok=True)

FUNCS = [
    (0x005A33F0, "Hills_WaterShoreSeed"),
    (0x005A2F50, "Hills_RandomWalk"),
    (0x0058D410, "Region_BoundaryCells"),
    (0x0058BF70, "Region_Ctor"),
    (0x0058E5D0, "Region_BorderCells"),
    (0x0058D0A0, "Region_IdAt"),
    (0x005A0700, "Boundary_Collector"),
    (0x0058CE90, "Region_ResetAll"),
    (0x0056D3F0, "Coord_LinearIndex"),
    (0x005AC230, "Coord_InDiamondQ"),
    (0x0056C510, "Zone_Recalc"),
    (0x00594420, "Start_FloodRegion"),
    (0x00594870, "Start_WritePerRegion"),
    (0x005A28C0, "Ore_BfsPlacer"),
    (0x005A4B60, "Patch_BlobGrow"),
    (0x0058C070, "Region_RemoveQ"),
    (0x005AC790, "Start_HelperA"),
    (0x005AD930, "Start_ScoreVec"),
    (0x005AD9C0, "Start_ScoreCmp"),
]

DISASM = [
    (0x0058C6F0, "Region_SplitCost"),
    (0x0058D620, "Region_Split"),
]

log_lines = []


def log(s):
    log_lines.append(s)


def disasm_range(f):
    out = []
    ea = f.start_ea
    while ea < f.end_ea:
        out.append("%08X  %s" % (ea, idc.GetDisasm(ea)))
        ea = idc.next_head(ea, f.end_ea)
    return "\n".join(out)


ida_auto.auto_wait()
ida_hexrays.init_hexrays_plugin()

for ea, name in FUNCS:
    f = ida_funcs.get_func(ea)
    if f is None:
        log("MISS  %08X %s (no function)" % (ea, name))
        continue
    try:
        text = str(ida_hexrays.decompile(f))
        kind = "decomp"
    except Exception as e:
        text = disasm_range(f)
        kind = "disasm(%s)" % e
    path = os.path.join(OUT, "%06X_%s.c" % (ea, name))
    with open(path, "w", encoding="utf-8", errors="replace") as fh:
        fh.write("// %s %s size=%X\n\n" % (hex(ea), name, f.end_ea - f.start_ea))
        fh.write(text)
    log("OK    %08X %-26s %s (%d lines)" % (ea, name, kind, text.count("\n") + 1))

for ea, name in DISASM:
    f = ida_funcs.get_func(ea)
    if f is None:
        log("MISS-D %08X %s" % (ea, name))
        continue
    path = os.path.join(OUT, "%06X_%s.asm" % (ea, name))
    with open(path, "w", encoding="utf-8", errors="replace") as fh:
        fh.write(disasm_range(f))
    log("ASMD  %08X %s" % (ea, name))

with open(os.path.join(OUT, "_log6.txt"), "w", encoding="utf-8") as fh:
    fh.write("\n".join(log_lines) + "\n")

idc.qexit(0)
