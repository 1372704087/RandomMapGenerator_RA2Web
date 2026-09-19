# IDA round 4: shore variant offset table writers + static data tables
import os
import ida_auto
import ida_funcs
import ida_hexrays
import ida_xref
import ida_bytes
import ida_idaapi
import idc

OUT = r"G:\ra2-web-mapgen\re\decomp"
os.makedirs(OUT, exist_ok=True)

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

# 1) find writers of the shore variant offset tables
for g in (0x00ABDB64, 0x00ABDB66):
    eas = set()
    x = ida_xref.get_first_dref_to(g)
    while x != ida_idaapi.BADADDR:
        eas.add(x)
        x = ida_xref.get_next_dref_to(g, x)
    x = ida_xref.get_first_cref_to(g)
    while x != ida_idaapi.BADADDR:
        eas.add(x)
        x = ida_xref.get_next_cref_to(g, x)
    for x in sorted(eas):
        f = ida_funcs.get_func(x)
        if f is None:
            log("XREF  %08X -> %08X (no func)" % (x, g))
            continue
        log("XREF  %08X -> %08X in %06X" % (x, g, f.start_ea))
        try:
            cf = ida_hexrays.decompile(f)
            text = str(cf)
        except Exception as e:
            text = disasm_range(f)
        path = os.path.join(OUT, "%06X_writer_of_%08X.c" % (f.start_ea, g))
        with open(path, "w", encoding="utf-8", errors="replace") as fh:
            fh.write(text)
        log("OK    dump %06X" % f.start_ea)

# also writers of the stamp anchor global 0x0088095C
for g in (0x0088095C,):
    eas = set()
    x = ida_xref.get_first_dref_to(g)
    while x != ida_idaapi.BADADDR:
        eas.add(x)
        x = ida_xref.get_next_dref_to(g, x)
    for x in sorted(eas):
        f = ida_funcs.get_func(x)
        if f is None:
            continue
        log("ANCHOR %08X -> %06X" % (x, f.start_ea))

# 2) data dumps
def dump_bytes(path, addr, n, note):
    blob = ida_bytes.get_bytes(addr, n) or b""
    with open(os.path.join(OUT, path), "w") as fh:
        fh.write("// %s @ %08X (%d bytes)\n" % (note, addr, n))
        for i in range(0, n, 16):
            fh.write(" ".join("%02X" % b for b in blob[i : i + 16]) + "\n")
    log("DATA  %s @ %08X" % (path, addr))


# ramp delta tables: off_83FF18 is 19 pointers; dump pointer table + payloads
ptrs = []
for i in range(19):
    p = ida_bytes.get_dword(0x0083FF18 + 4 * i)
    ptrs.append(p)
with open(os.path.join(OUT, "_data_ramp_tables.txt"), "w") as fh:
    fh.write("// off_83FF18: 19 slope rows, each int[4] (NW,NE,SE,SW)\n")
    for i, p in enumerate(ptrs):
        row = []
        for k in range(4):
            row.append(ida_bytes.get_dword(p + 4 * k) if p else 0)
        fh.write("slope %2d ptr=%08X: %s\n" % (i, p, " ".join("%d" % v for v in row)))
log("DATA  _data_ramp_tables.txt")

# shore compat tables (indices 0..41 into dword_82A7F4 / dword_82A89C)
dump_bytes("_data_shore_compat_82A7F4.txt", 0x0082A7F4, 64, "dword_82A7F4[0..63]")
dump_bytes("_data_shore_compat_82A89C.txt", 0x0082A89C, 64, "dword_82A89C[0..63]")
# land type map 0x008288E4 (16 bytes)
dump_bytes("_data_landtype_8288E4.txt", 0x008288E4, 16, "LandType map[16]")

with open(os.path.join(OUT, "_log4.txt"), "w", encoding="utf-8") as fh:
    fh.write("\n".join(log_lines) + "\n")

idc.qexit(0)
