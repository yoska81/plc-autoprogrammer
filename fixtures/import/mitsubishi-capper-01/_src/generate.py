#!/usr/bin/env python3
"""Generate the mitsubishi-capper-01 test fixture.

Outputs (next to _src/):
  CAPPER_MAIN.csv           GX Works3 ladder program exported as instruction list ("Export to CSV"):
                            UTF-16 LE with BOM, tab-delimited, every field quoted, CRLF; title lines, then
                            "Step No." / "Line Statement" / "Instruction" / "I/O(Device)" / "Blank" /
                            "PI Statement" / "Note"; extra operands continue on following rows.
  CAPPER_DeviceComment.csv  device comment export (same encoding / delimiter): Device Name, Comment
  expected.json             answer key

Run:  python3 -I _src/generate.py   (self-checks stack balance, device comments and the answer key)
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.dirname(HERE)
PROG_CSV = "CAPPER_MAIN.csv"
COMMENT_CSV = "CAPPER_DeviceComment.csv"
CPU = "FX5U-32MT/ES"

IO = [
    ("X0", "Start_PB", "Start pushbutton (NO)", "input"),
    ("X1", "Stop_PB", "Stop pushbutton (NC, ON = not pressed)", "input"),
    ("X2", "EStop_OK", "E-stop safety relay OK", "input"),
    ("X3", "Reset_PB", "Fault reset pushbutton (NO)", "input"),
    ("X4", "Bottle_At_Station_PE", "Bottle in capping position photo eye", "input"),
    ("X5", "Cap_In_Chuck_PE", "Cap present in capping chuck sensor", "input"),
    ("X6", "Head_Up_LS", "Capping head up limit switch", "input"),
    ("X7", "Head_Down_LS", "Capping head down limit switch", "input"),
    ("X10", "Clamp_Closed_LS", "Bottle clamp closed limit switch", "input"),
    ("X11", "Torque_Reached", "Spindle torque clutch reached switch", "input"),
    ("X12", "Cap_Chute_Full_PE", "Cap chute level photo eye (ON = caps in chute)", "input"),
    ("X13", "Guard_Closed", "Guard door closed safety switch", "input"),
    ("X14", "Air_OK", "Air pressure switch OK", "input"),
    ("X15", "Jog_Spindle_PB", "Manual jog spindle pushbutton (maintenance)", "input"),
    ("Y0", "Conveyor_Run", "Bottle conveyor motor", "output"),
    ("Y1", "Bottle_Gate_Sol", "Bottle stop gate solenoid (ON = gate closed, holds bottle)", "output"),
    ("Y2", "Clamp_Close_Sol", "Bottle clamp close solenoid", "output"),
    ("Y3", "Head_Down_Sol", "Capping head down solenoid (spring return up)", "output"),
    ("Y4", "Spindle_Run", "Capping spindle motor", "output"),
    ("Y5", "Cap_Feed_Sol", "Cap escapement / feed solenoid", "output"),
    ("Y6", "Reject_Sol", "Reject pusher solenoid (bad cap)", "output"),
    ("Y7", "Lamp_Green", "Running lamp", "output"),
    ("Y10", "Lamp_Red", "Fault lamp", "output"),
    ("Y11", "Buzzer", "Fault buzzer", "output"),
]
INTERNAL = [
    ("M0", "Machine running (auto)"),
    ("M50", "Fault summary (stops machine)"),
    ("M51", "Alarm: emergency stop"),
    ("M52", "Alarm: guard door open"),
    ("M53", "Alarm: low air pressure"),
    ("M54", "Alarm: 5 rejects - check caps / torque"),
    ("M55", "Alarm: capping head not up (timeout)"),
    ("M56", "Warning: cap chute low"),
    ("M57", "Alarm: bottle clamp not closed (timeout)"),
    ("M60", "Current bottle is a reject (torque not reached)"),
    ("M100", "Step 1: wait for bottle and cap"),
    ("M101", "Step 2: clamp bottle"),
    ("M102", "Step 3: head down, spindle on, wait torque"),
    ("M103", "Step 4: torque dwell"),
    ("M104", "Step 5: head up"),
    ("M105", "Step 6: open clamp, count bottle"),
    ("M106", "Step 7: release bottle, feed next cap"),
    ("T0", "Bottle settle delay 0.5 s"),
    ("T1", "Clamp close timeout 2 s"),
    ("T2", "Torque timeout 3 s after head down"),
    ("T3", "Torque dwell 0.3 s"),
    ("T4", "Bottle release time 1 s"),
    ("T5", "Head up timeout 3 s"),
    ("T6", "Cap chute low delay 5 s"),
    ("C0", "Good bottles in batch (preset D0)"),
    ("C1", "Rejected bottles (preset 5)"),
    ("D0", "Batch size (set to 500 at power-up)"),
    ("D10", "HMI: good bottle count"),
    ("D11", "HMI: reject count"),
    ("SM400", "Always ON"),
    ("SM402", "ON for one scan after RUN"),
    ("SM412", "1 s clock"),
]

# Rungs: (line statement, [(instruction, operands...)])
RUNGS = [
    ("Power-up: batch size and first step", [("LD", "SM402"), ("MOV", "K500", "D0"), ("SET", "M100")]),
    ("Machine run latch", [("LD", "X0"), ("OR", "M0"), ("AND", "X1"), ("AND", "X2"), ("ANI", "M50"), ("OUT", "M0")]),
    ("Alarm: E-stop", [("LDI", "X2"), ("SET", "M51")]),
    ("Alarm: guard door", [("LDI", "X13"), ("SET", "M52")]),
    ("Alarm: air pressure", [("LDI", "X14"), ("SET", "M53")]),
    ("Alarm: 5 rejects", [("LD", "C1"), ("SET", "M54")]),
    ("Alarm: head up timeout", [("LD", "T5"), ("SET", "M55")]),
    ("Alarm: clamp timeout", [("LD", "T1"), ("SET", "M57")]),
    ("Warning: cap chute low for 5 s", [("LDI", "X12"), ("OUT", "T6", "K50")]),
    ("", [("LD", "T6"), ("OUT", "M56")]),
    ("Fault reset", [("LD", "X3"), ("RST", "M51"), ("RST", "M52"), ("RST", "M53"), ("RST", "M54"), ("RST", "M55"), ("RST", "M57"), ("RST", "C1")]),
    ("Fault summary", [("LD", "M51"), ("OR", "M52"), ("OR", "M53"), ("OR", "M54"), ("OR", "M55"), ("OR", "M57"), ("OUT", "M50")]),
    ("Step 1: bottle settle", [("LD", "M100"), ("AND", "M0"), ("AND", "X4"), ("OUT", "T0", "K5")]),
    ("Step 1 -> 2: bottle settled, cap in chuck, head up", [("LD", "T0"), ("AND", "X5"), ("AND", "X6"), ("RST", "M100"), ("SET", "M101")]),
    ("Step 2: clamp timeout", [("LD", "M101"), ("OUT", "T1", "K20")]),
    ("Step 2 -> 3: clamp closed", [("LD", "M101"), ("AND", "X10"), ("RST", "M101"), ("SET", "M102")]),
    ("Step 3: torque timeout once head is down", [("LD", "M102"), ("AND", "X7"), ("OUT", "T2", "K30")]),
    ("Step 3 -> 4: torque reached", [("LD", "M102"), ("AND", "X11"), ("RST", "M102"), ("SET", "M103")]),
    ("Step 3 -> 5: no torque in 3 s, mark reject", [("LD", "M102"), ("AND", "T2"), ("SET", "M60"), ("RST", "M102"), ("SET", "M104")]),
    ("Count rejects", [("LD", "M60"), ("OUT", "C1", "K5")]),
    ("Step 4: torque dwell", [("LD", "M103"), ("OUT", "T3", "K3")]),
    ("Step 4 -> 5", [("LD", "T3"), ("RST", "M103"), ("SET", "M104")]),
    ("Step 5: head up timeout", [("LD", "M104"), ("OUT", "T5", "K30")]),
    ("Step 5 -> 6: head up", [("LD", "M104"), ("AND", "X6"), ("RST", "M104"), ("SET", "M105")]),
    ("Step 6: count good bottle when clamp open", [("LD", "M105"), ("ANI", "X10"), ("ANI", "M60"), ("OUT", "C0", "D0")]),
    ("Step 6 -> 7: clamp open", [("LD", "M105"), ("ANI", "X10"), ("RST", "M105"), ("SET", "M106")]),
    ("Step 7: release time", [("LD", "M106"), ("OUT", "T4", "K10")]),
    ("Step 7 -> 1: clear reject flag", [("LD", "T4"), ("RST", "M106"), ("RST", "M60"), ("SET", "M100")]),
    ("Conveyor", [("LD", "M0"), ("OUT", "Y0")]),
    ("Gate closed except when releasing", [("LDI", "M106"), ("OUT", "Y1")]),
    ("Clamp: steps 2 to 5", [("LD", "M101"), ("OR", "M102"), ("OR", "M103"), ("OR", "M104"), ("OUT", "Y2")]),
    ("Head down: steps 3 and 4 with clamp closed", [("LD", "M102"), ("OR", "M103"), ("AND", "X10"), ("AND", "M0"), ("OUT", "Y3")]),
    ("Spindle: step 3 until torque", [("LD", "M102"), ("ANI", "X11"), ("AND", "M0"), ("OUT", "Y4")]),
    ("Cap feed in step 7 until cap in chuck", [("LD", "M106"), ("ANI", "X5"), ("OUT", "Y5")]),
    ("Reject bad bottle on release", [("LD", "M106"), ("AND", "M60"), ("OUT", "Y6")]),
    ("Lamps and buzzer", [("LD", "M0"), ("ANI", "M50"), ("OUT", "Y7")]),
    ("", [("LD", "M50"), ("OR", "M56"), ("OUT", "Y10")]),
    ("", [("LD", "M50"), ("AND", "SM412"), ("OUT", "Y11")]),
    ("HMI counts", [("LD", "SM400"), ("MOV", "C0", "D10"), ("MOV", "C1", "D11")]),
    ("Batch complete: stop after last bottle", [("LD", "C0"), ("AND", "M100"), ("RST", "M0"), ("RST", "C0")]),
    # KNOWN ISSUE: double coil - Y4 is also driven at the "Spindle" rung above; this later OUT wins.
    ("Maintenance: jog spindle when not running", [("LDI", "M0"), ("AND", "X15"), ("OUT", "Y4")]),
]

STEP_SIZE = {"LD": 1, "LDI": 1, "AND": 1, "ANI": 1, "OR": 1, "ORI": 1, "SET": 1, "RST": 1, "OUT": 1, "MOV": 3, "END": 1}


def size(ins):
    op, *args = ins
    if op == "OUT" and len(args) == 2:  # OUT T/C with set value
        return 4
    if op == "RST" and args[0][0] in "TC":
        return 2
    return STEP_SIZE[op]


def program_rows():
    rows, step, starts = [], 0, []
    for stmt, instrs in RUNGS:
        starts.append(step)
        for k, ins in enumerate(instrs):
            op, *args = ins
            line = stmt if k == 0 else ""
            rows.append([str(step), line, op, args[0], "", "", ""])
            for a in args[1:]:
                rows.append(["", "", "", a, "", "", ""])
            step += size(ins)
    rows.append([str(step), "", "END", "", "", "", ""])
    return rows, starts, step


def q(row):
    return "\t".join('"' + c.replace('"', '""') + '"' for c in row)


def write_utf16(path, lines):
    with open(path, "wb") as f:
        f.write(("﻿" + "\r\n".join(lines) + "\r\n").encode("utf-16-le"))


def rung_of(pred):
    for k, (_, ins) in enumerate(RUNGS):
        if pred(ins):
            return k
    raise KeyError


def build_expected(starts):
    names = {a: (n, d) for a, n, d, _ in IO}
    at = lambda k: f"MAIN, step {starts[k]} (rung: {RUNGS[k][0] or RUNGS[k - 1][0]})"
    has = lambda *ins: (lambda xs: tuple(ins) in xs)
    timers = []
    tdesc = dict(INTERNAL)
    for k, (_, xs) in enumerate(RUNGS):
        for ins in xs:
            if ins[0] == "OUT" and len(ins) == 3 and ins[1].startswith("T"):
                timers.append({"name": ins[1], "type": "OUT T (100 ms on-delay)", "preset": ins[2], "presetMs": int(ins[2][1:]) * 100,
                               "purpose": tdesc[ins[1]], "where": at(k)})
    counters = [
        {"name": "C0", "type": "OUT C (16-bit up counter)", "preset": "D0", "presetValue": 500, "purpose": "Good bottles in the batch; at count-up the machine stops at the end of the cycle and C0 is reset", "reset": "RST C0 when C0 is up and back in step 1", "where": at(rung_of(has("OUT", "C0", "D0")))},
        {"name": "C1", "type": "OUT C (16-bit up counter)", "preset": "K5", "presetValue": 5, "purpose": "Rejected bottles (no torque); at 5 raises alarm M54", "reset": "RST C1 with Reset_PB (X3)", "where": at(rung_of(has("OUT", "C1", "K5")))},
    ]
    alarm_rows = [("M51", "LDI X2"), ("M52", "LDI X13"), ("M53", "LDI X14"), ("M54", "LD C1"), ("M55", "LD T5 (head not up in 3 s)"), ("M57", "LD T1 (clamp not closed in 2 s)")]
    alarms = [{"address": m, "text": tdesc[m].split(": ", 1)[1], "condition": c, "stopsMachine": True, "latched": True, "reset": "X3 Reset_PB",
               "where": at(rung_of(has("SET", m)))} for m, c in alarm_rows]
    alarms.append({"address": "M56", "text": "cap chute low", "condition": "X12 OFF for 5 s (T6)", "stopsMachine": False, "latched": False, "reset": "self-clearing",
                   "where": at(rung_of(has("OUT", "M56")))})
    y4_auto = rung_of(lambda xs: ("OUT", "Y4") in xs)
    y4_jog = max(k for k, (_, xs) in enumerate(RUNGS) if ("OUT", "Y4") in xs)
    assert y4_auto != y4_jog
    return {
        "fixture": "mitsubishi-capper-01",
        "sourceFiles": [PROG_CSV, COMMENT_CSV],
        "format": "Mitsubishi GX Works3 program export to CSV (instruction list, UTF-16 LE, tab-delimited) + device comment CSV",
        "machine": ("Single-head inline bottle capper. Bottles arrive on a conveyor and are held at the capping station by a "
                    "stop gate. When a bottle has settled (0.5 s) and a cap is in the chuck with the head up, the bottle is "
                    "clamped, the pneumatic head lowers and the spindle motor screws the cap on until the torque clutch "
                    "switch makes. After a 0.3 s dwell the head rises, the clamp opens, good bottles are counted against the "
                    "batch size in D0 (500) and the gate releases the bottle while the escapement feeds the next cap. If "
                    "torque is not reached within 3 s the bottle is marked as a reject and pushed off on release; 5 rejects "
                    "stop the machine. A maintenance pushbutton jogs the spindle when the machine is not running."),
        "plc": {"brand": "Mitsubishi Electric", "family": "MELSEC iQ-F", "cpu": CPU, "software": "GX Works3",
                "modules": [{"slot": 0, "name": "CPU", "catalog": CPU, "description": "FX5U CPU, 16 DI (X0-X17) 24 V DC, 16 DO (Y0-Y17) transistor sink"}],
                "programs": [{"name": "MAIN", "type": "scan", "language": "ladder", "steps": None}]},
        "io": [{"address": a, "tag": n, "description": d, "type": t, "signal": "digital"} for a, n, d, t in IO],
        "sequence": {
            "style": "Step bits M100-M106 with SET/RST",
            "steps": [
                {"step": "M100", "description": "Wait for a bottle at the station (X4) for 0.5 s (T0); with a cap in the chuck (X5) and head up (X6) go to clamp."},
                {"step": "M101", "description": "Close the bottle clamp (Y2); when clamp closed (X10) go to capping. 2 s timeout T1 -> alarm M57."},
                {"step": "M102", "description": "Head down (Y3) and spindle on (Y4) until torque switch X11 -> dwell. No torque within 3 s of the head reaching down (X7, T2) -> mark reject (M60), count C1, go to head up."},
                {"step": "M103", "description": "Torque dwell 0.3 s (T3), head stays down, spindle off; then head up."},
                {"step": "M104", "description": "Head up (Y3 off); when head up (X6) go to unclamp. 3 s timeout T5 -> alarm M55."},
                {"step": "M105", "description": "Clamp opens (Y2 off); when clamp no longer closed, count good bottle in C0 (unless reject) and go to release."},
                {"step": "M106", "description": "Gate opens (Y1 off) for 1 s (T4), cap feed (Y5) until a cap is in the chuck, reject pusher (Y6) if M60; then clear M60 and back to step 1."},
            ],
            "batchEnd": "When C0 reaches D0 (500) and the sequence is back in step 1, M0 is reset (machine stops) and C0 is reset.",
        },
        "timers": timers,
        "counters": counters,
        "alarms": alarms,
        "interlocks": [
            {"output": "M0 (run)", "requires": ["X1 Stop_PB", "X2 EStop_OK", "NOT M50 fault"], "where": at(rung_of(has("OUT", "M0")))},
            {"output": "Y3 Head_Down_Sol", "requires": ["M102 or M103", "X10 Clamp_Closed_LS", "M0"], "where": at(rung_of(has("OUT", "Y3")))},
            {"output": "Y4 Spindle_Run", "requires": ["M102", "NOT X11 Torque_Reached", "M0"], "where": at(y4_auto)},
            {"output": "Step 1 -> 2", "requires": ["T0 (bottle settled)", "X5 Cap_In_Chuck_PE", "X6 Head_Up_LS"], "where": at(rung_of(has("SET", "M101")))},
            {"output": "Y5 Cap_Feed_Sol", "requires": ["M106", "NOT X5"], "where": at(rung_of(has("OUT", "Y5")))},
        ],
        "devices": {"D": {"D0": "Batch size (500)", "D10": "HMI good count = C0", "D11": "HMI reject count = C1"}},
        "knownIssues": [
            {
                "id": "MEL-1",
                "where": f"MAIN, step {starts[y4_jog]} (OUT Y4 in 'Maintenance: jog spindle') and step {starts[y4_auto]} (OUT Y4 in 'Spindle')",
                "what": ("Double coil: Y4 Spindle_Run is driven by two OUT instructions. The later maintenance jog rung "
                         "(LDI M0 / AND X15 / OUT Y4) is evaluated last in the scan and overwrites the automatic result, so in "
                         "AUTO (M0 ON) the spindle never runs, torque is never reached, every bottle times out as a reject and "
                         "the machine stops on alarm M54 after 5 bottles."),
                "fix": ("Drive Y4 from one rung only, e.g. replace the auto rung's OUT Y4 with OUT M70, the jog rung's OUT Y4 "
                        "with OUT M71, and add: LD M70 / OR M71 / OUT Y4."),
            }
        ],
    }


def check(rows):
    # every device in the program has a comment; stack sanity (each rung starts with LD/LDI)
    commented = {a for a, *_ in IO} | {a for a, _ in INTERNAL}
    for stmt, xs in RUNGS:
        assert xs[0][0] in ("LD", "LDI"), stmt
        for ins in xs:
            for a in ins[1:]:
                if re.fullmatch(r"K\d+", a):
                    continue
                assert a in commented, f"no comment for {a}"
    used = {a for _, xs in RUNGS for ins in xs for a in ins[1:]}
    for a, *_ in IO:
        assert a in used, f"{a} unused"
    assert rows[-1][2] == "END"


def main():
    rows, starts, end = program_rows()
    check(rows)
    exp = build_expected(starts)
    exp["plc"]["programs"][0]["steps"] = end + 1
    prog = ['"MAIN"', '"Module Type:FX5UCPU"',
            q(["Step No.", "Line Statement", "Instruction", "I/O(Device)", "Blank", "PI Statement", "Note"])]
    prog += [q(r) for r in rows]
    write_utf16(os.path.join(OUT_DIR, PROG_CSV), prog)
    com = ['"Global Device Comment"', q(["Device Name", "Comment"])]
    com += [q([a, f"{n}: {d}"]) for a, n, d, _ in IO]
    com += [q([a, d]) for a, d in INTERNAL]
    write_utf16(os.path.join(OUT_DIR, COMMENT_CSV), com)
    with open(os.path.join(OUT_DIR, "expected.json"), "w", encoding="utf-8") as f:
        json.dump(exp, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print("wrote", PROG_CSV, COMMENT_CSV, "expected.json")


if __name__ == "__main__":
    main()
