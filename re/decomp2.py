# IDA batch round 2: RMG callee functions from gamemd (YR 1.001)
import os
import ida_auto
import ida_funcs
import ida_hexrays
import idc

OUT = r"G:\ra2-web-mapgen\re\decomp"
os.makedirs(OUT, exist_ok=True)

FUNCS = [
    (0x005A6C10, "Water_2x2Place"),
    (0x004865B0, "IsShorePieceTile"),
    (0x00481810, "AdjacentCell"),
    (0x005657A0, "DiamondToCell"),
    (0x0059BAB0, "Blob_EllipseTest"),
    (0x0059B940, "Blob_DirectedKey"),
    (0x005AD870, "Shore_HeapReg"),
    (0x005ADA40, "Shape0_Init"),
    (0x005AD820, "Green_Init"),
    (0x0042B1F0, "CellCount"),
    (0x004A8BF0, "Shore_Begin"),
    (0x00477BE0, "VecInit"),
    (0x0057A430, "Shore_Pass1"),
    (0x0057A320, "Shore_Pass2"),
    (0x0057ACF0, "Shore_Pass34"),
    (0x0058BDC0, "Scratch_Ctor"),
    (0x0058C2C0, "Scratch_At"),
    (0x0068BF50, "Waypoint_Set"),
    (0x0068BD00, "Waypoint_C"),
    (0x0059D510, "Water_CarveRiver"),
    (0x0059C920, "Water_GrowLake"),
]

# functions whose decompilation is suspect -> also dump raw disasm
DISASM = [
    (0x0059A8F0, "Water_PartitionGridDraws"),
    (0x0068BCC0, "Waypoint_A"),
    (0x0068BF50, "Waypoint_B"),
    (0x0059BBC0, "Water_LandBlobFlood"),
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


def dump_func(ea, name):
    f = ida_funcs.get_func(ea)
    if f is None:
        log("MISS  %08X %s (no function)" % (ea, name))
        return
    try:
        cf = ida_hexrays.decompile(f)
        text = str(cf)
        kind = "decomp"
    except Exception as e:
        text = disasm_range(f)
        kind = "disasm(%s)" % e
    path = os.path.join(OUT, "%06X_%s.c" % (ea, name))
    with open(path, "w", encoding="utf-8", errors="replace") as fh:
        fh.write("// %s %s size=%X\n\n" % (hex(ea), name, f.end_ea - f.start_ea))
        fh.write(text)
    log("OK    %08X %-28s %s (%d lines)" % (ea, name, kind, text.count("\n") + 1))


ida_auto.auto_wait()
ida_hexrays.init_hexrays_plugin()

for ea, name in FUNCS:
    try:
        dump_func(ea, name)
    except Exception as e:
        log("ERR   %08X %s: %r" % (ea, name, e))

for ea, name in DISASM:
    f = ida_funcs.get_func(ea)
    if f is None:
        log("MISS-D %08X %s" % (ea, name))
        continue
    path = os.path.join(OUT, "%06X_%s.asm" % (ea, name))
    with open(path, "w", encoding="utf-8", errors="replace") as fh:
        fh.write(disasm_range(f))
    log("ASMD  %08X %s" % (ea, name))

with open(os.path.join(OUT, "_log2.txt"), "w", encoding="utf-8") as fh:
    fh.write("\n".join(log_lines) + "\n")

idc.qexit(0)
