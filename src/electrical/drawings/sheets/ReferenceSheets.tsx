/** Reference sheets: symbols & abbreviations legend, device list, nameplate / label schedule. */
import { isIec, NEMA_TO_IP, regionSpec } from '../../../standards/regions';
import { IEC_LETTERS } from '../../../standards/iecText';
import type { ReactNode } from 'react';
import { codeRefs, isFuseCartridge, panelNameplate } from '../../derive';
import { AREA, AREA_B, AREA_R, LW, LW_HEAVY, LW_THIN, wrapText } from '../geometry';
import type { DrawingPlan, PlannedSheet, SheetSpec } from '../plan';
import {
  BreakerPole, Coil, Contact, Dot, Fuse, Ground, Lamp, LimitSwitch, Line, Motor, OverloadHeater, PressureSwitch, Pushbutton,
  Selector, Sensor3W, Solenoid, SwitchPole, TermBox, TermPt, Txt, WireNo, XrefArrow,
} from '../symbols';
import { iecStripText, stripTag } from '../../../standards/designations';

// ---------------------------------------------------------------------------
// Symbols & abbreviations
// ---------------------------------------------------------------------------

type SymbolDef = { name: string; note?: string; draw: (x: number, y: number) => ReactNode };

/** 3 stacked horizontal poles with a dashed mechanical link. */
function ThreePole({ x, y, pole, link = true }: { x: number; y: number; pole: (x: number, y: number) => ReactNode; link?: boolean }) {
  const ys = [y - 3.2, y, y + 3.2];
  return (
    <g>
      {ys.map((yy, i) => <g key={i}>{pole(x, yy)}</g>)}
      {link && <Line x1={x} y1={ys[0] - 2.6} x2={x} y2={ys[2] - 1.2} w={LW_THIN} dash="1.2 0.8" />}
    </g>
  );
}

function Box({ x, y, w, h, left, right, mid }: { x: number; y: number; w: number; h: number; left: string; right: string; mid: string }) {
  return (
    <g>
      <Line x1={x - w / 2 - 2} y1={y} x2={x - w / 2} y2={y} />
      <Line x1={x + w / 2} y1={y} x2={x + w / 2 + 2} y2={y} />
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} strokeWidth={0.45} fill="#fff" />
      <Txt x={x - w / 2 + 1} y={y + 0.8} size={1.9} mono>{left}</Txt>
      <Txt x={x + w / 2 - 1} y={y + 0.8} size={1.9} mono anchor="end">{right}</Txt>
      <Txt x={x} y={y + 0.8} size={1.9} anchor="middle">{mid}</Txt>
    </g>
  );
}

const SYMBOLS: SymbolDef[] = [
  { name: 'CONTACT, NORMALLY OPEN (NO)', note: 'RELAY / CONTACTOR AUXILIARY', draw: (x, y) => <><Line x1={x - 8} y1={y} x2={x - 4} y2={y} /><Contact x={x} y={y} /><Line x1={x + 4} y1={y} x2={x + 8} y2={y} /></> },
  { name: 'CONTACT, NORMALLY CLOSED (NC)', note: 'RELAY / CONTACTOR AUXILIARY', draw: (x, y) => <><Line x1={x - 8} y1={y} x2={x - 4} y2={y} /><Contact x={x} y={y} nc /><Line x1={x + 4} y1={y} x2={x + 8} y2={y} /></> },
  { name: 'COIL — RELAY (CR) / CONTACTOR (K)', note: 'TERMINALS A1 / A2', draw: (x, y) => <><Line x1={x - 8} y1={y} x2={x - 5} y2={y} /><Coil x={x} y={y} /><Line x1={x + 5} y1={y} x2={x + 8} y2={y} /></> },
  { name: 'PUSHBUTTON, NO', note: 'MOMENTARY, 22 mm', draw: (x, y) => <Pushbutton x={x} y={y} /> },
  { name: 'PUSHBUTTON, NC', note: 'MOMENTARY, 22 mm', draw: (x, y) => <Pushbutton x={x} y={y} nc /> },
  { name: 'EMERGENCY STOP, NC', note: 'MUSHROOM HEAD, DIRECT OPENING, LATCHING', draw: (x, y) => <Pushbutton x={x} y={y} nc mushroom /> },
  { name: 'SELECTOR SWITCH', note: 'MAINTAINED, 2-POSITION', draw: (x, y) => <Selector x={x} y={y} /> },
  { name: 'LIMIT SWITCH, NO', draw: (x, y) => <LimitSwitch x={x} y={y} /> },
  { name: 'PRESSURE SWITCH, NO', draw: (x, y) => <PressureSwitch x={x} y={y} /> },
  { name: 'PROXIMITY / PHOTO SENSOR, 3-WIRE', note: 'BN = +24V, BU = 0V, BK = SIGNAL', draw: (x, y) => <Sensor3W x={x} y={y - 1} kind="PNP" /> },
  { name: 'PILOT LIGHT', note: 'LETTER = LENS COLOUR (R, G, A, W, B)', draw: (x, y) => <Lamp x={x} y={y} color="G" /> },
  { name: 'SOLENOID VALVE COIL', draw: (x, y) => <Solenoid x={x} y={y} /> },
  { name: 'CIRCUIT BREAKER, 1-POLE', note: 'THERMAL-MAGNETIC', draw: (x, y) => <BreakerPole x={x} y={y} /> },
  { name: 'CIRCUIT BREAKER, 3-POLE', note: 'DASHED LINE = MECHANICAL LINK', draw: (x, y) => <ThreePole x={x} y={y + 0.6} pole={(px, py) => <BreakerPole x={px} y={py} />} /> },
  { name: 'DISCONNECT SWITCH, 3-POLE', note: 'LOCKABLE IN OFF', draw: (x, y) => <ThreePole x={x} y={y + 0.6} pole={(px, py) => <SwitchPole x={px} y={py} />} /> },
  { name: 'FUSE', note: 'CLASS PER FUSE HOLDER', draw: (x, y) => <Fuse x={x} y={y} /> },
  { name: 'OVERLOAD RELAY — HEATERS', note: 'THERMAL, 3-PHASE', draw: (x, y) => <ThreePole x={x} y={y + 0.6} pole={(px, py) => <OverloadHeater x={px} y={py} />} link={false} /> },
  { name: 'OVERLOAD RELAY — TRIP CONTACT', note: '95-96 NC, OPENS ON OVERLOAD', draw: (x, y) => <><Contact x={x} y={y} nc /><Txt x={x + 2} y={y - 3.2} size={1.8} mono>95-96</Txt></> },
  { name: 'MOTOR, 3-PHASE', note: 'T1 / T2 / T3 + PE', draw: (x, y) => <Motor cx={x + 3} cy={y} r={4.2} leadsY={[y - 2.4, y, y + 2.4]} /> },
  {
    name: 'CONTROL TRANSFORMER', note: 'H1-H4 PRIMARY, X1-X2 SECONDARY', draw: (x, y) => (
      <g>
        <path d={`M ${x - 3} ${y - 4} q 2 1 0 2 q 2 1 0 2 q 2 1 0 2 q 2 1 0 2`} strokeWidth={LW} />
        <path d={`M ${x + 3} ${y - 4} q -2 1 0 2 q -2 1 0 2 q -2 1 0 2 q -2 1 0 2`} strokeWidth={LW} />
        <Line x1={x - 0.5} y1={y - 4.4} x2={x - 0.5} y2={y + 4.4} w={0.3} />
        <Line x1={x + 0.5} y1={y - 4.4} x2={x + 0.5} y2={y + 4.4} w={0.3} />
      </g>
    ),
  },
  { name: 'POWER SUPPLY, AC/DC', note: 'L / N IN, +V / -V OUT', draw: (x, y) => <Box x={x} y={y} w={18} h={6} left="L" right="+V" mid="AC/DC" /> },
  { name: 'SAFETY RELAY', note: 'A1 / A2 SUPPLY; S.. = SAFETY TERMINALS', draw: (x, y) => <Box x={x} y={y} w={18} h={6} left="A1" right="A2" mid="SAFETY" /> },
  {
    name: 'PLC I/O MODULE TERMINALS', note: 'ADDRESS = TERMINAL; SHADED = COMMON', draw: (x, y) => (
      <g>
        <rect x={x - 6} y={y - 5} width={12} height={10} strokeWidth={0.45} fill="#fff" />
        <rect x={x - 5.7} y={y + 0.3} width={11.4} height={4.4} fill="#d9d9d9" stroke="none" />
        <Line x1={x - 6} y1={y} x2={x + 6} y2={y} w={LW_THIN} dash="0.8 0.8" />
        <Txt x={x} y={y - 1.6} size={1.9} mono bold anchor="middle">X001</Txt>
        <Txt x={x} y={y + 3.4} size={1.9} mono bold anchor="middle">COM</Txt>
        <TermPt x={x - 6} y={y - 2.5} /><TermPt x={x - 6} y={y + 2.5} />
        <Line x1={x - 11} y1={y - 2.5} x2={x - 6.7} y2={y - 2.5} />
      </g>
    ),
  },
  { name: 'TERMINAL BLOCK TERMINAL', note: 'NUMBER = TERMINAL ON STRIP (TB2-4)', draw: (x, y) => <><Line x1={x - 8} y1={y} x2={x - 2.5} y2={y} /><TermBox x={x} y={y} n={4} /><Line x1={x + 2.5} y1={y} x2={x + 8} y2={y} /></> },
  { name: 'DEVICE TERMINAL', note: 'SCREW / CLAMP ON A DEVICE', draw: (x, y) => <><Line x1={x - 8} y1={y} x2={x - 0.7} y2={y} /><TermPt x={x} y={y} /></> },
  { name: 'CONNECTION (JUNCTION)', note: 'NO DOT = WIRES CROSS, NOT CONNECTED', draw: (x, y) => <><Line x1={x - 8} y1={y} x2={x + 8} y2={y} /><Line x1={x} y1={y} x2={x} y2={y + 4} /><Dot x={x} y={y} /></> },
  { name: 'PROTECTIVE EARTH (PE) / GROUND', note: 'GREEN / YELLOW CONDUCTOR', draw: (x, y) => <><Line x1={x} y1={y - 3.5} x2={x} y2={y - 1.5} /><Ground x={x} y={y - 1.5} /></> },
  { name: 'WIRE WITH WIRE NUMBER', note: 'NUMBER PRINTED ON BOTH ENDS', draw: (x, y) => <><Line x1={x - 9} y1={y + 1} x2={x + 9} y2={y + 1} /><WireNo x={x} y={y + 1} n="X001" /></> },
  { name: 'CONTINUATION TO ANOTHER SHEET', note: '"TO 5.02" = SHEET 5, LINE 02', draw: (x, y) => <><Line x1={x - 10} y1={y} x2={x - 2} y2={y} /><XrefArrow x={x - 2} y={y} /><Txt x={x + 1.5} y={y + 0.8} size={2.0} mono>TO 5.02</Txt></> },
  { name: 'CONTINUATION FROM ANOTHER SHEET', note: '"FROM 3.18" = SHEET 3, LINE 18', draw: (x, y) => <><XrefArrow x={x - 1} y={y} /><Line x1={x + 1.4} y1={y} x2={x + 9} y2={y} /><Txt x={x - 2.5} y={y + 0.8} size={2.0} mono anchor="end">FROM 3.18</Txt></> },
  {
    name: 'CROSS-REFERENCE: CONTACT TO COIL', note: 'CONTACT OF K1, COIL ON SHEET 4 LINE 08', draw: (x, y) => (
      <g><Line x1={x - 8} y1={y} x2={x - 4} y2={y} /><Contact x={x} y={y} /><Line x1={x + 4} y1={y} x2={x + 8} y2={y} />
        <Txt x={x - 1} y={y - 3.4} size={2.0} mono bold anchor="end">K1</Txt><Txt x={x} y={y + 5.0} size={1.8} mono anchor="middle">/4.08</Txt></g>
    ),
  },
  {
    name: 'CROSS-REFERENCE: COIL TO CONTACTS', note: 'LIST UNDER COIL: TYPE, TERMINALS, SHEET.LINE', draw: (x, y) => (
      <g><Line x1={x - 8} y1={y - 1.5} x2={x - 5} y2={y - 1.5} /><Coil x={x} y={y - 1.5} /><Line x1={x + 5} y1={y - 1.5} x2={x + 8} y2={y - 1.5} />
        <Txt x={x} y={y + 4.0} size={1.6} mono anchor="middle">MAIN 3.12  NO 13-14 5.04</Txt></g>
    ),
  },
];

const ABBREVIATIONS: [string, string][] = [
  ['0V', 'DC COMMON (GROUNDED CONDUCTOR)'], ['24+', '+24VDC, UNSWITCHED'], ['24+S', '+24VDC, SAFETY-SWITCHED'], ['A1/A2', 'COIL TERMINALS'],
  ['AC / DC', 'ALTERNATING / DIRECT CURRENT'], ['AWG', 'AMERICAN WIRE GAUGE'], ['BK/BN/BU', 'BLACK / BROWN / BLUE'], ['COM', 'COMMON TERMINAL'],
  ['DOL', 'DIRECT ON LINE (ACROSS THE LINE)'], ['EDM', 'EXTERNAL DEVICE MONITORING'], ['EST.', 'ESTIMATED'], ['FLA', 'FULL LOAD AMPERES'],
  ['GN/YE', 'GREEN/YELLOW (PE)'], ['HMI', 'HUMAN-MACHINE INTERFACE'], ['I/O', 'INPUT / OUTPUT'], ['MCR', 'MASTER CONTROL RELAY'],
  ['NC / NO', 'NORMALLY CLOSED / OPEN'], ['NTS', 'NOT TO SCALE'], ['PE', 'PROTECTIVE EARTH'], ['PH', 'PHASE'],
  ['PNP / NPN', 'SOURCING / SINKING SENSOR'], ['SCCR', 'SHORT-CIRCUIT CURRENT RATING'], ['STO', 'SAFE TORQUE OFF'], ['TBD', 'TO BE DETERMINED'],
  ['TYP.', 'TYPICAL'], ['UNO', 'UNLESS NOTED OTHERWISE'], ['VFD', 'VARIABLE FREQUENCY DRIVE'], ['WH/BU', 'WHITE/BLUE (0V)'],
];

const TAG_PREFIXES: [RegExp, string, string][] = [
  [/^ENC/, 'ENC', 'ENCLOSURE'], [/^SP\d/, 'SP', 'SUBPANEL (BACK PANEL)'], [/^(DS|DISC)/, 'DS', 'DISCONNECT SWITCH'], [/^(CB|MCB)\d/, 'CB', 'CIRCUIT BREAKER'],
  [/^(FU|F)\d/, 'FU', 'FUSE / FUSE HOLDER'], [/^(MMP|MP)\d/, 'MMP', 'MANUAL MOTOR PROTECTOR'], [/^K/, 'K', 'CONTACTOR'], [/^OL\d/, 'OL', 'OVERLOAD RELAY'],
  [/^(VFD|VF|AFD)/, 'VFD', 'VARIABLE FREQUENCY DRIVE'], [/^M\d/, 'M', 'MOTOR'], [/^T\d/, 'T', 'TRANSFORMER'], [/^PS\d/, 'PS', 'POWER SUPPLY'],
  [/^PLC/, 'PLC', 'PLC CPU'], [/^IO\d/, 'IO', 'PLC I/O MODULE'], [/^SR\d/, 'SR', 'SAFETY RELAY'], [/^(CR|MCR)\d/, 'CR', 'CONTROL RELAY'],
  [/^(ES|EST)\d/, 'ES', 'EMERGENCY STOP'], [/^PB\d/, 'PB', 'PUSHBUTTON'], [/^(SS|SEL)\d/, 'SS', 'SELECTOR SWITCH'], [/^(PL|LT)\d/, 'PL', 'PILOT LIGHT'],
  [/^(SL|STK)\d/, 'SL', 'STACK LIGHT'], [/^(HMI|OIT)/, 'HMI', 'OPERATOR INTERFACE'], [/^(PRS|PX|PRX)\d/, 'PRS', 'PROXIMITY SENSOR'], [/^PE\d/, 'PE', 'PHOTO-EYE'],
  [/^LS\d/, 'LS', 'LIMIT SWITCH'], [/^(SOL|YV)\d/, 'SOL', 'SOLENOID VALVE'], [/^TB/, 'TB', 'TERMINAL STRIP'], [/^(GND|GB)/, 'GB', 'GROUND (PE) BAR'],
  [/^JB\d/, 'JB', 'JUNCTION BOX'], [/^W\d/, 'W', 'FIELD CABLE'], [/^FAN/, 'FAN', 'ENCLOSURE FAN / FILTER'],
];

export function LegendSheet({ plan }: { plan: DrawingPlan; sheet: PlannedSheet }) {
  const x0 = AREA.x + 6;
  const top = AREA.y + 19;
  const cols = 3, colW = 90, rowH = 15;
  const perCol = Math.ceil(SYMBOLS.length / cols);
  const tags = [...plan.model.rc.map((c) => c.tag), ...plan.model.io.map((p) => p.deviceTag), ...plan.ctx.design.inputs.motors.map((m) => m.tag), ...plan.model.machine.jbs.map((j) => j.tag), ...plan.model.machine.cables.map((c) => c.tag), ...plan.model.strips.map((s) => s.tag)].filter(Boolean);
  const RX = x0 + cols * colW + 4;
  const RW = AREA_R - RX - 3;
  const abHalf = Math.ceil(ABBREVIATIONS.length / 2);
  const abTop = top;
  const tpTop = abTop + abHalf * 3.5 + 12;
  const prefixes = plan.ctx.designations === 'iec81346' ? IEC_LETTERS : TAG_PREFIXES;
  const tpHalf = Math.ceil(prefixes.length / 2);
  return (
    <g>
      <Txt x={x0} y={AREA.y + 7} size={3.2} bold>{plan.ctx.symbols === 'iec60617' ? `SYMBOLS (IEC 60617) — ${codeRefs(plan.ctx).short}` : `SYMBOLS (ANSI/IEEE 315, NFPA 79 / JIC STYLE) — ${codeRefs(plan.ctx).short}`}</Txt>
      <Line x1={x0} y1={AREA.y + 9.5} x2={x0 + cols * colW - 4} y2={AREA.y + 9.5} w={LW} />
      {SYMBOLS.map((s, i) => {
        const c = Math.floor(i / perCol), r = i % perCol;
        const x = x0 + c * colW, y = top + r * rowH;
        return (
          <g key={s.name}>
            <rect x={x} y={y - 5.8} width={32} height={rowH - 2} strokeWidth={0.12} />
            {/* 85 % and centred in the cell: the tallest symbols (IEC pressure switch) otherwise reach over the cell line */}
            <g transform={`translate(${x + 16} ${y + 1.2}) scale(0.85) translate(${-(x + 16)} ${-(y + 0.8)})`}>{s.draw(x + 16, y + 0.8)}</g>
            <Txt x={x + 35} y={y + 0.2} size={2.2} bold maxW={colW - 37}>{s.name}</Txt>
            {s.note && <Txt x={x + 35} y={y + 3.4} size={1.9} maxW={colW - 37}>{plan.ctx.designations === 'iec81346' ? iecStripText(s.note) : s.note}</Txt>}
          </g>
        );
      })}
      <Line x1={RX - 3} y1={AREA.y + 3} x2={RX - 3} y2={AREA_B - 3} w={LW_THIN} />
      <Txt x={RX} y={AREA.y + 7} size={3.2} bold>ABBREVIATIONS</Txt>
      <Line x1={RX} y1={AREA.y + 9.5} x2={AREA_R - 3} y2={AREA.y + 9.5} w={LW} />
      {ABBREVIATIONS.map(([a, d], i) => {
        const c = Math.floor(i / abHalf), r = i % abHalf;
        const x = RX + c * (RW / 2);
        return (
          <g key={a}>
            <Txt x={x} y={abTop + r * 3.5} size={2.1} mono bold>{a}</Txt>
            <Txt x={x + 16} y={abTop + r * 3.5} size={1.9} maxW={RW / 2 - 18}>{d}</Txt>
          </g>
        );
      })}
      <Txt x={RX} y={tpTop - 5} size={3.2} bold>{plan.ctx.designations === 'iec81346' ? 'DEVICE DESIGNATIONS (IEC 81346-2)' : 'DEVICE TAG PREFIXES (NFPA 79 ANNEX D STYLE)'}</Txt>
      <Line x1={RX} y1={tpTop - 2.5} x2={AREA_R - 3} y2={tpTop - 2.5} w={LW} />
      {prefixes.map(([re, p, d], i) => {
        const c = Math.floor(i / tpHalf), r = i % tpHalf;
        const x = RX + c * (RW / 2);
        const used = tags.some((t) => re.test(t.toUpperCase()));
        return (
          <g key={p}>
            <Txt x={x} y={tpTop + 1 + r * 3.5} size={2.1} mono bold>{p}</Txt>
            <Txt x={x + 12} y={tpTop + 1 + r * 3.5} size={1.9} bold={used} maxW={RW / 2 - 18}>{d}</Txt>
            {used && <circle cx={x + RW / 2 - 4} cy={tpTop + 0.3 + r * 3.5} r={0.8} fill="#000" stroke="none" />}
          </g>
        );
      })}
      {(() => {
        const ny = tpTop + tpHalf * 3.5 + 4;
        const notes = [
          plan.ctx.designations === 'iec81346' ? 'DOT = CLASS USED IN THIS DRAWING SET. DESIGNATION = "-" + IEC 81346-2 CLASS LETTER + NUMBER (-K1, -S2); TERMINALS -K1:A1. TERMINAL STRIPS -X1, -X2…; WIRE NUMBERS WITHOUT THE "-" (M1-L1).' : 'DOT = PREFIX USED IN THIS DRAWING SET. TAG = PREFIX + SEQUENCE NUMBER (K1, PB2). MULTI-DEVICE PARTS: TAG.n (TB.2).',
          'LINE REFERENCES: "SHEET.LINE" — 5.04 = SHEET 5, LINE 04. LINE NUMBERS ARE PRINTED DOWN THE LEFT EDGE OF EVERY SCHEMATIC SHEET.',
          'WIRE COLOURS AND WIRE NUMBERING: SEE COVER SHEET. SPARE PLC POINTS ARE SHOWN "SPARE" ON THE I/O SHEETS.',
        ].flatMap((n) => wrapText(n, RW, 1.9));
        return notes.map((l, i) => <Txt key={i} x={RX} y={Math.min(ny, AREA_B - 3 - notes.length * 2.7) + i * 2.7} size={1.9} maxW={RW}>{l}</Txt>);
      })()}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Device list
// ---------------------------------------------------------------------------

export function DeviceListSheet({ sheet }: { plan: DrawingPlan; sheet: PlannedSheet }) {
  const sp = sheet.spec as Extract<SheetSpec, { kind: 'devices' }>;
  const x = AREA.x + 6;
  const w = AREA.w - 12;
  const cols = [0, 20, 30, 100, 142, 170, 290, 338];
  const heads = ['TAG', 'QTY', 'FUNCTION', 'PART NUMBER', 'MFR', 'PART DESCRIPTION', 'LOCATION', 'DRAWN ON (SHEET)'];
  const rowH = 5.0;
  const y0 = AREA.y + 9;
  const bottom = y0 + 1.6 + sp.rows.length * rowH;
  return (
    <g>
      <rect x={x} y={y0 - 4.8} width={w} height={bottom - y0 + 4.8} strokeWidth={LW_HEAVY} />
      {heads.map((h, i) => <Txt key={h} x={x + cols[i] + 1.5} y={y0} size={2.3} bold>{h}</Txt>)}
      <Line x1={x} y1={y0 + 1.6} x2={x + w} y2={y0 + 1.6} w={LW} />
      {cols.slice(1).map((c) => <Line key={c} x1={x + c} y1={y0 - 4.8} x2={x + c} y2={bottom} w={LW_THIN} />)}
      {sp.rows.map((r, i) => {
        const yy = y0 + 1.6 + (i + 1) * rowH;
        const ty = yy - 1.5;
        return (
          <g key={r.tag}>
            <Txt x={x + cols[0] + 1.5} y={ty} size={2.3} mono bold maxW={cols[1] - cols[0] - 2.5}>{r.tag}</Txt>
            <Txt x={x + (cols[1] + cols[2]) / 2} y={ty} size={2.2} mono anchor="middle">{r.qty}</Txt>
            <Txt x={x + cols[2] + 1.5} y={ty} size={2.1} maxW={cols[3] - cols[2] - 3}>{r.fn || '—'}</Txt>
            <Txt x={x + cols[3] + 1.5} y={ty} size={2.1} mono maxW={cols[4] - cols[3] - 3}>{r.partNumber || '—'}</Txt>
            <Txt x={x + cols[4] + 1.5} y={ty} size={2.0} maxW={cols[5] - cols[4] - 3}>{(r.manufacturer || '—').toUpperCase()}</Txt>
            <Txt x={x + cols[5] + 1.5} y={ty} size={2.0} maxW={cols[6] - cols[5] - 3}>{r.description.replace(/^FIXTURE — /, 'FIXTURE: ').toUpperCase()}</Txt>
            <Txt x={x + cols[6] + 1.5} y={ty} size={2.0} maxW={cols[7] - cols[6] - 3}>{r.location}</Txt>
            <Txt x={x + cols[7] + 1.5} y={ty} size={2.0} mono maxW={w - cols[7] - 3}>{r.refs}</Txt>
            <Line x1={x} y1={yy} x2={x + w} y2={yy} w={0.12} />
          </g>
        );
      })}
      <Txt x={x} y={AREA_B - 2} size={2.0} italic>{`SORTED BY DEVICE TAG. "/5.10" = SCHEMATIC LINE WHERE THE COIL / DEVICE IS DRAWN; OTHER NUMBERS = SHEETS SHOWING THE DEVICE. ${sp.pages > 1 ? `PAGE ${sp.page} OF ${sp.pages}.` : ''}`}</Txt>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Nameplate, legend plates & labels
// ---------------------------------------------------------------------------

/** A warning label graphic: header band (black, white text) + symbol + body text. */
function WarnLabel({ x, y, w, h, head, body, symbol }: { x: number; y: number; w: number; h: number; head: string; body: string[]; symbol: 'shock' | 'arc' | 'info' | 'ground' }) {
  const lines = body.flatMap((b) => wrapText(b, w - 18, 1.9));
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} strokeWidth={LW} fill="#fff" rx={0.8} />
      <rect x={x} y={y} width={w} height={6} fill="#000" stroke="none" rx={0.8} />
      <Txt x={x + w / 2} y={y + 4.4} size={3.0} bold anchor="middle" fill="#fff">{head}</Txt>
      {symbol !== 'ground' && symbol !== 'info' && (
        <g>
          <path d={`M ${x + 8} ${y + 9} L ${x + 14} ${y + 19} L ${x + 2} ${y + 19} Z`} strokeWidth={0.5} fill="#fff" />
          {symbol === 'shock'
            ? <path d={`M ${x + 8.6} ${y + 11.5} L ${x + 6.8} ${y + 15} L ${x + 8.6} ${y + 15} L ${x + 7.4} ${y + 18} L ${x + 10} ${y + 14} L ${x + 8.2} ${y + 14} Z`} fill="#000" stroke="none" />
            : <><circle cx={x + 8} cy={y + 15.4} r={2.2} strokeWidth={0.35} /><Line x1={x + 8} y1={y + 12.2} x2={x + 8} y2={y + 18.6} w={0.35} /><Line x1={x + 4.8} y1={y + 15.4} x2={x + 11.2} y2={y + 15.4} w={0.35} /></>}
        </g>
      )}
      {symbol === 'ground' && <g><circle cx={x + 8} cy={y + 14.5} r={4.4} strokeWidth={0.4} /><Line x1={x + 8} y1={y + 11.2} x2={x + 8} y2={y + 14} w={0.4} /><Ground x={x + 8} y={y + 13.6} /></g>}
      {symbol === 'info' && <g><circle cx={x + 8} cy={y + 14.5} r={4.4} strokeWidth={0.4} /><Txt x={x + 8} y={y + 16.4} size={4.6} bold anchor="middle">!</Txt></g>}
      {lines.slice(0, Math.floor((h - 8) / 2.5)).map((l, i) => <Txt key={i} x={x + 16} y={y + 10 + i * 2.5} size={1.9} bold={i === 0} maxW={w - 18}>{l}</Txt>)}
    </g>
  );
}

export function LabelSheet({ plan }: { plan: DrawingPlan; sheet: PlannedSheet }) {
  const { ctx, model, layout, doc } = plan;
  const np = panelNameplate(ctx);
  const codes = codeRefs(ctx);
  const canada = codes.region === 'Canada';
  const iec = isIec(ctx.region);
  const x0 = AREA.x + 6;
  // ---- panel nameplate
  const NPW = 128, NPH = 90;
  const npY = AREA.y + 14;
  const fields: [string, string][] = [
    ['MANUFACTURER', doc.company.toUpperCase()],
    ['CUSTOMER', doc.customer.toUpperCase()],
    ['PROJECT / PROJECT NO.', `${ctx.projectName.toUpperCase()}${doc.projectNumber ? `  /  ${doc.projectNumber.toUpperCase()}` : ''}`],
    ['DRAWING NO.', `${plan.sheets[0]?.drawingNo ?? ''}  REV ${doc.rs.rev}`],
    ['SERIAL NO. / DATE OF MFR.', ''],
    ['SUPPLY', iec ? np.supplyText : `${np.volts} VAC, ${np.phases} PH, ${np.phases === 3 ? '3 W + PE' : '2 W + PE'}, ${np.hz} Hz`],
    ['FULL-LOAD CURRENT', `${np.fullLoadAmps} A (MOTORS ${np.motorAmps} A + CONTROL ${np.controlAmps} A EST.) — VERIFY`],
    ['LARGEST MOTOR FLA', np.largestMotorFla !== null ? `${np.largestMotorFla} A` : 'N/A (NO MOTORS)'],
    iec ? ['SHORT-CIRCUIT RATING', `Icc ____ kA (IEC 61439-1 5.3) — ${np.sccr}`] : ['SCCR', `____ kA RMS SYM., ${np.volts} V MAX — ${np.sccr} (${canada ? 'CSA C22.2 No. 14' : 'UL 508A SB'})`],
    iec ? ['DEGREE OF PROTECTION', `${NEMA_TO_IP[np.enclosureType] ?? np.enclosureType} (IEC 60529)`] : ['ENCLOSURE TYPE', np.enclosureType.toUpperCase().replace(/^NEMA\s*/, 'TYPE ')],
    ['CONTROL VOLTAGE', `24 VDC${model.transformer ? ' / 120 VAC (TRANSFORMER)' : ''}`],
  ];
  const fh = (NPH - 14) / fields.length;
  // ---- legend plates
  const plates = layout.door.items.filter((d) => d.kind !== 'hmi');
  const TX = x0 + NPW + 12;
  const TW = AREA_R - TX - 3;
  const pcols = [0, 16, 66, 104, 124, 170];
  const pheads = ['TAG', 'ENGRAVED TEXT', 'PLATE / SIZE', 'TEXT HT', 'COLOURS (TEXT / PLATE)', 'OPERATOR'];
  const prow = 4.4;
  const ptop = AREA.y + 18;
  const maxPlates = 16;
  const shownPlates = plates.slice(0, maxPlates);
  const hmi = layout.door.items.find((d) => d.kind === 'hmi');
  // ---- labels
  const labels: { head: string; body: string[]; symbol: 'shock' | 'arc' | 'info' | 'ground'; where: string }[] = [
    { head: 'DANGER', symbol: 'shock', where: 'ENCLOSURE DOOR, OUTSIDE', body: ['HAZARDOUS VOLTAGE.', `${np.volts} VAC. WILL CAUSE SEVERE INJURY OR DEATH. TURN OFF AND LOCK OUT ${np.disconnectTag} BEFORE OPENING.`] },
    { head: 'WARNING', symbol: 'arc', where: 'ENCLOSURE DOOR, OUTSIDE', body: iec ? ['ELECTRICAL HAZARD (ISO 7010 W012).', 'WORK ON LIVE PARTS ONLY BY SKILLED PERSONS WITH SUITABLE PPE (EN 50110-1). ISOLATE AND LOCK OFF FIRST.'] : ['ARC FLASH AND SHOCK HAZARD.', `APPROPRIATE PPE REQUIRED. ${canada ? 'CSA Z462 / CEC 2-306' : 'NFPA 70E / NEC 110.16'}. INCIDENT ENERGY: TBD (BY SITE STUDY).`] },
    { head: 'NOTICE', symbol: 'info', where: `${np.disconnectTag} HANDLE`, body: ['MAIN DISCONNECT.', 'LOCKABLE IN OFF POSITION. OFF / ON MARKED ON HANDLE.'] },
    ...(np.multipleSources ? [{ head: 'WARNING', symbol: 'shock' as const, where: 'DOOR + AFFECTED DEVICES', body: ['MULTIPLE SOURCES OF SUPPLY.', `CIRCUITS REMAIN ENERGIZED WITH ${np.disconnectTag} OFF. ORANGE (OG) WIRING.`] }] : []),
    { head: 'PE', symbol: 'ground', where: `${model.groundBar?.tag ?? 'PE BAR'} / GROUND BAR`, body: ['PROTECTIVE EARTH.', 'MAIN BONDING POINT. GREEN/YELLOW CONDUCTORS ONLY.'] },
  ];
  const LW_ = 60, LH = 26;
  const ly = npY + NPH + 14;
  const perRow = Math.floor((NPW + 2) / (LW_ + 4));
  // ---- marking conventions
  const conv = [
    `WIRE MARKERS: WHITE HEAT-SHRINK OR PRINTED SLEEVES, BLACK TEXT, 2.5 mm MIN. TEXT HEIGHT, AT BOTH ENDS OF EVERY CONDUCTOR, READING FROM THE TERMINAL OUTWARD (${iec ? 'IEC 60204-1 13.2.1' : 'NFPA 79 13.2.1'}). TEXT = WIRE NUMBER ON THE SCHEMATIC.`,
    `TERMINAL MARKERS: CLIP-IN MARKERS, CONSECUTIVE NUMBERS 1, 2, 3… PER STRIP; STRIP TAG (${stripTag(plan.ctx.designations, 1)}, ${stripTag(plan.ctx.designations, 2)}…) ON A GROUP MARKER AT EACH END STOP.`,
    'DEVICE ID LABELS: ADHESIVE LABEL WITH THE DEVICE TAG ON THE PANEL OR DUCT NEXT TO EVERY BACK-PANEL DEVICE (NOT ON THE REMOVABLE DEVICE). DOOR DEVICES: TAG ON THE INSIDE OF THE DOOR.',
    'FIELD CABLES: CABLE TAG (W001…) ON BOTH ENDS; FIELD DEVICES: ENGRAVED / UV-STABLE TAG WITH THE DEVICE TAG.',
    'LEGEND PLATES: LAMINATED PHENOLIC (LAMICOID) OR THE OPERATOR SERIES LEGEND PLATE; ENGRAVED UPPER CASE, SANS-SERIF.',
    iec ? `${regionSpec(ctx.region).marking.toUpperCase()}. IEC 61439 RATING PLATE BY THE PANEL BUILDER.${ctx.region === 'Israel' ? ' WARNING LABELS IN HEBREW (AND ENGLISH / ARABIC AS NEEDED).' : ' WARNING LABELS IN THE LANGUAGE(S) OF THE COUNTRY OF USE.'}`
      : canada ? 'CANADA: CSA/cUL LABEL BY CERTIFIED SHOP. BILINGUAL (EN/FR) WARNING LABELS WHERE REQUIRED (E.G. QUEBEC).' : 'UL 508A LISTING MARK AND SCCR MARKING APPLIED BY THE LISTED PANEL SHOP.',
  ];
  const cy0 = ptop + (shownPlates.length + (hmi ? 1 : 0) + 2) * prow + 14;
  const convLines = conv.map((c) => wrapText(c, TW - 6, 2.1));
  const convEnd = cy0 + 7 + convLines.reduce((h, ls) => h + ls.length * 2.9 + 1.2, 0);
  const idTags = model.rc.filter((c) => c.mount === 'backplate' && !isFuseCartridge(c) && !['enclosure', 'dinRail', 'wireDuct', 'terminal', 'terminalAccessory'].includes(c.category) && !/handle|shaft|jumper|marker/i.test(`${c.comp.function} ${c.part?.description ?? ''}`))
    .map((c) => c.tag).concat(model.strips.map((st) => st.tag)).filter((t, i, a) => a.indexOf(t) === i).sort((x, y) => x.localeCompare(y, 'en', { numeric: true }));
  return (
    <g>
      <Txt x={x0} y={AREA.y + 7} size={3.2} bold>PANEL NAMEPLATE (NTS)</Txt>
      <rect x={x0} y={npY} width={NPW} height={NPH} strokeWidth={0.7} rx={1.5} />
      <rect x={x0 + 1.2} y={npY + 1.2} width={NPW - 2.4} height={NPH - 2.4} strokeWidth={LW_THIN} rx={1} />
      {[[3, 3], [NPW - 3, 3], [3, NPH - 3], [NPW - 3, NPH - 3]].map(([dx, dy], i) => <circle key={i} cx={x0 + dx} cy={npY + dy} r={0.9} strokeWidth={LW_THIN} />)}
      <Txt x={x0 + NPW / 2} y={npY + 7.5} size={3.2} bold anchor="middle">INDUSTRIAL CONTROL PANEL</Txt>
      {fields.map(([k, v], i) => {
        const yy = npY + 10 + i * fh;
        return (
          <g key={k}>
            <Line x1={x0 + 4} y1={yy + fh - 0.6} x2={x0 + NPW - 4} y2={yy + fh - 0.6} w={0.12} />
            <Txt x={x0 + 5} y={yy + fh - 1.8} size={1.9} bold>{k}</Txt>
            <Txt x={x0 + 46} y={yy + fh - 1.8} size={2.1} mono maxW={NPW - 50}>{v}</Txt>
          </g>
        );
      })}
      <Txt x={x0} y={npY + NPH + 4} size={1.9} maxW={NPW}>{`STAINLESS OR ENGRAVED PHENOLIC, RIVETED/ADHESIVE ON THE DOOR OUTSIDE NEAR ${np.disconnectTag}. BLANK FIELDS FILLED BY THE PANEL SHOP.`}</Txt>
      <Txt x={x0} y={npY + NPH + 7} size={1.9} maxW={NPW}>{`MARKINGS PER ${codes.panel} / NFPA 79 16.4. SCCR AND FULL-LOAD CURRENT MUST BE CALCULATED AND VERIFIED.`}</Txt>

      {/* warning labels */}
      <Txt x={x0} y={ly - 2} size={3.0} bold>WARNING & IDENTIFICATION LABELS</Txt>
      {labels.map((l, i) => {
        const c = i % perRow, r = Math.floor(i / perRow);
        const lx = x0 + c * (LW_ + 6), lyy = ly + 2 + r * (LH + 7);
        if (lyy + LH + 4 > AREA_B) return null;
        return (
          <g key={i}>
            <WarnLabel x={lx} y={lyy} w={LW_} h={LH} head={l.head} body={l.body} symbol={l.symbol} />
            <Txt x={lx} y={lyy + LH + 3} size={1.8} italic maxW={LW_}>{`LOCATION: ${l.where}`}</Txt>
          </g>
        );
      })}

      {/* legend plate schedule */}
      <Line x1={TX - 6} y1={AREA.y + 3} x2={TX - 6} y2={AREA_B - 3} w={LW_THIN} />
      <Txt x={TX} y={AREA.y + 7} size={3.2} bold>ENGRAVED LEGEND PLATE SCHEDULE — DOOR DEVICES</Txt>
      <rect x={TX} y={ptop - 4.2} width={TW} height={(shownPlates.length + (hmi ? 1 : 0) + 1) * prow + 1.4} strokeWidth={LW_HEAVY} />
      {pheads.map((h, i) => <Txt key={h} x={TX + pcols[i] + 1.2} y={ptop - 0.4} size={2.0} bold>{h}</Txt>)}
      <Line x1={TX} y1={ptop + 1} x2={TX + TW} y2={ptop + 1} w={LW} />
      {pcols.slice(1).map((c) => <Line key={c} x1={TX + c} y1={ptop - 4.2} x2={TX + c} y2={ptop - 4.2 + (shownPlates.length + (hmi ? 1 : 0) + 1) * prow + 1.4} w={LW_THIN} />)}
      {shownPlates.map((d, i) => {
        const yy = ptop + 1 + (i + 1) * prow - 1.2;
        const es = d.kind === 'estop';
        return (
          <g key={d.tag}>
            <Txt x={TX + 1.2} y={yy} size={2.1} mono bold>{d.tag}</Txt>
            <Txt x={TX + pcols[1] + 1.2} y={yy} size={2.1} bold maxW={pcols[2] - pcols[1] - 2}>{es ? 'EMERGENCY STOP' : d.legend.join(' / ')}</Txt>
            <Txt x={TX + pcols[2] + 1.2} y={yy} size={1.9} maxW={pcols[3] - pcols[2] - 2}>{es ? 'Ø60 mm (2.36") ROUND' : '22 mm STD PLATE'}</Txt>
            <Txt x={TX + pcols[3] + 1.2} y={yy} size={1.9} maxW={pcols[4] - pcols[3] - 2}>{es ? '4 mm (5/32")' : '3 mm (1/8")'}</Txt>
            <Txt x={TX + pcols[4] + 1.2} y={yy} size={1.9} maxW={pcols[5] - pcols[4] - 2}>{es ? 'BLACK / YELLOW (NFPA 79 10.7.3)' : 'WHITE / BLACK'}</Txt>
            <Txt x={TX + pcols[5] + 1.2} y={yy} size={1.9} maxW={TW - pcols[5] - 2}>{`${d.color || '—'} ${d.kind === 'pilot' ? 'LIGHT' : d.kind === 'selector' ? 'SELECTOR' : d.kind === 'estop' ? 'MUSHROOM' : 'BUTTON'}`}</Txt>
            <Line x1={TX} y1={yy + 1.2} x2={TX + TW} y2={yy + 1.2} w={0.1} />
          </g>
        );
      })}
      {hmi && (() => {
        const yy = ptop + 1 + (shownPlates.length + 1) * prow - 1.2;
        return (
          <g>
            <Txt x={TX + 1.2} y={yy} size={2.1} mono bold>{hmi.tag}</Txt>
            <Txt x={TX + pcols[1] + 1.2} y={yy} size={2.1} bold maxW={pcols[2] - pcols[1] - 2}>OPERATOR INTERFACE</Txt>
            <Txt x={TX + pcols[2] + 1.2} y={yy} size={1.9} maxW={pcols[3] - pcols[2] - 2}>75 x 20 mm (3" x 3/4")</Txt>
            <Txt x={TX + pcols[3] + 1.2} y={yy} size={1.9}>4 mm (5/32")</Txt>
            <Txt x={TX + pcols[4] + 1.2} y={yy} size={1.9}>WHITE / BLACK</Txt>
            <Txt x={TX + pcols[5] + 1.2} y={yy} size={1.9} maxW={TW - pcols[5] - 2}>{hmi.partNumber}</Txt>
          </g>
        );
      })()}
      {plates.length > maxPlates && <Txt x={TX} y={ptop + (maxPlates + 2) * prow} size={1.9} italic>{`+${plates.length - maxPlates} MORE — SEE DOOR LAYOUT`}</Txt>}
      {!plates.length && !hmi && <Txt x={TX + 2} y={ptop + 4} size={2.0} italic>NO DOOR-MOUNTED OPERATOR DEVICES.</Txt>}

      {/* marking conventions */}
      <Txt x={TX} y={cy0} size={3.0} bold>WIRE, TERMINAL & DEVICE MARKING CONVENTION</Txt>
      <Line x1={TX} y1={cy0 + 2.5} x2={AREA_R - 3} y2={cy0 + 2.5} w={LW} />
      {(() => {
        let yy = cy0 + 7;
        return convLines.map((ls, i) => {
          const y0 = yy;
          yy += ls.length * 2.9 + 1.2;
          return (
            <g key={i}>
              <Txt x={TX} y={y0} size={2.1} bold>{`${i + 1}.`}</Txt>
              {ls.map((l, k) => <Txt key={k} x={TX + 5} y={y0 + k * 2.9} size={2.1} maxW={TW - 6}>{l}</Txt>)}
            </g>
          );
        });
      })()}
      {/* wire marker illustration */}
      {(() => {
        const iy = convEnd + 6;
        const ix = TX + 4;
        const ly0 = iy + 16;
        const colsN = Math.max(1, Math.floor(TW / 22));
        const maxRows = Math.max(0, Math.floor((AREA_B - 3 - (ly0 + 6)) / 3.3));
        const shown = idTags.slice(0, colsN * maxRows);
        return (
          <g>
            {idTags.length > 0 && maxRows > 0 && (
              <g>
                <Txt x={TX} y={ly0} size={2.6} bold>{`DEVICE ID LABELS — BACK PANEL (${idTags.length}): ADHESIVE, BLACK TEXT ON WHITE, 3 mm (1/8") TEXT`}</Txt>
                <Line x1={TX} y1={ly0 + 1.6} x2={AREA_R - 3} y2={ly0 + 1.6} w={LW_THIN} />
                {shown.map((t, i) => {
                  const c = i % colsN, r = Math.floor(i / colsN);
                  return (
                    <g key={t}>
                      <rect x={TX + c * 22} y={ly0 + 3.2 + r * 3.3} width={19} height={2.9} strokeWidth={0.15} />
                      <Txt x={TX + c * 22 + 9.5} y={ly0 + 5.3 + r * 3.3} size={1.9} mono bold anchor="middle" maxW={18}>{t}</Txt>
                    </g>
                  );
                })}
                {idTags.length > shown.length && <Txt x={AREA_R - 4} y={ly0} size={1.9} italic anchor="end">{`+${idTags.length - shown.length} MORE (SEE DEVICE LIST)`}</Txt>}
              </g>
            )}
            <TermBox x={ix} y={iy} n={4} />
            <Txt x={ix} y={iy - 3.4} size={1.8} mono anchor="middle">{stripTag(plan.ctx.designations, 2)}</Txt>
            <Line x1={ix + 2.5} y1={iy} x2={ix + 90} y2={iy} w={0.6} />
            {[ix + 9, ix + 75].map((sx) => (
              <g key={sx}>
                <rect x={sx} y={iy - 1.8} width={11} height={3.6} strokeWidth={LW_THIN} fill="#fff" />
                <Txt x={sx + 5.5} y={iy + 0.8} size={2.0} mono bold anchor="middle">X101</Txt>
              </g>
            ))}
            <TermPt x={ix + 90.7} y={iy} />
            <Txt x={ix + 92.5} y={iy + 0.8} size={1.9} mono>PLC1:X101</Txt>
            <Txt x={ix + 42} y={iy + 5.5} size={1.9} anchor="middle">SAME WIRE NUMBER ON BOTH SLEEVES — MATCHES THE SCHEMATIC</Txt>
          </g>
        );
      })()}
    </g>
  );
}
