# IDA round 7: stage-12 callees + start-point gates + data tables
import os
import ida_auto
import ida_funcs
import ida_hexrays
import ida_bytes
import idc

OUT = r"G:\ra2-web-mapgen\re\decomp"
os.makedirs(OUT, exist_ok=True)

FUNCS = [
    (0x0056D230, "Zone_GetZoneID"),
    (0x005A7250, "Placeability_Gate"),
    (0x00578640, "Start_Rect6x6Check"),
    (0x00544C20, "Tile_FrameValidQ"),
    (0x005471B0, "Tile_SlopeOfSubtile"),
    (0x00544BE0, "Tile_LandOfSubtile"),
    (0x00547370, "Tile_MultiTileFlags"),
    (0x00483C80, "CellAttr_483C80"),
    (0x005FDD20, "Unknown_5FDD20"),
    (0x0056D6E0, "MapPrep_AttrInit"),
    (0x00581F50, "MapPrep_581F50"),
    (0x00568BB0, "InitCellAttributes"),
    (0x005AC290, "Region_Dtor"),
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


def dump_bytes(path, addr, n, note):
    blob = ida_bytes.get_bytes(addr, n) or b""
    with open(os.path.join(OUT, path), "w") as fh:
        fh.write("// %s @ %08X (%d bytes)\n" % (note, addr, n))
        for i in range(0, n, 16):
            fh.write(" ".join("%02X" % b for b in blob[i : i + 16]) + "\n")
    log("DATA  %s @ %08X" % (path, addr))


dump_bytes("_data_passability_matrix_82A594.txt", 0x0082A594, 104, "g_PassabilityMatrix 13x8")
dump_bytes("_data_lat_repair_offsets_89F588.txt", 0x0089F588, 32, "LAT repair dir offsets (rough)")

with open(os.path.join(OUT, "_log7.txt"), "w", encoding="utf-8") as fh:
    fh.write("\n".join(log_lines) + "\n")

idc.qexit(0)
