# IDA batch round 3: shore infrastructure + data tables
import os
import ida_auto
import ida_funcs
import ida_hexrays
import ida_bytes
import idc

OUT = r"G:\ra2-web-mapgen\re\decomp"
os.makedirs(OUT, exist_ok=True)

FUNCS = [
    (0x0057B210, "Shore_MaskProbe"),
    (0x00485060, "IsWaterTileQ"),
    (0x005A00C0, "Shore_QueryTag"),
    (0x005A0090, "Shore_SetTag"),
    (0x0057B440, "Shore_StampTile"),
    (0x004A91B0, "Coord_Helper"),
    (0x004A8BF0, "Shore_Begin"),
]

DISASM = [
    (0x0059C630, "Water_Finalize"),
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
    log("OK    %08X %-24s %s (%d lines)" % (ea, name, kind, text.count("\n") + 1))


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

# data tables: shore variant coordinate offsets
try:
    vals = []
    for i in range(48):
        w1 = ida_bytes.get_word(0x00ABDB64 + 4 * i)
        w2 = ida_bytes.get_word(0x00ABDB66 + 4 * i)
        vals.append((i, w1, w2))
    with open(os.path.join(OUT, "_data_shore_offsets.txt"), "w") as fh:
        for i, w1, w2 in vals:
            fh.write("variant %d: (%d, %d)\n" % (i, w1, w2))
    log("DATA  word_ABDB64 48 pairs dumped")
except Exception as e:
    log("ERR   data dump: %r" % e)

with open(os.path.join(OUT, "_log3.txt"), "w", encoding="utf-8") as fh:
    fh.write("\n".join(log_lines) + "\n")

idc.qexit(0)
