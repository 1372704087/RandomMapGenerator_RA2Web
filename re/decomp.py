# IDA batch decompile: RMG stage functions from gamemd (YR 1.001)
# Run: idat.exe -A -S"G:\ra2-web-mapgen\re\decomp.py" "G:\ra2-web-mapgen\re\gamemd.i64"
import os
import ida_auto
import ida_funcs
import ida_hexrays
import ida_xref
import ida_idaapi
import ida_bytes
import idc

OUT = r"G:\ra2-web-mapgen\re\decomp"
os.makedirs(OUT, exist_ok=True)

FUNCS = [
    (0x00598960, "Generate_main"),
    (0x00599650, "MapPrep"),
    (0x005981F0, "ReadRMGMD_INI"),
    (0x0059A6C0, "Water_Basic"),
    (0x0059AD10, "Water_Shape0_Archipelago"),
    (0x0059AFA0, "Water_Shape1_Mainland"),
    (0x0059B200, "Water_Shape2_SeaArchipelago"),
    (0x0059A8F0, "Water_PartitionGridDraws"),
    (0x0059BBC0, "Water_LandBlobFlood"),
    (0x0059C630, "Water_Finalize"),
    (0x0059C580, "Water_Driver_mt34"),
    (0x0059D510, "Water_CarveRiver"),
    (0x0059C920, "Water_GrowLake"),
    (0x0057A0C0, "Water_ShorelineFinalize"),
    (0x0058CF90, "Region_Partition"),
    (0x0058C800, "Region_FloodHelper"),
    (0x0058E740, "Region_Bfs1"),
    (0x0058E9B0, "Region_Bfs2"),
    (0x0058D010, "Region_Hierarchy"),
    (0x0058EBC0, "Region_PlateauThreshold"),
    (0x0058D620, "Region_Split"),
    (0x0058C6F0, "Region_SplitCost"),
    (0x0058EF10, "Bridge_ConnectPass"),
    (0x0058F0C0, "Bridge_Helper"),
    (0x005905D0, "Bridge_5x5Connect"),
    (0x005A19E0, "Cliff_Drops"),
    (0x005A17F0, "Water_Reanchor"),
    (0x00578E60, "Bridge_RampStamp"),
    (0x005A0160, "Region_DilateRings"),
    (0x0059B740, "Green_Spread"),
    (0x00578350, "CellRecalc_A"),
    (0x00578290, "CellRecalc_B"),
    (0x0047D2B0, "CellRecalc_C"),
    (0x00594B50, "Start_Candidate"),
    (0x005A1FB0, "Start_WriteFlood"),
    (0x00594F40, "Start_FarthestSelector"),
    (0x005A95B0, "Tech_Neutral"),
    (0x00595400, "Tech_MapType2"),
    (0x005A23A0, "Ore_Fields"),
    (0x005A35F0, "Hills_Main"),
    (0x006B2A70, "Corner_A"),
    (0x006B4100, "Corner_B"),
    (0x006B4240, "Corner_C"),
    (0x006B3E60, "Corner_MorphAt"),
    (0x006B3A80, "Corner_D"),
    (0x006B3850, "Corner_E"),
    (0x006B2520, "TerrainTest_Corner"),
    (0x005A38C0, "LAT_ProbsTemperate"),
    (0x005A3AE0, "LAT_PatchPlace"),
    (0x005A4280, "LAT_Apply"),
    (0x005A45E0, "Trees_Plant"),
    (0x00722D00, "GrowthQueue_Init"),
    (0x00722240, "GrowthQueue_Spread"),
    (0x00654490, "Radar_Bounds"),
    (0x00654650, "Radar_Surfaces"),
    (0x0068BCC0, "Waypoint_A"),
    (0x0068BF50, "Waypoint_B"),
    (0x00486380, "TerrainTest_A"),
    (0x004865D0, "TerrainTest_WaterFamily"),
    (0x004867B0, "TerrainTest_C"),
    (0x0049F2F0, "DirectionOffsets_Filler"),
    (0x00598030, "NextUniformRange"),
    (0x0065C7E0, "RandomRanged"),
    (0x005980C0, "NextGaussian"),
    (0x00597260, "RandomizeDerivedFields"),
    (0x005975E0, "ClampFields"),
    (0x00595680, "MapSeed_Ctor"),
    (0x00597A30, "SED_Load"),
]

# globals whose writers we want (tileset bases, start-quota, split-threshold input)
WATCH_GLOBALS = [0x00ABBEC4, 0x00ABBEC8, 0x00ABE028, 0x00ABE048]

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
        return None
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
    return f


ida_auto.auto_wait()

if not ida_hexrays.init_hexrays_plugin():
    log("FATAL: hexrays decompiler not available; disasm-only run")

for ea, name in FUNCS:
    try:
        dump_func(ea, name)
    except Exception as e:
        log("ERR   %08X %s: %r" % (ea, name, e))

# functions touching watched globals
seen = set()
for g in WATCH_GLOBALS:
    eas = set()
    x = ida_xref.get_first_cref_to(g)
    while x != ida_idaapi.BADADDR:
        eas.add(x)
        x = ida_xref.get_next_cref_to(g, x)
    x = ida_xref.get_first_dref_to(g)
    while x != ida_idaapi.BADADDR:
        eas.add(x)
        x = ida_xref.get_next_dref_to(g, x)
    for x in sorted(eas):
        f = ida_funcs.get_func(x)
        if f is None:
            log("XREF  %08X -> %08X (no func)" % (x, g))
            continue
        if f.start_ea in seen:
            log("XREF  %08X -> %08X in already-dumped %06X" % (x, g, f.start_ea))
            continue
        seen.add(f.start_ea)
        log("XREF  %08X -> %08X in %06X, dumping" % (x, g, f.start_ea))
        try:
            dump_func(f.start_ea, "watch_%06X" % f.start_ea)
        except Exception as e:
            log("ERR   watch %06X: %r" % (f.start_ea, e))

with open(os.path.join(OUT, "_log.txt"), "w", encoding="utf-8") as fh:
    fh.write("\n".join(log_lines) + "\n")

idc.qexit(0)
