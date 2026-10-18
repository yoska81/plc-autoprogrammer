#!/usr/bin/env python3
"""Generate the ab-palletizer-01 test fixture: Palletizer_PL01.L5X + expected.json.

Single source of truth: the tag, module and rung tables below produce both the Studio 5000
export and the answer key, so the two cannot drift. Run:  python3 -I _src/generate.py
The script also self-checks that every operand used in rung text is a declared tag and that the
output XML is well-formed.
"""
import json
import os
import re
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)
L5X_NAME = "Palletizer_PL01.L5X"
EXPORT_DATE = "Wed Sep 09 14:22:37 2026"
CREATED = "Mon Mar 02 09:11:05 2026"
CONTROLLER = "PL01_Palletizer"
CPU = "5069-L306ER"
REV = ("33", "11")

# ---------------------------------------------------------------- hardware
MODULES = [
    # name, catalog, slot, product type, product code, major, minor, description
    ("Local", "5069-L306ER", 0, 14, 213, 33, 11, "CompactLogix 5380 controller, 0.6 MB, 16 nodes"),
    ("DI_Slot1", "5069-IB16", 1, 7, 7, 1, 11, "16 pt 24 V DC sinking input"),
    ("DO_Slot2", "5069-OB16", 2, 7, 8, 1, 11, "16 pt 24 V DC sourcing output"),
    ("AI_Slot3", "5069-IF8", 3, 10, 21, 1, 11, "8 ch current/voltage analog input"),
]

# ---------------------------------------------------------------- I/O (alias tags, controller scope)
# name, module point, description, type, signal
IO = [
    ("E_Stop_OK",          "Local:1:I.Pt00.Data", "Safety relay K1 healthy (E-stop circuit closed)", "input", "digital"),
    ("Start_PB",           "Local:1:I.Pt01.Data", "Start pushbutton PB1 (NO)", "input", "digital"),
    ("Stop_PB",            "Local:1:I.Pt02.Data", "Stop pushbutton PB2 (NC, ON = not pressed)", "input", "digital"),
    ("Reset_PB",           "Local:1:I.Pt03.Data", "Fault reset pushbutton PB3 (NO)", "input", "digital"),
    ("Auto_Sel",           "Local:1:I.Pt04.Data", "Mode selector SS1 in AUTO", "input", "digital"),
    ("Infeed_Case_PE",     "Local:1:I.Pt05.Data", "Infeed conveyor case present photo eye PE1 (jam detection)", "input", "digital"),
    ("Infeed_Count_PE",    "Local:1:I.Pt06.Data", "Layer table entry case count photo eye PE2", "input", "digital"),
    ("Pusher_Retracted_PX","Local:1:I.Pt07.Data", "Layer pusher retracted prox PX1", "input", "digital"),
    ("Pusher_Extended_PX", "Local:1:I.Pt08.Data", "Layer pusher extended prox PX2", "input", "digital"),
    ("Elev_Up_LS",         "Local:1:I.Pt09.Data", "Pallet elevator at top (load height) limit switch LS1", "input", "digital"),
    ("Elev_Down_LS",       "Local:1:I.Pt10.Data", "Pallet elevator at bottom (discharge) limit switch LS2", "input", "digital"),
    ("Pallet_Present_PE",  "Local:1:I.Pt11.Data", "Pallet present on elevator photo eye PE3", "input", "digital"),
    ("Guard_Door_Closed",  "Local:1:I.Pt12.Data", "Guard door interlock switch GS1 closed", "input", "digital"),
    ("Air_Pressure_OK",    "Local:1:I.Pt13.Data", "Main air pressure switch PS1 OK", "input", "digital"),
    ("Infeed_OL_OK",       "Local:1:I.Pt14.Data", "Infeed conveyor motor protector Q1 not tripped", "input", "digital"),
    ("Case_Stop_Up_PX",    "Local:1:I.Pt15.Data", "Case stop blade up (blocking infeed) prox PX3", "input", "digital"),
    ("Infeed_Conv_Run",    "Local:2:O.Pt00.Data", "Infeed conveyor motor contactor K10", "output", "digital"),
    ("Layer_Conv_Run",     "Local:2:O.Pt01.Data", "Layer forming table conveyor contactor K11", "output", "digital"),
    ("Case_Stop_Sol",      "Local:2:O.Pt02.Data", "Case stop blade raise solenoid Y1", "output", "digital"),
    ("Pusher_Extend_Sol",  "Local:2:O.Pt03.Data", "Layer pusher extend solenoid Y2 (spring return)", "output", "digital"),
    ("Elev_Up_Mtr",        "Local:2:O.Pt04.Data", "Pallet elevator hoist UP contactor K12", "output", "digital"),
    ("Elev_Down_Mtr",      "Local:2:O.Pt05.Data", "Pallet elevator hoist DOWN contactor K13", "output", "digital"),
    ("Light_Green",        "Local:2:O.Pt06.Data", "Stack light green - running", "output", "digital"),
    ("Light_Amber",        "Local:2:O.Pt07.Data", "Stack light amber - stopped / ready", "output", "digital"),
    ("Light_Red",          "Local:2:O.Pt08.Data", "Stack light red - fault", "output", "digital"),
    ("Horn",               "Local:2:O.Pt09.Data", "Alarm horn H1", "output", "digital"),
    ("Pallet_Conv_Run",    "Local:2:O.Pt10.Data", "Full pallet discharge conveyor contactor K14", "output", "digital"),
    ("Elev_Position",      "Local:3:I.Ch00.Data", "Elevator height transmitter LT1, 4-20 mA = 0-2000 mm (scaled in module)", "input", "analog"),
]
ANALOG_RANGE = {"Elev_Position": {"range": "4-20mA", "engMin": 0.0, "engMax": 2000.0, "units": "mm"}}

# ---------------------------------------------------------------- base tags
# (name, type, value/preset, description, scope)  scope C = controller, P = MainProgram
TAGS = [
    ("Cases_Per_Layer",   "INT", 6,  "HMI recipe: cases per layer", "C"),
    ("Layers_Per_Pallet", "INT", 5,  "HMI recipe: layers per pallet", "C"),
    ("HMI_Step",          "INT", 0,  "HMI display: sequencer step", "C"),
    ("HMI_Case_Count",    "DINT", 0, "HMI display: cases on layer table", "C"),
    ("HMI_Layer_Count",   "DINT", 0, "HMI display: layers on pallet", "C"),
    ("HMI_Pallet_Count",  "DINT", 0, "HMI display: pallets completed", "C"),
    ("HMI_Silence_PB",    "BOOL", 0, "HMI button: silence horn", "C"),
    ("HMI_Reset_Count",   "BOOL", 0, "HMI button: reset pallet counter", "C"),
    ("Alm",               "DINT[2]", 0, "Alarm word array (one bit per alarm, latched)", "C"),
    ("Alarm_Active",      "BOOL", 0, "Any alarm bit set", "C"),
    ("Safety_OK",         "BOOL", 0, "E-stop, guard and air all healthy", "P"),
    ("Machine_Running",   "BOOL", 0, "Machine running in automatic", "P"),
    ("Fault_Latched",     "BOOL", 0, "Fault stop latched until reset", "P"),
    ("Horn_Silenced",     "BOOL", 0, "Horn silenced by operator", "P"),
    ("Seq_Step",          "INT", 0,  "Palletizer sequencer step", "P"),
    ("Reset_ONS",         "BOOL", 0, "One-shot storage for alarm reset", "P"),
    ("Silence_ONS",       "BOOL", 0, "One-shot storage for horn silence", "P"),
    ("Case_Ctr",          "COUNTER", 6, "Cases counted onto the layer table", "P"),
    ("Layer_Ctr",         "COUNTER", 5, "Layers placed on the pallet", "P"),
    ("Pallet_Count",      "COUNTER", 32767, "Pallets completed (production total)", "P"),
    ("Infeed_Jam_Tmr",    "TIMER", 5000, "Case blocking infeed eye = jam", "P"),
    ("Pusher_Ext_Tmr",    "TIMER", 3000, "Pusher extend watchdog", "P"),
    ("Pusher_Ret_Tmr",    "TIMER", 3000, "Pusher retract watchdog", "P"),
    ("Layer_Lower_Tmr",   "TIMER", 1500, "Elevator lowering time for one layer pitch", "P"),
    ("Discharge_Tmr",     "TIMER", 3000, "Discharge run-on after pallet clears eye", "P"),
    ("Elev_Raise_Tmr",    "TIMER", 20000, "Elevator raise watchdog", "P"),
]

ALARMS = [
    # bit, text, condition (plain), stops machine
    ("Alm[0].0", "Emergency stop pressed", "E_Stop_OK off", True),
    ("Alm[0].1", "Guard door open", "Guard_Door_Closed off", True),
    ("Alm[0].2", "Low air pressure", "Air_Pressure_OK off", True),
    ("Alm[0].3", "Infeed conveyor motor overload", "Infeed_OL_OK off", True),
    ("Alm[0].4", "Pusher failed to extend", "Pusher_Ext_Tmr done (3 s in step 20)", True),
    ("Alm[0].5", "Pusher failed to retract", "Pusher_Ret_Tmr done (3 s in step 30)", True),
    ("Alm[0].6", "Elevator overtravel (height > 1950 mm)", "Elev_Position > 1950.0", True),
    ("Alm[0].7", "Case jam at infeed", "Infeed_Jam_Tmr done (case on PE1 for 5 s while infeed runs)", True),
    ("Alm[0].8", "Elevator failed to reach top", "Elev_Raise_Tmr done (20 s in step 90)", True),
]

# ---------------------------------------------------------------- routines (comment, neutral text)
R = {}
R["MainRoutine"] = [
    ("First scan: sequencer to idle", "XIC(S:FS)MOV(0,Seq_Step);"),
    ("", "JSR(Safety_Modes,0);"),
    ("", "JSR(Infeed,0);"),
    ("", "JSR(LayerForm,0);"),
    ("", "JSR(Elevator,0);"),
    ("", "JSR(Alarms,0);"),
    ("", "JSR(HMI,0);"),
]
R["Safety_Modes"] = [
    ("Safety chain healthy: E-stop relay, guard door and air pressure",
     "XIC(E_Stop_OK)XIC(Guard_Door_Closed)XIC(Air_Pressure_OK)OTE(Safety_OK);"),
    ("Machine run: Start in AUTO with Stop not pressed, safety OK and no latched fault",
     # KNOWN ISSUE 1: no seal-in branch around Start_PB
     "XIC(Start_PB)XIC(Stop_PB)XIC(Safety_OK)XIC(Auto_Sel)XIO(Fault_Latched)OTE(Machine_Running);"),
    ("Any alarm latches a fault stop", "XIC(Alarm_Active)OTL(Fault_Latched);"),
    ("Reset clears the fault stop once no alarm remains", "XIC(Reset_PB)XIO(Alarm_Active)OTU(Fault_Latched);"),
]
R["Infeed"] = [
    ("Infeed conveyor runs while the layer is accumulating (step 10)",
     "XIC(Machine_Running)EQU(Seq_Step,10)XIC(Infeed_OL_OK)OTE(Infeed_Conv_Run);"),
    ("Layer table conveyor runs with the infeed during accumulation",
     "XIC(Machine_Running)EQU(Seq_Step,10)OTE(Layer_Conv_Run);"),
    ("Cases per layer from HMI recipe", "MOV(Cases_Per_Layer,Case_Ctr.PRE);"),
    ("Count cases entering the layer table", "XIC(Infeed_Count_PE)CTU(Case_Ctr,6,0);"),
    ("Jam: case blocking the infeed eye for 5 s while the conveyor runs",
     "XIC(Infeed_Case_PE)XIC(Infeed_Conv_Run)TON(Infeed_Jam_Tmr,5000,0);"),
]
R["LayerForm"] = [
    ("Machine stopped: sequencer back to idle", "XIO(Machine_Running)MOV(0,Seq_Step);"),
    ("Step 0 -> 10: start conditions - elevator at top, pallet present, pusher retracted",
     "XIC(Machine_Running)EQU(Seq_Step,0)XIC(Elev_Up_LS)XIC(Pallet_Present_PE)XIC(Pusher_Retracted_PX)MOV(10,Seq_Step);"),
    ("Step 10 -> 20: layer complete when case count reached", "EQU(Seq_Step,10)XIC(Case_Ctr.DN)MOV(20,Seq_Step);"),
    ("Case stop blade up during push (steps 20 and 30)", "[EQU(Seq_Step,20),EQU(Seq_Step,30)]OTE(Case_Stop_Sol);"),
    ("Pusher extend: only with case stop up and a pallet on the elevator",
     # KNOWN ISSUE 2: checks Infeed_Case_PE instead of Pallet_Present_PE
     "EQU(Seq_Step,20)XIC(Case_Stop_Up_PX)XIC(Infeed_Case_PE)OTE(Pusher_Extend_Sol);"),
    ("Step 20 watchdog", "EQU(Seq_Step,20)TON(Pusher_Ext_Tmr,3000,0);"),
    ("Step 20 -> 30: pusher extended, layer is on the pallet", "EQU(Seq_Step,20)XIC(Pusher_Extended_PX)MOV(30,Seq_Step);"),
    ("Step 30 watchdog", "EQU(Seq_Step,30)TON(Pusher_Ret_Tmr,3000,0);"),
    ("Step 30 -> 40: pusher retracted, clear case count",
     "EQU(Seq_Step,30)XIC(Pusher_Retracted_PX)[RES(Case_Ctr),MOV(40,Seq_Step)];"),
]
R["Elevator"] = [
    ("Layers per pallet from HMI recipe", "MOV(Layers_Per_Pallet,Layer_Ctr.PRE);"),
    ("Step 40: lower one layer pitch (timed)", "EQU(Seq_Step,40)TON(Layer_Lower_Tmr,1500,0);"),
    ("Step 40 -> 50: count the layer", "EQU(Seq_Step,40)XIC(Layer_Lower_Tmr.DN)[CTU(Layer_Ctr,5,0),MOV(50,Seq_Step)];"),
    ("Step 50 -> 10: pallet not full, form next layer", "EQU(Seq_Step,50)XIO(Layer_Ctr.DN)MOV(10,Seq_Step);"),
    ("Step 50 -> 60: pallet full", "EQU(Seq_Step,50)XIC(Layer_Ctr.DN)MOV(60,Seq_Step);"),
    ("Step 60 -> 70: elevator at bottom", "EQU(Seq_Step,60)XIC(Elev_Down_LS)MOV(70,Seq_Step);"),
    ("Step 70: discharge full pallet", "EQU(Seq_Step,70)OTE(Pallet_Conv_Run);"),
    ("Step 70: run-on after pallet leaves the eye", "EQU(Seq_Step,70)XIO(Pallet_Present_PE)TON(Discharge_Tmr,3000,0);"),
    ("Step 70 -> 80", "EQU(Seq_Step,70)XIC(Discharge_Tmr.DN)MOV(80,Seq_Step);"),
    ("Step 80 -> 90: operator has loaded an empty pallet", "EQU(Seq_Step,80)XIC(Pallet_Present_PE)MOV(90,Seq_Step);"),
    ("Step 90 watchdog", "EQU(Seq_Step,90)TON(Elev_Raise_Tmr,20000,0);"),
    ("Step 90 -> 10: elevator back at top, clear layer count",
     "EQU(Seq_Step,90)XIC(Elev_Up_LS)[RES(Layer_Ctr),MOV(10,Seq_Step)];"),
    ("Hoist DOWN: steps 40 and 60, stop at bottom limit, not with UP",
     "[EQU(Seq_Step,40),EQU(Seq_Step,60)]XIO(Elev_Down_LS)XIO(Elev_Up_Mtr)OTE(Elev_Down_Mtr);"),
    ("Hoist UP: step 90, stop at top limit, not with DOWN",
     "EQU(Seq_Step,90)XIO(Elev_Up_LS)XIO(Elev_Down_Mtr)OTE(Elev_Up_Mtr);"),
]
R["Alarms"] = [
    ("Alarm 0: E-stop", "XIO(E_Stop_OK)OTL(Alm[0].0);"),
    ("Alarm 1: guard door", "XIO(Guard_Door_Closed)OTL(Alm[0].1);"),
    ("Alarm 2: air pressure", "XIO(Air_Pressure_OK)OTL(Alm[0].2);"),
    ("Alarm 3: infeed overload", "XIO(Infeed_OL_OK)OTL(Alm[0].3);"),
    ("Alarm 4: pusher extend timeout", "XIC(Pusher_Ext_Tmr.DN)OTL(Alm[0].4);"),
    ("Alarm 5: pusher retract timeout", "XIC(Pusher_Ret_Tmr.DN)OTL(Alm[0].5);"),
    ("Alarm 6: elevator overtravel", "GRT(Elev_Position,1950.0)OTL(Alm[0].6);"),
    ("Alarm 7: infeed jam", "XIC(Infeed_Jam_Tmr.DN)OTL(Alm[0].7);"),
    ("Alarm 8: elevator raise timeout", "XIC(Elev_Raise_Tmr.DN)OTL(Alm[0].8);"),
    ("Reset clears all alarm words (still-present conditions re-latch)",
     "XIC(Reset_PB)ONS(Reset_ONS)[MOV(0,Alm[0]),MOV(0,Alm[1])];"),
    ("Summary", "[NEQ(Alm[0],0),NEQ(Alm[1],0)]OTE(Alarm_Active);"),
]
R["HMI"] = [
    ("Green: running without alarm", "XIC(Machine_Running)XIO(Alarm_Active)OTE(Light_Green);"),
    ("Amber: stopped without alarm", "XIO(Machine_Running)XIO(Alarm_Active)OTE(Light_Amber);"),
    ("Red: any alarm", "XIC(Alarm_Active)OTE(Light_Red);"),
    ("Silence horn from HMI", "XIC(HMI_Silence_PB)ONS(Silence_ONS)OTL(Horn_Silenced);"),
    ("Re-arm horn when alarms clear", "XIO(Alarm_Active)OTU(Horn_Silenced);"),
    ("Horn", "XIC(Alarm_Active)XIO(Horn_Silenced)OTE(Horn);"),
    ("Count completed pallets", "XIC(Layer_Ctr.DN)CTU(Pallet_Count,32767,0);"),
    ("Reset pallet total from HMI", "XIC(HMI_Reset_Count)RES(Pallet_Count);"),
    ("HMI values", "[MOV(Seq_Step,HMI_Step),MOV(Case_Ctr.ACC,HMI_Case_Count),MOV(Layer_Ctr.ACC,HMI_Layer_Count),MOV(Pallet_Count.ACC,HMI_Pallet_Count)];"),
]
ROUTINE_ORDER = ["MainRoutine", "Safety_Modes", "Infeed", "LayerForm", "Elevator", "Alarms", "HMI"]


def rung_ref(routine, needle):
    for i, (_, t) in enumerate(R[routine]):
        if needle in t:
            return i
    raise KeyError(needle)


# ---------------------------------------------------------------- XML writing
def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def cdata(s):
    return "<![CDATA[" + s + "]]>"


def member(name, typ, val):
    radix = ' Radix="Decimal"' if typ == "DINT" else ""
    return f'<DataValueMember Name="{name}" DataType="{typ}"{radix} Value="{val}"/>'


def tag_xml(name, typ, val, desc, ind):
    i = ind
    lines = []
    if typ == "DINT[2]":
        lines.append(f'{i}<Tag Name="{name}" TagType="Base" DataType="DINT" Dimensions="2" Radix="Decimal" Constant="false" ExternalAccess="Read/Write">')
        lines.append(f'{i}<Description>\n{i}{cdata(desc)}\n{i}</Description>')
        lines.append(f'{i}<Comments>')
        for bit, text, _, _ in ALARMS:
            op = bit[len(name):]
            lines.append(f'{i}<Comment Operand="{op}">\n{i}{cdata(text)}\n{i}</Comment>')
        lines.append(f'{i}</Comments>')
        lines.append(f'{i}<Data Format="L5K">\n{i}{cdata("[0,0]")}\n{i}</Data>')
        lines.append(f'{i}<Data Format="Decorated">\n{i}<Array DataType="DINT" Dimensions="2" Radix="Decimal">')
        lines.append(f'{i}<Element Index="[0]" Value="0"/>\n{i}<Element Index="[1]" Value="0"/>\n{i}</Array>\n{i}</Data>')
        lines.append(f'{i}</Tag>')
        return "\n".join(lines)
    radix = {"BOOL": ' Radix="Decimal"', "INT": ' Radix="Decimal"', "DINT": ' Radix="Decimal"', "REAL": ' Radix="Float"'}.get(typ, "")
    lines.append(f'{i}<Tag Name="{name}" TagType="Base" DataType="{typ}"{radix} Constant="false" ExternalAccess="Read/Write">')
    lines.append(f'{i}<Description>\n{i}{cdata(desc)}\n{i}</Description>')
    if typ == "TIMER":
        l5k, dec = f"[0,{val},0]", [f'<Structure DataType="TIMER">', member("PRE", "DINT", val), member("ACC", "DINT", 0),
                                      member("EN", "BOOL", 0), member("TT", "BOOL", 0), member("DN", "BOOL", 0), "</Structure>"]
    elif typ == "COUNTER":
        l5k, dec = f"[0,{val},0]", [f'<Structure DataType="COUNTER">', member("PRE", "DINT", val), member("ACC", "DINT", 0),
                                      member("CU", "BOOL", 0), member("CD", "BOOL", 0), member("DN", "BOOL", 0),
                                      member("OV", "BOOL", 0), member("UN", "BOOL", 0), "</Structure>"]
    else:
        l5k = str(val)
        dec = [f'<DataValue DataType="{typ}"{radix} Value="{val}"/>']
    lines.append(f'{i}<Data Format="L5K">\n{i}{cdata(l5k)}\n{i}</Data>')
    lines.append(f'{i}<Data Format="Decorated">')
    lines.extend(i + d for d in dec)
    lines.append(f'{i}</Data>')
    lines.append(f'{i}</Tag>')
    return "\n".join(lines)


def alias_xml(name, point, desc, ind):
    return (f'{ind}<Tag Name="{name}" TagType="Alias" Radix="Decimal" AliasFor="{point}" ExternalAccess="Read/Write">\n'
            f'{ind}<Description>\n{ind}{cdata(desc)}\n{ind}</Description>\n{ind}</Tag>')


def module_xml(m, ind):
    name, cat, slot, ptype, pcode, major, minor, desc = m
    i = ind
    if name == "Local":
        return "\n".join([
            f'{i}<Module Name="Local" CatalogNumber="{cat}" Vendor="1" ProductType="{ptype}" ProductCode="{pcode}" Major="{major}" Minor="{minor}" ParentModule="Local" ParentModPortId="1" Inhibited="false" MajorFault="true">',
            f'{i}<Description>\n{i}{cdata(desc)}\n{i}</Description>',
            f'{i}<EKey State="Disabled"/>',
            f'{i}<Ports>',
            f'{i}<Port Id="1" Address="0" Type="Compact" Upstream="false">\n{i}<Bus Size="17"/>\n{i}</Port>',
            f'{i}<Port Id="2" Address="192.168.1.20" Type="Ethernet" Upstream="false">\n{i}<Bus/>\n{i}</Port>',
            f'{i}</Ports>',
            f'{i}</Module>'])
    conn = "Input" if "IB" in cat or "IF" in cat else "Output"
    lines = [
        f'{i}<Module Name="{name}" CatalogNumber="{cat}" Vendor="1" ProductType="{ptype}" ProductCode="{pcode}" Major="{major}" Minor="{minor}" ParentModule="Local" ParentModPortId="1" Inhibited="false" MajorFault="false">',
        f'{i}<Description>\n{i}{cdata(desc)}\n{i}</Description>',
        f'{i}<EKey State="CompatibleModule"/>',
        f'{i}<Ports>\n{i}<Port Id="1" Address="{slot}" Type="Compact" Upstream="true"/>\n{i}</Ports>',
        f'{i}<Communications>',
    ]
    if cat.startswith("5069-IF8"):
        r = ANALOG_RANGE["Elev_Position"]
        lines += [
            f'{i}<ConfigTag ConfigSize="0" ExternalAccess="Read/Write">',
            f'{i}<Data Format="Decorated">',
            f'{i}<Structure DataType="AB:5000_AI8:C:0">',
            f'{i}<StructureMember Name="Ch00" DataType="AB:5000_AI_Ch_Config_Struct:C:0">',
            f'{i}<DataValueMember Name="Disable" DataType="BOOL" Value="0"/>',
            f'{i}<DataValueMember Name="RangeType" DataType="SINT" Radix="Decimal" Value="1"/>',
            f'{i}<DataValueMember Name="LowSignal" DataType="REAL" Radix="Float" Value="4.0"/>',
            f'{i}<DataValueMember Name="HighSignal" DataType="REAL" Radix="Float" Value="20.0"/>',
            f'{i}<DataValueMember Name="LowEngineering" DataType="REAL" Radix="Float" Value="{r["engMin"]}"/>',
            f'{i}<DataValueMember Name="HighEngineering" DataType="REAL" Radix="Float" Value="{r["engMax"]}"/>',
            f'{i}</StructureMember>',
            f'{i}</Structure>',
            f'{i}</Data>',
            f'{i}</ConfigTag>',
        ]
    lines += [
        f'{i}<Connections>',
        f'{i}<Connection Name="{conn}Data" RPI="2000" Type="{conn}" EventID="0" ProgrammaticallySendEventTrigger="false"/>',
        f'{i}</Connections>',
        f'{i}</Communications>',
        f'{i}</Module>',
    ]
    return "\n".join(lines)


def build_l5x():
    ctl_tags = [alias_xml(n, p, d, "") for n, p, d, _, _ in IO]
    ctl_tags += [tag_xml(n, t, v, d, "") for n, t, v, d, s in TAGS if s == "C"]
    prg_tags = [tag_xml(n, t, v, d, "") for n, t, v, d, s in TAGS if s == "P"]
    routines = []
    for rn in ROUTINE_ORDER:
        rungs = []
        for k, (c, t) in enumerate(R[rn]):
            parts = [f'<Rung Number="{k}" Type="N">']
            if c:
                parts.append(f"<Comment>\n{cdata(c)}\n</Comment>")
            parts.append(f"<Text>\n{cdata(t)}\n</Text>")
            parts.append("</Rung>")
            rungs.append("\n".join(parts))
        routines.append(f'<Routine Name="{rn}" Type="RLL">\n<RLLContent>\n' + "\n".join(rungs) + "\n</RLLContent>\n</Routine>")
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<RSLogix5000Content SchemaRevision="1.0" SoftwareRevision="{REV[0]}.{REV[1]}" TargetName="{CONTROLLER}" TargetType="Controller" ContainsContext="false" ExportDate="{EXPORT_DATE}" ExportOptions="NoRawData L5KData DecoratedData ForceProtectedEncoding AllProjDocTrans">
<Controller Use="Target" Name="{CONTROLLER}" ProcessorType="{CPU}" MajorRev="{REV[0]}" MinorRev="{REV[1]}" TimeSlice="20" ShareUnusedTimeSlice="1" ProjectCreationDate="{CREATED}" LastModifiedDate="{EXPORT_DATE}" SFCExecutionControl="CurrentActive" SFCRestartPosition="MostRecent" SFCLastScan="DontScan" ProjectSN="16#2b7e_1a04" MatchProjectToController="false" CanUseRPIFromProducer="false" InhibitAutomaticFirmwareUpdate="0" PassThroughConfiguration="EnabledWithAppend" DownloadProjectDocumentationAndExtendedProperties="true" DownloadProjectCustomProperties="true" ReportMinorOverflow="false">
<Description>
{cdata("PL01 layer palletizer - line 3 end of line. CompactLogix 5380 " + CPU + ".")}
</Description>
<RedundancyInfo Enabled="false" KeepTestEditsOnSwitchOver="false" IOMemoryPadPercentage="90" DataTablePadPercentage="50"/>
<Security Code="0" ChangesToDetect="16#ffff_ffff_ffff_ffff"/>
<SafetyInfo/>
<DataTypes/>
<Modules>
{chr(10).join(module_xml(m, "") for m in MODULES)}
</Modules>
<AddOnInstructionDefinitions/>
<Tags>
{chr(10).join(ctl_tags)}
</Tags>
<Programs>
<Program Name="MainProgram" TestEdits="false" MainRoutineName="MainRoutine" Disabled="false" UseAsFolder="false">
<Description>
{cdata("Palletizer machine program")}
</Description>
<Tags>
{chr(10).join(prg_tags)}
</Tags>
<Routines>
{chr(10).join(routines)}
</Routines>
</Program>
</Programs>
<Tasks>
<Task Name="MainTask" Type="CONTINUOUS" Priority="10" Watchdog="500" DisableUpdateOutputs="false" InhibitTask="false">
<ScheduledPrograms>
<ScheduledProgram Name="MainProgram"/>
</ScheduledPrograms>
</Task>
</Tasks>
<CST MasterID="0"/>
<WallClockTime LocalTimeAdjustment="0" TimeZone="0"/>
<Trends/>
<DataLogs/>
<TimeSynchronize Priority1="128" Priority2="128" PTPEnable="false"/>
<EthernetPorts>
<EthernetPort Port="1" Label="1" PortEnabled="true"/>
</EthernetPorts>
</Controller>
</RSLogix5000Content>
'''


# ---------------------------------------------------------------- answer key
def build_expected():
    tmap = {n: (t, v, d) for n, t, v, d, _ in TAGS}
    loc = lambda rn, needle: f"MainProgram/{rn}, rung {rung_ref(rn, needle)}"
    timers = []
    for n, t, v, d, _ in TAGS:
        if t == "TIMER":
            rn = next(r for r in ROUTINE_ORDER if any(f"TON({n}," in x for _, x in R[r]))
            timers.append({"name": n, "type": "TON", "presetMs": v, "purpose": d, "where": loc(rn, f"TON({n},")})
    counters = []
    for n, t, v, d, _ in TAGS:
        if t == "COUNTER":
            rn = next(r for r in ROUTINE_ORDER if any(f"CTU({n}," in x for _, x in R[r]))
            pre = {"Case_Ctr": "Cases_Per_Layer (default 6, copied to .PRE every scan)",
                   "Layer_Ctr": "Layers_Per_Pallet (default 5, copied to .PRE every scan)",
                   "Pallet_Count": "32767"}[n]
            reset = {"Case_Ctr": "RES in step 30 -> 40", "Layer_Ctr": "RES in step 90 -> 10",
                     "Pallet_Count": "RES from HMI_Reset_Count"}[n]
            counters.append({"name": n, "type": "CTU", "preset": v, "presetSource": pre, "purpose": d, "reset": reset,
                             "where": loc(rn, f"CTU({n},")})
    return {
        "fixture": "ab-palletizer-01",
        "sourceFiles": [L5X_NAME],
        "format": "Rockwell Studio 5000 Logix Designer L5X (full controller export, v33.11), RLL neutral text",
        "machine": ("Simple single-row layer palletizer (PL01) at the end of a case packing line. Cases arrive on an infeed "
                    "conveyor and are counted onto a layer forming table by photo eye PE2. When the recipe count of cases "
                    "(Cases_Per_Layer, default 6) is reached, the infeed stops, a case stop blade rises and a pneumatic pusher "
                    "sweeps the layer onto a pallet carried by a hoist elevator. The elevator then lowers one layer pitch "
                    "(timed 1.5 s). After Layers_Per_Pallet layers (default 5) the elevator goes to the bottom, the full pallet "
                    "is discharged on a powered conveyor, the operator loads an empty pallet and the elevator returns to the "
                    "top. A 4-20 mA height transmitter guards against overtravel; alarms are latched bits in a DINT array and "
                    "shown on a stack light and horn."),
        "plc": {
            "brand": "Allen-Bradley (Rockwell Automation)",
            "family": "CompactLogix 5380",
            "cpu": CPU,
            "firmware": f"{REV[0]}.{REV[1]}",
            "software": "Studio 5000 Logix Designer",
            "controllerName": CONTROLLER,
            "modules": [{"slot": s, "name": n, "catalog": c, "description": d} for n, c, s, _, _, _, _, d in MODULES],
            "tasks": [{"name": "MainTask", "type": "CONTINUOUS", "programs": ["MainProgram"]}],
            "routines": ROUTINE_ORDER,
        },
        "io": [dict({"address": p, "tag": n, "description": d, "type": t, "signal": s},
                    **({"analog": ANALOG_RANGE[n]} if n in ANALOG_RANGE else {})) for n, p, d, t, s in IO],
        "sequence": {
            "register": "Seq_Step (INT, MainProgram scope)",
            "steps": [
                {"step": 0, "name": "Idle", "description": "Machine stopped or waiting. Goes to 10 when running, elevator at top (Elev_Up_LS), pallet present and pusher retracted. Any time Machine_Running drops, the step is forced back to 0."},
                {"step": 10, "name": "Accumulate layer", "description": "Infeed and layer table conveyors run; PE2 counts cases with Case_Ctr. When Case_Ctr.DN (count reached) go to 20."},
                {"step": 20, "name": "Push layer", "description": "Infeed stops, case stop blade rises, pusher extends the layer onto the pallet. When Pusher_Extended_PX go to 30 (3 s watchdog)."},
                {"step": 30, "name": "Retract pusher", "description": "Pusher solenoid off (spring return), case stop still up. When Pusher_Retracted_PX reset Case_Ctr and go to 40 (3 s watchdog)."},
                {"step": 40, "name": "Lower one layer", "description": "Hoist runs down for Layer_Lower_Tmr (1.5 s); then Layer_Ctr counts the layer and go to 50."},
                {"step": 50, "name": "Pallet full?", "description": "If Layer_Ctr not done go back to 10 for the next layer, otherwise go to 60."},
                {"step": 60, "name": "Lower to bottom", "description": "Hoist runs down until Elev_Down_LS, then go to 70."},
                {"step": 70, "name": "Discharge pallet", "description": "Discharge conveyor runs; 3 s after the pallet clears PE3 go to 80."},
                {"step": 80, "name": "Wait empty pallet", "description": "Wait for the operator to place an empty pallet (Pallet_Present_PE), then go to 90."},
                {"step": 90, "name": "Raise elevator", "description": "Hoist runs up until Elev_Up_LS (20 s watchdog), reset Layer_Ctr and go back to 10."},
            ],
        },
        "timers": timers,
        "counters": counters,
        "alarms": [{"address": b, "text": t, "condition": c, "stopsMachine": s, "latched": True,
                    "reset": "Reset_PB (one-shot) clears Alm[0] and Alm[1]"} for b, t, c, s in ALARMS],
        "interlocks": [
            {"output": "Machine_Running", "requires": ["Stop_PB", "Safety_OK", "Auto_Sel", "NOT Fault_Latched"], "where": loc("Safety_Modes", "OTE(Machine_Running)")},
            {"output": "Safety_OK", "requires": ["E_Stop_OK", "Guard_Door_Closed", "Air_Pressure_OK"], "where": loc("Safety_Modes", "OTE(Safety_OK)")},
            {"output": "Infeed_Conv_Run", "requires": ["Machine_Running", "Seq_Step = 10", "Infeed_OL_OK"], "where": loc("Infeed", "OTE(Infeed_Conv_Run)")},
            {"output": "Pusher_Extend_Sol", "requires": ["Seq_Step = 20", "Case_Stop_Up_PX", "Pallet_Present_PE (intended; program actually checks Infeed_Case_PE - see knownIssues)"], "where": loc("LayerForm", "OTE(Pusher_Extend_Sol)")},
            {"output": "Elev_Down_Mtr", "requires": ["Seq_Step = 40 or 60", "NOT Elev_Down_LS", "NOT Elev_Up_Mtr"], "where": loc("Elevator", "OTE(Elev_Down_Mtr)")},
            {"output": "Elev_Up_Mtr", "requires": ["Seq_Step = 90", "NOT Elev_Up_LS", "NOT Elev_Down_Mtr"], "where": loc("Elevator", "OTE(Elev_Up_Mtr)")},
            {"output": "Seq_Step 0 -> 10", "requires": ["Machine_Running", "Elev_Up_LS", "Pallet_Present_PE", "Pusher_Retracted_PX"], "where": loc("LayerForm", "MOV(10,Seq_Step)")},
        ],
        "knownIssues": [
            {
                "id": "AB-1",
                "where": loc("Safety_Modes", "OTE(Machine_Running)"),
                "rungText": R["Safety_Modes"][rung_ref("Safety_Modes", "OTE(Machine_Running)")][1],
                "what": "Missing seal-in: Machine_Running has no parallel XIC(Machine_Running) branch around Start_PB, so the machine only runs while Start is held and the sequencer drops back to step 0 as soon as the button is released.",
                "fix": "[XIC(Start_PB),XIC(Machine_Running)]XIC(Stop_PB)XIC(Safety_OK)XIC(Auto_Sel)XIO(Fault_Latched)OTE(Machine_Running);",
            },
            {
                "id": "AB-2",
                "where": loc("LayerForm", "OTE(Pusher_Extend_Sol)"),
                "rungText": R["LayerForm"][rung_ref("LayerForm", "OTE(Pusher_Extend_Sol)")][1],
                "what": "Interlock checks the wrong sensor: the rung comment says the pusher may only extend with a pallet on the elevator, but the rung examines Infeed_Case_PE (Local:1:I.Pt05) instead of Pallet_Present_PE (Local:1:I.Pt11). The pusher can push a layer onto an empty elevator, or refuse to push (and raise a pusher timeout) when no case is sitting at the infeed eye.",
                "fix": "EQU(Seq_Step,20)XIC(Case_Stop_Up_PX)XIC(Pallet_Present_PE)OTE(Pusher_Extend_Sol);",
            },
        ],
    }


# ---------------------------------------------------------------- self-check
def check(xml_text, expected):
    ET.fromstring(xml_text.encode("utf-8"))
    names = {n for n, *_ in IO} | {n for n, *_ in TAGS} | set(ROUTINE_ORDER) | {"S:FS"}
    for rn in ROUTINE_ORDER:
        for _, t in R[rn]:
            assert t.endswith(";"), t
            assert t.count("[") == t.count("]") and t.count("(") == t.count(")"), t
            for args in re.findall(r"[A-Z]{2,4}\(([^()]*)\)", t):
                for a in args.split(","):
                    a = a.strip()
                    if not a or re.fullmatch(r"-?\d+(\.\d+)?", a):
                        continue
                    base = re.split(r"[.\[]", a)[0] if a != "S:FS" else a
                    assert base in names, f"{rn}: unknown operand {a}"
    io_names = {x["tag"] for x in expected["io"]}
    for x in expected["io"]:
        assert f'Name="{x["tag"]}"' in xml_text and f'AliasFor="{x["address"]}"' in xml_text
    used = " ".join(t for rn in ROUTINE_ORDER for _, t in R[rn])
    for n in io_names:
        assert n in used, f"I/O {n} never used"
    for t in expected["timers"]:
        assert f'TON({t["name"]},{t["presetMs"]},0)' in used
    for c in expected["counters"]:
        assert f'CTU({c["name"]},{c["preset"]},0)' in used
    for a in expected["alarms"]:
        assert f"OTL({a['address']})" in used and a["text"] in xml_text
    for k in expected["knownIssues"]:
        assert k["rungText"] in xml_text


def main():
    xml_text = build_l5x()
    expected = build_expected()
    check(xml_text, expected)
    with open(os.path.join(OUT, L5X_NAME), "w", encoding="utf-8", newline="\r\n") as f:
        f.write(xml_text)
    with open(os.path.join(OUT, "expected.json"), "w", encoding="utf-8") as f:
        json.dump(expected, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print("wrote", L5X_NAME, "and expected.json")


if __name__ == "__main__":
    main()
