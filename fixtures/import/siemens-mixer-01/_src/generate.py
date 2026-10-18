#!/usr/bin/env python3
"""Generate the siemens-mixer-01 test fixture.

Outputs (next to _src/):
  MixTank_MT01.xml        PLCopen TC6 XML 2.01: FB_Mixer (LD body), FC_ScaleAnalog (ST/SCL body),
                          global PLC tags in the resource, OB1 cycle task
  PLC_Tags_MT01.csv       TIA Portal PLC tag table export (columns of the TIA .xlsx export, saved as CSV)
  expected.json           answer key

Run:  python3 -I _src/generate.py   (self-checks XML well-formedness and expected-vs-program consistency)
"""
import csv
import io
import json
import os
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.dirname(HERE)
XML_NAME = "MixTank_MT01.xml"
CSV_NAME = "PLC_Tags_MT01.csv"
STAMP = "2026-08-27T10:41:12"
NS = "http://www.plcopen.org/xml/tc6_0201"

CPU = {"name": "PLC_1", "type": "CPU 1214C DC/DC/DC", "order": "6ES7214-1AG40-0XB0", "firmware": "V4.6"}
MODULES = [
    {"slot": 1, "name": "PLC_1", "order": "6ES7214-1AG40-0XB0", "description": "CPU 1214C DC/DC/DC, 14 DI 24 V DC / 10 DQ 24 V DC / 2 AI 0-10 V (onboard AI unused)"},
    {"slot": 2, "name": "AI 4x13BIT_1", "order": "6ES7231-4HD32-0XB0", "description": "SM 1231 AI 4 x 13 bit, channels 0-1 set to current 4-20 mA, I address IW96..IW103"},
]

# name, address, data type, comment, io type, signal
IO = [
    ("Start_PB",            "%I0.0", "Bool", "Start pushbutton S1 (NO)", "input", "digital"),
    ("Stop_PB",             "%I0.1", "Bool", "Stop pushbutton S2 (NC, TRUE = not pressed)", "input", "digital"),
    ("EStop_OK",            "%I0.2", "Bool", "E-stop safety relay K0 OK", "input", "digital"),
    ("Agitator_Running",    "%I0.3", "Bool", "Agitator contactor K3 auxiliary contact (running feedback)", "input", "digital"),
    ("Agitator_OL_OK",      "%I0.4", "Bool", "Agitator motor protector Q3 not tripped", "input", "digital"),
    ("LSHH_OK",             "%I0.5", "Bool", "High-high level switch LSHH101 (NC, TRUE = level not high-high)", "input", "digital"),
    ("Outlet_Valve_Closed", "%I0.6", "Bool", "Outlet valve XV103 closed limit switch", "input", "digital"),
    ("Lid_Closed",          "%I0.7", "Bool", "Tank lid / manway closed switch", "input", "digital"),
    ("Reset_PB",            "%I1.0", "Bool", "Reset / acknowledge pushbutton S3 (NO)", "input", "digital"),
    ("Heater_OT_OK",        "%I1.1", "Bool", "Heater safety thermostat TSH102 OK (not over-temperature)", "input", "digital"),
    ("Inlet_Valve_A",       "%Q0.0", "Bool", "Ingredient A (water) inlet valve XV101", "output", "digital"),
    ("Inlet_Valve_B",       "%Q0.1", "Bool", "Ingredient B (syrup) inlet valve XV102", "output", "digital"),
    ("Outlet_Valve",        "%Q0.2", "Bool", "Outlet / drain valve XV103", "output", "digital"),
    ("Agitator_Run",        "%Q0.3", "Bool", "Agitator motor M1 contactor K3", "output", "digital"),
    ("Heater_On",           "%Q0.4", "Bool", "Immersion heater E1 contactor K4", "output", "digital"),
    ("Lamp_Running",        "%Q0.5", "Bool", "Batch running lamp H1 (green)", "output", "digital"),
    ("Lamp_Fault",          "%Q0.6", "Bool", "Fault lamp H2 (red)", "output", "digital"),
    ("Lamp_Batch_Done",     "%Q0.7", "Bool", "Batch complete lamp H3 (white)", "output", "digital"),
    ("Level_Raw",           "%IW96", "Int", "Level transmitter LT101, 4-20 mA = 0-100 % (SM 1231 ch0, raw 0..27648)", "input", "analog"),
    ("Temp_Raw",            "%IW98", "Int", "Temperature transmitter TT101, 4-20 mA = 0-150 degC (SM 1231 ch1, raw 0..27648)", "input", "analog"),
]
ANALOG = {
    "Level_Raw": {"range": "4-20mA", "rawMin": 0, "rawMax": 27648, "engMin": 0.0, "engMax": 100.0, "units": "%", "scaledTo": "Level_Pct"},
    "Temp_Raw": {"range": "4-20mA", "rawMin": 0, "rawMax": 27648, "engMin": 0.0, "engMax": 150.0, "units": "degC", "scaledTo": "Temp_C"},
}
MEMORY = [("HMI_Reset_Count", "%M10.0", "Bool", "HMI button: reset batch counter")]

# FB_Mixer statics: name, type, initial, comment
STATICS = [
    ("S_Idle", "BOOL", "TRUE", "Step: idle, ready for start"),
    ("S_FillA", "BOOL", None, "Step: fill ingredient A"),
    ("S_FillB", "BOOL", None, "Step: fill ingredient B"),
    ("S_Heat", "BOOL", None, "Step: heat with agitation"),
    ("S_Mix", "BOOL", None, "Step: timed mix at temperature"),
    ("S_Drain", "BOOL", None, "Step: drain tank"),
    ("S_Done", "BOOL", None, "Step: batch complete, wait for acknowledge"),
    ("Fault", "BOOL", None, "Any alarm active"),
    ("Alm_EStop", "BOOL", None, "Alarm: emergency stop"),
    ("Alm_AgitOverload", "BOOL", None, "Alarm: agitator motor overload"),
    ("Alm_HeaterOvertemp", "BOOL", None, "Alarm: heater safety thermostat tripped"),
    ("Alm_LevelHH", "BOOL", None, "Alarm: tank level high-high"),
    ("Alm_LevelSensor", "BOOL", None, "Alarm: level transmitter wire break / out of range"),
    ("Alm_TempSensor", "BOOL", None, "Alarm: temperature transmitter wire break / out of range"),
    ("Alm_AgitFeedback", "BOOL", None, "Alarm: agitator commanded but no running feedback"),
    ("Alm_FillTimeout", "BOOL", None, "Alarm: filling took longer than 10 min"),
    ("Level_Pct", "REAL", None, "Tank level, %"),
    ("Temp_C", "REAL", None, "Tank temperature, degC"),
    ("Level_Fault", "BOOL", None, "Level input out of range"),
    ("Temp_Fault", "BOOL", None, "Temperature input out of range"),
    ("Level_Above_Min", "BOOL", None, "Level above agitator / heater minimum"),
    ("SP_Level_A", "REAL", "40.0", "Setpoint: level after ingredient A, %"),
    ("SP_Level_B", "REAL", "80.0", "Setpoint: level after ingredient B, %"),
    ("SP_Temp", "REAL", "65.0", "Setpoint: batch temperature, degC"),
    ("Agit_Min_Level", "REAL", "20.0", "Minimum level for agitator and heater, %"),
    ("SP_Drain_Empty", "REAL", "3.0", "Level considered empty when draining, %"),
    ("Mix_Time", "TIME", "T#5M", "Mix time at temperature"),
    ("Batch_Count", "INT", None, "Completed batches"),
    ("T_AgitFB", "TON", None, "Agitator feedback watchdog"),
    ("T_FillTimeout", "TON", None, "Fill watchdog"),
    ("T_Mix", "TON", None, "Mix timer"),
    ("T_DrainDelay", "TON", None, "Drain run-on after empty"),
    ("C_Batch", "CTU", None, "Batch counter"),
]

# ---------------------------------------------------------------- LD network description
NO = lambda v: ("C", v, False, "none")
NC = lambda v: ("C", v, True, "none")
P = lambda v: ("C", v, False, "rising")
PAR = lambda *b: ("PAR", [x if isinstance(x, list) else [x] for x in b])
def BLK(typ, inst, ins, outs, power_in, power_out):
    return ("B", typ, inst, ins, outs, power_in, power_out)
GE = lambda a, b: BLK("GE", None, {"EN": None, "IN1": a, "IN2": b}, {"ENO": None, "OUT": None}, "EN", "OUT")
LE = lambda a, b: BLK("LE", None, {"EN": None, "IN1": a, "IN2": b}, {"ENO": None, "OUT": None}, "EN", "OUT")
LT = lambda a, b: BLK("LT", None, {"EN": None, "IN1": a, "IN2": b}, {"ENO": None, "OUT": None}, "EN", "OUT")
TON = lambda inst, pt: BLK("TON", inst, {"IN": None, "PT": pt}, {"Q": None, "ET": None}, "IN", "Q")
OUT = lambda v: ("COIL", v, "none")
SET = lambda v: ("COIL", v, "set")
RST = lambda v: ("COIL", v, "reset")

ALARM_DEF = [
    ("Alm_EStop", "Emergency stop pressed", NC("EStop_OK"), "EStop_OK FALSE"),
    ("Alm_AgitOverload", "Agitator motor overload", NC("Agitator_OL_OK"), "Agitator_OL_OK FALSE"),
    ("Alm_HeaterOvertemp", "Heater safety thermostat tripped", NC("Heater_OT_OK"), "Heater_OT_OK FALSE"),
    ("Alm_LevelHH", "Tank level high-high", NC("LSHH_OK"), "LSHH_OK FALSE"),
    ("Alm_LevelSensor", "Level transmitter fault", NO("Level_Fault"), "FC_ScaleAnalog Fault output for Level_Raw"),
    ("Alm_TempSensor", "Temperature transmitter fault", NO("Temp_Fault"), "FC_ScaleAnalog Fault output for Temp_Raw"),
    ("Alm_AgitFeedback", "Agitator no running feedback", [NO("Agitator_Run"), NC("Agitator_Running"), TON("T_AgitFB", "T#3S")], "Agitator_Run without Agitator_Running for 3 s"),
    ("Alm_FillTimeout", "Fill timeout", [PAR(NO("S_FillA"), NO("S_FillB")), TON("T_FillTimeout", "T#10M")], "S_FillA or S_FillB active for 10 min"),
]
STEPS = ["S_FillA", "S_FillB", "S_Heat", "S_Mix", "S_Drain", "S_Done"]
SCALE = lambda raw, lo, hi, val, flt: BLK("FC_ScaleAnalog", None, {"EN": None, "Raw": raw, "LoEng": lo, "HiEng": hi},
                                         {"ENO": None, "Ret_Val": val, "Fault": flt}, "EN", "ENO")

NETWORKS = [
    ("Scale level transmitter LT101 (4-20 mA -> 0-100 %)", [SCALE("Level_Raw", "0.0", "100.0", "Level_Pct", "Level_Fault")], []),
    ("Scale temperature transmitter TT101 (4-20 mA -> 0-150 degC)", [SCALE("Temp_Raw", "0.0", "150.0", "Temp_C", "Temp_Fault")], []),
    ("Level above minimum for agitator and heater", [GE("Level_Pct", "Agit_Min_Level")], [OUT("Level_Above_Min")]),
]
for name, text, cond, _ in ALARM_DEF:
    NETWORKS.append((f"Alarm: {text}", cond if isinstance(cond, list) else [cond], [SET(name)]))
NETWORKS += [
    ("Acknowledge alarms (conditions still present set again)", [NO("Reset_PB")], [RST(a[0]) for a in ALARM_DEF]),
    ("Fault summary", [PAR(*[NO(a[0]) for a in ALARM_DEF])], [OUT("Fault")]),
    ("Stop or fault: abort batch, back to idle", [PAR(NC("Stop_PB"), NO("Fault"))], [RST(s) for s in STEPS] + [SET("S_Idle")]),
    ("Idle -> Fill A: start with outlet closed and lid closed",
     [NO("S_Idle"), P("Start_PB"), NO("Stop_PB"), NC("Fault"), NO("Outlet_Valve_Closed"), NO("Lid_Closed")], [RST("S_Idle"), SET("S_FillA")]),
    ("Fill A -> Fill B at level setpoint A", [NO("S_FillA"), GE("Level_Pct", "SP_Level_A")], [RST("S_FillA"), SET("S_FillB")]),
    ("Fill B -> Heat at level setpoint B", [NO("S_FillB"), GE("Level_Pct", "SP_Level_B")], [RST("S_FillB"), SET("S_Heat")]),
    ("Heat -> Mix at temperature setpoint", [NO("S_Heat"), GE("Temp_C", "SP_Temp")], [RST("S_Heat"), SET("S_Mix")]),
    ("Mix for Mix_Time, then drain", [NO("S_Mix"), TON("T_Mix", "Mix_Time")], [RST("S_Mix"), SET("S_Drain")]),
    ("Drain until empty plus 10 s", [NO("S_Drain"), LE("Level_Pct", "SP_Drain_Empty"), TON("T_DrainDelay", "T#10S")], [RST("S_Drain"), SET("S_Done")]),
    ("Count completed batches",
     [NO("S_Done"), BLK("CTU", "C_Batch", {"CU": None, "R": "HMI_Reset_Count", "PV": "9999"}, {"Q": None, "CV": "Batch_Count"}, "CU", "Q")], []),
    ("Done -> Idle on acknowledge", [NO("S_Done"), NO("Reset_PB")], [RST("S_Done"), SET("S_Idle")]),
    ("Inlet valve A", [NO("S_FillA"), NC("Fault"), NO("LSHH_OK"), NO("Outlet_Valve_Closed")], [OUT("Inlet_Valve_A")]),
    ("Inlet valve B", [NO("S_FillB"), NC("Fault"), NO("LSHH_OK"), NO("Outlet_Valve_Closed")], [OUT("Inlet_Valve_B")]),
    ("Agitator: heat and mix steps, overload OK, lid closed, level above minimum",
     [PAR(NO("S_Heat"), NO("S_Mix")), NC("Fault"), NO("Agitator_OL_OK"), NO("Lid_Closed"), NO("Level_Above_Min")], [OUT("Agitator_Run")]),
    ("Heater: heat and mix steps, agitator running, level above minimum, thermostat OK, below setpoint",
     [PAR(NO("S_Heat"), NO("S_Mix")), NC("Fault"), NO("Agitator_Running"), NO("Level_Above_Min"), NO("Heater_OT_OK"), LT("Temp_C", "SP_Temp")], [OUT("Heater_On")]),
    ("Outlet valve", [NO("S_Drain"), NC("Fault")], [OUT("Outlet_Valve")]),
    ("Running lamp", [PAR(*[NO(s) for s in STEPS[:-1]])], [OUT("Lamp_Running")]),
    ("Fault lamp", [NO("Fault")], [OUT("Lamp_Fault")]),
    ("Batch done lamp", [NO("S_Done")], [OUT("Lamp_Batch_Done")]),
]

FC_ST = """// Scale an S7 analog input word from a 4-20 mA channel to engineering units.
// S7-1200 nominal range for 4-20 mA: 4 mA = 0, 20 mA = 27648; overrange up to 32511,
// 32767 (16#7FFF) = wire break / overflow, -4864 = underrange limit.
IF #Raw > 32511 OR #Raw < -4864 THEN
    #Fault := TRUE;
    #FC_ScaleAnalog := #LoEng;
    RETURN;
END_IF;
#Fault := FALSE;

// Normalise raw counts to 0.0 .. 1.0
#Norm := NORM_X(MIN := 0, VALUE := #Raw, MAX := 32767);

// Engineering units
#FC_ScaleAnalog := SCALE_X(MIN := #LoEng, VALUE := #Norm, MAX := #HiEng);
"""
BUG_LINE = "#Norm := NORM_X(MIN := 0, VALUE := #Raw, MAX := 32767);"


# ---------------------------------------------------------------- XML helpers
def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def doc(text, ind):
    return f'{ind}<documentation>\n{ind}  <xhtml:p>{esc(text)}</xhtml:p>\n{ind}</documentation>'


ELEM_TYPE = {"BOOL": "<BOOL/>", "REAL": "<REAL/>", "INT": "<INT/>", "TIME": "<TIME/>"}


def var_xml(name, typ, init, comment, ind, address=None):
    t = ELEM_TYPE.get(typ.upper(), f'<derived name="{typ}"/>')
    addr = f' address="{address}"' if address else ""
    s = [f'{ind}<variable name="{name}"{addr}>', f"{ind}  <type>{t}</type>"]
    if init is not None:
        s.append(f'{ind}  <initialValue><simpleValue value="{esc(init)}"/></initialValue>')
    s.append(doc(comment, ind + "  "))
    s.append(f"{ind}</variable>")
    return "\n".join(s)


class LD:
    """Builds the PLCopen LD body of FB_Mixer: rails, contacts, coils, blocks, in/outVariables."""

    def __init__(self):
        self.id = 0
        self.parts = []
        self.y = 20

    def nid(self):
        self.id += 1
        return self.id

    @staticmethod
    def cpin(refs, ind, rel=(0, 10)):
        lines = [f'{ind}<connectionPointIn>', f'{ind}  <relPosition x="{rel[0]}" y="{rel[1]}"/>']
        for rid, formal in refs:
            f = f' formalParameter="{formal}"' if formal else ""
            lines.append(f'{ind}  <connection refLocalId="{rid}"{f}/>')
        lines.append(f"{ind}</connectionPointIn>")
        return "\n".join(lines)

    def var_in(self, expr, x, y):
        i = self.nid()
        self.parts.append(f'<inVariable localId="{i}" height="20" width="80" negated="false">\n'
                          f'  <position x="{x}" y="{y}"/>\n  <connectionPointOut>\n    <relPosition x="80" y="10"/>\n  </connectionPointOut>\n'
                          f'  <expression>{esc(expr)}</expression>\n</inVariable>')
        return i

    def var_out(self, expr, src, x, y):
        i = self.nid()
        self.parts.append(f'<outVariable localId="{i}" height="20" width="80" negated="false">\n'
                          f'  <position x="{x}" y="{y}"/>\n{self.cpin([src], "  ")}\n'
                          f'  <expression>{esc(expr)}</expression>\n</outVariable>')

    def series(self, items, refs, x, y):
        for it in items:
            refs, x = self.elem(it, refs, x, y)
        return refs, x

    def elem(self, it, refs, x, y):
        kind = it[0]
        if kind == "C":
            _, v, neg, edge = it
            i = self.nid()
            self.parts.append(f'<contact localId="{i}" height="20" width="21" negated="{str(neg).lower()}" edge="{edge}" storage="none">\n'
                              f'  <position x="{x}" y="{y}"/>\n{self.cpin(refs, "  ")}\n'
                              f'  <connectionPointOut>\n    <relPosition x="21" y="10"/>\n  </connectionPointOut>\n'
                              f'  <variable>{esc(v)}</variable>\n</contact>')
            return [(i, None)], x + 60
        if kind == "PAR":
            outs, maxx = [], x
            for k, br in enumerate(it[1]):
                r, bx = self.series(br, refs, x, y + 40 * k)
                outs += r
                maxx = max(maxx, bx)
            return outs, maxx
        if kind == "B":
            _, typ, inst, ins, outs, pin, pout = it
            i = self.nid()
            iv = []
            for k, (formal, val) in enumerate(ins.items()):
                if formal == pin:
                    iv.append((formal, refs))
                else:
                    src = self.var_in(val, x - 100, y + 30 * (k + 1))
                    iv.append((formal, [(src, None)]))
            inst_attr = f' instanceName="{inst}"' if inst else ""
            lines = [f'<block localId="{i}" width="120" height="{40 + 30 * len(ins)}" typeName="{typ}"{inst_attr}>',
                     f'  <position x="{x}" y="{y}"/>', "  <inputVariables>"]
            for k, (formal, r) in enumerate(iv):
                lines += [f'    <variable formalParameter="{formal}">', self.cpin(r, "      ", (0, 10 + 30 * k)), "    </variable>"]
            lines += ["  </inputVariables>", "  <inOutVariables/>", "  <outputVariables>"]
            for k, formal in enumerate(outs):
                lines += [f'    <variable formalParameter="{formal}">', "      <connectionPointOut>",
                          f'        <relPosition x="120" y="{10 + 30 * k}"/>', "      </connectionPointOut>", "    </variable>"]
            lines += ["  </outputVariables>", "</block>"]
            self.parts.append("\n".join(lines))
            for k, (formal, val) in enumerate(outs.items()):
                if val:
                    self.var_out(val, (i, formal), x + 160, y + 30 * (k + 1))
            return [(i, pout)], x + 180
        raise ValueError(kind)

    def network(self, title, conds, coils):
        y = self.y
        c = self.nid()
        self.parts.append(f'<comment localId="{c}" height="20" width="400">\n  <position x="0" y="{y}"/>\n'
                          f'  <content>\n    <xhtml:p>{esc(title)}</xhtml:p>\n  </content>\n</comment>')
        y += 30
        left = self.nid()
        self.parts.append(f'<leftPowerRail localId="{left}" height="40" width="3">\n  <position x="0" y="{y}"/>\n'
                          f'  <connectionPointOut formalParameter="">\n    <relPosition x="3" y="10"/>\n  </connectionPointOut>\n</leftPowerRail>')
        refs, x = self.series(conds, [(left, None)], 160, y)
        ends = []
        for k, (_, v, storage) in enumerate(coils):
            i = self.nid()
            self.parts.append(f'<coil localId="{i}" height="20" width="21" negated="false" edge="none" storage="{storage}">\n'
                              f'  <position x="{x + 40}" y="{y + 40 * k}"/>\n{self.cpin(refs, "  ")}\n'
                              f'  <connectionPointOut>\n    <relPosition x="21" y="10"/>\n  </connectionPointOut>\n'
                              f'  <variable>{esc(v)}</variable>\n</coil>')
            ends.append([(i, None)])
        if not ends:
            ends = [refs]
        right = self.nid()
        pins = "\n".join(self.cpin(e, "  ", (0, 10 + 40 * k)) for k, e in enumerate(ends))
        self.parts.append(f'<rightPowerRail localId="{right}" height="{40 * len(ends)}" width="3">\n'
                          f'  <position x="{x + 120}" y="{y}"/>\n{pins}\n</rightPowerRail>')
        self.y = y + 60 + 40 * max(len(coils), 3)


def indent(text, n):
    pad = " " * n
    return "\n".join(pad + l if l else l for l in text.split("\n"))


def build_xml():
    ld = LD()
    for t, c, o in NETWORKS:
        ld.network(t, c, o)
    body = indent("\n".join(ld.parts), 12)
    used_globals = [g for g in IO + MEMORY]
    ext = "\n".join(var_xml(n, "INT" if t == "Int" else "BOOL", None, c, "            ") for n, _, t, c, *_ in used_globals)
    stat = "\n".join(var_xml(n, t, i, c, "            ") for n, t, i, c in STATICS)
    glob = "\n".join(var_xml(n, "INT" if t == "Int" else "BOOL", None, c, "            ", address=a) for n, a, t, c, *_ in used_globals)
    hw = "\n".join(f'              <Module Slot="{m["slot"]}" Name="{esc(m["name"])}" OrderNumber="{m["order"]}"/>' for m in MODULES)
    return f'''<?xml version="1.0" encoding="utf-8"?>
<project xmlns="{NS}" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <fileHeader companyName="Siemens AG" productName="TIA Portal" productVersion="V18 Update 3" creationDateTime="{STAMP}" contentDescription="Mixing tank MT01 - FB_Mixer (LAD), FC_ScaleAnalog (SCL)"/>
  <contentHeader name="MixTank_MT01" version="1.4" modificationDateTime="{STAMP}" organization="Plant 2 - Utilities" author="j.berger" language="en-US">
    <Comment>Mixing tank MT01, {CPU["type"]} ({CPU["order"]}, firmware {CPU["firmware"]}) with SM 1231 AI4 (6ES7231-4HD32-0XB0).</Comment>
    <coordinateInfo>
      <fbd><scaling x="1" y="1"/></fbd>
      <ld><scaling x="1" y="1"/></ld>
      <sfc><scaling x="1" y="1"/></sfc>
    </coordinateInfo>
  </contentHeader>
  <types>
    <dataTypes/>
    <pous>
      <pou name="FC_ScaleAnalog" pouType="function">
        <interface>
          <returnType><REAL/></returnType>
          <inputVars>
{var_xml("Raw", "INT", None, "Analog input word (S7 format)", "            ")}
{var_xml("LoEng", "REAL", None, "Engineering value at 4 mA", "            ")}
{var_xml("HiEng", "REAL", None, "Engineering value at 20 mA", "            ")}
          </inputVars>
          <outputVars>
{var_xml("Fault", "BOOL", None, "Wire break or out of range", "            ")}
          </outputVars>
          <tempVars>
{var_xml("Norm", "REAL", None, "Normalised value 0..1", "            ")}
          </tempVars>
        </interface>
        <body>
          <ST>
            <xhtml:p><![CDATA[{FC_ST}]]></xhtml:p>
          </ST>
        </body>
        <addData>
          <data name="http://www.siemens.com/automation/Openness/SW/Interface/v5" handleUnknown="discard">
            <BlockInfo xmlns="urn:fixture:siemens-blockinfo" Number="10" ProgrammingLanguage="SCL" MemoryLayout="Optimized"/>
          </data>
        </addData>
        <documentation>
          <xhtml:p>Scale a 4-20 mA analog input word to engineering units with wire-break detection.</xhtml:p>
        </documentation>
      </pou>
      <pou name="FB_Mixer" pouType="functionBlock">
        <interface>
          <localVars>
{stat}
          </localVars>
          <externalVars>
{ext}
          </externalVars>
        </interface>
        <body>
          <LD>
{body}
          </LD>
        </body>
        <addData>
          <data name="http://www.siemens.com/automation/Openness/SW/Interface/v5" handleUnknown="discard">
            <BlockInfo xmlns="urn:fixture:siemens-blockinfo" Number="1" ProgrammingLanguage="LAD" MemoryLayout="Optimized" InstanceDB="Mixer_DB" InstanceDBNumber="1"/>
          </data>
        </addData>
        <documentation>
          <xhtml:p>Mixing tank MT01 batch sequence, interlocks and alarms.</xhtml:p>
        </documentation>
      </pou>
    </pous>
  </types>
  <instances>
    <configurations>
      <configuration name="{CPU["name"]}">
        <resource name="{CPU["name"]}">
          <task name="Main" priority="1">
            <pouInstance name="Mixer_DB" typeName="FB_Mixer">
              <documentation>
                <xhtml:p>Called from OB1 "Main" (Program cycle).</xhtml:p>
              </documentation>
            </pouInstance>
          </task>
          <globalVars name="Default tag table">
{glob}
          </globalVars>
          <addData>
            <data name="urn:fixture:siemens-hardware" handleUnknown="discard">
              <Hardware xmlns="urn:fixture:siemens-hardware" Cpu="{CPU["type"]}" OrderNumber="{CPU["order"]}" Firmware="{CPU["firmware"]}">
{hw}
              </Hardware>
            </data>
          </addData>
        </resource>
      </configuration>
    </configurations>
  </instances>
</project>
'''


def build_csv():
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\r\n", quoting=csv.QUOTE_MINIMAL)
    w.writerow(["Name", "Path", "Data Type", "Logical Address", "Comment", "Hmi Visible", "Hmi Accessible", "Hmi Writeable", "Typeobject ID", "Version ID"])
    for n, a, t, c, *_ in IO + MEMORY:
        w.writerow([n, "Default tag table", t, a, c, "True", "True", "True", "", ""])
    return buf.getvalue()


def net_index(pred):
    for k, (t, c, o) in enumerate(NETWORKS):
        if pred(t, c, o):
            return k + 1
    raise KeyError


def coil_net(v):
    return net_index(lambda t, c, o: any(x[1] == v and x[2] == "none" for x in o))


def build_expected():
    where = lambda n: f"FB_Mixer, network {n}"
    return {
        "fixture": "siemens-mixer-01",
        "sourceFiles": [XML_NAME, CSV_NAME],
        "format": "PLCopen TC6 XML 2.01 (FB in LD, FC in ST/SCL) + TIA Portal PLC tag table export (CSV of the .xlsx columns)",
        "machine": ("Batch mixing tank MT01. On Start (tank idle, outlet valve closed, lid closed) the tank is filled with "
                    "ingredient A (water) to 40 % and ingredient B (syrup) to 80 %, measured by a 4-20 mA level transmitter. "
                    "The agitator then starts and an immersion heater brings the batch to 65 degC; the heater is interlocked "
                    "with agitator running feedback, minimum level (20 %), the safety thermostat and the setpoint. After "
                    "5 minutes of mixing at temperature the outlet valve drains the tank; 10 s after the level is below 3 % the "
                    "batch is done, counted, and waits for acknowledge. Analog scaling is done by an SCL function, the "
                    "sequence and interlocks by a LAD function block with set/reset step bits; alarms latch until Reset."),
        "plc": {
            "brand": "Siemens",
            "family": "S7-1200",
            "cpu": CPU["type"],
            "cpuOrderNumber": CPU["order"],
            "firmware": CPU["firmware"],
            "software": "TIA Portal V18",
            "modules": MODULES,
            "blocks": [
                {"name": "FB_Mixer", "type": "FB", "number": 1, "language": "LAD", "instanceDB": "Mixer_DB", "calledFrom": "OB1 Main"},
                {"name": "FC_ScaleAnalog", "type": "FC", "number": 10, "language": "SCL", "returns": "Real"},
            ],
        },
        "io": [dict({"address": a, "tag": n, "description": c, "type": ty, "signal": s, "dataType": t},
                    **({"analog": ANALOG[n]} if n in ANALOG else {})) for n, a, t, c, ty, s in IO],
        "memory": [{"address": a, "tag": n, "description": c, "dataType": t} for n, a, t, c in MEMORY],
        "sequence": {
            "style": "Set/reset step bits in FB_Mixer statics (S_Idle initial value TRUE)",
            "steps": [
                {"step": "S_Idle", "description": "Ready. Rising edge of Start_PB with Stop_PB healthy, no fault, outlet valve closed and lid closed starts the batch (Fill A).", "exitNetwork": net_index(lambda t, c, o: any(x[1] == "S_FillA" and x[2] == "set" for x in o))},
                {"step": "S_FillA", "description": "Inlet valve A open until Level_Pct >= SP_Level_A (40 %).", "exitNetwork": net_index(lambda t, c, o: any(x[1] == "S_FillB" and x[2] == "set" for x in o))},
                {"step": "S_FillB", "description": "Inlet valve B open until Level_Pct >= SP_Level_B (80 %).", "exitNetwork": net_index(lambda t, c, o: any(x[1] == "S_Heat" and x[2] == "set" for x in o))},
                {"step": "S_Heat", "description": "Agitator runs, heater on until Temp_C >= SP_Temp (65 degC).", "exitNetwork": net_index(lambda t, c, o: any(x[1] == "S_Mix" and x[2] == "set" for x in o))},
                {"step": "S_Mix", "description": "Agitator runs and heater holds temperature for Mix_Time (T#5M).", "exitNetwork": net_index(lambda t, c, o: any(x[1] == "S_Drain" and x[2] == "set" for x in o))},
                {"step": "S_Drain", "description": "Outlet valve open; when Level_Pct <= SP_Drain_Empty (3 %) for 10 s go to Done.", "exitNetwork": net_index(lambda t, c, o: any(x[1] == "S_Done" and x[2] == "set" for x in o))},
                {"step": "S_Done", "description": "Batch counted (C_Batch), done lamp on; Reset_PB returns to Idle.", "exitNetwork": net_index(lambda t, c, o: any(x[1] == "S_Done" and x[2] == "reset" for x in o) and len(o) == 2)},
            ],
            "abort": "Stop_PB pressed or any alarm resets every step bit and sets S_Idle (tank is not drained automatically).",
        },
        "timers": [
            {"name": "T_AgitFB", "type": "TON", "presetMs": 3000, "preset": "T#3S", "purpose": "Agitator commanded without running feedback", "where": where(net_index(lambda t, c, o: "Alm_AgitFeedback" in [x[1] for x in o]))},
            {"name": "T_FillTimeout", "type": "TON", "presetMs": 600000, "preset": "T#10M", "purpose": "Fill A + Fill B watchdog", "where": where(net_index(lambda t, c, o: "Alm_FillTimeout" in [x[1] for x in o]))},
            {"name": "T_Mix", "type": "TON", "presetMs": 300000, "preset": "Mix_Time (T#5M)", "purpose": "Mix time at temperature", "where": where(net_index(lambda t, c, o: any(x[1] == "S_Drain" and x[2] == "set" for x in o)))},
            {"name": "T_DrainDelay", "type": "TON", "presetMs": 10000, "preset": "T#10S", "purpose": "Drain run-on after tank reads empty", "where": where(net_index(lambda t, c, o: any(x[1] == "S_Done" and x[2] == "set" for x in o)))},
        ],
        "counters": [
            {"name": "C_Batch", "type": "CTU", "preset": 9999, "purpose": "Completed batches, count value to Batch_Count", "reset": "HMI_Reset_Count (%M10.0)", "where": where(net_index(lambda t, c, o: any(x[0] == "B" and x[1] == "CTU" for x in c)))},
        ],
        "alarms": [{"address": f"Mixer_DB.{n}", "tag": n, "text": t, "condition": cond, "stopsMachine": True, "latched": True,
                    "reset": "Reset_PB", "where": where(net_index(lambda tt, c, o, n=n: o == [SET(n)]))} for n, t, _, cond in ALARM_DEF],
        "interlocks": [
            {"output": "Inlet_Valve_A", "requires": ["S_FillA", "NOT Fault", "LSHH_OK", "Outlet_Valve_Closed"], "where": where(coil_net("Inlet_Valve_A"))},
            {"output": "Inlet_Valve_B", "requires": ["S_FillB", "NOT Fault", "LSHH_OK", "Outlet_Valve_Closed"], "where": where(coil_net("Inlet_Valve_B"))},
            {"output": "Agitator_Run", "requires": ["S_Heat or S_Mix", "NOT Fault", "Agitator_OL_OK", "Lid_Closed", "Level_Above_Min (Level_Pct >= 20 %)"], "where": where(coil_net("Agitator_Run"))},
            {"output": "Heater_On", "requires": ["S_Heat or S_Mix", "NOT Fault", "Agitator_Running", "Level_Above_Min (Level_Pct >= 20 %)", "Heater_OT_OK", "Temp_C < SP_Temp"], "where": where(coil_net("Heater_On"))},
            {"output": "Outlet_Valve", "requires": ["S_Drain", "NOT Fault"], "where": where(coil_net("Outlet_Valve"))},
            {"output": "Batch start", "requires": ["S_Idle", "Start_PB rising edge", "Stop_PB", "NOT Fault", "Outlet_Valve_Closed", "Lid_Closed"], "where": where(net_index(lambda t, c, o: any(x[1] == "S_FillA" and x[2] == "set" for x in o)))},
        ],
        "knownIssues": [
            {
                "id": "S7-1",
                "where": "FC_ScaleAnalog (SCL), NORM_X call",
                "code": BUG_LINE,
                "what": ("Wrong full-scale value: the raw word is normalised with MAX := 32767, but the S7-1200 nominal range for a "
                         "4-20 mA channel is 0..27648. Every scaled value reads 15.6 % low (20 mA shows 84.4 % level / 126.6 degC). "
                         "Level setpoint B (80 %) is only reached at a real level of about 94.8 %, so the tank overfills toward the "
                         "high-high switch, and the heater runs to about 77 degC real for a 65 degC setpoint."),
                "fix": "#Norm := NORM_X(MIN := 0, VALUE := #Raw, MAX := 27648);",
            }
        ],
    }


def check(xml_text, csv_text, exp):
    root = ET.fromstring(xml_text.encode("utf-8"))
    n = {"p": NS}
    pous = {p.get("name"): p for p in root.iterfind(".//p:pou", n)}
    assert set(pous) == {"FB_Mixer", "FC_ScaleAnalog"}
    assert pous["FB_Mixer"].find("p:body/p:LD", n) is not None
    st = pous["FC_ScaleAnalog"].find("p:body/p:ST", n)
    assert st is not None and BUG_LINE in "".join(st.itertext())
    ld = pous["FB_Mixer"].find("p:body/p:LD", n)
    ids = {e.get("localId") for e in ld if e.get("localId")}
    for c in ld.iter(f"{{{NS}}}connection"):
        assert c.get("refLocalId") in ids, c.get("refLocalId")
    declared = {v.get("name") for v in pous["FB_Mixer"].iterfind(".//p:interface//p:variable", n)}
    for tagname in ("contact", "coil"):
        for e in ld.iterfind(f"p:{tagname}", n):
            assert e.find("p:variable", n).text in declared
    for e in ld.iterfind("p:inVariable", n):
        x = e.find("p:expression", n).text
        assert x in declared or x[0].isdigit() or x.startswith("T#"), x
    for e in ld.iterfind("p:outVariable", n):
        assert e.find("p:expression", n).text in declared
    for b in ld.iterfind("p:block", n):
        if b.get("instanceName"):
            assert b.get("instanceName") in declared
    rows = list(csv.DictReader(io.StringIO(csv_text)))
    by = {r["Name"]: r for r in rows}
    gv = {v.get("name"): v.get("address") for v in root.iterfind(".//p:globalVars/p:variable", n)}
    for x in exp["io"]:
        assert by[x["tag"]]["Logical Address"] == x["address"] == gv[x["tag"]]
        assert x["tag"] in xml_text.split("<LD>")[1], f'{x["tag"]} unused in LD'
    for t in exp["timers"]:
        assert f'instanceName="{t["name"]}"' in xml_text
    for a in exp["alarms"]:
        assert a["tag"] in declared


def main():
    x, c, e = build_xml(), build_csv(), build_expected()
    check(x, c, e)
    with open(os.path.join(OUT_DIR, XML_NAME), "w", encoding="utf-8", newline="\n") as f:
        f.write(x)
    with open(os.path.join(OUT_DIR, CSV_NAME), "w", encoding="utf-8-sig", newline="") as f:
        f.write(c)
    with open(os.path.join(OUT_DIR, "expected.json"), "w", encoding="utf-8") as f:
        json.dump(e, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print("wrote", XML_NAME, CSV_NAME, "expected.json")


if __name__ == "__main__":
    main()
