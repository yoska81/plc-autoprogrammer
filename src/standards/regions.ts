/**
 * Installation regions and the standards each one brings: codes, supplies, conductor sizes and
 * colours, device designations, drawing symbols and sheet size. North America (US, Canada) keeps
 * NFPA 79 practice; Europe, Israel and other IEC countries follow IEC 60204-1.
 *
 * Sources (checked 2026-10):
 * - IEC 60204-1:2016 (EN 60204-1:2018) §13.2.2–13.2.4 conductor colours: PE green-and-yellow,
 *   neutral (light) blue, BLACK AC/DC power, RED AC control, BLUE DC control, ORANGE excepted
 *   (interlock) circuits supplied from an external source.
 * - IEC 60204-1:2016 Table 6: current-carrying capacity, PVC copper, 40 °C ambient, methods B2 and C
 *   (B2 = cable in conduit/trunking, the usual case inside a panel; C = cable clipped to a surface).
 * - IEC 60947-4-1 Annex G: rated operational currents of 4-pole cage motors (230 / 400 / 690 V).
 * - Israel: 230/400 V 50 Hz. Machinery electrical equipment to IEC 60204-1 (SI 60204 part 1:
 *   confirm the adopted edition and whether it is official with the Standards Institution of
 *   Israel). Earthing per the Electricity Regulations (earthing and protection against electric
 *   shock up to 1000 V), 1991: TN-C-S/TN-S ("ipus", with the network owner's approval) or TT,
 *   depending on the site — confirm with the site's electrician.
 */
import type { SupplyVoltage } from '../electrical/types';

export type Region = 'US' | 'Canada' | 'EU' | 'Israel' | 'IEC';
export type DesignationStyle = 'nfpa' | 'iec81346';
export type SymbolSet = 'ansi' | 'iec60617';
export type SheetFormat = 'ANSI B' | 'A3';

export interface RegionSpec {
  value: Region;
  label: string;
  /** One line under the label in the wizard. */
  hint: string;
  /** 'na' = North American practice (NFPA 79), 'iec' = IEC 60204-1 practice. */
  family: 'na' | 'iec';
  standards: string[];
  supply: SupplyVoltage;
  supplies: SupplyVoltage[];
  /** Installation code / panel standard / short title-block text. */
  codes: { installation: string; panel: string; short: string };
  /** Product marking the machine needs before it is sold or put into service there. */
  marking: string;
  designations: DesignationStyle;
  symbols: SymbolSet;
  sheet: SheetFormat;
}

const NA_SUPPLIES: SupplyVoltage[] = ['600VAC-3PH', '480VAC-3PH', '240VAC-3PH', '208VAC-3PH', '120VAC-1PH'];
const IEC_SUPPLIES: SupplyVoltage[] = ['400VAC-3PH', '230VAC-1PH', '690VAC-3PH'];
const IEC_STANDARDS = ['IEC 60204-1', 'IEC 61439-1/-2', 'EN ISO 13849-1', 'IEC 62061', 'EN ISO 12100'];

export const REGIONS: RegionSpec[] = [
  {
    value: 'US', label: 'United States', hint: 'NEC, NFPA 79, UL 508A · circuit breakers', family: 'na',
    standards: ['NFPA 79', 'UL 508A', 'NEC'], supply: '480VAC-3PH', supplies: NA_SUPPLIES,
    codes: { installation: 'NEC (NFPA 70)', panel: 'UL 508A', short: 'NFPA 79 / UL 508A / NEC' },
    marking: 'UL 508A listing mark on the panel', designations: 'nfpa', symbols: 'ansi', sheet: 'ANSI B',
  },
  {
    value: 'Canada', label: 'Canada', hint: 'CEC, CSA C22.2 No. 14 · fuses', family: 'na',
    standards: ['CSA C22.2 No. 14', 'CEC'], supply: '600VAC-3PH', supplies: NA_SUPPLIES,
    codes: { installation: 'CEC (CSA C22.1)', panel: 'CSA C22.2 No. 14', short: 'NFPA 79 / CSA C22.2 No. 14 / CEC' },
    marking: 'CSA / cUL certification mark on the panel', designations: 'nfpa', symbols: 'ansi', sheet: 'ANSI B',
  },
  {
    value: 'EU', label: 'Europe (CE / UKCA)', hint: 'IEC 60204-1, IEC 61439 · 400 V 50 Hz · MCBs', family: 'iec',
    standards: IEC_STANDARDS, supply: '400VAC-3PH', supplies: IEC_SUPPLIES,
    codes: { installation: 'IEC 60364 (national wiring rules)', panel: 'IEC 61439-1/-2', short: 'IEC 60204-1 / IEC 61439' },
    marking: 'CE marking (EU Machinery Directive 2006/42/EC, from 20 Jan 2027 Regulation (EU) 2023/1230; LV and EMC directives) or UKCA for Great Britain, with a declaration of conformity and technical file',
    designations: 'iec81346', symbols: 'iec60617', sheet: 'A3',
  },
  {
    value: 'Israel', label: 'Israel', hint: 'SI/IEC 60204-1 · 400/230 V 50 Hz · MCBs', family: 'iec',
    standards: ['SI 60204-1 (IEC 60204-1)', ...IEC_STANDARDS.slice(1), 'Israeli Electricity Law and Regulations'], supply: '400VAC-3PH', supplies: IEC_SUPPLIES,
    codes: { installation: 'Israeli Electricity Regulations (earthing per the 1991 regulations)', panel: 'IEC 61439-1/-2', short: 'SI/IEC 60204-1 / IEC 61439' },
    marking: 'Conformity to SI 60204-1 / IEC 60204-1; CE documentation is commonly accepted as evidence. Installation by a licensed electrician; confirm the site earthing system (TN-C-S/TN-S or TT) with the site',
    designations: 'iec81346', symbols: 'iec60617', sheet: 'A3',
  },
  {
    value: 'IEC', label: 'Other IEC country', hint: 'IEC 60204-1, IEC 61439 · 400 V 50 Hz', family: 'iec',
    standards: IEC_STANDARDS, supply: '400VAC-3PH', supplies: IEC_SUPPLIES,
    codes: { installation: 'IEC 60364 (local wiring rules)', panel: 'IEC 61439-1/-2', short: 'IEC 60204-1 / IEC 61439' },
    marking: 'The marking and approval the destination country requires (check local rules)',
    designations: 'iec81346', symbols: 'iec60617', sheet: 'A3',
  },
];

export function regionSpec(r: Region | string | undefined): RegionSpec {
  return REGIONS.find((x) => x.value === r) ?? REGIONS[0];
}
export const isIec = (r: Region | string | undefined) => regionSpec(r).family === 'iec';

// ---------------------------------------------------------------------------
// Supplies
// ---------------------------------------------------------------------------

export interface SupplyInfo { label: string; hint: string; volts: number; phases: 1 | 3; hz: 50 | 60; neutral: boolean; text: string }

export const SUPPLY_INFO: Record<SupplyVoltage, SupplyInfo> = {
  '600VAC-3PH': { label: '600 V 3-phase', hint: 'Most Canadian factories', volts: 600, phases: 3, hz: 60, neutral: false, text: '600VAC 3PH 60Hz' },
  '480VAC-3PH': { label: '480 V 3-phase', hint: 'Most US factories', volts: 480, phases: 3, hz: 60, neutral: false, text: '480VAC 3PH 60Hz' },
  '240VAC-3PH': { label: '240 V 3-phase', hint: 'Smaller plants, shops', volts: 240, phases: 3, hz: 60, neutral: false, text: '240VAC 3PH 60Hz' },
  '208VAC-3PH': { label: '208 V 3-phase', hint: 'Commercial buildings', volts: 208, phases: 3, hz: 60, neutral: false, text: '208VAC 3PH 60Hz' },
  '120VAC-1PH': { label: '120 V single-phase', hint: 'Small machines, plug-in', volts: 120, phases: 1, hz: 60, neutral: true, text: '120VAC 1PH 60Hz' },
  '400VAC-3PH': { label: '400 V 3-phase + N', hint: '400/230 V 50 Hz, most factories', volts: 400, phases: 3, hz: 50, neutral: true, text: '3/N/PE AC 400/230V 50Hz' },
  '230VAC-1PH': { label: '230 V single-phase', hint: 'Small machines, plug-in', volts: 230, phases: 1, hz: 50, neutral: true, text: '1/N/PE AC 230V 50Hz' },
  '690VAC-3PH': { label: '690 V 3-phase', hint: 'Large drives, heavy industry', volts: 690, phases: 3, hz: 50, neutral: false, text: '3/PE AC 690V 50Hz' },
};

// ---------------------------------------------------------------------------
// Motors (IEC)
// ---------------------------------------------------------------------------

/** IEC 60947-4-1 Annex G: kW, 230 V, 400 V, 690 V rated operational currents (4-pole cage motors). */
const IEC_MOTOR: [number, number, number, number][] = [
  [0.37, 1.9, 1.1, 0.64], [0.55, 2.6, 1.5, 0.87], [0.75, 3.3, 1.9, 1.1], [1.1, 4.7, 2.7, 1.6], [1.5, 6.3, 3.6, 2.1],
  [2.2, 8.5, 4.9, 2.8], [3, 11.3, 6.5, 3.8], [4, 15, 8.5, 4.9], [5.5, 20, 11.5, 6.7], [7.5, 27, 15.5, 9], [11, 39, 22, 12.9],
  [15, 52, 29, 17], [18.5, 64, 35, 21], [22, 75, 42, 24], [30, 100, 56, 32], [37, 125, 69, 40], [45, 150, 83, 48],
  [55, 182, 100, 58], [75, 240, 132, 76],
];

export const hpToKw = (hp: number) => hp * 0.7457;

/** Standard IEC motor rating at or above the given power. */
export function iecMotorKw(hp: number): number {
  const kw = hpToKw(hp);
  return (IEC_MOTOR.find(([k]) => k >= kw - 0.005) ?? IEC_MOTOR[IEC_MOTOR.length - 1])[0];
}

/**
 * Rated current of an IEC motor on an IEC supply (Annex G, next rating up). Single-phase 230 V is
 * approximated as √3 × the 3-phase 230 V current (no IEC table; check the motor nameplate).
 */
export function iecMotorCurrent(hp: number, supply: SupplyVoltage): number {
  const kw = hpToKw(hp);
  const row = IEC_MOTOR.find(([k]) => k >= kw - 0.005) ?? IEC_MOTOR[IEC_MOTOR.length - 1];
  if (supply === '690VAC-3PH') return row[3];
  if (supply === '230VAC-1PH') return Math.round(row[1] * Math.sqrt(3) * 10) / 10;
  return row[2];
}

// ---------------------------------------------------------------------------
// Conductors
// ---------------------------------------------------------------------------

/** IEC 60204-1 Table 6, PVC copper at 40 °C: mm², method B2 (A), method C (A). */
export const IEC_AMPACITY: [number, number, number][] = [
  [0.75, 8.5, 9.8], [1, 10.1, 11.7], [1.5, 13.1, 15.2], [2.5, 17.4, 21], [4, 23, 28], [6, 30, 36], [10, 40, 50],
  [16, 54, 66], [25, 70, 84], [35, 86, 104], [50, 103, 125],
];

/** Smallest conductor (method B2, in trunking) carrying the current; power at least 1.5 mm². */
export function mm2For(amps: number, min = 1.5): number {
  const row = IEC_AMPACITY.find(([s, b2]) => s >= min && b2 >= amps);
  return (row ?? IEC_AMPACITY[IEC_AMPACITY.length - 1])[0];
}

/** Copper area of an AWG / kcmil size in mm². */
export function awgToMm2(awg: string): number | null {
  const m = awg.trim().match(/^(\d+)\/0|^(\d+)\s*AWG/i);
  if (!m) return null;
  const n = m[1] ? -(Number(m[1]) - 1) : Number(m[2]);
  const d = 0.127 * 92 ** ((36 - n) / 39);
  return Math.round((Math.PI / 4) * d * d * 100) / 100;
}

/** Standard IEC sizes (IEC 60228). */
export const IEC_SIZES = [0.5, 0.75, 1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120];

/** Nearest IEC size with at least the copper of the AWG size (e.g. 14 AWG → 2.5 mm², 18 AWG → 1 mm²). */
export function mm2FromAwg(awg: string): number | null {
  const a = awgToMm2(awg);
  if (a == null) return null;
  return IEC_SIZES.find((s) => s >= a * 0.97) ?? IEC_SIZES[IEC_SIZES.length - 1];
}

/** Nearest AWG for an mm² size, for "2.5 mm² (≈14 AWG)" displays. */
export function awgNear(mm2: number): string {
  let best = '';
  let diff = Infinity;
  for (const n of [24, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4, 2, 1]) {
    const a = awgToMm2(`${n} AWG`)!;
    if (Math.abs(Math.log(a / mm2)) < diff) { diff = Math.abs(Math.log(a / mm2)); best = `${n} AWG`; }
  }
  for (const n of [1, 2, 3, 4]) {
    const a = awgToMm2(`${n}/0`)!;
    if (Math.abs(Math.log(a / mm2)) < diff) { diff = Math.abs(Math.log(a / mm2)); best = `${n}/0 AWG`; }
  }
  return best;
}

export const mm2Text = (mm2: number) => `${mm2} mm²`;

/**
 * NFPA 79 wire colour (as drawn by the electrical engine) → IEC 60204-1 §13.2 colour for the same
 * function. `fn` is the wire's function text, used to tell AC control from AC power.
 */
export function iecColor(nfpa: string, fn = ''): string {
  const c = nfpa.toUpperCase();
  if (c === 'GN/YE' || c === 'GN') return 'GN/YE';
  // NFPA white is the grounded conductor: the supply neutral (IEC light blue), or the earthed side of
  // the control transformer secondary, which is part of the AC control circuit (IEC red).
  if (c === 'WH' || c === 'WH/BK') return /secondary|120VAC/i.test(fn) ? 'RD' : 'BU(LT)';
  if (c === 'RD') return 'RD';
  if (c === 'BU' || c === 'WH/BU') return 'BU';
  if (c === 'OR' || c === 'YE') return 'OG';
  return c === 'BK' ? 'BK' : c;
}

/** Wire size text in the region's units (IEC: mm² with the AWG in brackets left out). */
export function regionSize(size: string, region: Region | string | undefined): string {
  if (!isIec(region)) return size;
  const mm = mm2FromAwg(size);
  return mm == null ? size : mm2Text(mm);
}

// ---------------------------------------------------------------------------
// Device designations (IEC 81346-2 letter codes)
// ---------------------------------------------------------------------------

/** NFPA-style tag prefix → IEC 81346-2 class letter. */
const IEC_CLASS: [RegExp, string][] = [
  [/^(DS|MDS|CB|MCB|MPCB|MMS|MP|QF)$/, 'Q'], // switching/protecting power: disconnect, breakers, motor circuit breakers
  [/^(FU|F|OL)$/, 'F'],                      // fuses, overload relays
  [/^(M|MTR|SOL|YV)$/, 'M'],                 // motors and solenoid coils drive motion
  [/^(K|CR|MCR|SR|SFT|C)$/, 'K'],            // relays, contactors, safety relay
  [/^(PLC|CPU|A)$/, 'K'],                    // PLC: processing signals
  [/^(PS|T|XFMR|VFD|U|DR)$/, 'T'],           // power supplies, transformers, drives convert energy
  [/^(PB|SS|ES|ESTOP|E-STOP|SW)$/, 'S'],     // manual control devices
  [/^(LS|PX|PE|PRX|B|SEN)$/, 'B'],           // sensors
  [/^(PL|LT|L|SL|H|HMI)$/, 'P'],             // indicators and operator panels present information
  [/^(TB|X|TS)$/, 'X'],                      // terminals
];

/** IEC 81346 designation for an NFPA tag, e.g. CB1 → -Q1, MCR → -K1 (numbers kept when present). */
export function iecDesignation(tag: string, used: Map<string, number> = new Map()): string {
  const m = tag.toUpperCase().match(/^([A-Z-]+?)(\d*)$/);
  if (!m) return `-${tag}`;
  const cls = IEC_CLASS.find(([re]) => re.test(m[1]))?.[1] ?? 'U';
  const key = `${cls}:${m[1]}`;
  if (m[2]) return `-${cls}${m[2]}`;
  const n = (used.get(key) ?? 0) + 1;
  used.set(key, n);
  return `-${cls}${n}`;
}

/** IEC 60898-1 MCB tripping curves and what each is for. */
export const MCB_CURVES = [
  { curve: 'B', trips: '3–5 × In', use: 'Resistive loads, long cables, socket outlets' },
  { curve: 'C', trips: '5–10 × In', use: 'Control transformers, power supplies, small motors, general use' },
  { curve: 'D', trips: '10–20 × In', use: 'High inrush: large transformers, capacitors, motors started direct-on-line' },
] as const;

/** Standard MCB / motor circuit breaker ratings (A). */
const MCB_RATINGS = [0.5, 1, 2, 3, 4, 6, 10, 13, 16, 20, 25, 32, 40, 50, 63];

/** MCB rating for a load: next standard rating at or above the current (× factor). */
export function mcbFor(amps: number, factor = 1.25): number {
  return MCB_RATINGS.find((r) => r >= amps * factor) ?? MCB_RATINGS[MCB_RATINGS.length - 1];
}

/** IEC enclosure IP rating closest to a NEMA type (IEC 60529; NEMA→IP is one-way, approximate). */
export const NEMA_TO_IP: Record<string, string> = { 'NEMA 1': 'IP20', 'NEMA 12': 'IP54', 'NEMA 4': 'IP66', 'NEMA 4X': 'IP66 (corrosion resistant)' };

/** Pick the US, Canadian or IEC variant of a text or value for a region. */
export function byRegion<T>(region: Region | string | undefined, us: T, canada: T, iec: T): T {
  return isIec(region) ? iec : region === 'Canada' ? canada : us;
}

/**
 * Paper for the drawing set. Sheets are laid out on ANSI B (431.8 × 279.4 mm); on A3 (420 × 297 mm,
 * ISO 216) the same sheet is printed at 420 / 431.8 = 97.3 % and centred, so scales change slightly.
 */
export const PAPER: Record<SheetFormat, { w: number; h: number; css: string; label: string }> = {
  'ANSI B': { w: 431.8, h: 279.4, css: '17in 11in', label: 'ANSI B 17 × 11 in' },
  A3: { w: 420, h: 297, css: '420mm 297mm', label: 'A3 420 × 297 mm' },
};

/** Where the ANSI B sheet sits on the paper (mm) and its scale factor. */
export function sheetOnPaper(sheet: SheetFormat | undefined) {
  const p = PAPER[sheet ?? 'ANSI B'];
  const f = Math.min(p.w / 431.8, p.h / 279.4);
  const w = 431.8 * f, h = 279.4 * f;
  return { paper: p, factor: f, x: (p.w - w) / 2, y: (p.h - h) / 2, w, h };
}
