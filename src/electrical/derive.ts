/**
 * Deterministic derivations from an ElectricalDesign: wire numbers, terminal
 * plan, bill of materials, panel/door layout, review warnings and CSV exports.
 * Pure functions, no React. The drawing sheets (src/electrical/drawings) are
 * built from the same model so every sheet, table and CSV agrees.
 *
 * WIRE-NUMBERING SCHEME (North American practice, also printed on the cover):
 *  - Incoming supply ............ L1, L2, L3 (3-phase) or L1, N (120VAC), PE = protective earth.
 *  - Main bus (load side of the main disconnect / main breaker) ... 1L1, 1L2, 1L3 (N stays "N").
 *  - Branch feeds ............... <device>-L1.. on the load side of each branch protective device,
 *                                 e.g. PS1-L1/PS1-L2 feed power supply PS1.
 *  - Motor branches ............. M1-L1..L3 load side of the branch protection (line side of the
 *                                 starter/VFD), M1-C1..C3 contactor to overload, M1-T1..T3 to the motor.
 *  - 24VDC distribution ......... 24+ (unswitched +24V), 0V (DC common, bonded to PE at PS1),
 *                                 24+S (+24V switched by the safety relay / MCR, feeds outputs).
 *  - 120VAC control (only if a control transformer is used) ... X1 (hot), X2 (grounded).
 *  - Safety circuit ............. named after the safety-relay terminal they land on:
 *                                 S11, S12, S21, S22, S33, S34; intermediate segments get a
 *                                 letter suffix (S11A, S11B ...).
 *  - PLC I/O .................... the PLC address: X001 from the field device through the terminal
 *                                 strip to input X001; Y001 from output Y001 to the load. Segments
 *                                 after a series device get a letter suffix (Y001 -> OL1 -> Y001A).
 */
import type { AnalogSetupRow } from '../plc/core/analog';
import { analogWiring, type AnalogWiring } from './analog';
import { driveControls, type DriveControl, type DriveTerminal } from './vfd';
import { encoderChannel, isServoDrive, isServoMotor, motionWarnings, servoCableKind, servoPins } from './motion';
import { servoAxes, servoControls, type ServoAxisModel, type StoFeed } from './servoWiring';
import type {
  CatalogCategory, CatalogPart, DesignComponent, ElectricalDesign, EnclosureChoice, EnclosureRating, FieldDeviceType, IOWiring, JunctionBox,
  MachineWiring, MotorSpec, MountLocation, SupplyVoltage,
} from './types';
import { getHmi, hmiMaker } from '../hmi/hmiCatalog';
import { hasBuiltInPanel } from '../hmi/panels';
import { lengthText, routedLength, withService } from './layout/geometry';
import { CABINET, type LayoutForDesign } from './layout/types';
import { iecColor, iecMotorCurrent, isIec, mm2For, mm2FromAwg, mm2Text, regionSize, regionSpec, SUPPLY_INFO, type DesignationStyle, type Region, type SheetFormat, type SymbolSet } from '../standards/regions';
import { ALL_PARTS } from './catalogs';
import { coolingCover, dcFanAmps } from './cooling';
import { coilMatchesRail, relayLadder, type Ladder } from './relayLogic';
import { ALLOWED_RISE_C, cabinetHeat } from './thermal';
import { withIecStrips } from '../standards/designations';
import { issuedForConstruction } from '../standards/issue';

export interface DrawingContext {
  projectName: string;
  design: ElectricalDesign;
  getPart: (partNumber: string) => CatalogPart | undefined;
  plc: { vendor: string; name: string; cpuPartNumber: string; cpuLabel: string };
  /** Project I/O resolved to PLC addresses. */
  io: { address: string; description: string; type: 'input' | 'output' }[];
  /** Installation region: drives code references (NEC/UL 508A vs CEC/CSA C22.2 No. 14). Default 'US'. */
  region?: Region;
  /** Door-mounted HMI chosen for the project (cutout from src/hmi/hmiCatalog). */
  hmiPartNumber?: string | null;
  /** Document control for title blocks: numbers, company, names and revision history. */
  doc?: DocInfo;
  /** Machine layout (metres): placed items and cable routes, for cable lengths and suggestions. */
  machineLayout?: LayoutForDesign;
  /** Analog channel setup (DF points): drawn on the analog sheet, wired on TBA with shielded cables. */
  analog?: AnalogSetupRow[];
  /** Drawing choices (src/standards/drawingOptions.ts); absent = ANSI symbols on ANSI B with NFPA tags. */
  symbols?: SymbolSet;
  sheet?: SheetFormat;
  designations?: DesignationStyle;
}

/** Document control data shared by drawings and documents (see ProjectInfo). */
export interface DocInfo {
  company: string;
  customer: string;
  site: string;
  projectNumber: string;
  /** Drawing / document number prefix, e.g. "WCC". */
  prefix: string;
  preparedBy: string;
  checkedBy: string;
  approvedBy: string;
  revisions: { rev: string; date: string; description: string; by: string }[];
}

/** Electrical code references for the project region. */
export function codeRefs(ctx: DrawingContext): { region: Region; installation: string; panel: string; short: string } {
  const r = regionSpec(ctx.region);
  return { region: r.value, ...r.codes };
}

export const WIRE_NUMBERING_NOTES: string[] = [
  'Incoming supply L1, L2, L3 (or L1, N for 120VAC); PE = protective earth (ground).',
  'Main bus after the disconnect: 1L1, 1L2, 1L3. Branch feeds: <device>-L1.. (e.g. PS1-L1).',
  'Motor branches: M1-L1..L3 line side of starter/VFD, M1-C1..C3 contactor to overload, M1-T1..T3 to motor.',
  '24VDC: 24+ unswitched, 24+S safety-switched (via safety relay/MCR), 0V common bonded to PE.',
  'Safety circuit wires take the safety-relay terminal name (S11, S12, S21, S22, S33, S34).',
  'PLC I/O wires take the PLC address (X001 input, Y001 output); a letter suffix (Y001A) follows each series device.',
];

// ---------------------------------------------------------------------------
// Component resolution
// ---------------------------------------------------------------------------

export interface ResolvedComponent {
  comp: DesignComponent;
  tag: string;
  partNumber: string;
  part?: CatalogPart;
  category: CatalogCategory;
  mount: MountLocation;
  /** Fuse holders: the fuse cartridge fitted in them (when the design has one). */
  fuse?: CatalogPart;
}

/** A device tag as a whole word in free text — also IEC tags with a leading "-" ("-K5"), where \b does not apply. */
export function tagRe(tag: string, flags = ''): RegExp {
  return new RegExp(`(?<![\\w-])${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w])`, flags);
}

/** Fuse cartridge (goes into a holder; not a protective "device" position on its own). */
export function isFuseCartridge(c: ResolvedComponent): boolean {
  if (c.category !== 'fuse') return false;
  const d = `${c.part?.description ?? ''} ${c.comp.function}`;
  if (/holder|fuse ?block|fuseblock|carrier/i.test(d)) return false;
  return num(c.part?.ratings, 'poles') === undefined && /\bfuses?\b/i.test(d);
}

export function isTransformer(c: ResolvedComponent): boolean {
  return c.part?.ratings.kind === 'transformer' || (c.category === 'other' && /\btransformer\b/i.test(`${c.part?.description ?? ''} ${c.comp.function}`));
}

export function isFusedDisconnect(c: ResolvedComponent | undefined): boolean {
  return !!c && c.category === 'disconnect' && /\bfused\b/i.test(c.part?.description ?? '') && !/non-?fused/i.test(c.part?.description ?? '');
}

/** 18 AWG control conductor rating (NFPA 79 Table 12.5.1), the smallest DC wire the design uses. */
const DC_WIRE_A = 7;
const psOutA = (ps: ResolvedComponent | undefined) => num(ps?.part?.ratings, 'outputAmps', 'amps') ?? ((num(ps?.part?.ratings, 'watts') ?? 0) / 24);
const isClass2 = (ps: ResolvedComponent | undefined) => /yes/i.test(String(ps?.part?.ratings.necClass2 ?? ''));
/** Fuse rating for 24 VDC branches that leave the cabinet, when the supply is not Class 2 and can exceed the wire rating. */
function dcBranchFuse(ps: ResolvedComponent | undefined): string | undefined {
  return ps && !isClass2(ps) && psOutA(ps) > DC_WIRE_A ? '4 A' : undefined;
}

/** Current of an auxiliary load (heater …) from its branch protection, which is sized at >= 1.25 x the load. */
function auxLoadA(b: AuxBranch): number {
  const a = num(b.protection.fuse?.ratings, 'amps') ?? num(b.protection.part?.ratings, 'amps');
  return a ? a / 1.25 : 0;
}

/** Small-conductor / 75 °C copper ampacity for the OCPD limit (NEC 240.4(D), Table 310.16). */
const AWG_OCPD: Record<string, number> = { '14 AWG': 15, '12 AWG': 20, '10 AWG': 30, '8 AWG': 50, '6 AWG': 65, '4 AWG': 85, '3 AWG': 100, '2 AWG': 115, '1 AWG': 130, '1/0 AWG': 150, '2/0 AWG': 175, '3/0 AWG': 200, '4/0 AWG': 230 };
const STD_OCPD = [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250];

/**
 * Supply protection the panel relies on from outside: with a non-fused disconnect and no main breaker nothing in
 * the panel protects the main bus, so the feeder's overcurrent device (by others) must. Its rating must carry the
 * panel load (125 % of the largest motor + the other loads, NEC 430.24 / 409.20) and protect the bus conductors and
 * the disconnect (NEC 240.4, 430.62). null when the panel has its own main protection.
 */
export function upstreamOcpd(ctx: DrawingContext): { minA: number; maxA: number | null; text: string; conflict: boolean } | null {
  const m = buildModel(ctx);
  if (m.mainBreaker || isFusedDisconnect(m.disconnect)) return null;
  const motorFla = m.motors.map((x) => x.fla);
  const largest = motorFla.length ? Math.max(...motorFla) : 0;
  const control = m.psBranches.length * 2 + (m.transformer ? 2 : 0);
  const load = motorFla.reduce((a, b) => a + b, 0) + largest * 0.25 + control + m.auxBranches.reduce((s, b) => s + auxLoadA(b), 0);
  const minA = STD_OCPD.find((a) => a >= load) ?? Math.ceil(load);
  const discA = num(m.disconnect?.part?.ratings, 'amps', 'ratedAmps', 'currentA');
  const wireA = AWG_OCPD[m.mainAwg];
  const limits = [discA, wireA].filter((x): x is number => x !== undefined);
  const maxA = limits.length ? Math.min(...limits) : null;
  const conflict = maxA !== null && minA > maxA;
  const ds = m.disconnect?.tag ?? 'the disconnect';
  const text = `${ds} is not fused and the panel has no main breaker: the supply must be protected upstream (by others) by a branch-circuit overcurrent device of ${minA} A min.${maxA !== null ? ` and ${maxA} A max. (protects the ${m.mainAwg} bus${discA !== undefined ? ` and the ${discA} A disconnect` : ''})` : ''}${conflict ? ' — not possible with these parts: use a fused disconnect / main breaker or larger bus conductors' : ''}.`;
  return { minA, maxA, text, conflict };
}

const TAG_CATEGORY: [RegExp, CatalogCategory][] = [
  [/^ENC/, 'enclosure'], [/^(DS|DISC|SW)\d*/, 'disconnect'], [/^(MMP|MP)\d/, 'motorProtector'],
  [/^(CB|MCB)\d*/, 'breaker'], [/^(FU|F)\d/, 'fuse'], [/^PS\d/, 'powerSupply'], [/^OL\d/, 'overload'],
  [/^(VFD|VF|AFD)\d*/, 'vfd'], [/^SR\d/, 'safetyRelay'], [/^(CR|MCR|R)\d*/, 'relay'], [/^K/, 'contactor'],
  [/^(ES|EST)\d/, 'estop'], [/^PB\d/, 'pushbutton'], [/^(PL|LT)\d/, 'pilotLight'], [/^(SS|SEL)\d/, 'selector'],
  [/^(SL|STK|LS-STACK)\d/, 'stackLight'], [/^PLC/, 'plc'], [/^(HMI|OIT)/, 'hmi'], [/^TB/, 'terminal'],
  [/^(GND|GB)/, 'groundBar'], [/^FAN/, 'fan'], [/^(SOL|YV)\d/, 'solenoidValve'],
  [/^(PRS|PX|PE|LS|S|PS[A-Z]|PRX|FS|TS)\d/, 'sensor'],
];

const DOOR_CATS: CatalogCategory[] = ['pushbutton', 'estop', 'pilotLight', 'selector', 'hmi'];
const FIELD_CATS: CatalogCategory[] = ['sensor', 'solenoidValve', 'stackLight'];

function guessCategory(tag: string): CatalogCategory {
  const t = tag.toUpperCase();
  for (const [re, cat] of TAG_CATEGORY) if (re.test(t)) return cat;
  return 'other';
}

function defaultMount(cat: CatalogCategory): MountLocation {
  if (DOOR_CATS.includes(cat)) return 'door';
  if (FIELD_CATS.includes(cat)) return 'field';
  return 'backplate';
}

/** Natural sort for tags/addresses: "PB2" < "PB10". */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
}

// ---------------------------------------------------------------------------
// Ratings helpers
// ---------------------------------------------------------------------------

function num(r: Record<string, string | number> | undefined, ...keys: string[]): number | undefined {
  if (!r) return undefined;
  for (const k of keys) {
    const v = r[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') { const n = parseFloat(v); if (Number.isFinite(n)) return n; }
  }
  return undefined;
}

function str(r: Record<string, string | number> | undefined, ...keys: string[]): string | undefined {
  if (!r) return undefined;
  for (const k of keys) if (r[k] !== undefined && r[k] !== '') return String(r[k]);
  return undefined;
}

/** Short rating text for drawings, e.g. "10A 3P", "24VDC 5A". */
export function ratingText(rc: ResolvedComponent | undefined): string {
  if (!rc?.part) return '';
  const r = rc.part.ratings;
  const parts: string[] = [];
  const amps = num(r, 'amps', 'outputAmps', 'current', 'ampRating');
  const minA = num(r, 'minAmps'), maxA = num(r, 'maxAmps');
  const range = str(r, 'range', 'setting', 'ampRange') ?? (minA !== undefined && maxA !== undefined ? `${minA}-${maxA}` : undefined);
  const poles = num(r, 'poles');
  const watts = num(r, 'watts');
  const ov = num(r, 'outputVolts');
  const volts = str(r, 'outputVoltage', 'output') ?? (ov !== undefined ? `${ov}VDC` : undefined);
  const hp = num(r, 'hp480', 'hp', 'hp230');
  if (rc.category === 'fuse' && rc.fuse) {
    const fa = num(rc.fuse.ratings, 'amps');
    const cls = str(rc.fuse.ratings, 'fuseClass');
    return [cls ? `CL ${cls}` : '', fa !== undefined ? `${fa}A` : '', poles !== undefined ? `${poles}P` : ''].filter(Boolean).join(' ');
  }
  if (isTransformer(rc)) {
    const va = num(r, 'va');
    return [va !== undefined ? `${va}VA` : '', str(r, 'primaryVolts') && str(r, 'secondaryVolts') ? `${str(r, 'primaryVolts')}:${str(r, 'secondaryVolts')}V` : ''].filter(Boolean).join(' ');
  }
  switch (rc.category) {
    case 'powerSupply':
      if (volts) parts.push(volts);
      if (amps !== undefined) parts.push(`${amps}A`);
      if (watts !== undefined) parts.push(`${watts}W`);
      break;
    case 'vfd':
      if (hp !== undefined) parts.push(`${hp}HP`);
      if (amps !== undefined) parts.push(`${amps}A`);
      break;
    default:
      if (range) parts.push(`${range}${/a$/i.test(range) ? '' : 'A'}`);
      else if (amps !== undefined) parts.push(`${amps}A`);
      if (poles !== undefined) parts.push(`${poles}P`);
  }
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Motor data
// ---------------------------------------------------------------------------

/** NEC Table 430.250 (3-phase) / 430.248 (1-phase 115V) full-load currents. */
const FLA_3PH: [number, number, number, number, number][] = [
  // hp, 460V, 230V, 208V, 575V
  [0.5, 1.1, 2.2, 2.4, 0.9], [0.75, 1.6, 3.2, 3.5, 1.3], [1, 2.1, 4.2, 4.6, 1.7], [1.5, 3.0, 6.0, 6.6, 2.4], [2, 3.4, 6.8, 7.5, 2.7],
  [3, 4.8, 9.6, 10.6, 3.9], [5, 7.6, 15.2, 16.7, 6.1], [7.5, 11, 22, 24.2, 9], [10, 14, 28, 30.8, 11], [15, 21, 42, 46.2, 17],
  [20, 27, 54, 59.4, 22], [25, 34, 68, 74.8, 27], [30, 40, 80, 88, 32], [40, 52, 104, 114, 41], [50, 65, 130, 143, 52],
  [60, 77, 154, 169, 62], [75, 96, 192, 211, 77], [100, 124, 248, 273, 99],
];
const FLA_1PH_115: [number, number][] = [[0.17, 4.4], [0.25, 5.8], [0.33, 7.2], [0.5, 9.8], [0.75, 13.8], [1, 16], [1.5, 20], [2, 24], [3, 34], [5, 56]];

/** Motor full-load amps per NEC tables (next size up when the HP is between rows). */
export function motorFla(hp: number, voltage: SupplyVoltage): number {
  // IEC supplies: IEC 60947-4-1 Annex G motor currents.
  if (SUPPLY_INFO[voltage].hz === 50) return iecMotorCurrent(hp, voltage);
  if (voltage === '120VAC-1PH') {
    const row = FLA_1PH_115.find(([h]) => h >= hp) ?? FLA_1PH_115[FLA_1PH_115.length - 1];
    return row[1];
  }
  const row = FLA_3PH.find(([h]) => h >= hp) ?? FLA_3PH[FLA_3PH.length - 1];
  switch (voltage) {
    case '600VAC-3PH': return row[4];
    case '480VAC-3PH': return row[1];
    case '240VAC-3PH': return row[2];
    default: return row[3];
  }
}

/** Suggested copper conductor (75°C, in enclosure) for a continuous current, min 14 AWG for power. */
export function awgFor(amps: number): string {
  const table: [number, string][] = [[15, '14 AWG'], [20, '12 AWG'], [30, '10 AWG'], [40, '8 AWG'], [55, '6 AWG'], [70, '4 AWG'], [95, '2 AWG'], [130, '1/0 AWG'], [175, '2/0 AWG'], [230, '4/0 AWG']];
  return (table.find(([a]) => a >= amps) ?? table[table.length - 1])[1];
}

function supplyPhases(s: SupplyVoltage): 1 | 3 { return SUPPLY_INFO[s].phases; }

export function supplyText(s: SupplyVoltage): string {
  return SUPPLY_INFO[s].text;
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export interface WireRecord {
  wire: string;
  from: string;
  to: string;
  /** NFPA 79 color, e.g. "BK", "BU", "WH/BU", "GN/YE". */
  color: string;
  size: string;
  function: string;
}

export interface PsBranch { protection?: ResolvedComponent; ps: ResolvedComponent; feedWires: string[]; protectedPoles: number; fromXfmr?: boolean }
/** Control power transformer branch: bus -> primary protection -> T1 (H1/H2) -> X1/X2 secondary. */
export interface XfmrBranch { protection?: ResolvedComponent; xfmr: ResolvedComponent; primaryWires: string[]; /** Same as primaryWires (uniform with other branches). */ feedWires: string[]; protectedPoles: number }
export interface AuxBranch {
  protection: ResolvedComponent; feedWires: string[]; protectedPoles: number;
  /** Load fed through switching devices ("Seal heater via K1 and SSR1"): contactor first, then the SSR (first pole). */
  path?: ResolvedComponent[];
  /** Name of the load ("Seal heater"). */
  load?: string;
}

export interface MotorModel {
  motor: MotorSpec;
  fla: number;
  awg: string;
  protection?: ResolvedComponent;
  /** [forward, reverse] for reversing starters. */
  contactors: ResolvedComponent[];
  overload?: ResolvedComponent;
  vfd?: ResolvedComponent;
  lineWires: string[];
  midWires: string[];
  loadWires: string[];
  /** Reversing: wires between the reverse contactor and the overload, already swapped L1/L3. */
  terminals: string[];
  peTerminal?: string;
}

export interface IoPoint {
  address: string;
  type: 'input' | 'output';
  description: string;
  wiring?: IOWiring;
  deviceTag: string;
  deviceType: FieldDeviceType;
  location: 'door' | 'field' | 'internal';
  /** Group key (module/slot). */
  group: string;
  /** Wires along the signal path, first is the address. */
  wire: string;
  signalTerminal?: string;
  supplyTerminal?: string;
  returnTerminal?: string;
  /** Inputs: the wire a dry contact (button, switch, relay contact) switches into the input — '24+', or '0V' in a
   *  group whose common goes to +24V for NPN sensors (sourcing inputs: the contact must pull the input to 0V). */
  supplyWire?: '24+' | '0V';
  /** Inputs: the device terminal the supply wire lands on (the contact's feed side: C, 23, R1…), as wired. */
  feedTo?: string;
  /** Inputs: the contact's terminals [feed, signal] — C / NO, C / NC for an N.C. button, and an E-stop's own N.C.
   *  block (31-32 beside a safety relay's two channels, else 21-22): the PLC reads those N.C. (ON = released). */
  inPins?: [string, string];
  /** Load terminals the output switches ([feed, return]): A1/A2, B1/B2 for a second coil of the same device
   *  (double solenoid), X1/X2 for a pilot light. */
  pins: [string, string];
  /** Machine zone ("Cabinet door" for door devices, "Cabinet" for panel devices). */
  zone: string;
  /** Junction box the field device is wired through, or null for a home-run cable. */
  jb: string | null;
  /** For PLC-driven coils on the control sheet: chain of series devices and wires. */
  coilChain?: {
    devices: { tag: string; terminals: string; nc: boolean; kind: 'ol' | 'interlock' }[];
    /** Wire numbers along the chain up to the coil's A1 (sourcing: the output's address first; sinking: the output supply first). */
    wires: string[];
    /** Sinking output: the chain runs from the output supply (24+S) to A1 and the coil's A2 returns to the PLC output. */
    sink: boolean;
    /** A contact in the coil's return (A2 → contact → 0V): the overload shared by both coils of a reversing starter on
     *  sourcing outputs, whose feeds are two different PLC outputs (one contact cannot be in both feeds). */
    returnVia?: { tag: string; terminals: string; wire: string };
  };
}

export interface IoGroup {
  key: string;
  type: 'input' | 'output';
  label: string;
  /** Device tag of the CPU/module carrying this group, used in wire lists. */
  devTag: string;
  partNumber?: string;
  /** Output style: sourcing (load to 0V), sinking (load from +24) or relay. */
  outputStyle: 'sourcing' | 'sinking' | 'relay';
  /** Input common goes to 0V (PNP/sourcing devices) or +24 (NPN/sinking devices). */
  commonTo: '0V' | '24+';
  points: IoPoint[];
}

/**
 * Terminal of a dry-contact field device for a contact role: the part's own numbering (catalog
 * ratings.pins, e.g. "C=1 NC=2 NO=3 PE=4" on a DIN-connector pressure switch, "C=33 NO=34" on an
 * interlock's monitoring contact), else the role name.
 */
export function contactPin(part: CatalogPart | undefined, role: 'C' | 'NO' | 'NC' | 'PE'): string {
  return new RegExp(`\\b${role}=(\\S+)`).exec(String(part?.ratings.pins ?? ''))?.[1] ?? role;
}

export interface SafetyModel {
  relay?: ResolvedComponent;
  estops: string[];
  /** Guard-door interlock switches: their N.C. 11-12 / 21-22 in series with the E-stops in both channels. */
  guards: string[];
  reset?: string;
  mcr?: ResolvedComponent;
  edm: string[];
  /** N.C. feedback contact terminals of each EDM device (same order as edm), e.g. "61-62" on an add-on block. */
  edmTerms: string[];
  statusInput?: IoPoint;
  /** Wire supplying PLC outputs: 24+S when switched by safety, else 24+. */
  outputSupply: string;
  /** Two-hand and light-curtain safety relays: their own input circuits; a light curtain's output is in series in 24+S. */
  extraRelays?: { relay: ResolvedComponent; kind: 'two-hand' | 'light-curtain'; inputs: string[] }[];
}

export interface Terminal {
  strip: string;
  number: number;
  /** "TB2-4" */
  label: string;
  wire: string;
  internal: string;
  external: string;
  kind: 'feed' | 'ground' | 'spare';
  group: string;
  /** Fused terminal: fuse rating, e.g. "2 A" (branch protection of the circuit it feeds). */
  fuse?: string;
}

export interface TerminalStrip {
  tag: string;
  title: string;
  terminals: Terminal[];
  endPlates: number;
  endStops: number;
}

export interface ElectricalModel {
  /** Analog loops (empty when the project has no analog I/O). */
  analog: AnalogWiring;
  /** VFD control wiring and parameters, one per drive (electrical/vfd.ts). */
  drives: DriveControl[];
  /** Servo axes (src/electrical/servoWiring.ts): drive, motor, protection, control terminals. */
  servos: ServoAxisModel[];
  rc: ResolvedComponent[];
  supply: SupplyVoltage;
  phases: 1 | 3;
  incoming: string[];
  bus: string[];
  disconnect?: ResolvedComponent;
  mainBreaker?: ResolvedComponent;
  psBranches: PsBranch[];
  auxBranches: AuxBranch[];
  transformer?: ResolvedComponent;
  xfmrBranch?: XfmrBranch;
  groundBar?: ResolvedComponent;
  motors: MotorModel[];
  safety: SafetyModel;
  io: IoPoint[];
  groups: IoGroup[];
  strips: TerminalStrip[];
  wires: WireRecord[];
  plcPart?: CatalogPart;
  plcTag: string;
  mainAwg: string;
  machine: MachineModel;
  /** N.C. auxiliary contact used for EDM feedback / reversing interlock, per contactor tag. */
  auxNc: Map<string, AuxNc>;
  /** The door HMI: its 24 VDC feed and its link to the PLC. */
  hmi?: HmiLink;
  /** Enclosure filter fan switched by its thermostat (24 VDC from TB1, or AC — not drawn). */
  fan?: FanCircuit;
  /** The relay ladder kept from a converted machine (DesignInputs.relayLogic), numbered around the panel's own wiring. */
  ladder?: Ladder;
}

export interface FanCircuit {
  tag: string;
  partNumber: string;
  /** Thermostat in series (N.O., closes on rise), when the design has one. */
  thermostat?: string;
  /** 24 VDC fan fed from TB1 (an AC fan is wired from the control voltage per the maker, not drawn). */
  dc: boolean;
}

/** The door HMI's power (own fused terminal on TB1) and communication link to the PLC. */
export interface HmiLink {
  tag: string;
  partNumber: string;
  /** Fused TB1 terminal feeding it, e.g. "TB1-12". */
  fuseTerminal: string;
  fuse: string;
  link: 'ethernet' | 'serial';
}

/** Where a contactor's N.C. auxiliary contact comes from. */
export interface AuxNc {
  /** Terminal pair, e.g. ['61', '62']. */
  terms: [string, string];
  /** Add-on block fitted in the design (or added because the frame has none). */
  block?: string;
  /** True when the design has no add-on block although the frame has no internal auxiliary contact (added to the BOM). */
  missing: boolean;
  family?: string;
}

/** Fuji SC-E02(G)..E4(G) frames have no internal auxiliary contact (AutomationDirect Fuji SC-E spec, note 1). */
const NO_INTERNAL_AUX = /^SC-E(0[2-5]|1|2S?|3|4)G?$/i;

const cache = new WeakMap<DrawingContext, ElectricalModel>();

/** Builds (and caches per context object) the full derived model. */
/** Wire number from a device designation: IEC "-M1" numbers its wires M1-L1 (no prefix sign in wire numbers). */
const wt = (tag: string) => tag.replace(/^-/, '');

export function buildModel(ctx: DrawingContext): ElectricalModel {
  const hit = cache.get(ctx);
  if (hit) return hit;
  // IEC 81346 designations: terminal strips TB1, TB2… are -X1, -X2… on every sheet and list.
  const m = ctx.designations === 'iec81346' ? withIecStrips(computeModel(ctx)) : computeModel(ctx);
  cache.set(ctx, m);
  return m;
}

export function resolveComponents(ctx: DrawingContext): ResolvedComponent[] {
  const list = ctx.design.components.map((comp) => {
    const part = comp.partNumber ? ctx.getPart(comp.partNumber) : undefined;
    const category = part?.category ?? comp.category ?? guessCategory(comp.tag);
    return { comp, tag: comp.tag, partNumber: comp.partNumber, part, category, mount: part?.mount ?? defaultMount(category) } as ResolvedComponent;
  });
  // link fuse cartridges to their holders (same motor, tag/function reference, or a single obvious pair)
  const carts = list.filter(isFuseCartridge);
  const holders = list.filter((c) => c.category === 'fuse' && !isFuseCartridge(c));
  for (const h of holders) {
    const ref = new RegExp(`\\b${h.tag.replace(/[^A-Za-z0-9]/g, '')}\\b`, 'i');
    const c = carts.find((x) => h.comp.motorTag && x.comp.motorTag === h.comp.motorTag)
      ?? carts.find((x) => ref.test(x.comp.function) || x.tag.startsWith(h.tag))
      ?? (carts.length === 1 && holders.length === 1 ? carts[0] : undefined);
    if (c?.part) h.fuse = c.part;
  }
  return list;
}

function byCat(rc: ResolvedComponent[], ...cats: CatalogCategory[]) {
  return rc.filter((c) => cats.includes(c.category)).sort((a, b) => naturalCompare(a.tag, b.tag));
}

function poles(rc: ResolvedComponent | undefined, fallback: number): number {
  return num(rc?.part?.ratings, 'poles') ?? fallback;
}

/** Device location for an I/O point. */
function ioLocation(rc: ResolvedComponent | undefined, t: FieldDeviceType): IoPoint['location'] {
  if (t === 'contactor-coil' || t === 'relay-coil' || t === 'vfd-input' || t === 'servo-drive' || t === 'safety-relay-output') return 'internal';
  if (rc) return rc.mount === 'backplate' ? 'internal' : rc.mount;
  if (t === 'pushbutton-no' || t === 'pushbutton-nc' || t === 'selector' || t === 'estop-contact' || t === 'pilot-light') return 'door';
  return 'field';
}

function guessIoType(address: string): 'input' | 'output' {
  return /^(X|I|IN|DI|%I)/i.test(address) ? 'input' : 'output';
}

/** "X101" -> slot "1" for CLICK style addresses; generic fallback groups by 16 in order. */
function groupKey(address: string, type: 'input' | 'output', index: number): string {
  const m = /^([XY])(\d)(\d\d)$/.exec(address);
  if (m) return `${type}:${m[2]}`;
  return `${type}:g${Math.floor(index / 16)}`;
}

/**
 * The PLC's own terminal name for a point, where the maker numbers terminals per CPU / module from 0
 * (Unitronics: I0… / O0… on the CPU, each Uni-I/O module and snap-in, per their guides); null = the address is the label.
 */
export function vendorTerminal(part: CatalogPart | undefined, address: string): string | null {
  if (part?.vendor !== 'unitronics') return null;
  const m = /^([XY])\d(\d\d)$/i.exec(address);
  return m ? `${m[1].toUpperCase() === 'X' ? 'I' : 'O'}${Number(m[2]) - 1}` : null;
}

function outputStyleOf(pn: string | undefined, part: CatalogPart | undefined): IoGroup['outputStyle'] {
  // An explicit style from the catalog wins (Unitronics "-TR22" is mostly relay with two npn points).
  const explicit = part?.ratings.outputStyle;
  if (explicit === 'sourcing' || explicit === 'sinking' || explicit === 'relay') return explicit;
  const r = str(part?.ratings, 'outputType', 'outputs', 'output');
  // The catalog's output type wins over the description ("8 DC sinking/sourcing inputs … relay outputs").
  if (/^\s*relay\b/i.test(r ?? '')) return 'relay';
  if (/^\s*sinking\b/i.test(r ?? '')) return 'sinking';
  if (/^\s*sourcing\b/i.test(r ?? '')) return 'sourcing';
  const s = `${r ?? ''} ${part?.description ?? ''} ${pn ?? ''}`.toLowerCase();
  if (/sinking|nPN|dd1|td1/i.test(s)) return 'sinking';
  if (/relay|dre|dr-|tr\b|-tr/i.test(s) && !/sourcing/.test(s)) return 'relay';
  return 'sourcing';
}

/** A safety relay's N.O. safety outputs, in the usual numbering. */
const SAFETY_OUTPUTS = [['13', '14'], ['23', '24'], ['33', '34'], ['43', '44']];

/** Number of N.O. safety outputs from the catalog rating: 3, "(3) N.O.", "3 N.O. relay", "3 NO (relay)" … (2 if unknown). */
export function safetyOutputCount(v: string | number | undefined): number {
  if (typeof v === 'number') return v;
  const m = /(\d+)\s*\)?\s*(?:x\s*)?N\.?\s*O\b/i.exec(String(v ?? ''));
  return m ? Number(m[1]) : 2;
}

function letter(i: number): string { return i === 0 ? '' : String.fromCharCode(64 + i); }

function computeModel(ctx: DrawingContext): ElectricalModel {
  // IEC regions: mm² sizes (IEC 60204-1 Table 6) and IEC colours, applied at the end (toIec).
  const iec = isIec(ctx.region);
  const rc = resolveComponents(ctx);
  const supply = ctx.design.inputs.supply;
  const phases = supplyPhases(supply);
  const incoming = phases === 3 ? ['L1', 'L2', 'L3'] : ['L1', 'N'];
  const bus = phases === 3 ? ['1L1', '1L2', '1L3'] : ['1L1', 'N'];
  const wires: WireRecord[] = [];
  const addWire = (w: WireRecord) => wires.push(w);

  const disconnect = byCat(rc, 'disconnect').filter((c) => c.mount === 'backplate' && !isLayoutAccessory(c))[0];
  const looseProt = byCat(rc, 'breaker', 'fuse').filter((c) => !c.comp.motorTag && !isFuseCartridge(c));
  const mainBreaker = looseProt.find((c) => /main/i.test(c.comp.function) && c.category === 'breaker');
  const rest = looseProt.filter((c) => c !== mainBreaker);
  const pss = byCat(rc, 'powerSupply');
  const transformer = rc.find(isTransformer);
  const xfmrRe = transformer ? new RegExp(`transformer|xfmr|\\bcpt\\b|primary|\\b${transformer.tag}\\b`, 'i') : null;
  const xfmrProt = xfmrRe ? rest.find((c) => xfmrRe.test(c.comp.function) && !/secondary/i.test(c.comp.function)) : undefined;
  const psProt = rest.filter((c) => c !== xfmrProt && /power supply|24 ?v|\bps\d|dc supply|psu|secondary/i.test(`${c.comp.function} ${c.comp.tag}`));
  const used = new Set<ResolvedComponent>();
  if (xfmrProt) used.add(xfmrProt);
  const xfmrBranch: XfmrBranch | undefined = transformer ? {
    protection: xfmrProt, xfmr: transformer,
    primaryWires: phases === 1 ? [`${wt(transformer.tag)}-L1`, 'N'] : [`${wt(transformer.tag)}-L1`, `${wt(transformer.tag)}-L2`],
    feedWires: phases === 1 ? [`${wt(transformer.tag)}-L1`, 'N'] : [`${wt(transformer.tag)}-L1`, `${wt(transformer.tag)}-L2`],
    protectedPoles: phases === 1 ? 1 : Math.min(2, poles(xfmrProt, 2)),
  } : undefined;
  const psBranches: PsBranch[] = pss.map((ps) => {
    const byName = psProt.find((p) => !used.has(p) && tagRe(ps.tag, 'i').test(p.comp.function));
    const protection = byName ?? psProt.filter((p) => !used.has(p))[0];
    if (protection) used.add(protection);
    const inPh = num(ps.part?.ratings, 'phases', 'inputPhases');
    // With a control transformer the supply is fed from its 120V secondary (X1 hot / X2 grounded).
    if (transformer) return { protection, ps, feedWires: [protection ? `${wt(ps.tag)}-L1` : 'X1', 'X2'], protectedPoles: 1, fromXfmr: true };
    const n = phases === 1 ? 2 : inPh === 3 ? 3 : 2;
    const feedWires = phases === 1 ? [`${wt(ps.tag)}-L1`, 'N'] : Array.from({ length: n }, (_, k) => `${wt(ps.tag)}-L${k + 1}`);
    return { protection, ps, feedWires, protectedPoles: phases === 1 ? 1 : n };
  });
  const auxBranches: AuxBranch[] = rest.filter((c) => !used.has(c)).map((protection) => {
    const p = Math.min(poles(protection, phases === 1 ? 1 : 2), phases === 1 ? 1 : 3);
    const feedWires = phases === 1 ? [`${wt(protection.tag)}-L1`, 'N'] : Array.from({ length: p }, (_, k) => `${wt(protection.tag)}-L${k + 1}`);
    // "Seal heater via K1 and SSR1 — branch fuses …": the devices the load is switched through
    const via = /^(.*?)\s+via\s+(\S+)(?:\s+and\s+(\S+))?\s+—/.exec(protection.comp.function);
    const path = via ? [via[2], via[3]].map((t) => rc.find((c) => c.tag === t)).filter((c): c is ResolvedComponent => !!c) : [];
    return { protection, feedWires, protectedPoles: p, ...(path.length ? { path, load: via![1] } : {}) };
  });
  const groundBar = byCat(rc, 'groundBar')[0];

  // ---- motors
  const motors: MotorModel[] = ctx.design.inputs.motors.map((motor) => {
    const own = rc.filter((c) => c.comp.motorTag === motor.tag);
    const fla = motorFla(motor.hp, motor.voltage);
    const prot = own.find((c) => c.category === 'motorProtector') ?? own.find((c) => (c.category === 'breaker' || c.category === 'fuse') && !isFuseCartridge(c));
    let contactors = own.filter((c) => c.category === 'contactor').sort((a, b) => naturalCompare(a.tag, b.tag));
    if (motor.reversing && contactors.length >= 2) {
      const fwd = contactors.find((c) => /fwd|forward/i.test(c.comp.function)) ?? contactors[0];
      const rev = contactors.find((c) => c !== fwd && /rev|reverse/i.test(c.comp.function)) ?? contactors.find((c) => c !== fwd)!;
      contactors = [fwd, rev];
    }
    const overload = own.find((c) => c.category === 'overload');
    const vfd = own.find((c) => c.category === 'vfd');
    const ph = SUPPLY_INFO[motor.voltage].phases === 1 ? 2 : 3;
    const idx = Array.from({ length: ph }, (_, k) => k + 1);
    return {
      motor, fla, awg: iec ? mm2Text(mm2For(fla * 1.25)) : awgFor(fla * 1.25), protection: prot, contactors, overload, vfd,
      // 120VAC single-phase motors keep the grounded conductor numbered "N" end to end.
      lineWires: idx.map((k) => (ph === 2 && k === 2 ? 'N' : `${wt(motor.tag)}-L${k}`)),
      midWires: idx.map((k) => (ph === 2 && k === 2 ? 'N' : `${wt(motor.tag)}-C${k}`)),
      loadWires: idx.map((k) => (ph === 2 && k === 2 ? 'N' : `${wt(motor.tag)}-T${k}`)),
      terminals: [],
    };
  });

  // ---- safety
  // The E-stop relay; two-hand and light-curtain relays are drawn as their own safety functions.
  const appOf = (c: ResolvedComponent) => `${str(c.part?.ratings, 'application') ?? ''} ${c.comp.function}`;
  const isTwoHand = (c: ResolvedComponent) => /two-hand/i.test(appOf(c));
  const isCurtain = (c: ResolvedComponent) => /light[- ]curtain/i.test(appOf(c)) && !/e-?stop/i.test(appOf(c).split('—')[0]);
  const srs = byCat(rc, 'safetyRelay');
  const relay = srs.find((c) => !isTwoHand(c) && !isCurtain(c)) ?? srs[0];
  const estopTags = byCat(rc, 'estop').map((c) => c.tag);
  const guardTags = byCat(rc, 'sensor').filter((c) => /safety interlock switch/i.test(String(c.part?.ratings.type ?? ''))).map((c) => c.tag);
  const pinOf = (tag: string, role: 'C' | 'NO' | 'NC' | 'PE') => contactPin(rc.find((c) => c.tag === tag)?.part, role);
  const ioW = ctx.design.ioWiring;
  for (const w of ioW) if (w.deviceType === 'estop-contact' && !estopTags.includes(w.deviceTag)) estopTags.push(w.deviceTag);
  // Safety-relay reset button: an explicit "safety reset" first; a plain "Reset" only when it is not
  // also a PLC input (a fault-reset button wired to the PLC is not the relay's reset).
  const pbs = byCat(rc, 'pushbutton');
  const plcInputs = new Set(ctx.design.ioWiring.map((w) => w.deviceTag));
  const resetRc = pbs.find((c) => /safety.*reset|reset.*safety|relay reset/i.test(c.comp.function))
    ?? pbs.find((c) => /reset/i.test(c.comp.function) && !plcInputs.has(c.tag))
    ?? pbs.find((c) => /reset/i.test(c.comp.function));
  const reset = resetRc?.tag ?? ioW.find((w) => /reset/i.test(w.description) && w.deviceType === 'pushbutton-no')?.deviceTag;
  const mcr = byCat(rc, 'relay').find((c) => /master|mcr|safety/i.test(`${c.comp.function} ${c.tag}`));
  // Servo STO: channel A from the relay's 13-14, channel B from the next N.O. safety output that is free
  // (23-24 carries the PLC status input when there is one). With both wired, the drive's FDBK output is in
  // the S33-S34 feedback loop too (SureServo2 manual 3.11.3); with no free output STO stays unwired (warning).
  const relayOuts = relay ? safetyOutputCount(relay.part?.ratings.safetyOutputs) : 0;
  const stoFree = relay ? SAFETY_OUTPUTS.slice(0, relayOuts)[ioW.some((w) => w.deviceType === 'safety-relay-output') ? 2 : 1] : undefined;
  const stoDrives = stoFree ? rc.filter((c) => isServoDrive(c.part) && servoPins(c.part)) : [];
  const edm = [...(mcr ? [mcr.tag] : motors.flatMap((m) => m.contactors.map((c) => c.tag))), ...(relay ? stoDrives.map((c) => c.tag) : [])];
  const hasSafety = !!relay || estopTags.length > 0;
  // N.C. auxiliary contacts for EDM feedback and reversing interlocks. Front block SZ-A11T: N.O. 53-54,
  // N.C. 61-62; side block SZ-AS1T: N.C. 71-72, N.O. 83-84 (Fuji SC-E spec); otherwise built-in 21-22.
  const auxNc = new Map<string, AuxNc>();
  const needNc = [...new Set([...edm, ...motors.filter((mm) => mm.motor.reversing && mm.contactors.length === 2).flatMap((mm) => mm.contactors.map((c) => c.tag))])];
  const blocks = rc.filter((c) => /auxiliary contact block/i.test(c.part?.description ?? '') || /^SZ-A(11|S1|22|S2)T$/i.test(c.partNumber));
  const unassigned = blocks.flatMap((b) => Array.from({ length: Math.max(1, b.comp.quantity) }, () => b))
    .filter((b) => !b.comp.motorTag && !needNc.some((t) => tagRe(t).test(b.comp.function)));
  for (const tag of needNc) {
    const k = rc.find((c) => c.tag === tag);
    const family = str(k?.part?.ratings, 'family');
    const blk = blocks.find((b) => tagRe(tag).test(b.comp.function))
      ?? blocks.find((b) => b.comp.motorTag && b.comp.motorTag === k?.comp.motorTag && !auxNcUsed(b))
      ?? (family && NO_INTERNAL_AUX.test(family) ? unassigned.shift() : undefined);
    const side = (b: ResolvedComponent) => /side/i.test(b.part?.description ?? '') || /^SZ-AS/i.test(b.partNumber);
    if (blk) auxNc.set(tag, { terms: side(blk) ? ['71', '72'] : ['61', '62'], block: blk.partNumber, missing: false, family });
    else if (family && NO_INTERNAL_AUX.test(family)) auxNc.set(tag, { terms: ['61', '62'], block: 'SZ-A11T', missing: true, family });
    else auxNc.set(tag, { terms: ['21', '22'], missing: false, family });
  }
  for (const d of stoDrives) { const P = servoPins(d.part)!; auxNc.set(d.tag, { terms: [P.sto.fbPlus, P.sto.fbMinus], missing: false }); }
  function auxNcUsed(b: ResolvedComponent) { return [...auxNc.values()].filter((a) => a.block === b.partNumber && !a.missing).length >= Math.max(1, b.comp.quantity); }
  const ncOf = (tag: string): [string, string] => auxNc.get(tag)?.terms ?? ['21', '22'];
  // a reversing interlock needs its own N.C. contact when the first one is in the safety relay's feedback (EDM)
  // loop: one contact cannot be in two circuits. The second N.C. is 71-72 (a 2 N.O. + 2 N.C. block).
  const secondNc = new Set(motors.filter((mm) => mm.motor.reversing && mm.contactors.length === 2).flatMap((mm) => mm.contactors.map((c) => c.tag)).filter((t) => edm.includes(t)));
  const ilkOf = (tag: string): [string, string] => (secondNc.has(tag) ? ['71', '72'] : ncOf(tag));
  const extraRelays: SafetyModel['extraRelays'] = srs.filter((c) => c !== relay && (isTwoHand(c) || isCurtain(c))).map((c) => {
    const kind = isTwoHand(c) ? 'two-hand' as const : 'light-curtain' as const;
    // The devices feeding it: the two-hand station / the light curtains (by the relay's tag in their function).
    const inputs = rc.filter((d) => d !== c && tagRe(c.tag).test(d.comp.function) && (kind === 'two-hand' ? d.category === 'pushbutton' : d.category === 'sensor')).map((d) => d.tag);
    return { relay: c, kind, inputs };
  });
  const safety: SafetyModel = { relay, estops: estopTags, guards: guardTags, reset, mcr, edm, edmTerms: edm.map((t) => ncOf(t).join('-')), outputSupply: hasSafety ? '24+S' : '24+', extraRelays };

  // ---- PLC & IO points
  const plcRc = byCat(rc, 'plc')[0];
  const plcPart = ctx.getPart(ctx.plc.cpuPartNumber) ?? plcRc?.part;
  const plcTag = plcRc?.tag ?? 'PLC1';
  const rcByTag = new Map(rc.map((c) => [c.tag, c] as const));
  const wiringByAddr = new Map(ioW.map((w) => [w.address.toUpperCase(), w] as const));
  // Analog points (DF registers) are wired by electrical/analog.ts, not as discrete I/O.
  let rawIo = ctx.io.filter((p) => p.address && !/^DF\d+$/i.test(p.address));
  if (rawIo.length === 0) rawIo = ioW.map((w) => ({ address: w.address, description: w.description, type: guessIoType(w.address) }));
  const sorted = [...rawIo].sort((a, b) => (a.type === b.type ? naturalCompare(a.address, b.address) : a.type === 'input' ? -1 : 1));
  const counters = { input: 0, output: 0 };
  const io: IoPoint[] = sorted.map((p) => {
    const wiring = wiringByAddr.get(p.address.toUpperCase());
    const deviceType: FieldDeviceType = wiring?.deviceType ?? 'other';
    const deviceTag = wiring?.deviceTag ?? '';
    const loc = ioLocation(rcByTag.get(deviceTag), deviceType);
    const i = counters[p.type]++;
    // An explicit location overrides the default: "Cabinet door" -> door, a machine zone -> field.
    let location = loc;
    const where = wiring?.location?.trim();
    if (where && loc !== 'internal') location = DOOR_RE.test(where) ? 'door' : 'field';
    return { address: p.address, type: p.type, description: p.description || wiring?.description || '', wiring, deviceTag, deviceType, location, zone: '', jb: null, group: groupKey(p.address, p.type, i), wire: p.address, pins: ['A1', 'A2'] as [string, string] };
  });
  // load terminals per output: each coil of a multi-coil device (double solenoid) on its own pair
  for (const p of io) {
    if (p.type !== 'output') continue;
    if (p.deviceType === 'pilot-light') { p.pins = ['X1', 'X2']; continue; }
    // a stack light's tiers share one body: each output on its own tier terminal (RED, GREEN…), all back on COM
    if (p.deviceType === 'stack-light') { p.pins = [(p.description.match(/red|amber|yellow|green|blue|white|horn|buzzer/i)?.[0] ?? p.address).toUpperCase(), 'COM']; continue; }
    const k = io.filter((q) => q.type === 'output' && q.deviceTag && q.deviceTag === p.deviceTag && q.deviceType !== 'stack-light').indexOf(p);
    if (k > 0) p.pins = [`${String.fromCharCode(65 + k)}1`, `${String.fromCharCode(65 + k)}2`];
  }
  const mw = effectiveMachine(ctx, io, motors);

  // groups
  const modules = byCat(rc, 'plcModule');
  const groups: IoGroup[] = [];
  for (const p of io) {
    let g = groups.find((x) => x.key === p.group);
    if (!g) {
      const slot = /:(\d+)$/.exec(p.group)?.[1];
      let partNumber: string | undefined;
      let part: CatalogPart | undefined;
      let label: string;
      let devTag = plcTag;
      if (slot === '0') { partNumber = ctx.plc.cpuPartNumber; part = plcPart; label = `CPU ${ctx.plc.cpuPartNumber}`; }
      else if (slot) {
        const mod = modules.find((mm) => String(num(mm.part?.ratings, 'slot') ?? '') === slot)
          ?? modules.filter((mm) => num(mm.part?.ratings, 'slot') === undefined)[Number(slot) - 1];
        partNumber = mod?.partNumber; part = mod?.part; devTag = mod?.tag ?? `${plcTag}-S${slot}`;
        label = `SLOT ${slot}${partNumber ? ` ${partNumber}` : ''}`;
      } else label = `${p.type === 'input' ? 'INPUTS' : 'OUTPUTS'} ${groups.filter((x) => x.type === p.type).length + 1}`;
      g = { key: p.group, type: p.type, label, devTag, partNumber, outputStyle: outputStyleOf(partNumber, part), commonTo: '0V', points: [] };
      groups.push(g);
    }
    g.points.push(p);
  }
  for (const g of groups) if (g.type === 'input' && g.points.some((p) => p.deviceType === 'sensor-npn')) g.commonTo = '24+';
  // a group with its common on +24V (NPN sensors) only sees an input pulled to 0V: its dry contacts switch 0V
  for (const g of groups) for (const p of g.points) if (g.type === 'input') p.supplyWire = g.commonTo === '24+' && !isSensor3(p.deviceType) ? '0V' : '24+';
  for (const p of io) if (p.type === 'input' && p.deviceTag) {
    p.inPins = p.deviceType === 'estop-contact' ? (relay ? ['31', '32'] : ['21', '22'])
      : [pinOf(p.deviceTag, 'C'), pinOf(p.deviceTag, p.deviceType === 'pushbutton-nc' ? 'NC' : 'NO')];
  }

  // safety status input
  safety.statusInput = io.find((p) => p.deviceType === 'safety-relay-output');

  // coil chains for PLC-driven contactors/relays
  for (const p of io) {
    const sc = p.wiring?.safetyContact;
    if (p.type !== 'output' || (p.deviceType !== 'contactor-coil' && p.deviceType !== 'relay-coil' && !sc)) continue;
    const devices: NonNullable<IoPoint['coilChain']>['devices'] = [];
    // A safety relay's N.O. output in series (two-hand relay on the closing stroke, over-temperature limit on a heater contactor).
    if (sc) devices.push({ tag: sc, terminals: '13-14', nc: false, kind: 'interlock' });
    const mm = motors.find((m) => m.contactors.some((c) => c.tag === p.deviceTag));
    const sink = groups.find((x) => x.key === p.group)?.outputStyle === 'sinking';
    // a reversing starter's two coils share one overload contact: on sinking outputs both feeds start at the output
    // supply, so the contact leads both chains into one shared net; on sourcing outputs the feeds are two PLC outputs,
    // so the contact goes in the coils' common return
    const shared = !!mm?.overload && !!mm.motor.reversing && mm.contactors.length === 2;
    if (mm?.overload && !(shared && !sink)) devices.push({ tag: mm.overload.tag, terminals: '95-96', nc: true, kind: 'ol' });
    if (mm && mm.motor.reversing && mm.contactors.length === 2) {
      const other = mm.contactors.find((c) => c.tag !== p.deviceTag);
      if (other) devices.push({ tag: other.tag, terminals: ilkOf(other.tag).join('-'), nc: true, kind: 'interlock' });
    }
    // Sourcing: output → chain → A1, A2 → 0V. Sinking: the output switches to 0V, so the coil hangs off the
    // output supply: 24+S → chain → A1, A2 → output (both coil ends at 0V would never pull in).
    const olNet = shared ? `${mm!.motor.tag}OL` : '';
    const wires = devices.map((d, k) => (k === 0 && shared && sink && d.kind === 'ol' ? olNet : `${p.address}${letter(k + 1)}`));
    p.coilChain = sink
      ? { devices, wires: [safety.outputSupply, ...wires], sink }
      : { devices, wires: [p.address, ...wires], sink, ...(shared ? { returnVia: { tag: mm!.overload!.tag, terminals: '95-96', wire: olNet } } : {}) };
  }

  // ---- terminal strips
  const strips: TerminalStrip[] = [];
  const mkStrip = (tag: string, title: string): TerminalStrip => { const s = { tag, title, terminals: [] as Terminal[], endPlates: 1, endStops: 2 }; strips.push(s); return s; };
  const add = (s: TerminalStrip, t: Omit<Terminal, 'strip' | 'number' | 'label'>) => {
    const number = s.terminals.length + 1;
    const term: Terminal = { strip: s.tag, number, label: `${s.tag}-${number}`, ...t };
    s.terminals.push(term);
    return term.label;
  };
  const addSpares = (s: TerminalStrip, min: number) => {
    const n = Math.max(min, Math.ceil(s.terminals.length * 0.15));
    for (let k = 0; k < n; k++) add(s, { wire: '', internal: 'SPARE', external: 'SPARE', kind: 'spare', group: 'SPARE' });
  };

  const tb1 = mkStrip('TB1', 'POWER & 24VDC DISTRIBUTION');
  const psMain = psBranches[0]?.ps.tag ?? 'PS1';
  for (const m of motors) {
    const src = m.vfd ? m.vfd.tag : m.overload ? m.overload.tag : m.contactors[0]?.tag ?? m.protection?.tag ?? '?';
    m.terminals = m.loadWires.map((w, k) => add(tb1, { wire: w, internal: `${src}:T${k + 1}`, external: `${m.motor.tag}:T${k + 1}`, kind: 'feed', group: m.motor.tag }));
    m.peTerminal = add(tb1, { wire: 'PE', internal: groundBar?.tag ?? 'PE BAR', external: `${m.motor.tag}:PE`, kind: 'ground', group: m.motor.tag });
  }
  // The door HMI (a design component, or the one chosen on the HMI page): 24 VDC through its own fused
  // terminal (the supply can deliver more than the 18 AWG door wiring carries), Ethernet to the PLC when both have it.
  const hmiRc = rc.find((c) => c.category === 'hmi');
  // An all-in-one PLC is its own screen: no separate panel feed or link.
  const hmiPn = hmiRc?.partNumber ?? (ctx.hmiPartNumber && ctx.hmiPartNumber !== ctx.plc.cpuPartNumber ? ctx.hmiPartNumber : undefined);
  const hmiTag = hmiRc?.tag ?? (hmiPn ? 'HMI1' : undefined);
  const hmiModel = hmiPn ? getHmi(hmiPn) : undefined;
  const hmiLink: HmiLink['link'] = String(plcPart?.ratings?.ethernet ?? 'yes') !== 'no' && hmiModel?.ethernet !== false ? 'ethernet' : 'serial';
  let hmi: HmiLink | undefined;
  // 24VDC consumers
  const plus: string[] = [`${plcTag}:24V`];
  const zero: string[] = [`${plcTag}:0V`];
  if (relay) { plus.push(`${relay.tag}:A1`, `${relay.tag}:13`); zero.push(`${relay.tag}:A2`); if (safety.statusInput) plus.push(`${relay.tag}:23`); }
  if (mcr) { plus.push(`${mcr.tag}:13`); zero.push(`${mcr.tag}:A2`); }
  if (!relay && !mcr && estopTags.length) plus.push(`${estopTags[0]}:11`);
  for (const g of groups) {
    if (g.type === 'input') (g.commonTo === '0V' ? zero : plus).push(`${g.devTag}:COM`);
  }
  const outSupply: string[] = [];
  for (const g of groups) {
    if (g.type !== 'output') continue;
    if (g.outputStyle === 'sinking') zero.push(`${g.devTag}:C`);
    else outSupply.push(`${g.devTag}:+V`);
  }
  for (const p of io) {
    if (!p.coilChain) continue;
    if (!p.coilChain.sink) {
      const rv = p.coilChain.returnVia;
      const end = rv ? `${rv.tag}:${rv.terminals.split('-')[1]}` : `${p.deviceTag}:${p.pins[1]}`;
      if (p.location !== 'field' && !zero.includes(end)) zero.push(end);
      continue;
    }
    const d0 = p.coilChain.devices[0];
    const first = d0 ? `${d0.tag}:${d0.terminals.split('-')[0]}` : `${p.deviceTag}:${p.pins[0]}`;
    (safety.outputSupply === '24+S' ? outSupply : plus).push(first);
  }
  if (io.some((p) => p.type === 'input' && p.location === 'field')) { plus.push('TB2 FIELD 24+'); zero.push('TB2 FIELD 0V'); }
  if (io.some((p) => p.type === 'output' && p.location !== 'internal')) {
    const anySink = groups.some((g) => g.type === 'output' && g.outputStyle === 'sinking');
    zero.push('TB3 LOAD 0V');
    if (anySink) outSupply.push('TB3 LOAD 24+S');
  }
  // A supply that is not Class 2 and can deliver more than the 18 AWG control wiring carries: the feeds that
  // leave for the field strips get fused terminals (NFPA 79 7.2.4 / 12.5); a smaller supply's current limit
  // protects the wiring itself (design note).
  const fieldFuse = dcBranchFuse(psBranches[0]?.ps);
  const fuseOf = (c: string) => (fieldFuse && /^TB\d+ (FIELD|LOAD) /.test(c) ? { fuse: fieldFuse } : {});
  for (const c of plus) add(tb1, { wire: '24+', internal: `${psMain}:+V`, external: c, kind: 'feed', group: '24+', ...fuseOf(c) });
  /** Load supply of a sinking output: 24+S for motion, the unswitched 24+ for lamps. */
  const lampSupply = (p: IoPoint) => (p.deviceType === 'pilot-light' || p.deviceType === 'stack-light' ? '24+' : safety.outputSupply);
  // 24+S leaves the last safety output in series: the MCR, a light-curtain relay after SR1, or SR1 itself.
  const lcRelays = (safety.extraRelays ?? []).filter((x) => x.kind === 'light-curtain').map((x) => x.relay.tag);
  const sPlus = relay ? `${mcr ? mcr.tag : lcRelays.at(-1) ?? relay.tag}:14` : `${estopTags.at(-1) ?? 'ES'}:12`;
  if (safety.outputSupply === '24+S') for (const c of outSupply) add(tb1, { wire: '24+S', internal: sPlus, external: c, kind: 'feed', group: '24+S', ...fuseOf(c) });
  else for (const c of outSupply) add(tb1, { wire: '24+', internal: `${psMain}:+V`, external: c, kind: 'feed', group: '24+', ...fuseOf(c) });
  if (hmiTag && hmiPn) {
    zero.push(`${hmiTag}:0V`);
    hmi = { tag: hmiTag, partNumber: hmiPn, fuse: '2 A', link: hmiLink, fuseTerminal: '' };
    hmi.fuseTerminal = add(tb1, { wire: '24+H', internal: 'TB1 24+ (jumper)', external: `${hmiTag}:+24V`, kind: 'feed', group: hmiTag, fuse: hmi.fuse });
  }
  // Enclosure filter fan: 24+ through the thermostat's N.O. contact (closes on rise) to the fan, its return to 0V.
  const fanRc = rc.find((c) => c.category === 'fan' && c.part?.ratings.kind === 'filter fan');
  let fan: FanCircuit | undefined;
  if (fanRc) {
    const th = rc.find((c) => c.part?.ratings.kind === 'thermostat');
    fan = { tag: fanRc.tag, partNumber: fanRc.partNumber, thermostat: th?.tag, dc: dcFanAmps(fanRc.part) !== null };
    if (fan.dc) {
      add(tb1, { wire: '24+', internal: `${psMain}:+V`, external: th ? `${th.tag}:1` : `${fan.tag}:+`, kind: 'feed', group: '24+' });
      zero.push(`${fan.tag}:-`);
    }
  }
  for (const c of zero) add(tb1, { wire: '0V', internal: `${psMain}:-V`, external: c, kind: 'feed', group: '0V' });
  add(tb1, { wire: 'PE', internal: groundBar?.tag ?? 'PE BAR', external: `${psMain}:PE`, kind: 'ground', group: 'PE' });
  addSpares(tb1, 2);

  const ins = io.filter((p) => p.type === 'input');
  const outs = io.filter((p) => p.type === 'output');
  if (ins.some((p) => p.location === 'field')) {
    const tb2 = mkStrip('TB2', 'INPUTS (FIELD)');
    for (const p of ins) {
      if (p.location !== 'field') continue;
      const tag = p.deviceTag || p.address;
      const sensor = isSensor3(p.deviceType);
      if (p.deviceType === 'encoder') {
        // Encoder channels: a home-run shielded cable (never through a junction box); one 24+ / 0V pair and the
        // shield per encoder, the channel colour on the PLC side (A / B / Z).
        p.jb = null;
        const first = ins.find((q) => q.deviceTag === p.deviceTag && q.deviceType === 'encoder') === p;
        const ch = encoderChannel(p.description) ?? 'A';
        p.signalTerminal = add(tb2, { wire: p.address, internal: `${plcTag}:${p.address}`, external: `${tag}:${ch}`, kind: 'feed', group: tag });
        if (first) {
          p.supplyTerminal = add(tb2, { wire: '24+', internal: 'TB1 24+ (jumper)', external: `${tag}:+V`, kind: 'feed', group: tag });
          p.returnTerminal = add(tb2, { wire: '0V', internal: 'TB1 0V (jumper)', external: `${tag}:0V`, kind: 'feed', group: tag });
          add(tb2, { wire: 'SH', internal: groundBar?.tag ?? 'PE BAR', external: `${tag} cable shield (cabinet end only)`, kind: 'ground', group: tag });
        }
        continue;
      }
      if (p.jb) {
        p.signalTerminal = add(tb2, { wire: p.address, internal: `${plcTag}:${p.address}`, external: `${p.jb} (${tag})`, kind: 'feed', group: p.jb });
        continue;
      }
      p.signalTerminal = add(tb2, { wire: p.address, internal: `${plcTag}:${p.address}`, external: `${tag}:${sensor ? 'BK' : p.inPins?.[1] ?? pinOf(tag, 'NO')}`, kind: 'feed', group: tag });
      const sw = sensor ? '24+' : p.supplyWire ?? '24+';
      p.supplyTerminal = add(tb2, { wire: sw, internal: `TB1 ${sw} (jumper)`, external: `${tag}:${sensor ? 'BN' : p.inPins?.[0] ?? pinOf(tag, 'C')}`, kind: 'feed', group: tag });
      if (sensor) p.returnTerminal = add(tb2, { wire: '0V', internal: 'TB1 0V (jumper)', external: `${tag}:BU`, kind: 'feed', group: tag });
      // the device cable's PE core gets its own clamp (one conductor per terminal)
      else add(tb2, { wire: 'PE', internal: groundBar?.tag ?? 'PE BAR', external: `${tag}:${pinOf(tag, 'PE')}`, kind: 'ground', group: tag });
    }
    // one 24+ / 0V pair per junction box, commoned inside the box
    for (const jb of mw.wiring.junctionBoxes) {
      const pts = ins.filter((p) => p.location === 'field' && p.jb === jb.tag);
      if (!pts.length) continue;
      const sup = add(tb2, { wire: '24+', internal: 'TB1 24+ (jumper)', external: `${jb.tag} 24+`, kind: 'feed', group: jb.tag });
      const ret = add(tb2, { wire: '0V', internal: 'TB1 0V (jumper)', external: `${jb.tag} 0V`, kind: 'feed', group: jb.tag });
      for (const p of pts) { p.supplyTerminal = p.supplyWire === '0V' ? ret : sup; if (isSensor3(p.deviceType)) p.returnTerminal = ret; }
    }
    add(tb2, { wire: 'PE', internal: groundBar?.tag ?? 'PE BAR', external: 'FIELD SHIELDS/PE', kind: 'ground', group: 'PE' });
    addSpares(tb2, 2);
  }
  if (outs.some((p) => p.location === 'field')) {
    const tb3 = mkStrip('TB3', 'OUTPUTS (FIELD)');
    const retDone = new Map<string, string>();
    for (const p of outs) {
      if (p.location !== 'field') continue;
      const tag = p.deviceTag || p.address;
      const g = groups.find((x) => x.key === p.group);
      const sink = g?.outputStyle === 'sinking';
      const pin = p.deviceType === 'stack-light' ? `${tag}:${(p.description.match(/red|amber|yellow|green|blue|white|horn|buzzer/i)?.[0] ?? p.address).toUpperCase()}` : `${tag}:${p.pins[0]}`;
      // Sinking output with a series safety contact: 24+S -> chain -> coil feed terminal, coil return terminal -> output.
      const sinkCh = p.coilChain?.sink && p.coilChain.devices.length ? p.coilChain : undefined;
      if (sinkCh) {
        const last = sinkCh.devices[sinkCh.devices.length - 1];
        p.signalTerminal = add(tb3, { wire: sinkCh.wires[sinkCh.wires.length - 1], internal: `${last.tag}:${last.terminals.split('-')[1]}`, external: p.jb ? `${p.jb} (${tag})` : pin, kind: 'feed', group: p.jb ?? tag });
        p.returnTerminal = add(tb3, { wire: p.address, internal: `${plcTag}:${p.address}`, external: p.jb ? `${p.jb} ${p.address}` : `${tag}:${p.pins[1]}`, kind: 'feed', group: p.jb ?? tag });
        if (!p.jb && !retDone.has(`${tag}|PE`)) { add(tb3, { wire: 'PE', internal: groundBar?.tag ?? 'PE BAR', external: `${tag}:PE`, kind: 'ground', group: tag }); retDone.set(`${tag}|PE`, ''); }
        continue;
      }
      // Through a series safety contact (coil chain): the terminal is fed from the chain's last contact.
      const ch = p.coilChain && !p.coilChain.sink && p.coilChain.devices.length ? p.coilChain : undefined;
      const lastDev = ch?.devices[ch.devices.length - 1];
      p.signalTerminal = add(tb3, { wire: ch ? ch.wires[ch.wires.length - 1] : p.address, internal: lastDev ? `${lastDev.tag}:${lastDev.terminals.split('-')[1]}` : `${plcTag}:${p.address}`, external: p.jb ? `${p.jb} (${tag})` : pin, kind: 'feed', group: p.jb ?? tag });
      // Lamps on a sinking module stay on the unswitched 24+ (a fault lamp must light during a safety stop).
      const retWire = sink ? (p.deviceType === 'pilot-light' || p.deviceType === 'stack-light' ? '24+' : safety.outputSupply) : '0V';
      // one return per coil (double solenoid: A2 and B2), shared by a stack light's lamps and inside a JB
      const key = p.jb ? `${p.jb}|${retWire}` : `${tag}|${retWire}${p.deviceType === 'stack-light' ? '' : `|${p.pins[1]}`}`;
      if (retDone.has(key)) p.returnTerminal = retDone.get(key);
      else {
        p.returnTerminal = add(tb3, { wire: retWire, internal: `TB1 ${retWire} (jumper)`, external: p.jb ? `${p.jb} ${retWire}` : `${tag}:${p.deviceType === 'stack-light' ? 'COM' : p.pins[1]}`, kind: 'feed', group: p.jb ?? tag });
        retDone.set(key, p.returnTerminal);
        // home-run device cable: its PE core on its own clamp (one conductor per terminal, one per device)
        if (!p.jb && !retDone.has(`${tag}|PE`)) { add(tb3, { wire: 'PE', internal: groundBar?.tag ?? 'PE BAR', external: `${tag}:PE`, kind: 'ground', group: tag }); retDone.set(`${tag}|PE`, ''); }
      }
    }
    add(tb3, { wire: 'PE', internal: groundBar?.tag ?? 'PE BAR', external: 'FIELD PE', kind: 'ground', group: 'PE' });
    addSpares(tb3, 2);
  }

  // ---- wires
  const pe = groundBar?.tag ?? 'PE BAR';
  const dsTag = disconnect?.tag ?? 'DS1';
  const loadPhase = (k: number) => (phases === 1 && k === 1 ? 'N' : `T${k + 1}`);
  // auxiliary loads (heaters …) count with their current, estimated from the branch protection (sized >= 1.25 x)
  const auxA = auxBranches.reduce((s, b) => s + auxLoadA(b), 0);
  const fullLoad = motors.reduce((s, m) => s + m.fla, 0) + auxA;
  const largest = motors.reduce((s, m) => Math.max(s, m.fla), 0);
  // IEC: never thinner than the fixed 14 AWG (2.5 mm²) feeds the bus supplies (power supplies, transformer, aux).
  const busFeeds = psBranches.some((b) => !b.fromXfmr) || Boolean(xfmrBranch) || auxBranches.length > 0;
  const mainAwg = iec
    ? mm2Text(Math.max(mm2For(fullLoad + largest * 0.25 + psBranches.length * 2), busFeeds ? mm2FromAwg('14 AWG') ?? 0 : 0))
    : awgFor(fullLoad + largest * 0.25 + psBranches.length * 2);
  incoming.forEach((w, k) => addWire({ wire: w, from: 'SUPPLY', to: phases === 1 && k === 1 ? `${pe} (N)` : `${dsTag}:L${k + 1}`, color: w === 'N' ? 'WH' : 'BK', size: mainAwg, function: `Incoming supply ${supplyText(supply)}` }));
  addWire({ wire: 'PE', from: 'SUPPLY PE', to: pe, color: 'GN/YE', size: mainAwg, function: 'Incoming protective earth' });
  // bus chain
  const busTaps: { tag: string; poles: number }[] = [];
  if (mainBreaker) busTaps.push({ tag: mainBreaker.tag, poles: phases === 1 ? 1 : 3 });
  for (const m of motors) if (m.protection ?? m.vfd ?? m.contactors[0]) busTaps.push({ tag: (m.protection ?? m.vfd ?? m.contactors[0]).tag, poles: m.lineWires.length });
  if (xfmrBranch) busTaps.push({ tag: xfmrBranch.protection?.tag ?? xfmrBranch.xfmr.tag, poles: xfmrBranch.primaryWires.length });
  for (const b of psBranches) if (!b.fromXfmr) busTaps.push({ tag: b.protection?.tag ?? b.ps.tag, poles: b.feedWires.length });
  for (const b of auxBranches) busTaps.push({ tag: b.protection.tag, poles: b.feedWires.length });
  const servoBase = servoAxes(rc);
  for (const a of servoBase) if (a.protection) busTaps.push({ tag: a.protection.tag, poles: phases === 1 ? 2 : 3 });
  bus.forEach((w, k) => {
    if (w === 'N') return;
    let prev = mainBreaker ? `${mainBreaker.tag}:T${k + 1}` : `${dsTag}:${loadPhase(k)}`;
    for (const t of busTaps) {
      if (mainBreaker && t.tag === mainBreaker.tag) continue;
      if (k >= t.poles) continue;
      const to = `${t.tag}:L${k + 1}`;
      addWire({ wire: w, from: prev, to, color: 'BK', size: mainAwg, function: 'Main power bus (jumpered)' });
      prev = to;
    }
  });
  if (mainBreaker) bus.forEach((w, k) => { if (w !== 'N') addWire({ wire: `${w}`, from: `${dsTag}:T${k + 1}`, to: `${mainBreaker.tag}:L${k + 1}`, color: 'BK', size: mainAwg, function: 'Disconnect to main breaker' }); });
  if (xfmrBranch) {
    const T = xfmrBranch.xfmr.tag;
    // Primary: from its own protection, else from the transformer's integral fuse block (CT-...-1),
    // else straight from the bus (design warning 'no primary protection').
    const fusedT = /yes/i.test(String(xfmrBranch.xfmr.part?.ratings.fused ?? ''));
    const primFrom = (k: number) => (xfmrBranch.protection ? `${xfmrBranch.protection.tag}:T${k + 1}` : fusedT ? `${T}:FU${k + 1}` : `BUS ${bus[k]}`);
    xfmrBranch.primaryWires.forEach((w, k) => addWire({ wire: w, from: w === 'N' ? 'N' : primFrom(k), to: `${T}:H${k === 0 ? 1 : 2}`, color: w === 'N' ? 'WH' : 'BK', size: '14 AWG', function: `${T} primary` }));
    // 120 VAC control secondary: red (NFPA 79 13.2.4.3: ungrounded AC control conductors), grounded side white.
    for (const b of psBranches) addWire({ wire: 'X1', from: `${T}:X1`, to: b.protection ? `${b.protection.tag}:L1` : `${b.ps.tag}:L`, color: 'RD', size: '14 AWG', function: `${T} secondary 120VAC to ${b.ps.tag}${b.protection ? '' : fusedT ? ' (through the transformer secondary fuse)' : ''}` });
    addWire({ wire: 'X2', from: `${T}:X2`, to: pe, color: 'WH', size: '14 AWG', function: `${T} secondary grounded conductor, bonded to PE` });
    addWire({ wire: 'PE', from: `${T}:GND`, to: pe, color: 'GN/YE', size: '14 AWG', function: `${T} ground` });
  }
  for (const b of psBranches) {
    if (b.fromXfmr) {
      // With its own secondary protection the supply is fed from that device; otherwise X1 goes straight to it (above).
      if (b.protection) addWire({ wire: b.feedWires[0], from: `${b.protection.tag}:T1`, to: `${b.ps.tag}:L`, color: 'RD', size: '14 AWG', function: `${b.ps.tag} 120VAC feed` });
      addWire({ wire: 'X2', from: `${xfmrBranch?.xfmr.tag ?? 'T1'}:X2`, to: `${b.ps.tag}:N`, color: 'WH', size: '14 AWG', function: `${b.ps.tag} 120VAC neutral` });
    } else b.feedWires.forEach((w, k) => addWire({ wire: w, from: w === 'N' ? 'N' : `${b.protection?.tag ?? '1L'}:T${k + 1}`, to: `${b.ps.tag}:${w === 'N' ? 'N' : phases === 1 ? 'L' : `L${k + 1}`}`, color: w === 'N' ? 'WH' : 'BK', size: '14 AWG', function: `${b.ps.tag} primary feed` }));
    addWire({ wire: 'PE', from: `${b.ps.tag}:PE`, to: pe, color: 'GN/YE', size: '14 AWG', function: `${b.ps.tag} ground` });
    addWire({ wire: '24+', from: `${b.ps.tag}:+V`, to: 'TB1 24+', color: 'BU', size: '16 AWG', function: '+24VDC distribution' });
    addWire({ wire: '0V', from: `${b.ps.tag}:-V`, to: 'TB1 0V', color: 'WH/BU', size: '16 AWG', function: '0V DC common' });
  }
  if (psBranches.length) addWire({ wire: '0V', from: 'TB1 0V', to: pe, color: 'WH/BU', size: '14 AWG', function: '0V bonded to PE (grounded DC control circuit)' });
  for (const b of auxBranches) {
    if (!b.path) {
      b.feedWires.forEach((w, k) => addWire({ wire: w, from: `${b.protection.tag}:T${k + 1}`, to: b.protection.comp.function || 'LOAD', color: w === 'N' ? 'WH' : 'BK', size: '14 AWG', function: b.protection.comp.function }));
      continue;
    }
    // protection → contactor main contacts → SSR (first pole) → load, numbered on the load side of each device
    const [k, ssr] = b.path;
    const fuseA = num(b.protection.fuse?.ratings, 'amps') ?? num(b.protection.part?.ratings, 'amps') ?? 15;
    const size = iec ? mm2Text(mm2For(fuseA)) : awgFor(fuseA);
    const load = b.load ?? 'LOAD';
    // the load's terminals by its tag ("HTR1 Seal heater" → HTR1:1)
    const dest = /^-?[A-Z]+\d+\b/.exec(load)?.[0] ?? load.toUpperCase();
    b.feedWires.forEach((w, i) => {
      const col = w === 'N' ? 'WH' : 'BK';
      addWire({ wire: w, from: w === 'N' ? 'N' : `${b.protection.tag}:T${i + 1}`, to: `${k.tag}:L${i + 1}`, color: col, size, function: `${load} feed` });
      const kOut = w === 'N' ? 'N' : `${wt(k.tag)}-T${i + 1}`;
      if (i === 0 && ssr && ssr !== k) {
        addWire({ wire: kOut, from: `${k.tag}:T1`, to: `${ssr.tag}:1`, color: col, size, function: `${load} through ${k.tag} to ${ssr.tag}` });
        addWire({ wire: `${wt(ssr.tag)}-T1`, from: `${ssr.tag}:2`, to: `${dest}:1`, color: col, size, function: `${load} (switched by ${ssr.tag})` });
      } else addWire({ wire: kOut, from: `${k.tag}:T${i + 1}`, to: `${dest}:${i + 1}`, color: col, size, function: `${load} (through ${k.tag})` });
    });
  }
  for (const m of motors) {
    const prot = m.protection?.tag;
    // VFD with a line contactor (safety stop by contactor): protection -> K:L, K:T -> VFD:L
    const lineK = m.vfd ? m.contactors[0] : undefined;
    const lineTo = lineK ? lineK.tag : m.vfd ? m.vfd.tag : m.contactors[0]?.tag;
    if (lineK && m.vfd) m.midWires.forEach((w, k) => addWire({ wire: w, from: `${lineK.tag}:T${k + 1}`, to: `${m.vfd!.tag}:L${k + 1}`, color: w === 'N' ? 'WH' : 'BK', size: m.awg, function: `${m.motor.tag} line contactor to drive` }));
    if (lineK && !io.some((p) => p.deviceTag === lineK.tag)) {
      const safetyOut = safety.outputSupply;
      // not switched by a PLC output: the coil is held by the safety-switched supply, so the safety relay drops it
      addWire({ wire: safetyOut, from: `TB1 ${safetyOut}`, to: `${lineK.tag}:A1`, color: 'BU', size: '18 AWG', function: `${lineK.tag} line contactor coil (safety stop of ${m.vfd!.tag})` });
      addWire({ wire: '0V', from: `${lineK.tag}:A2`, to: 'TB1 0V', color: 'WH/BU', size: '18 AWG', function: `${lineK.tag} line contactor coil` });
    }
    m.lineWires.forEach((w, k) => {
      if (prot && lineTo) addWire({ wire: w, from: `${prot}:T${k + 1}`, to: `${lineTo}:L${k + 1}`, color: w === 'N' ? 'WH' : 'BK', size: m.awg, function: `${m.motor.tag} line side` });
      if (m.contactors[1]) addWire({ wire: w, from: `${m.contactors[0].tag}:L${k + 1}`, to: `${m.contactors[1].tag}:L${k + 1}`, color: w === 'N' ? 'WH' : 'BK', size: m.awg, function: `${m.motor.tag} reversing jumper` });
    });
    if (!m.vfd && m.overload && m.contactors[0]) m.midWires.forEach((w, k) => {
      addWire({ wire: w, from: `${m.contactors[0].tag}:T${k + 1}`, to: `${m.overload!.tag}:L${k + 1}`, color: w === 'N' ? 'WH' : 'BK', size: m.awg, function: `${m.motor.tag} contactor to overload` });
      if (m.contactors[1]) {
        const sw = m.midWires.length === 3 ? [2, 1, 0][k] : k;
        addWire({ wire: m.midWires[sw], from: `${m.contactors[1].tag}:T${k + 1}`, to: `${m.contactors[0].tag}:T${sw + 1}`, color: w === 'N' ? 'WH' : 'BK', size: m.awg, function: `${m.motor.tag} reversing (phase swap)` });
      }
    });
    const src = m.vfd ? m.vfd.tag : m.overload ? m.overload.tag : m.contactors[0]?.tag ?? prot ?? '?';
    m.loadWires.forEach((w, k) => {
      addWire({ wire: w, from: `${src}:T${k + 1}`, to: m.terminals[k], color: w === 'N' ? 'WH' : 'BK', size: m.awg, function: `${m.motor.tag} motor leads` });
      addWire({ wire: w, from: m.terminals[k], to: `${m.motor.tag}:T${k + 1}`, color: w === 'N' ? 'WH' : 'BK', size: m.awg, function: `${m.motor.tag} motor cable (field)` });
    });
    if (m.peTerminal) addWire({ wire: 'PE', from: m.peTerminal, to: `${m.motor.tag}:PE`, color: 'GN/YE', size: m.awg, function: `${m.motor.tag} motor ground` });
  }
  // safety circuit
  if (relay) {
    addWire({ wire: '24+', from: 'TB1 24+', to: `${relay.tag}:A1`, color: 'BU', size: '18 AWG', function: 'Safety relay supply' });
    addWire({ wire: '0V', from: `${relay.tag}:A2`, to: 'TB1 0V', color: 'WH/BU', size: '18 AWG', function: 'Safety relay supply' });
    const chain = (a: string, b: string, contactTerms: string) => {
      const devs = [...(estopTags.length ? estopTags : ['ES?']), ...guardTags];
      devs.forEach((tag, k) => {
        const [t1, t2] = contactTerms.split('-');
        addWire({ wire: k === 0 ? a : `${a}${letter(k)}`, from: k === 0 ? `${relay.tag}:${a}` : `${devs[k - 1]}:${t2}`, to: `${tag}:${t1}`, color: 'BU', size: '18 AWG', function: 'E-stop channel' });
      });
      addWire({ wire: b, from: `${devs[devs.length - 1]}:${contactTerms.split('-')[1]}`, to: `${relay.tag}:${b}`, color: 'BU', size: '18 AWG', function: 'E-stop channel' });
    };
    chain('S11', 'S12', '11-12');
    chain('S21', 'S22', '21-22');
    const rs = [reset ?? 'PB?', ...edm]; // same placeholder as the drawings until a reset button is assigned
    rs.forEach((tag, k) => addWire({ wire: k === 0 ? 'S33' : `S33${letter(k)}`, from: k === 0 ? `${relay.tag}:S33` : `${rs[k - 1]}:${k - 1 === 0 ? '14' : ncOf(rs[k - 1])[1]}`, to: `${tag}:${k === 0 ? '13' : ncOf(tag)[0]}`, color: 'BU', size: '18 AWG', function: k === 0 ? 'Safety reset' : 'Feedback (EDM) loop' }));
    addWire({ wire: 'S34', from: `${rs[rs.length - 1]}:${rs.length === 1 ? '14' : ncOf(rs[rs.length - 1])[1]}`, to: `${relay.tag}:S34`, color: 'BU', size: '18 AWG', function: 'Feedback (EDM) loop' });
    addWire({ wire: '24+', from: 'TB1 24+', to: `${relay.tag}:13`, color: 'BU', size: '18 AWG', function: 'Safety output supply' });
    if (mcr) {
      addWire({ wire: 'SR14', from: `${relay.tag}:14`, to: `${mcr.tag}:A1`, color: 'BU', size: '18 AWG', function: 'MCR coil (safety output)' });
      addWire({ wire: '0V', from: `${mcr.tag}:A2`, to: 'TB1 0V', color: 'WH/BU', size: '18 AWG', function: 'MCR coil' });
      addWire({ wire: '24+', from: 'TB1 24+', to: `${mcr.tag}:13`, color: 'BU', size: '18 AWG', function: 'MCR contact supply' });
      addWire({ wire: '24+S', from: `${mcr.tag}:14`, to: 'TB1 24+S', color: 'BU', size: '16 AWG', function: 'Safety-switched +24V' });
    } else {
      const series = [relay.tag, ...lcRelays];
      for (let k = 0; k + 1 < series.length; k++) addWire({ wire: k === 0 ? 'SR14' : `SR14${letter(k)}`, from: `${series[k]}:14`, to: `${series[k + 1]}:13`, color: 'BU', size: '16 AWG', function: 'Safety outputs in series (E-stop, light curtain)' });
      addWire({ wire: '24+S', from: `${lcRelays.at(-1) ?? relay.tag}:14`, to: 'TB1 24+S', color: 'BU', size: '16 AWG', function: 'Safety-switched +24V' });
    }
    // Two-hand and light-curtain relays: supply and inputs.
    for (const x of safety.extraRelays ?? []) {
      const t = x.relay.tag;
      addWire({ wire: '24+', from: 'TB1 24+', to: `${t}:A1`, color: 'BU', size: '18 AWG', function: `${t} supply` });
      addWire({ wire: '0V', from: `${t}:A2`, to: 'TB1 0V', color: 'WH/BU', size: '18 AWG', function: `${t} supply` });
      for (const d of x.inputs) {
        if (x.kind === 'light-curtain') {
          addWire({ wire: 'OSSD1', from: `${d}:OSSD1`, to: `${t}:S12`, color: 'BU', size: '18 AWG', function: `Light curtain ${d} OSSD1` });
          addWire({ wire: 'OSSD2', from: `${d}:OSSD2`, to: `${t}:S22`, color: 'BU', size: '18 AWG', function: `Light curtain ${d} OSSD2` });
        } else {
          addWire({ wire: `${t}-1`, from: `${d}:BTN1`, to: `${t}:IN1`, color: 'BU', size: '18 AWG', function: `Two-hand button 1 (${d})` });
          addWire({ wire: `${t}-2`, from: `${d}:BTN2`, to: `${t}:IN2`, color: 'BU', size: '18 AWG', function: `Two-hand button 2 (${d})` });
        }
      }
    }
    // Heater safety contactors: 24+S through the over-temperature limit's latched relay to the coil.
    const limit = rc.find((c) => c.part?.ratings.kind === 'limitAlarm');
    const ioTagSet = new Set(io.map((p) => p.deviceTag));
    for (const k of rc.filter((c) => c.category === 'contactor' && !c.comp.motorTag && !ioTagSet.has(c.tag) && /safety contactor/i.test(c.comp.function))) {
      if (limit) {
        // the limit's relay 1 is a contact in series with the coil: in on one side, out on the other
        const [ra, rb] = limitRelayPins(limit.part);
        addWire({ wire: safety.outputSupply, from: `TB1 ${safety.outputSupply}`, to: `${limit.tag}:${ra}`, color: 'BU', size: '18 AWG', function: `${k.tag} coil through the over-temperature limit` });
        addWire({ wire: `${k.tag}A1`, from: `${limit.tag}:${rb}`, to: `${k.tag}:A1`, color: 'BU', size: '18 AWG', function: `${k.tag} coil` });
      } else addWire({ wire: safety.outputSupply, from: `TB1 ${safety.outputSupply}`, to: `${k.tag}:A1`, color: 'BU', size: '18 AWG', function: `${k.tag} coil` });
      addWire({ wire: '0V', from: `${k.tag}:A2`, to: 'TB1 0V', color: 'WH/BU', size: '18 AWG', function: `${k.tag} coil return` });
    }
    if (safety.statusInput) {
      const sw = io.find((q) => q.address === safety.statusInput!.address)?.supplyWire ?? '24+';
      addWire({ wire: sw, from: `TB1 ${sw}`, to: `${relay.tag}:23`, color: sw === '0V' ? 'WH/BU' : 'BU', size: '18 AWG', function: `Safety status contact${sw === '0V' ? ' (switches 0V: NPN input common)' : ''}` });
      safety.statusInput.feedTo = `${relay.tag}:23`;
      addWire({ wire: safety.statusInput.address, from: `${relay.tag}:24`, to: `${plcTag}:${safety.statusInput.address}`, color: 'BU', size: '18 AWG', function: 'Safety relay status to PLC' });
    }
  } else if (estopTags.length) {
    estopTags.forEach((tag, k) => addWire({ wire: k === 0 ? '24+' : `ES${k}`, from: k === 0 ? 'TB1 24+' : `${estopTags[k - 1]}:12`, to: `${tag}:11`, color: 'BU', size: '18 AWG', function: 'E-stop chain' }));
    addWire({ wire: '24+S', from: `${estopTags[estopTags.length - 1]}:12`, to: mcr ? `${mcr.tag}:A1` : 'TB1 24+S', color: 'BU', size: '16 AWG', function: 'E-stop switched +24V' });
  }
  // PLC power & commons
  if (fan?.dc) {
    addWire({ wire: '24+', from: 'TB1 24+', to: fan.thermostat ? `${fan.thermostat}:1` : `${fan.tag}:+`, color: 'BU', size: '18 AWG', function: `${fan.tag} filter fan supply${fan.thermostat ? ` (thermostat ${fan.thermostat})` : ''}` });
    if (fan.thermostat) addWire({ wire: fan.tag, from: `${fan.thermostat}:2`, to: `${fan.tag}:+`, color: 'BU', size: '18 AWG', function: `${fan.tag} filter fan, switched by thermostat ${fan.thermostat}` });
    addWire({ wire: '0V', from: `${fan.tag}:-`, to: 'TB1 0V', color: 'WH/BU', size: '18 AWG', function: `${fan.tag} filter fan return` });
  }
  addWire({ wire: '24+', from: 'TB1 24+', to: `${plcTag}:24V`, color: 'BU', size: '18 AWG', function: 'PLC power' });
  addWire({ wire: '0V', from: `${plcTag}:0V`, to: 'TB1 0V', color: 'WH/BU', size: '18 AWG', function: 'PLC power' });
  if (hmi) {
    addWire({ wire: '24+', from: 'TB1 24+', to: hmi.fuseTerminal, color: 'BU', size: '18 AWG', function: `${hmi.tag} supply into fused terminal (${hmi.fuse} fuse)` });
    addWire({ wire: '24+H', from: hmi.fuseTerminal, to: `${hmi.tag}:+24V`, color: 'BU', size: '18 AWG', function: `${hmi.tag} power (door, through the hinge loop)` });
    addWire({ wire: '0V', from: `${hmi.tag}:0V`, to: 'TB1 0V', color: 'WH/BU', size: '18 AWG', function: `${hmi.tag} power` });
    addWire({ wire: 'PE', from: `${hmi.tag}:FG`, to: pe, color: 'GN/YE', size: '14 AWG', function: `${hmi.tag} frame ground` });
    addWire(hmi.link === 'ethernet'
      ? { wire: 'ENET1', from: `${plcTag}:ETH`, to: `${hmi.tag}:LAN`, color: 'Cat6 STP (cable)', size: 'Cat6', function: `Ethernet ${plcTag} to ${hmi.tag}: shielded patch cable, direct (add a switch for more Ethernet devices)` }
      : { wire: 'COM2', from: `${plcTag}:PORT2`, to: `${hmi.tag}:PORT1`, color: 'RS-232 (cable)', size: 'RS-232', function: `Serial ${plcTag} port 2 to ${hmi.tag}: RS-232 cable (PLC has no Ethernet port)` });
  }
  for (const g of groups) {
    const slot = g.key.split(':')[1];
    if (g.type === 'input') addWire({ wire: g.commonTo, from: `${g.devTag}:COM`, to: `TB1 ${g.commonTo}`, color: g.commonTo === '0V' ? 'WH/BU' : 'BU', size: '18 AWG', function: `Input common slot ${slot}` });
    else if (g.outputStyle === 'sinking') addWire({ wire: '0V', from: `${g.devTag}:C`, to: 'TB1 0V', color: 'WH/BU', size: '18 AWG', function: `Output common slot ${slot}` });
    else addWire({ wire: safety.outputSupply, from: `TB1 ${safety.outputSupply}`, to: `${g.devTag}:+V`, color: 'BU', size: '18 AWG', function: `Output supply slot ${slot}` });
  }
  // VFD control: which PLC point lands on which drive terminal (electrical/vfd.ts).
  const MOTOR_VOLTS: Record<SupplyVoltage, number> = { '120VAC-1PH': 115, '208VAC-3PH': 200, '240VAC-3PH': 230, '480VAC-3PH': 460, '600VAC-3PH': 575, '400VAC-3PH': 400, '230VAC-1PH': 230, '690VAC-3PH': 690 };
  const driveOutStyle = groups.find((g) => g.type === 'output' && g.points.some((p) => p.deviceType === 'vfd-input'))?.outputStyle ?? groups.find((g) => g.type === 'output')?.outputStyle ?? 'sourcing';
  const drives = driveControls(
    motors.filter((m) => m.vfd).map((m) => ({
      tag: m.vfd!.tag, partNumber: m.vfd!.partNumber, series: String(m.vfd!.part?.ratings?.series ?? ''), outputAmps: num(m.vfd!.part?.ratings, 'outputAmps'),
      motorTag: m.motor.tag, motorDescription: m.motor.description, motorHp: m.motor.hp, motorVolts: MOTOR_VOLTS[m.motor.voltage], fla: m.fla, reversing: m.motor.reversing,
      sto: /\b(STO|safe torque)\b/i.test(m.vfd!.comp.function), contactor: m.contactors.length > 0,
    })),
    io.map((p) => ({ address: p.address, type: p.type, description: p.description, deviceTag: p.deviceTag, deviceType: p.deviceType })),
    ctx.analog ?? [], driveOutStyle, safety.outputSupply,
  );
  const driveTerm = new Map<string, { tag: string; t: DriveTerminal }>();
  for (const c of drives) for (const t of c.terminals) driveTerm.set(t.address, { tag: c.drive.tag, t });
  for (const c of drives) {
    const tag = c.drive.tag;
    if (c.terminals.some((t) => ['run', 'reverse', 'preset'].includes(t.role))) {
      if (driveOutStyle === 'sinking') addWire({ wire: safety.outputSupply, from: `TB1 ${safety.outputSupply}`, to: `${tag}:DCM`, color: 'BU', size: '18 AWG', function: `${tag} digital input common (sinking PLC outputs)` });
      else addWire({ wire: '0V', from: `${tag}:DCM`, to: 'TB1 0V', color: 'WH/BU', size: '18 AWG', function: `${tag} digital input common` });
    }
    const fault = c.terminals.find((t) => t.role === 'fault');
    if (fault) {
      const fp = io.find((q) => q.address === fault.address);
      const sw = fp?.supplyWire ?? '24+';
      if (fp) fp.feedTo = `${tag}:R1`;
      addWire({ wire: sw, from: `TB1 ${sw}`, to: `${tag}:R1`, color: sw === '0V' ? 'WH/BU' : 'BU', size: '18 AWG', function: `${tag} fault relay common` });
    }
    if (c.safetyStop === 'sto') {
      // Safe Torque Off from the safety relay output (factory STO jumper removed), GS20 manual App. E.
      for (const ch of ['STO1', 'STO2']) addWire({ wire: safety.outputSupply, from: `TB1 ${safety.outputSupply}`, to: `${tag}:${ch}`, color: 'BU', size: '18 AWG', function: `${tag} Safe Torque Off ${ch} (safety relay output)` });
      addWire({ wire: '0V', from: `${tag}:SCM`, to: 'TB1 0V', color: 'WH/BU', size: '18 AWG', function: `${tag} STO common` });
    }
    if (c.terminals.some((t) => t.role === 'running')) addWire({ wire: '0V', from: `${tag}:DOC`, to: 'TB1 0V', color: 'WH/BU', size: '18 AWG', function: `${tag} DO1 common` });
  }

  // Servo axes: power, STO and each PLC signal on its drive terminal (electrical/servoWiring.ts).
  const servoOut = groups.find((g) => g.type === 'output' && g.points.some((p) => p.deviceType === 'servo-drive'))?.outputStyle ?? 'sinking';
  const servoIn = groups.find((g) => g.type === 'input' && g.points.some((p) => p.deviceType === 'servo-drive'))?.commonTo === '24+' ? '24+' : '0V';
  // STO channels, each straight from a safety-relay output: A from 13-14, B from a free output. A uses 24+S only
  // when 24+S is 13-14 itself; with an MCR (a standard relay contact) or light-curtain relays in series (which
  // would open channel A alone: a channel-mismatch fault, and a one-channel stop) A taps SR14 at the relay, so
  // both channels are opened by the same safety functions.
  let sto: StoFeed | null = null;
  if (relay && servoBase.length && stoFree) {
    addWire({ wire: '24+', from: 'TB1 24+', to: `${relay.tag}:${stoFree[0]}`, color: 'BU', size: '18 AWG', function: 'STO channel B supply (second safety output)' });
    sto = {
      a: mcr || lcRelays.length ? { wire: 'SR14', from: `${relay.tag}:14` } : { wire: safety.outputSupply, from: `TB1 ${safety.outputSupply}` },
      b: { wire: `SR${stoFree[1]}`, from: `${relay.tag}:${stoFree[1]}` },
    };
  }
  const servo = servoControls(servoBase, io, servoOut, servoIn, sto, relay ? 'no-output' : 'no-relay', pe, phases);
  for (const sw of servo.wires) addWire(sw);

  // IO wires
  for (const p of io) {
    if (safety.statusInput === p) continue;
    const tag = p.deviceTag || '(device)';
    const g = groups.find((x) => x.key === p.group);
    const st = servo.terms.get(p.address);
    if (!st && p.deviceType === 'servo-drive') continue; // not wired (e.g. a relay output for pulses): see the servo sheet
    if (st) {
      addWire(p.type === 'input'
        ? { wire: p.address, from: `${st.tag}:${st.terminal}`, to: `${plcTag}:${p.address}`, color: 'BU', size: '18 AWG', function: p.description }
        : { wire: p.address, from: `${plcTag}:${p.address}`, to: `${st.tag}:${st.terminal}`, color: 'BU', size: '18 AWG', function: p.description });
      continue;
    }
    const dt = driveTerm.get(p.address);
    if (dt) {
      addWire(p.type === 'input'
        ? { wire: p.address, from: `${dt.tag}:${dt.t.terminal}`, to: `${plcTag}:${p.address}`, color: 'BU', size: '18 AWG', function: p.description }
        : { wire: p.address, from: `${plcTag}:${p.address}`, to: `${dt.tag}:${dt.t.terminal.replace(/^(FWD|REV)\//, '')}`, color: 'BU', size: '18 AWG', function: p.description });
      continue;
    }
    if (p.type === 'input') {
      if (p.signalTerminal) {
        const s3 = isSensor3(p.deviceType);
        const sig = p.deviceType === 'encoder' ? encoderChannel(p.description) ?? 'A' : s3 ? 'BK' : p.inPins?.[1] ?? pinOf(tag, 'NO');
        addWire({ wire: p.address, from: `${tag}:${sig}`, to: p.signalTerminal, color: s3 ? `${p.deviceType === 'encoder' ? sig : 'BK'} (cable)` : 'BU', size: p.deviceType === 'encoder' ? '24 AWG (cable)' : '18 AWG', function: p.description });
        addWire({ wire: p.address, from: p.signalTerminal, to: `${plcTag}:${p.address}`, color: 'BU', size: '18 AWG', function: p.description });
        if (p.supplyTerminal) {
          const sw = s3 ? '24+' : p.supplyWire ?? '24+';
          p.feedTo = `${tag}:${p.deviceType === 'encoder' ? '+V' : s3 ? 'BN' : p.inPins?.[0] ?? pinOf(tag, 'C')}`;
          addWire({ wire: sw, from: p.supplyTerminal, to: p.feedTo, color: s3 ? 'BN (cable)' : sw === '0V' ? 'WH/BU' : 'BU', size: p.deviceType === 'encoder' ? '24 AWG (cable)' : '18 AWG', function: `${tag} supply` });
        }
        if (p.returnTerminal) addWire({ wire: '0V', from: p.returnTerminal, to: `${tag}:${p.deviceType === 'encoder' ? '0V' : 'BU'}`, color: p.deviceType === 'encoder' ? 'WH (cable)' : 'BU (cable)', size: p.deviceType === 'encoder' ? '24 AWG (cable)' : '18 AWG', function: `${tag} 0V` });
      } else {
        const sw = p.supplyWire ?? '24+';
        p.feedTo = `${tag}:${p.inPins?.[0] ?? 'C'}`;
        addWire({ wire: sw, from: `TB1 ${sw}`, to: p.feedTo, color: sw === '0V' ? 'WH/BU' : 'BU', size: '18 AWG', function: `${tag} supply` });
        addWire({ wire: p.address, from: `${tag}:${p.inPins?.[1] ?? (p.deviceType === 'pushbutton-nc' ? 'NC' : 'NO')}`, to: `${plcTag}:${p.address}`, color: 'BU', size: '18 AWG', function: p.description });
      }
    } else {
      const sink = g?.outputStyle === 'sinking';
      if (p.coilChain) {
        const ch = p.coilChain;
        // chain start: the PLC output (sourcing) or the output supply terminal (sinking)
        const start = ch.sink ? `TB1 ${safety.outputSupply}` : `${plcTag}:${p.address}`;
        ch.devices.forEach((d, k) => addWire({ wire: ch.wires[k], from: k === 0 ? start : `${ch.devices[k - 1].tag}:${ch.devices[k - 1].terminals.split('-')[1]}`, to: `${d.tag}:${d.terminals.split('-')[0]}`, color: 'BU', size: '18 AWG', function: p.description }));
        const last = ch.devices.length ? `${ch.devices[ch.devices.length - 1].tag}:${ch.devices[ch.devices.length - 1].terminals.split('-')[1]}` : start;
        if (p.signalTerminal && ch.sink) {
          // Sinking field coil: chain -> feed terminal -> coil; coil -> return terminal -> output.
          addWire({ wire: ch.wires[ch.wires.length - 1], from: last, to: p.signalTerminal, color: 'BU', size: '18 AWG', function: p.description });
          addWire({ wire: ch.wires[ch.wires.length - 1], from: p.signalTerminal, to: tbExternal(strips, p.signalTerminal), color: 'BU', size: '18 AWG', function: p.description });
          if (p.returnTerminal) {
            addWire({ wire: p.address, from: tbExternal(strips, p.returnTerminal), to: p.returnTerminal, color: 'BU', size: '18 AWG', function: `${p.description} (sinking output)` });
            addWire({ wire: p.address, from: p.returnTerminal, to: `${plcTag}:${p.address}`, color: 'BU', size: '18 AWG', function: `${p.description} (sinking output)` });
          }
          continue;
        }
        if (p.signalTerminal && !ch.sink) {
          // Field coil: from the chain through its output terminal, returning through the field return terminal.
          addWire({ wire: ch.wires[ch.wires.length - 1], from: last, to: p.signalTerminal, color: 'BU', size: '18 AWG', function: p.description });
          addWire({ wire: ch.wires[ch.wires.length - 1], from: p.signalTerminal, to: tbExternal(strips, p.signalTerminal), color: 'BU', size: '18 AWG', function: p.description });
          if (p.returnTerminal) addWire({ wire: '0V', from: tbExternal(strips, p.returnTerminal), to: p.returnTerminal, color: 'WH/BU', size: '18 AWG', function: `${tag} return` });
        } else addWire({ wire: ch.wires[ch.wires.length - 1], from: last, to: `${tag}:${p.pins[0]}`, color: 'BU', size: '18 AWG', function: p.description });
        if (p.signalTerminal && !ch.sink) { /* return wired above */ } else if (ch.sink) addWire({ wire: p.address, from: `${tag}:${p.pins[1]}`, to: `${plcTag}:${p.address}`, color: 'BU', size: '18 AWG', function: `${p.description} (sinking output)` });
        else if (ch.returnVia) {
          // A2 → the shared overload contact → 0V (once for both coils)
          const [a, b] = ch.returnVia.terminals.split('-');
          addWire({ wire: ch.returnVia.wire, from: `${tag}:${p.pins[1]}`, to: `${ch.returnVia.tag}:${a}`, color: 'BU', size: '18 AWG', function: `${tag} coil return through ${ch.returnVia.tag}` });
          if (!wires.some((w) => w.from === `${ch.returnVia!.tag}:${b}` && w.wire === '0V')) addWire({ wire: '0V', from: `${ch.returnVia.tag}:${b}`, to: 'TB1 0V', color: 'WH/BU', size: '18 AWG', function: `${ch.returnVia.tag} coil return` });
        } else addWire({ wire: '0V', from: `${tag}:${p.pins[1]}`, to: 'TB1 0V', color: 'WH/BU', size: '18 AWG', function: `${tag} coil return` });
      } else if (p.signalTerminal) {
        addWire({ wire: p.address, from: `${plcTag}:${p.address}`, to: p.signalTerminal, color: 'BU', size: '18 AWG', function: p.description });
        addWire({ wire: p.address, from: p.signalTerminal, to: tbExternal(strips, p.signalTerminal), color: 'BU', size: '18 AWG', function: p.description });
        if (p.returnTerminal) addWire({ wire: sink ? lampSupply(p) : '0V', from: tbExternal(strips, p.returnTerminal), to: p.returnTerminal, color: sink ? 'BU' : 'WH/BU', size: '18 AWG', function: `${tag} return` });
      } else {
        addWire({ wire: p.address, from: `${plcTag}:${p.address}`, to: `${tag}:${p.deviceType === 'vfd-input' ? 'DI' : p.pins[0]}`, color: 'BU', size: '18 AWG', function: p.description });
        if (p.deviceType === 'vfd-input') addWire({ wire: '0V', from: `${tag}:DCM`, to: 'TB1 0V', color: 'WH/BU', size: '18 AWG', function: `${tag} digital input common` });
        else addWire({ wire: sink ? lampSupply(p) : '0V', from: `${tag}:${p.pins[1]}`, to: `TB1 ${sink ? lampSupply(p) : '0V'}`, color: sink ? 'BU' : 'WH/BU', size: '18 AWG', function: `${tag} return` });
      }
    }
  }

  const machine = buildMachine(ctx, mw, io, motors, groundBar?.tag ?? 'PE BAR', strips);
  // Analog signals: TBA terminals, shielded cables, loop wiring (electrical/analog.ts).
  const analog = analogWiring(ctx.analog ?? [], {
    plcTag, groundBar: groundBar?.tag ?? 'PE BAR', firstCable: machine.cables.length + 1, ioWiring: ioW,
    internal: new Map(drives.flatMap((c) => c.terminals.filter((t) => t.role === 'speed').map((t) => [t.address, { tag: c.drive.tag, plus: t.terminal, minus: t.common }] as const))),
    moduleTag: (slot, pn) => modules.find((mm) => mm.partNumber === pn)?.tag ?? `${plcTag}-S${slot}`,
  });
  // Every PE clamp on the strips is wired from the ground bar, and the enclosure, back panel and door are bonded to it
  // (NFPA 79 8.2.3 / IEC 60204-1 8.2.1: protective bonding circuit continuity does not rely on hinges or mounting screws).
  for (const st of strips) for (const t of st.terminals.filter((x) => x.kind === 'ground')) {
    const mt = motors.find((mm) => mm.peTerminal === t.label);
    addWire({ wire: 'PE', from: pe, to: t.label, color: 'GN/YE', size: mt ? mt.awg : '14 AWG', function: `PE to ${t.external}` });
  }
  addWire({ wire: 'PE', from: 'ENCLOSURE (ground stud)', to: pe, color: 'GN/YE', size: mainAwg, function: 'Enclosure bonding' });
  addWire({ wire: 'PE', from: 'BACK PANEL (ground stud)', to: pe, color: 'GN/YE', size: mainAwg, function: 'Back panel bonding' });
  addWire({ wire: 'PE', from: 'DOOR (ground stud)', to: 'ENCLOSURE (ground stud)', color: 'GN/YE', size: '14 AWG', function: 'Door bonding jumper (flexible, across the hinge)' });
  wires.push(...analog.wires);
  // relay logic kept from a converted machine: the ladder's nodes (relayLogic.ts, same numbers as the ladder sheets);
  // NFPA 79 13.2.4: DC control blue, AC control red
  const logic = ctx.design.inputs.relayLogic;
  let ladder: Ladder | undefined;
  if (logic?.rungs.length) {
    // terminals the panel already wires stay on their net: the ladder asks instead of joining a second wire to them
    const occupied = new Map<string, string>();
    for (const w of wires) for (const e of [w.from, w.to]) if (/^[A-Z][A-Z0-9-]*:[^\s?]+$/.test(e) && !occupied.has(e)) occupied.set(e, w.wire);
    ladder = relayLadder(logic, { occupied });
    for (const w of ladder.wires) addWire({ ...w, color: logic.supply === '120VAC' ? 'RD' : 'BU', size: '18 AWG' });
  }
  if (analog.strip) strips.push(analog.strip);
  machine.cables.push(...analog.cables);
  if (iec) toIec(wires, machine.cables);
  return {
    rc, supply, phases, incoming, bus, disconnect, mainBreaker, psBranches, auxBranches, transformer, xfmrBranch, groundBar,
    motors, safety, io, groups, strips, wires, plcPart, plcTag, mainAwg, machine, auxNc, analog, drives, servos: servo.axes, hmi, fan, ladder,
  };
}

/**
 * IEC regions: the fixed AWG sizes above become the IEC size with at least the same copper (IEC
 * 60228; e.g. 14 AWG → 2,5 mm², 18 AWG → 1 mm²) and NFPA 79 colours become IEC 60204-1 §13.2 ones.
 */
function toIec(wires: WireRecord[], cables: { size: string }[]) {
  for (const w of wires) { w.color = iecColor(w.color, w.function); w.size = regionSize(w.size, 'IEC'); }
  for (const c of cables) c.size = regionSize(c.size, 'IEC');
}

function tbExternal(strips: TerminalStrip[], label: string): string {
  for (const s of strips) for (const t of s.terminals) if (t.label === label) return t.external;
  return '?';
}

// ---------------------------------------------------------------------------
// Machine (field) wiring: zones, junction boxes, cable schedule
// ---------------------------------------------------------------------------

/** Locations that mean "on the cabinet" (door devices / cabinet internals). */
const DOOR_RE = /\b(door|cabinet|enclosure|control panel)\b/i;
export const CABINET_DOOR = 'Cabinet door';
const ZONE_WORDS = ['infeed', 'outfeed', 'discharge', 'loading', 'unloading', 'pusher', 'press', 'lift', 'elevator', 'robot', 'hopper', 'feeder', 'turntable', 'transfer', 'wrapper', 'filler', 'capper', 'labeler', 'conveyor'];

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function guessZone(text: string): string | undefined {
  const t = text.toLowerCase();
  for (const w of ZONE_WORDS) if (new RegExp(`\\b${w}\\b`).test(t)) return titleCase(w);
  return undefined;
}

export interface MachineDevice {
  tag: string;
  zone: string;
  jb: string | null;
  kind: 'io' | 'motor';
  description: string;
  deviceType: FieldDeviceType | 'motor';
  points: IoPoint[];
  motor?: MotorModel;
  partNumber?: string;
  /** Cable tag that connects this device. */
  cable?: string;
  /** Zone was guessed (no explicit location). */
  guessed: boolean;
}

export interface CableCore { core: string; color: string; wire: string; from: string; to: string }

export interface Cable {
  /** "W001" */
  tag: string;
  kind: 'trunk' | 'device' | 'motor';
  zone: string;
  /** Cabinet terminal range ("TB2-1..3"), or a junction box tag. */
  from: string;
  /** Device / junction box / motor tag. */
  to: string;
  type: string;
  /** Only when the part exists in the design or catalog — never invented. */
  partNumber?: string;
  size: string;
  /** "BY SITE" unless known. */
  length: string;
  cores: CableCore[];
  spareCores: number;
}

export interface JbTerminal {
  number: number;
  /** "JB1:4" */
  label: string;
  wire: string;
  /** Incoming trunk core ("W001/5"), "JUMPER" for commoned terminals, or "". */
  incoming: string;
  /** Outgoing device cable core ("W003/BK"). */
  outgoing: string;
  device: string;
  kind: 'feed' | 'ground';
}

export interface JunctionBoxPlan {
  tag: string;
  zone: string;
  partNumber?: string | null;
  trunk?: string;
  devices: string[];
  terminals: JbTerminal[];
}

export interface MachineModel {
  wiring: MachineWiring;
  devices: MachineDevice[];
  jbs: JunctionBoxPlan[];
  cables: Cable[];
  warnings: string[];
}

interface EffectiveMachine { wiring: MachineWiring; guessed: Set<string>; warnings: string[] }

function effectiveMachine(ctx: DrawingContext, io: IoPoint[], motors: MotorModel[]): EffectiveMachine {
  const given = ctx.design.machine;
  const warnings: string[] = [];
  const guessed = new Set<string>();
  const zones: string[] = [...(given?.zones ?? [])];
  const addZone = (z: string) => { if (!zones.some((x) => x.toLowerCase() === z.toLowerCase())) zones.push(z); return zones.find((x) => x.toLowerCase() === z.toLowerCase())!; };
  const rcByTag = new Map(ctx.design.components.map((c) => [c.tag, c] as const));
  // field devices, grouped by tag
  const byTag = new Map<string, IoPoint[]>();
  for (const p of io) {
    if (p.location === 'door') { p.zone = CABINET_DOOR; continue; }
    if (p.location === 'internal') { p.zone = 'Cabinet'; continue; }
    const tag = p.deviceTag || p.address;
    byTag.set(tag, [...(byTag.get(tag) ?? []), p]);
  }
  const jbs: JunctionBox[] = given?.junctionBoxes ? [...given.junctionBoxes] : [];
  const known = (tag: string, pts: IoPoint[]) => {
    const where = pts.map((p) => p.wiring?.location?.trim()).find((l) => l && !DOOR_RE.test(l));
    const routedJb = given?.routing?.[tag] ? jbs.find((j) => j.tag === given.routing[tag]) : undefined;
    return where ?? routedJb?.location;
  };
  // explicit locations first, so guesses can join an existing zone
  for (const [tag, pts] of byTag) { const z = known(tag, pts); if (z) { const zz = addZone(z); for (const p of pts) p.zone = zz; } }
  const guessInto = (text: string): string | undefined => {
    const t = text.toLowerCase();
    const words = ZONE_WORDS.filter((w) => new RegExp(`\\b${w}\\b`).test(t));
    for (const w of words) { const z = zones.find((x) => new RegExp(`\\b${w}\\b`, 'i').test(x)); if (z) return z; }
    return guessZone(text);
  };
  for (const [tag, pts] of byTag) {
    if (pts[0].zone) continue;
    guessed.add(tag);
    const zone = addZone(guessInto(`${pts.map((p) => p.description).join(' ')} ${rcByTag.get(tag)?.function ?? ''}`) ?? 'Machine');
    for (const p of pts) p.zone = zone;
  }
  const motorLocations: Record<string, string> = {};
  for (const m of motors) {
    const t = m.motor.tag;
    let z = given?.motorLocations?.[t];
    if (!z) { guessed.add(t); z = zones.find((x) => m.motor.description.toLowerCase().includes(x.toLowerCase())) ?? guessInto(m.motor.description) ?? titleCase(m.motor.description || t); }
    motorLocations[t] = addZone(z);
  }
  // default junction boxes: one per zone with >= 4 field I/O devices
  if (!given?.junctionBoxes?.length) {
    for (const z of zones) {
      const n = [...byTag.values()].filter((pts) => pts[0].zone === z).length;
      if (n >= 4) jbs.push({ tag: `JB${jbs.length + 1}`, location: z, partNumber: null });
    }
  }
  const routing: Record<string, string | null> = {};
  for (const [tag, pts] of byTag) {
    let jb: string | null;
    if (given?.routing && tag in given.routing) {
      jb = given.routing[tag];
      if (jb && !jbs.some((j) => j.tag === jb)) { warnings.push(`Machine routing: ${tag} is routed to unknown junction box ${jb} — drawn as a home-run cable.`); jb = null; }
    } else jb = jbs.find((j) => j.location.toLowerCase() === pts[0].zone.toLowerCase())?.tag ?? null;
    routing[tag] = jb;
    for (const p of pts) p.jb = jb;
  }
  return { wiring: { zones, junctionBoxes: jbs, motorLocations, routing }, guessed, warnings };
}

const STD_CORES = [3, 4, 5, 7, 12, 18, 25, 36, 50, 65];

function rangeText(labels: string[]): string {
  const parsed = [...new Set(labels.filter(Boolean))].map((l) => { const m = /^(.*)-(\d+)$/.exec(l); return m ? { s: m[1], n: Number(m[2]) } : { s: l, n: NaN }; });
  parsed.sort((a, b) => naturalCompare(a.s, b.s) || a.n - b.n);
  const out: string[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const a = parsed[i];
    if (Number.isNaN(a.n)) { out.push(a.s); continue; }
    let j = i;
    while (j + 1 < parsed.length && parsed[j + 1].s === a.s && parsed[j + 1].n === parsed[j].n + 1) j++;
    out.push(j > i ? `${a.s}-${a.n}..${parsed[j].n}` : `${a.s}-${a.n}`);
    i = j;
  }
  return out.join(', ');
}

/** 3-wire DC devices: supply, 0 V and signal (PNP/NPN sensors, a discrete ultrasonic sensor, an encoder channel). */
const isSensor3 = (t: FieldDeviceType | 'motor') => t === 'sensor-pnp' || t === 'sensor-npn' || t === 'ultrasonic' || t === 'encoder';

/** The two sides of a limit alarm's relay 1 (a Form A contact): the catalog's terminals, else R1A / R1B. */
export function limitRelayPins(part: CatalogPart | undefined): [string, string] {
  const [a, b] = String(part?.ratings.relay1Terminals ?? '').split(/\s*-\s*/);
  return a && b ? [a, b] : ['R1A', 'R1B'];
}

function buildMachine(ctx: DrawingContext, mw: EffectiveMachine, io: IoPoint[], motors: MotorModel[], peBar: string, strips: TerminalStrip[]): MachineModel {
  const warnings = [...mw.warnings];
  const stripWire = new Map<string, string>();
  for (const s of strips) for (const t of s.terminals) stripWire.set(t.label, t.wire);
  /** Wire number of an output's return path (0V for sourcing, 24+/24+S for sinking outputs). */
  const retWire = (p: IoPoint) => (p.returnTerminal ? stripWire.get(p.returnTerminal) ?? '0V' : '0V');
  const comps = ctx.design.components;
  const partOf = (tag: string) => { const c = comps.find((x) => x.tag === tag); return c ? ctx.getPart(c.partNumber) : undefined; };
  const devices: MachineDevice[] = [];
  const byTag = new Map<string, IoPoint[]>();
  for (const p of io) if (p.location === 'field') { const t = p.deviceTag || p.address; byTag.set(t, [...(byTag.get(t) ?? []), p]); }
  for (const [tag, pts] of byTag) {
    devices.push({ tag, zone: pts[0].zone, jb: pts[0].jb, kind: 'io', description: pts.length > 1 ? (comps.find((c) => c.tag === tag)?.function ?? pts[0].description) : pts[0].description, deviceType: pts[0].deviceType, points: pts, partNumber: comps.find((c) => c.tag === tag)?.partNumber, guessed: mw.guessed.has(tag) });
  }
  for (const m of motors) devices.push({ tag: m.motor.tag, zone: mw.wiring.motorLocations[m.motor.tag], jb: null, kind: 'motor', description: m.motor.description, deviceType: 'motor', points: [], motor: m, guessed: mw.guessed.has(m.motor.tag) });

  // M12 cordset part: a cable in the design first, else one named by the device's catalog data (must exist in the catalog).
  const designCordset = comps.map((c) => ({ c, p: ctx.getPart(c.partNumber) })).find(({ p }) => p && /\bM12\b/i.test(p.description) && /cable|cordset/i.test(p.description))?.c.partNumber;
  const cordsetFor = (tag: string): string | undefined => {
    if (designCordset) return designCordset;
    const ref = String(partOf(tag)?.ratings.cable ?? '');
    for (const tok of ref.match(/[A-Z0-9]+(?:-[A-Z0-9]+)+/g) ?? []) if (ctx.getPart(tok)) return tok;
    return undefined;
  };
  const isM12 = (tag: string) => /\bM12\b/i.test(`${partOf(tag)?.ratings.connection ?? ''} ${partOf(tag)?.description ?? ''}`);

  const cables: Cable[] = [];
  const jbs: JunctionBoxPlan[] = [];
  let seq = 0;
  const nextTag = () => `W${String(++seq).padStart(3, '0')}`;

  /** Cores of the cable between `src` terminals and a field device. */
  const deviceCable = (d: MachineDevice, from: string, term: (p: IoPoint, role: 'sig' | 'sup' | 'ret') => string): Cable => {
    const tag = nextTag();
    const cores: CableCore[] = [];
    const t = d.deviceType;
    const p0 = d.points[0];
    let type: string;
    let partNumber: string | undefined;
    if (t === 'encoder') {
      // Encoder: shielded, one core per channel plus supply; the shield is grounded at the cabinet end only.
      cores.push({ core: '1', color: 'BN', wire: '24+', from: term(p0, 'sup'), to: `${d.tag}:+V` });
      cores.push({ core: '2', color: 'WH', wire: '0V', from: term(p0, 'ret'), to: `${d.tag}:0V` });
      d.points.forEach((p, k) => cores.push({ core: String(k + 3), color: ['GN', 'YE', 'GY', 'PK'][k] ?? 'BK', wire: p.wire, from: term(p, 'sig'), to: `${d.tag}:${encoderChannel(p.description) ?? 'A'}` }));
      cores.push({ core: 'SH', color: 'shield', wire: 'SH', from: 'PE (cabinet end only)', to: `${d.tag}: not connected` });
      type = `${cores.length - 1}-core 24 AWG shielded encoder cable (twisted pairs, overall shield) — keep away from motor power cables`;
    } else if (isSensor3(t)) {
      cores.push({ core: '1', color: 'BN', wire: '24+', from: term(p0, 'sup'), to: `${d.tag}:1` });
      cores.push({ core: '3', color: 'BU', wire: '0V', from: term(p0, 'ret'), to: `${d.tag}:3` });
      cores.push({ core: '4', color: 'BK', wire: p0.wire, from: term(p0, 'sig'), to: `${d.tag}:4` });
      if (isM12(d.tag)) { type = 'M12 4-pin cordset, female straight to flying leads'; partNumber = cordsetFor(d.tag); }
      else if (/pigtail|integral cable/i.test(`${partOf(d.tag)?.ratings.connection ?? ''}`)) type = 'Integral sensor pigtail (BN/BU/BK) — check length, extend in JB';
      else type = '3-core 18 AWG sensor cable (BN/BU/BK)';
    } else if (p0.type === 'input') {
      const sw = p0.supplyWire ?? '24+';
      cores.push({ core: '1', color: sw === '0V' ? 'WH/BU' : 'BU', wire: sw, from: term(p0, 'sup'), to: `${d.tag}:${p0.inPins?.[0] ?? 'C'}` });
      // one signal core per input of the device (the terminal name matches the wire list)
      d.points.forEach((p, k) => cores.push({ core: String(k + 2), color: 'BU', wire: p.wire, from: term(p, 'sig'), to: `${d.tag}:${p.inPins?.[1] ?? 'NO'}` }));
      cores.push({ core: 'PE', color: 'GN/YE', wire: 'PE', from: from !== 'CABINET' ? `${from}:PE` : 'PE', to: `${d.tag}:PE` });
      type = `${cores.length}-core 18 AWG control cable (${cores.length - 1} + PE)`;
    } else {
      const stack = t === 'stack-light';
      // the wire number on the device's terminal (a coil behind a safety contact carries the chain's number)
      const sigWire = (p: IoPoint) => (p.signalTerminal ? stripWire.get(p.signalTerminal) ?? p.wire : p.wire);
      d.points.forEach((p, k) => cores.push({ core: String(k + 1), color: 'BU', wire: sigWire(p), from: term(p, 'sig'), to: `${d.tag}:${stack && d.points.length > 1 ? (p.description.match(/red|amber|yellow|green|blue|white|horn|buzzer/i)?.[0] ?? p.address).toUpperCase() : p.pins[0]}` }));
      // return cores: a stack light's common; otherwise one per return terminal (each coil of a double solenoid)
      const rets = stack && d.points.length > 1 ? [{ p: p0, to: 'COM' }]
        : [...new Map(d.points.map((p) => [p.returnTerminal ?? p.address, p] as const)).values()].map((p) => ({ p, to: d.points.filter((q) => (q.returnTerminal ?? q.address) === (p.returnTerminal ?? p.address)).map((q) => q.pins[1]).join('+') }));
      for (const r of rets) {
        const rw = retWire(r.p);
        cores.push({ core: String(cores.length + 1), color: rw === '0V' ? 'WH/BU' : 'BU', wire: rw, from: term(r.p, 'ret'), to: `${d.tag}:${r.to}` });
      }
      cores.push({ core: 'PE', color: 'GN/YE', wire: 'PE', from: from !== 'CABINET' ? `${from}:PE` : 'PE', to: `${d.tag}:PE` });
      type = `${cores.length}-core 18 AWG control cable (${cores.length - 1} + PE)${t === 'solenoid' ? ', DIN plug end' : ''}`;
    }
    return { tag, kind: 'device', zone: d.zone, from, to: d.tag, type, partNumber, size: '18 AWG', length: 'BY SITE', cores, spareCores: 0 };
  };

  for (const zone of mw.wiring.zones) {
    const zDevices = devices.filter((d) => d.zone === zone);
    // junction boxes of this zone
    for (const jb of mw.wiring.junctionBoxes.filter((j) => j.location.toLowerCase() === zone.toLowerCase())) {
      const ds = zDevices.filter((d) => d.kind === 'io' && d.jb === jb.tag);
      if (!ds.length) { jbs.push({ tag: jb.tag, zone, partNumber: jb.partNumber, devices: [], terminals: [] }); continue; }
      const trunkTag = nextTag();
      const terms: JbTerminal[] = [];
      const addT = (t: Omit<JbTerminal, 'number' | 'label'>) => { const n = terms.length + 1; terms.push({ number: n, label: `${jb.tag}:${n}`, ...t }); return `${jb.tag}:${n}`; };
      const trunk: CableCore[] = [];
      const firstOf = new Map<string, string>();
      const landed = new Map<string, string>();
      const devCables: Cable[] = [];
      for (const d of ds) {
        const roles = new Map<string, string>();
        for (const p of d.points) {
          // the number on the strip terminal (a coil behind a safety contact carries the chain's number, e.g. Y001A)
          const w = p.type === 'output' && p.signalTerminal ? stripWire.get(p.signalTerminal) ?? p.wire : p.wire;
          roles.set(`sig:${p.address}`, addT({ wire: w, incoming: '', outgoing: '', device: d.tag, kind: 'feed' }));
          trunk.push({ core: String(trunk.length + 1), color: 'BU', wire: w, from: p.signalTerminal ?? '?', to: roles.get(`sig:${p.address}`)! });
          terms[terms.length - 1].incoming = `${trunkTag}/${trunk.length}`;
        }
        const p0 = d.points[0];
        // outputs: one JB terminal per return wire (the coils of a double solenoid may return on different wires)
        const commons: [string, 'sup' | 'ret', IoPoint][] = p0.type === 'input' ? [[isSensor3(d.deviceType) ? '24+' : p0.supplyWire ?? '24+', 'sup', p0], ...(isSensor3(d.deviceType) ? [['0V', 'ret', p0] as [string, 'ret', IoPoint]] : [])]
          : [...new Map(d.points.map((p) => [retWire(p), p] as const)).entries()].map(([w, p]) => [w, 'ret', p] as [string, 'ret', IoPoint]);
        for (const [w, role, pc] of commons) {
          const lab = addT({ wire: w, incoming: '', outgoing: '', device: d.tag, kind: 'feed' });
          roles.set(role === 'ret' && p0.type === 'output' ? `ret:${w}` : role, lab);
          const cabTerm = role === 'sup' ? pc.supplyTerminal : pc.returnTerminal;
          if (!firstOf.has(w)) {
            firstOf.set(w, lab);
            trunk.push({ core: String(trunk.length + 1), color: w === '0V' ? 'WH/BU' : 'BU', wire: w, from: cabTerm ?? `TB1 ${w}`, to: lab });
            terms[terms.length - 1].incoming = `${trunkTag}/${trunk.length}`;
            landed.set(w, lab);
          } else terms[terms.length - 1].incoming = `JUMPER ${firstOf.get(w)}`;
        }
        const c = deviceCable(d, jb.tag, (p, role) => (role === 'sig' ? roles.get(`sig:${p.address}`) : role === 'ret' && p.type === 'output' ? roles.get(`ret:${retWire(p)}`) : roles.get(role)) ?? '?');
        d.cable = c.tag;
        for (const core of c.cores) { const t = terms.find((x) => x.label === core.from); if (t) t.outgoing = `${c.tag}/${core.color === 'GN/YE' ? 'PE' : core.core}`; }
        devCables.push(c);
      }
      const pe = addT({ wire: 'PE', incoming: '', outgoing: devCables.filter((c) => c.cores.some((k) => k.wire === 'PE')).map((c) => `${c.tag}/PE`).join(', '), device: 'PE', kind: 'ground' });
      trunk.push({ core: 'PE', color: 'GN/YE', wire: 'PE', from: peBar, to: pe });
      terms[terms.length - 1].incoming = `${trunkTag}/PE`;
      for (const c of devCables) for (const k of c.cores) if (k.from === 'PE' || k.from === `${jb.tag}:PE`) k.from = pe;
      const need = trunk.length;
      const std = STD_CORES.find((n) => n >= Math.ceil(need * 1.1)) ?? need;
      const cabTerms = trunk.filter((k) => k.wire !== 'PE').map((k) => k.from);
      cables.push({ tag: trunkTag, kind: 'trunk', zone, from: rangeText(cabTerms), to: jb.tag, type: `${std}-core 18 AWG multi-conductor control cable, numbered cores + GN/YE`, size: '18 AWG', length: 'BY SITE', cores: trunk, spareCores: std - need });
      cables.push(...devCables);
      jbs.push({ tag: jb.tag, zone, partNumber: jb.partNumber, trunk: trunkTag, devices: ds.map((d) => d.tag), terminals: terms });
    }
    // home-run devices
    for (const d of zDevices.filter((x) => x.kind === 'io' && !x.jb)) {
      const c = deviceCable(d, 'CABINET', (p, role) => (role === 'sig' ? p.signalTerminal : role === 'sup' ? p.supplyTerminal : p.returnTerminal) ?? '?');
      const st = strips.find((x) => x.tag === (d.points[0].signalTerminal ?? '').split('-')[0]);
      const stripPe = (st?.terminals.find((t) => t.kind === 'ground' && t.group === d.tag) ?? st?.terminals.find((t) => t.kind === 'ground'))?.label;
      for (const k of c.cores) if (k.from === 'PE') k.from = stripPe ?? peBar;
      c.from = rangeText(c.cores.map((k) => k.from).filter((f) => /^TB\d+-\d+$/.test(f)));
      d.cable = c.tag;
      cables.push(c);
    }
    // motors
    for (const d of zDevices.filter((x) => x.kind === 'motor')) {
      const m = d.motor!;
      const tag = nextTag();
      const cores: CableCore[] = m.loadWires.map((w, k) => ({ core: String(k + 1), color: w === 'N' ? 'WH' : 'BK', wire: w, from: m.terminals[k] ?? '?', to: `${m.motor.tag}:T${k + 1}` }));
      cores.push({ core: 'PE', color: 'GN/YE', wire: 'PE', from: m.peTerminal ?? peBar, to: `${m.motor.tag}:PE` });
      const n = cores.length;
      cables.push({
        tag, kind: 'motor', zone, from: rangeText([...m.terminals, m.peTerminal ?? '']), to: m.motor.tag,
        type: m.vfd ? `${n}-core ${m.awg} VFD-rated shielded motor cable (${n - 1} + PE), 600V` : `${n}-core ${m.awg} power cable (${n - 1} + PE), 600V TC-ER`,
        size: m.awg, length: 'BY SITE', cores, spareCores: 0,
      });
      d.cable = tag;
    }
  }

  // Servo motors: the maker's power and feedback cables, drive to motor (plugged, no terminals in between).
  for (const c of comps) {
    const part = ctx.getPart(c.partNumber);
    const k = servoCableKind(part);
    if (!k) continue;
    const drive = comps.find((x) => x.motorTag === c.motorTag && isServoDrive(ctx.getPart(x.partNumber)));
    const motor = comps.find((x) => x.motorTag === c.motorTag && isServoMotor(ctx.getPart(x.partNumber)));
    if (!drive || !motor) continue;
    const power = k === 'power';
    const cores: CableCore[] = k === 'brake' ? [{ core: '1', color: "maker's", wire: 'BRK+', from: `${drive.tag} brake supply`, to: `${motor.tag}:BRAKE1` }, { core: '2', color: "maker's", wire: 'BRK-', from: `${drive.tag} brake supply`, to: `${motor.tag}:BRAKE2` }]
      : power
      ? [...['U', 'V', 'W'].map((u, i) => ({ core: String(i + 1), color: 'BK', wire: `${drive.tag}-${u}`, from: `${drive.tag}:${u}`, to: `${motor.tag}:${u}` })), { core: 'PE', color: 'GN/YE', wire: 'PE', from: `${drive.tag}:PE`, to: `${motor.tag}:PE` }]
      : [{ core: 'all', color: "maker's", wire: 'ENC', from: `${drive.tag}:CN2`, to: `${motor.tag}:ENC` }];
    const len = num(part?.ratings, 'lengthM');
    cables.push({ tag: nextTag(), kind: 'motor', zone: 'Machine', from: `${drive.tag}:${power ? 'U/V/W' : 'CN2'}`, to: motor.tag, type: `${power ? 'Servo motor power cable' : k === 'brake' ? 'Servo brake cable' : 'Servo encoder feedback cable'} (maker's, plugged both ends${/yes/i.test(String(part?.ratings.flex ?? '')) ? ', flex' : ''})`, partNumber: c.partNumber, size: power ? '16 AWG' : '—', length: len ? `${len} m` : 'BY SITE', cores, spareCores: 0 });
  }

  const guessedDev = devices.filter((d) => d.kind === 'io' && d.guessed).map((d) => d.tag);
  const guessedMot = devices.filter((d) => d.kind === 'motor' && d.guessed).map((d) => d.tag);
  if (guessedDev.length) warnings.push(`Machine wiring: ${guessedDev.length} field device(s) have no location (${guessedDev.slice(0, 8).join(', ')}${guessedDev.length > 8 ? '…' : ''}) — zone guessed from the description; set IOWiring.location.`);
  if (guessedMot.length) warnings.push(`Machine wiring: motor location not given for ${guessedMot.join(', ')} — zone guessed; set machine.motorLocations.`);
  for (const j of jbs) {
    if (!j.devices.length) warnings.push(`Junction box ${j.tag} (${j.zone}) has no devices routed to it.`);
    if (!j.partNumber) warnings.push(`Junction box ${j.tag} (${j.zone}): enclosure part not selected (${j.terminals.length} terminals required).`);
  }
  // Cable lengths from the machine layout: routed length + slack + a service loop at each end.
  const ml = ctx.machineLayout;
  if (ml) {
    const jbTags = new Set(jbs.map((j) => j.tag));
    const onManifold = new Map(ml.manifolds.flatMap((mf) => mf.valves.map((v) => [v, mf] as const)));
    const at = (tag: string): [number, number] | null => {
      const mf = onManifold.get(tag);
      if (mf) return [mf.x, mf.y];
      const p = ml.pos[tag];
      return p ? [p.x, p.y] : null;
    };
    for (const c of cables) {
      const from = c.kind === 'device' && jbTags.has(c.from) ? at(c.from) : at(CABINET);
      const to = at(c.to);
      if (!from || !to) continue;
      c.length = lengthText(withService(routedLength(from, to, ml.routes).len, ml.service));
    }
    const unplaced = cables.filter((c) => c.length === 'BY SITE').map((c) => c.to);
    if (unplaced.length && unplaced.length < cables.length) warnings.push(`Machine layout: ${unplaced.length} cable end(s) not placed (${unplaced.slice(0, 8).join(', ')}${unplaced.length > 8 ? '…' : ''}) — their lengths stay "by site".`);
  }
  if (cables.some((c) => c.length === 'BY SITE')) warnings.push('Cable lengths are "by site": measure routes and add service loops before ordering cable.');
  const tooBig = cables.filter((c) => c.kind === 'trunk' && c.cores.length > 36);
  if (tooBig.length) warnings.push(`Trunk cable(s) ${tooBig.map((c) => c.tag).join(', ')} exceed 36 cores — consider splitting the junction box.`);
  return { wiring: mw.wiring, devices, jbs, cables, warnings };
}

// ---------------------------------------------------------------------------
// Public derivations
// ---------------------------------------------------------------------------

/** All wire segments (from/to) with wire number, NFPA 79 color and suggested size. */
export function wireNumbers(ctx: DrawingContext): WireRecord[] {
  return buildModel(ctx).wires;
}

/** Terminal strips TB1 (power/24V distribution), TB2 (field inputs), TB3 (field outputs). */
export function terminalPlan(ctx: DrawingContext): TerminalStrip[] {
  return buildModel(ctx).strips;
}

export interface BomLine {
  item: number;
  qty: number;
  partNumber: string;
  manufacturer: string;
  description: string;
  tags: string[];
  category: CatalogCategory | 'note';
  /** Derived note line without a part number (never invented). */
  note?: boolean;
}
export interface BomGroup { category: CatalogCategory | 'note'; title: string; lines: BomLine[] }

const CAT_TITLES: Record<CatalogCategory, string> = {
  enclosure: 'Enclosure', disconnect: 'Disconnect', breaker: 'Circuit breakers', fuse: 'Fuses & fuse holders', powerSupply: 'Power supplies',
  contactor: 'Contactors', overload: 'Overload relays', motorProtector: 'Motor protectors', vfd: 'Variable frequency drives',
  relay: 'Relays', safetyRelay: 'Safety relays', terminal: 'Terminal blocks', terminalAccessory: 'Terminal accessories',
  pushbutton: 'Pushbuttons', estop: 'Emergency stops', pilotLight: 'Pilot lights', selector: 'Selector switches', stackLight: 'Stack lights',
  plc: 'PLC', plcModule: 'PLC I/O modules', hmi: 'HMI', sensor: 'Sensors', solenoidValve: 'Solenoid valves', dinRail: 'DIN rail',
  wireDuct: 'Wire duct', groundBar: 'Ground bars', fan: 'Fans & filters', other: 'Miscellaneous',
  servoDrive: 'Servo drives', servoMotor: 'Servo motors', encoder: 'Encoders',
};
const CAT_ORDER: CatalogCategory[] = ['enclosure', 'disconnect', 'breaker', 'fuse', 'motorProtector', 'contactor', 'overload', 'vfd', 'servoDrive', 'powerSupply',
  'plc', 'plcModule', 'hmi', 'safetyRelay', 'relay', 'estop', 'pushbutton', 'selector', 'pilotLight', 'stackLight', 'sensor', 'encoder', 'servoMotor', 'solenoidValve',
  'terminal', 'terminalAccessory', 'groundBar', 'dinRail', 'wireDuct', 'fan', 'other'];

export function categoryTitle(c: CatalogCategory | 'note'): string { return c === 'note' ? 'Derived quantities (part to be selected)' : CAT_TITLES[c]; }

/** Terminal counts implied by the terminal plan. */
export function terminalCounts(ctx: DrawingContext) {
  const strips = terminalPlan(ctx);
  let feed = 0, ground = 0, fused = 0, endPlates = 0, endStops = 0;
  for (const s of strips) {
    for (const t of s.terminals) if (t.kind === 'ground') ground++; else if (t.fuse) fused++; else feed++;
    endPlates += s.endPlates; endStops += s.endStops;
  }
  return { feed, ground, fused, endPlates, endStops };
}

export function billOfMaterials(ctx: DrawingContext): BomGroup[] {
  const m = buildModel(ctx);
  const tc = terminalCounts(ctx);
  const lines = new Map<string, BomLine>();
  const notesFromLayout: BomLine[] = [];
  for (const c of m.rc) {
    const key = `${c.category}|${c.partNumber}`;
    const l = lines.get(key);
    if (l) { l.qty += c.comp.quantity; l.tags.push(c.tag); continue; }
    lines.set(key, {
      item: 0, qty: c.comp.quantity, partNumber: c.partNumber, manufacturer: c.part?.manufacturer ?? '',
      // Read from a photo of an existing cabinet: say so right by the part number.
      description: `${c.part?.description ?? `${c.comp.function} (part not found in catalog — verify)`}${c.part && /as-built from photos/i.test(c.comp.function) ? ' — from photo, verify' : ''}`, tags: [c.tag], category: c.category,
    });
  }
  // Accepted machine-layout suggestions: parts still to be selected (never an invented part number).
  for (const mf of ctx.machineLayout?.manifolds ?? []) notesFromLayout.push({ item: 0, qty: 1, partNumber: '', manufacturer: '', description: `Valve manifold ${mf.tag}: ${mf.valves.length} stations for ${mf.valves.join(', ')} (machine layout) — part to be selected`, tags: [mf.tag], category: 'note', note: true });
  for (const r of ctx.machineLayout?.remoteIo ?? []) notesFromLayout.push({ item: 0, qty: 1, partNumber: '', manufacturer: '', description: `Remote I/O / IO-Link block ${r.tag} for ${r.devices.length} devices near ${r.devices.slice(0, 4).join(', ')}${r.devices.length > 4 ? '…' : ''} (machine layout) — part to be selected`, tags: [r.tag], category: 'note', note: true });
  // Contactors without an internal auxiliary contact need an add-on block for the EDM / interlock N.C. contact.
  const auxMissing = [...m.auxNc].filter(([, a]) => a.missing).map(([tag]) => tag);
  if (auxMissing.length) {
    const key = 'other|SZ-A11T';
    const why = `added for ${auxMissing.join(', ')}: the contactor has no built-in auxiliary contact; its N.C. 61-62 is used for ${m.safety.edm.some((t) => auxMissing.includes(t)) ? 'the safety relay feedback (EDM)' : 'the reversing interlock'}`;
    const l = lines.get(key);
    if (l) { l.qty += auxMissing.length; l.description += ` — ${why}`; }
    else lines.set(key, { item: 0, qty: auxMissing.length, partNumber: 'SZ-A11T', manufacturer: ctx.getPart('SZ-A11T')?.manufacturer ?? 'Fuji Electric', description: `${ctx.getPart('SZ-A11T')?.description ?? 'Contactor auxiliary contact block, front mount, (1) N.O./(1) N.C.'} — ${why}`, tags: auxMissing.map((t) => `${t}-AUX`), category: 'other' });
  }
  // The project HMI (chosen on the HMI page) is on the door even when the design has no HMI component.
  if (ctx.hmiPartNumber && !m.rc.some((c) => c.category === 'hmi' || c.partNumber === ctx.hmiPartNumber)) {
    const h = getHmi(ctx.hmiPartNumber);
    lines.set(`hmi|${ctx.hmiPartNumber}`, { item: 0, qty: 1, partNumber: ctx.hmiPartNumber, manufacturer: h ? hmiMaker(h) : 'AutomationDirect', description: h?.description ?? 'Operator touch panel', tags: ['HMI1'], category: 'hmi' });
  }
  const notes: BomLine[] = [...notesFromLayout];
  const all = [...lines.values()];
  const isGround = (l: BomLine) => /ground|pe\b|earth/i.test(`${l.description} ${ctx.getPart(l.partNumber)?.ratings?.type ?? ''}`);
  const feedLine = all.find((l) => l.category === 'terminal' && !isGround(l) && !/fused terminal/i.test(l.description));
  const groundLine = all.find((l) => l.category === 'terminal' && isGround(l));
  const acc = all.filter((l) => l.category === 'terminalAccessory');
  const endPlateLine = acc.find((l) => /end (cover|plate|barrier)/i.test(l.description));
  const endStopLine = acc.find((l) => /end (stop|bracket|clamp|anchor)/i.test(l.description));
  const apply = (line: BomLine | undefined, n: number, what: string) => {
    if (n <= 0) return;
    if (line) { if (line.qty < n) line.qty = n; line.description += ` — ${n} required by terminal plan`; }
    else notes.push({ item: 0, qty: n, partNumber: '', manufacturer: '', description: `${what}: ${n} required (select part)`, tags: [], category: 'note', note: true });
  };
  apply(feedLine, tc.feed, 'Feed-through terminal blocks');
  if (tc.fused && !all.some((l) => /fused terminal/i.test(l.description))) {
    const fp = ctx.getPart('DN-F6L24');
    const fused = m.strips.flatMap((st) => st.terminals.filter((t) => t.fuse));
    const tags = fused.map((t) => t.label);
    const sizes = [...new Set(fused.map((t) => t.fuse))].map((f) => `${f} (${fused.filter((t) => t.fuse === f).map((t) => t.label).join(', ')})`).join(', ');
    const line: BomLine = { item: 0, qty: tc.fused, partNumber: fp ? fp.partNumber : '', manufacturer: fp?.manufacturer ?? '', description: `${fp?.description ?? 'Fused terminal block with blown-fuse LED'} — ${tc.fused} used; fit time-delay 1/4x1-1/4in fuses: ${sizes}`, tags, category: fp ? 'terminal' : 'note', note: !fp };
    (fp ? all : notes).push(line);
  }
  if (m.hmi) notes.push({ item: 0, qty: 1, partNumber: '', manufacturer: '', description: m.hmi.link === 'ethernet' ? `Shielded Cat6 Ethernet patch cable ${m.plcTag} to ${m.hmi.tag}, length for the door hinge loop (select part)` : `RS-232 programming/communication cable ${m.plcTag} port 2 to ${m.hmi.tag} (select part per HMI manual)`, tags: [m.hmi.tag], category: 'note', note: true });
  apply(groundLine, tc.ground, 'Ground (PE) terminal blocks');
  apply(endPlateLine, tc.endPlates, 'Terminal end plates');
  apply(endStopLine, tc.endStops, 'Terminal end stops');
  const layout = panelLayout(ctx);
  const railMm = Math.ceil(layout.rails.reduce((s, r) => s + r.w, 0));
  const ductMm = Math.ceil(layout.ducts.reduce((s, d) => s + Math.max(d.w, d.h), 0));
  if (!all.some((l) => l.category === 'dinRail') && railMm) notes.push({ item: 0, qty: 1, partNumber: '', manufacturer: '', description: `35mm DIN rail: approx. ${railMm} mm total (select part)`, tags: [], category: 'note', note: true });
  if (!all.some((l) => l.category === 'wireDuct') && ductMm) notes.push({ item: 0, qty: 1, partNumber: '', manufacturer: '', description: `Wire duct + cover: approx. ${ductMm} mm total (select part)`, tags: [], category: 'note', note: true });
  if (!m.groundBar) notes.push({ item: 0, qty: 1, partNumber: '', manufacturer: '', description: 'Ground (PE) bar kit (select part)', tags: [], category: 'note', note: true });

  const groups: BomGroup[] = [];
  for (const cat of CAT_ORDER) {
    const ls = all.filter((l) => l.category === cat).sort((a, b) => naturalCompare(a.tags[0] ?? '', b.tags[0] ?? ''));
    if (ls.length) groups.push({ category: cat, title: CAT_TITLES[cat], lines: ls });
  }
  if (notes.length) groups.push({ category: 'note', title: categoryTitle('note'), lines: notes });
  let item = 1;
  for (const g of groups) for (const l of g.lines) { l.item = item++; l.tags.sort(naturalCompare); }
  return groups;
}

// ---------------------------------------------------------------------------
// Panel layout
// ---------------------------------------------------------------------------

export interface Rect { x: number; y: number; w: number; h: number }
export interface PlacedItem extends Rect {
  tag: string;
  partNumber: string;
  category: CatalogCategory;
  label: string;
  estimated: boolean;
  /** Stacked sub-items (direct-mount overload under a contactor). */
  sub?: PlacedItem[];
  /** Extra spacing before this item when a group shares the previous rail. */
  gapLeft?: number;
}
export interface DoorItem {
  tag: string;
  partNumber: string;
  kind: 'pushbutton' | 'estop' | 'pilot' | 'selector' | 'hmi' | 'other';
  cx: number;
  cy: number;
  /** Operator diameter (22mm devices) or HMI w/h. */
  w: number;
  h: number;
  legend: string[];
  color: string;
  estimated: boolean;
  /** Panel cutout for HMIs (catalog value when verified). */
  cutout?: { w: number; h: number; verified: boolean };
}
export interface PanelLayout {
  /** Outer enclosure size (mm). */
  enclosure: { w: number; h: number; d?: number; partNumber?: string; tag?: string; estimated: boolean };
  /** Back panel (subpanel) placed centred in the enclosure. */
  backplate: Rect & { estimated: boolean; partNumber?: string; tag?: string };
  rails: Rect[];
  ducts: (Rect & { orientation: 'h' | 'v' })[];
  items: PlacedItem[];
  /** Mounted elsewhere (fans, side-mounted) — listed only. */
  unplaced: { tag: string; partNumber: string; reason: string }[];
  /** Back-panel parts that could not be placed inside the back panel. */
  notFit: { tag: string; partNumber: string; w: number; h: number }[];
  overflow: boolean;
  door: {
    w: number; h: number; items: DoorItem[]; overflow: boolean; handle?: { tag: string; partNumber: string; cx: number; cy: number };
    /** Door leaves left to right (one, or two meeting at the centre); `leaf` holds the HMI, operators and handle. */
    leaves: { x0: number; x1: number }[]; leaf: number;
    /** Floor-standing enclosure: height of the floor stands under it (0 = sits on the floor), mm. */
    plinth?: number;
  };
  warnings: string[];
}

/** Realistic default footprints (W x H mm) by category, used when the catalog has no dimensions. */
const DEFAULT_DIMS: Partial<Record<CatalogCategory, [number, number]>> = {
  disconnect: [54, 90], breaker: [18, 90], fuse: [18, 85], motorProtector: [45, 90], contactor: [45, 75], overload: [45, 70],
  vfd: [100, 180], powerSupply: [50, 125], plc: [60, 90], plcModule: [25, 90], relay: [16, 80], safetyRelay: [23, 100],
  groundBar: [100, 25], other: [50, 50], terminal: [6.2, 50], hmi: [200, 150],
};

function dims(c: ResolvedComponent): { w: number; h: number; estimated: boolean } {
  const pw = c.part?.widthMm, ph = c.part?.heightMm;
  if (pw && ph) return { w: pw, h: ph, estimated: false };
  const d = DEFAULT_DIMS[c.category] ?? [50, 50];
  let w = pw ?? d[0];
  if (!pw && (c.category === 'breaker' || c.category === 'fuse')) w = d[0] * poles(c, c.comp.motorTag ? 3 : 2);
  return { w, h: ph ?? d[1], estimated: true };
}

const inMm = (v: number | undefined) => (v === undefined ? undefined : v * 25.4);

/** Subpanels are catalogued as enclosures with ratings.kind = 'subpanel'. */
export function isSubpanel(c: ResolvedComponent): boolean {
  return c.category === 'enclosure' && (str(c.part?.ratings, 'kind') === 'subpanel' || /\b(sub ?panel|back ?panel)\b/i.test(c.part?.description ?? '') && !/enclosure/i.test(c.part?.description ?? ''));
}

/** Accessories that are not drawn as back-panel components (shafts, handles, jumpers, markers, end covers...). */
export function isLayoutAccessory(c: ResolvedComponent): boolean {
  if (['enclosure', 'dinRail', 'wireDuct', 'terminal', 'terminalAccessory'].includes(c.category)) return true;
  if (isFuseCartridge(c)) return true;
  if (c.mount !== 'backplate') return true;
  // Plug into the CPU (memory cards, plug-in I/O modules); no place of their own on the back panel.
  if (/\bmemory card\b/i.test(c.part?.description ?? '') || /plug-in slot/i.test(String(c.part?.ratings.forUse ?? ''))) return true;
  if (num(c.part?.ratings, 'lengthMm') !== undefined && c.category !== 'groundBar') return true;
  const ACC = /^(disconnect |terminal |din rail |terminal block |contactor auxiliary )?(shaft|external (rotary )?handle|handle|contact block|jumper|marker|marking tags?|end cover|end plate|end stop|end bracket|end anchor)\b/i;
  return ACC.test(c.part?.description ?? '') || ACC.test(c.comp.function);
}

const RAIL_H = 35;
const CLEAR = 10;
const MARGIN = 10;
/** Height a direct-mount overload adds below its contactor when the catalog has no height. */
const OL_STACK_H = 50;
const GAP = 4;
/** Parts at least this tall get their own column when the rails overflow (mm). */
const TALL_MM = 140;

/** Layout group of a category (breakers / fuses together, PLC + modules together). */
const grpOf = (c: CatalogCategory) => (c === 'breaker' || c === 'fuse' ? 'cb' : c === 'plc' || c === 'plcModule' ? 'plc' : c);

/** Breakers sit side by side and CLICK modules snap onto the CPU: no gap inside those groups. */
function gapBefore(prev: PlacedItem | undefined, it: PlacedItem): number {
  if (!prev) return 0;
  const grp = (c: CatalogCategory) => (c === 'breaker' || c === 'fuse' ? 'cb' : c === 'plc' || c === 'plcModule' ? 'plc' : c);
  if (grp(prev.category) === grp(it.category) && (grp(it.category) === 'cb' || grp(it.category) === 'plc')) return 0;
  if (prev.category === 'terminal' && it.category === 'terminal') return 10;
  return GAP;
}

export function panelLayout(ctx: DrawingContext): PanelLayout {
  const m = buildModel(ctx);
  const warnings: string[] = [];
  const encs = byCat(m.rc, 'enclosure');
  const enc = encs.find((c) => !isSubpanel(c));
  const sub = encs.find((c) => isSubpanel(c));
  const er = enc?.part?.ratings;
  // Outer enclosure: ratings in inches first (catalog widthMm/heightMm may be the usable subpanel size).
  let encW = inMm(num(er, 'widthIn')) ?? enc?.part?.widthMm;
  let encH = inMm(num(er, 'heightIn')) ?? enc?.part?.heightMm;
  let encEst = false;
  if (!encW || !encH) {
    encW = 610; encH = 762; encEst = true;
    warnings.push(enc ? `Enclosure ${enc.partNumber}: dimensions missing — layout uses an estimated 24" x 30" (610 x 762 mm).` : 'No enclosure part in the design — layout uses an estimated 24" x 30" (610 x 762 mm) enclosure.');
  }
  // Back panel: subpanel part > enclosure panel ratings > enclosure widthMm/heightMm (when outer size came from inches) > estimate.
  const sr = sub?.part?.ratings;
  let bpW = inMm(num(sr, 'widthIn')) ?? sub?.part?.widthMm ?? inMm(num(er, 'panelWidthIn')) ?? num(er, 'backPanelWidthMm', 'panelWidthMm', 'subpanelWidthMm');
  let bpH = inMm(num(sr, 'heightIn')) ?? sub?.part?.heightMm ?? inMm(num(er, 'panelHeightIn')) ?? num(er, 'backPanelHeightMm', 'panelHeightMm', 'subpanelHeightMm');
  if ((!bpW || !bpH) && num(er, 'widthIn') !== undefined && enc?.part?.widthMm && enc.part.heightMm) { bpW = enc.part.widthMm; bpH = enc.part.heightMm; }
  const bpEst = !bpW || !bpH;
  if (bpEst) { bpW = encW - 76; bpH = encH - 76; if (!encEst) warnings.push(`Back-panel size not in catalog data for ${enc?.partNumber ?? 'enclosure'} — estimated as enclosure minus 76 mm (3").`); }
  bpW = Math.min(bpW!, encW); bpH = Math.min(bpH!, encH);
  const backplate = { x: (encW - bpW) / 2, y: (encH - bpH) / 2, w: bpW, h: bpH, estimated: bpEst, partNumber: sub?.partNumber, tag: sub?.tag };
  const ductPart = m.rc.find((c) => c.category === 'wireDuct');
  const DUCT = ductPart?.part?.widthMm ?? inMm(num(ductPart?.part?.ratings, 'widthIn')) ?? 40;

  const bp = m.rc.filter((c) => !isLayoutAccessory(c));
  const unplaced: PanelLayout['unplaced'] = [];
  const mk = (c: ResolvedComponent): PlacedItem => {
    const d = dims(c);
    return { tag: c.tag, partNumber: c.partNumber, category: c.category, label: c.tag, estimated: d.estimated, x: 0, y: 0, w: d.w, h: d.h };
  };
  const expand = (c: ResolvedComponent): PlacedItem[] => Array.from({ length: Math.max(1, Math.min(c.comp.quantity, 20)) }, (_, k) => {
    const it = mk(c);
    if (c.comp.quantity > 1) it.label = `${c.tag}${k > 0 ? `.${k + 1}` : ''}`;
    return it;
  });
  const rows: PlacedItem[][] = [[], [], [], []];
  const groundBars: PlacedItem[] = [];
  const sortKey = (c: ResolvedComponent) => {
    const order: CatalogCategory[] = ['disconnect', 'breaker', 'fuse', 'powerSupply', 'plc', 'plcModule', 'motorProtector', 'contactor', 'vfd', 'safetyRelay', 'relay', 'other'];
    const i = order.indexOf(c.category);
    return i < 0 ? 99 : i;
  };
  const used = new Set<ResolvedComponent>();
  const sortedBp = [...bp].sort((a, b) => sortKey(a) - sortKey(b) || (a === m.mainBreaker ? -1 : b === m.mainBreaker ? 1 : naturalCompare(a.tag, b.tag)));
  for (const c of sortedBp) {
    if (used.has(c)) continue;
    used.add(c);
    if (c.category === 'fan') { unplaced.push({ tag: c.tag, partNumber: c.partNumber, reason: 'Enclosure side/door mounted' }); continue; }
    if (c.category === 'overload' && bp.some((x) => x.category === 'contactor' && x.comp.motorTag && x.comp.motorTag === c.comp.motorTag)) continue;
    if (c.category === 'groundBar') groundBars.push(...expand(c));
    else if (['disconnect', 'breaker', 'fuse'].includes(c.category)) rows[0].push(...expand(c));
    else if (['powerSupply', 'plc', 'plcModule'].includes(c.category)) rows[1].push(...expand(c));
    else if (c.category === 'contactor') {
      const it = mk(c);
      const ol = bp.find((x) => x.category === 'overload' && x.comp.motorTag && x.comp.motorTag === c.comp.motorTag);
      const mm = m.motors.find((x) => x.motor.tag === c.comp.motorTag);
      const isRev = mm && mm.contactors[1]?.tag === c.tag;
      if (ol && !isRev) {
        const o = mk(ol);
        if (!ol.part?.heightMm) o.h = OL_STACK_H;
        used.add(ol);
        it.sub = [{ ...it }, o];
        it.w = Math.max(it.w, o.w); it.h = it.h + o.h; it.estimated = it.estimated || o.estimated;
        it.label = `${c.tag}/${ol.tag}`;
      }
      rows[2].push(it);
    } else rows[2].push(...expand(c));
  }
  if (!m.rc.some((c) => c.category === 'plc') && m.plcPart) {
    rows[1].unshift({ tag: m.plcTag, partNumber: m.plcPart.partNumber, category: 'plc', label: m.plcTag, estimated: !(m.plcPart.widthMm && m.plcPart.heightMm), x: 0, y: 0, w: m.plcPart.widthMm ?? 60, h: m.plcPart.heightMm ?? 90 });
  }
  const termPart = m.rc.find((c) => c.category === 'terminal');
  const tw = termPart?.part?.widthMm ?? 6.2;
  const th = termPart?.part?.heightMm ?? DEFAULT_DIMS.terminal![1];
  for (const s of m.strips) {
    const w = s.terminals.length * tw + s.endPlates * 1.5 + s.endStops * 9;
    rows[3].push({ tag: s.tag, partNumber: termPart?.partNumber ?? '', category: 'terminal', label: `${s.tag} (${s.terminals.length})`, estimated: !termPart?.part?.widthMm || !termPart?.part?.heightMm, x: 0, y: 0, w, h: th });
  }

  // Pack rows into DIN-rail bands (wrapping onto extra rails when a row is too wide).
  // Normal pass: each group (protection, power/PLC, control, terminals) on its own rails; a whole group
  // shares the previous rail when it fits. Compact pass (only when the normal pass overflows): the
  // disconnect first, then the other parts tallest first, each on the first partly used rail with room
  // (preferring rails already tall enough), so tall parts share rails and fewer rails + ducts are
  // needed; terminal strips on their own rails, or one strip moved onto a device rail with room.
  const innerX0 = backplate.x + MARGIN + DUCT + CLEAR;
  const innerW = backplate.w - 2 * (MARGIN + DUCT + CLEAR);
  /** Width the rails pack into: the full width, or less when tall parts have their own column. */
  let areaW = innerW;
  /** As-built rows: each row is one photographed rail (never shared with the next one). */
  let keepRows = false;
  type Band = { items: PlacedItem[]; h: number; terminals?: boolean };
  const gapOf = (b: PlacedItem[], it: PlacedItem) => (b.length ? it.gapLeft ?? gapBefore(b[b.length - 1], it) : 0);
  const bandW = (b: PlacedItem[]) => b.reduce((a, it, k) => a + it.w + (k ? it.gapLeft ?? gapBefore(b[k - 1], it) : 0), 0);
  const rowW = (row: PlacedItem[]) => row.reduce((a, it, k) => a + it.w + (k ? gapBefore(row[k - 1], it) : 0), 0);
  /** Put an item on the best rail of `pool` that has room (tall-enough rails first). */
  const fitInto = (pool: Band[], it: PlacedItem): boolean => {
    const gapTo = (b: Band) => { const prev = b.items[b.items.length - 1]; return grpOf(prev.category) === grpOf(it.category) ? gapBefore(prev, it) : 3 * GAP; };
    const fits = pool.filter((b) => b.items.length && bandW(b.items) + gapTo(b) + it.w <= areaW);
    const b = fits.find((x) => Math.max(...x.items.map((i) => i.h)) >= it.h) ?? fits[0];
    if (!b) return false;
    const prev = b.items[b.items.length - 1];
    it.gapLeft = grpOf(prev.category) === grpOf(it.category) ? undefined : 3 * GAP;
    b.items.push(it);
    return true;
  };
  /** compact: -1 = normal pass; >= 0 = compact pass, moving terminal strip `moveStrip - 1` onto a device rail (0 = none). */
  const pack = (rowsIn: PlacedItem[][], compact: number, notFit: PanelLayout['notFit']): Band[] => {
    const bands: Band[] = [];
    const tooWide = (it: PlacedItem) => { if (it.w <= areaW) return false; notFit.push({ tag: it.label, partNumber: it.partNumber, w: it.w, h: it.h }); return true; };
    if (compact >= 0) {
      const dev = rowsIn.slice(0, 3).flat();
      const ds = dev.find((i) => i.category === 'disconnect');
      const order = [...(ds ? [ds] : []), ...dev.filter((i) => i !== ds).sort((x, y) => y.h - x.h)];
      for (const it of order) {
        if (tooWide(it)) continue;
        if (!fitInto(bands, it)) { it.gapLeft = undefined; bands.push({ items: [it], h: 0 }); }
      }
      const termBands: Band[] = [];
      (rowsIn[3] ?? []).forEach((t, k) => {
        if (tooWide(t)) return;
        if (k === compact - 1 && fitInto(bands, t)) return;
        if (!fitInto(termBands, t)) { t.gapLeft = undefined; termBands.push({ items: [t], h: 0, terminals: true }); }
      });
      return [...bands, ...termBands];
    }
    rowsIn.forEach((row, ri) => {
      if (!row.length) return;
      const terminals = keepRows ? row.every((it) => it.category === 'terminal') : ri === 3;
      const last = bands[bands.length - 1];
      // A whole group that fits on the end of the previous rail shares it (never for terminal strips).
      // bandW: the rail may already hold merged groups with their wider gaps (gapLeft), which rowW does not count.
      if (!keepRows && !terminals && last && !last.terminals && bandW(last.items) + 3 * GAP + rowW(row) <= areaW) {
        row[0].gapLeft = 3 * GAP;
        last.items.push(...row);
        return;
      }
      let cur: PlacedItem[] = [];
      let w = 0;
      for (const it of row) {
        if (tooWide(it)) continue;
        const need = gapOf(cur, it) + it.w;
        if (cur.length && w + need > areaW) { bands.push({ items: cur, h: 0 }); cur = []; w = 0; }
        w += gapOf(cur, it) + it.w;
        cur.push(it);
      }
      if (cur.length) bands.push({ items: cur, h: 0, terminals });
    });
    return bands;
  };
  /**
   * Lay out the rails. With `column`, the tall parts (main disconnect, large drives) stand in their
   * own column at the right-hand side, each on a short rail, beside a vertical duct, the way a panel
   * builder mounts them; the DIN rails then run only across the area to the left of that duct.
   */
  const place = (rowsIn: PlacedItem[][], gbs: PlacedItem[], compact: number, column: PlacedItem[] = []) => {
    const notFit: PanelLayout['notFit'] = [];
    const colW = column.length ? Math.max(...column.map((c) => c.w)) : 0;
    // right duct | CLEAR | column | CLEAR | middle duct | CLEAR | rails ...
    const colRight = backplate.x + backplate.w - MARGIN - DUCT - CLEAR;
    const colX = colRight - colW;
    const midDuctX = colX - CLEAR - DUCT;
    areaW = column.length ? midDuctX - CLEAR - innerX0 : innerW;
    const bands = pack(rowsIn, compact, notFit);
    for (const b of bands) b.h = Math.max(RAIL_H, ...b.items.map((i) => i.h)) + 2 * CLEAR;
    const gbH = gbs.length ? Math.max(...gbs.map((g) => g.h)) + CLEAR : 0;
    const limit = backplate.y + backplate.h - MARGIN - gbH;
    const rails: Rect[] = [];
    const ducts: PanelLayout['ducts'] = [];
    const items: PlacedItem[] = [];
    const ductX = backplate.x + MARGIN, fullW = backplate.w - 2 * MARGIN;
    // with a column, the horizontal ducts between the rails stop at the middle duct
    const ductW = column.length ? midDuctX + DUCT - ductX : fullW;
    const railX = backplate.x + MARGIN + DUCT + 4;
    const railW = column.length ? midDuctX - 4 - railX : backplate.w - 2 * (MARGIN + DUCT + 4);
    let y = backplate.y + MARGIN;
    const ductTop = y;
    ducts.push({ x: ductX, y, w: fullW, h: DUCT, orientation: 'h' });
    y += DUCT;
    // the column: tall parts stacked from the top, each on its own short rail
    let colBottom = y;
    let colY = y + CLEAR;
    /** Put a part in the column (on its own short rail); false when there is no room below. */
    const toColumn = (it: PlacedItem): boolean => {
      if (it.w > colW + 0.01 || colY + it.h + CLEAR > limit + 0.01) return false;
      it.x = colX + (colW - it.w) / 2; it.y = colY;
      rails.push({ x: colX - 4, y: colY + it.h / 2 - RAIL_H / 2, w: colW + 8, h: RAIL_H });
      items.push(it);
      colY += it.h + 2 * CLEAR;
      colBottom = colY - CLEAR;
      return true;
    };
    for (const it of column) if (!toColumn(it)) notFit.push({ tag: it.label, partNumber: it.partNumber, w: it.w, h: it.h });
    bands.forEach((b, bi) => {
      const lastBand = bi === bands.length - 1;
      // The duct under the bottom terminal strip is optional (field wiring enters from below).
      if (y + b.h + (lastBand && b.terminals ? 0 : DUCT) > limit + 0.01) {
        for (const it of b.items) {
          if (column.length && toColumn(it)) continue;
          notFit.push({ tag: it.label, partNumber: it.partNumber, w: it.w, h: it.h });
        }
        return;
      }
      const cy = y + b.h / 2;
      rails.push({ x: railX, y: cy - RAIL_H / 2, w: railW, h: RAIL_H });
      // Main disconnect at the right-hand end of its rail (latch side of a left-hinged door), so the
      // through-door handle is on the right as usual; the rest of the rail packs from the left.
      const ds = b.items[0]?.category === 'disconnect' ? b.items[0] : undefined;
      const rest = ds ? b.items.slice(1) : b.items;
      let x = innerX0;
      rest.forEach((it, k) => {
        x += k > 0 ? it.gapLeft ?? gapBefore(rest[k - 1], it) : 0;
        it.x = x; it.y = cy - it.h / 2;
        if (it.sub) { let sy = it.y; for (const s of it.sub) { s.x = x + (it.w - s.w) / 2; s.y = sy; sy += s.h; } }
        x += it.w;
        items.push(it);
      });
      if (ds) { ds.x = innerX0 + areaW - ds.w; ds.y = cy - ds.h / 2; items.push(ds); }
      y += b.h;
      if (!(lastBand && b.terminals) || y + DUCT <= limit + 0.01) {
        ducts.push({ x: ductX, y, w: ductW, h: DUCT, orientation: 'h' });
        y += DUCT;
      }
    });
    const railsBottom = y;
    const bottom = Math.max(y, colBottom);
    const lastDuct = ducts[ducts.length - 1];
    const vEnd = lastDuct.y + lastDuct.h === railsBottom && bottom === railsBottom ? bottom - DUCT : bottom;
    ducts.push({ x: ductX, y: ductTop + DUCT, w: DUCT, h: Math.max(0, vEnd - ductTop - DUCT), orientation: 'v' });
    ducts.push({ x: backplate.x + backplate.w - MARGIN - DUCT, y: ductTop + DUCT, w: DUCT, h: Math.max(0, vEnd - ductTop - DUCT), orientation: 'v' });
    if (column.length) {
      const midEnd = lastDuct.y + lastDuct.h === railsBottom ? railsBottom - DUCT : railsBottom;
      ducts.push({ x: midDuctX, y: ductTop + DUCT, w: DUCT, h: Math.max(0, Math.max(midEnd, colBottom) - ductTop - DUCT), orientation: 'v' });
    }
    // Ground bar(s): bolted to the back panel along the bottom edge, below the last duct, right-hand side.
    let gx = backplate.x + backplate.w - MARGIN;
    for (const g of gbs) {
      if (g.w > gx - (backplate.x + MARGIN) || bottom + gbH > backplate.y + backplate.h + 0.01) { notFit.push({ tag: g.label, partNumber: g.partNumber, w: g.w, h: g.h }); continue; }
      g.x = gx - g.w; g.y = bottom + (gbH - g.h) / 2;
      gx -= g.w + GAP;
      items.push(g);
    }
    return { notFit, rails, ducts, items, bands: bands.length };
  };
  // Fresh copies per attempt (placement writes x / y / gapLeft into the items).
  const copy = (it: PlacedItem): PlacedItem => ({ ...it, sub: it.sub?.map((x) => ({ ...x })) });
  // Least part area left off the panel wins (a terminal strip weighs more than a small relay).
  const lost = (p: { notFit: PanelLayout['notFit'] }) => p.notFit.reduce((a, n) => a + n.w * n.h, 0);
  // As-built from photos: the photographed rails top to bottom, each device where it was seen (left to
  // right); parts not seen on a rail follow on rails of their own. Falls back to the normal packing
  // only when the photographed arrangement doesn't fit the enclosure.
  const asBuilt = ctx.design.asBuilt?.rails.filter((r) => r.length);
  let asBuiltPlaced: ReturnType<typeof place> | null = null;
  if (asBuilt?.length) {
    const pool = rows.flat().map(copy);
    const take = (tag: string) => { const i = pool.findIndex((it) => it.tag === tag || it.sub?.some((s) => s.tag === tag)); return i < 0 ? [] : pool.splice(i, 1); };
    const photoRows = asBuilt.map((r) => r.flatMap(take)).filter((r) => r.length);
    const rest = rows.map((r) => pool.filter((it) => r.some((x) => x.tag === it.tag && x.label === it.label))).filter((r) => r.length);
    keepRows = true;
    const ab = place([...photoRows, ...rest], groundBars.map(copy), -1);
    keepRows = false;
    if (!ab.notFit.length) { asBuiltPlaced = ab; warnings.push('As-built from photos: rails and device order as photographed — verify on the cabinet.'); }
    else warnings.push('The photographed rail arrangement does not fit this enclosure size: the layout below is packed normally.');
  }
  let placed = asBuiltPlaced ?? place(rows.map((r) => r.map(copy)), groundBars.map(copy), -1);
  if (!asBuiltPlaced && placed.notFit.length) {
    for (let k = 0; k <= rows[3].length; k++) {
      const tight = place(rows.map((r) => r.map(copy)), groundBars.map(copy), k);
      if (lost(tight) < lost(placed)) placed = tight;
    }
  }
  // Still overflowing: tall parts (disconnect, large drives) in their own column so they don't make
  // a whole rail tall; the other parts pack on the rails beside it (normal and compact packing).
  if (!asBuiltPlaced && placed.notFit.length) {
    const isTall = (it: PlacedItem) => it.h >= TALL_MM && it.category !== 'terminal';
    if (rows.slice(0, 3).some((r) => r.some(isTall))) {
      for (let k = -1; k <= rows[3].length; k++) {
        const rs = rows.map((r) => r.map(copy));
        const column = rs.slice(0, 3).flatMap((r) => r.filter(isTall)).sort((a, b) => (a.category === 'disconnect' ? -1 : b.category === 'disconnect' ? 1 : b.h - a.h));
        const rest = rs.map((r, i) => (i < 3 ? r.filter((it) => !isTall(it)) : r));
        const col = place(rest, groundBars.map(copy), k, column);
        if (lost(col) < lost(placed)) placed = col;
      }
    }
  }
  const { notFit, rails, ducts, items } = placed;
  const overflow = notFit.length > 0;
  if (overflow) warnings.push(`Back panel ${Math.round(backplate.w)} x ${Math.round(backplate.h)} mm is too small: ${notFit.map((n) => n.tag).join(', ')} do not fit — use a larger enclosure or rearrange.`);
  const est = items.filter((i) => i.estimated && i.category !== 'terminal').map((i) => i.label);
  if (est.length) warnings.push(`Estimated dimensions used for: ${est.join(', ')} — confirm with datasheets before releasing the layout.`);

  // Door
  const doorRc = m.rc.filter((c) => c.mount === 'door' && c.category !== 'fan' && c.category !== 'disconnect');
  const handleRc = m.rc.find((c) => c.mount === 'door' && c.category === 'disconnect');
  const doorItems: DoorItem[] = [];
  const colorOf = (c: ResolvedComponent) => {
    const s = `${str(c.part?.ratings, 'color', 'lensColor', 'buttonColor') ?? ''} ${c.part?.description ?? ''} ${c.comp.function}`.toLowerCase();
    return (s.match(/\b(red|green|amber|yellow|blue|white|black|clear)\b/)?.[1] ?? (c.category === 'estop' ? 'red' : '')).toUpperCase();
  };
  // The plate names the device ("SAFETY RESET"), not the rest of its function text ("— blue, monitored manual reset of SR1 …").
  const legendOf = (c: ResolvedComponent) => wrapWords((str(c.part?.ratings, 'legend') ?? ((c.comp.function || c.tag).split(/\s+[—–-]\s+|[(:;,]/)[0].trim() || c.tag)).toUpperCase(), 12).slice(0, 2);
  // A PLC with a built-in screen (Unitronics) is laid out as the door's panel; its snap-in I/O is on its back.
  const hmis = doorRc.filter((c) => c.category === 'hmi' || hasBuiltInPanel(c.part));
  // Stack lights mount on the enclosure top (direct base mount), not through the door face.
  for (const c of doorRc.filter((x) => x.category === 'stackLight')) unplaced.push({ tag: c.tag, partNumber: c.partNumber, reason: 'Enclosure top mounted (stack light) — drill per manufacturer mounting template' });
  const ops = doorRc.filter((c) => c.category !== 'hmi' && c.category !== 'plc' && c.category !== 'plcModule' && c.category !== 'stackLight' && !isLayoutAccessoryDoor(c));
  const kindOf = (c: ResolvedComponent): DoorItem['kind'] => c.category === 'pushbutton' ? 'pushbutton' : c.category === 'estop' ? 'estop' : c.category === 'pilotLight' ? 'pilot' : c.category === 'selector' ? 'selector' : 'other';
  const order: DoorItem['kind'][] = ['pilot', 'selector', 'pushbutton', 'other', 'estop'];
  // Double door: the HMI, operators and handle go on one leaf (the one in front of the disconnect), never across
  // the centre split. Floor-standing: operators 0.6 m to 1.7 m above the floor (NFPA 79 / EN 60204-1 reach).
  const dsItem = items.find((i) => i.category === 'disconnect');
  const leaves = (num(er, 'doors') ?? 1) >= 2 ? [{ x0: 0, x1: encW / 2 }, { x0: encW / 2, x1: encW }] : [{ x0: 0, x1: encW }];
  const leaf = leaves.length > 1 && dsItem && dsItem.x + dsItem.w / 2 < encW / 2 ? 0 : leaves.length - 1;
  const { x0: LX0, x1: LX1 } = leaves[leaf];
  const LCX = (LX0 + LX1) / 2;
  const stand = str(er, 'floorStand') ?? '';
  const plinth = str(er, 'mounting') === 'floor' ? (/included|bolted/i.test(stand) && !/optional|not in/i.test(stand) ? inMm(parseFloat(/(\d+(?:\.\d+)?)\s*in\b/i.exec(stand)?.[1] ?? '0')) ?? 0 : 0) : undefined;
  let dy = Math.min(90, encH * 0.15);
  if (plinth !== undefined) dy = Math.max(dy, encH + plinth - 1700);
  let doorOverflow = false;
  const hmiList: { tag: string; partNumber: string; rc?: ResolvedComponent }[] = hmis.map((h) => ({ tag: h.tag, partNumber: h.partNumber, rc: h }));
  if (!hmiList.length && ctx.hmiPartNumber) hmiList.push({ tag: 'HMI1', partNumber: ctx.hmiPartNumber });
  for (const h of hmiList) {
    const model = getHmi(h.partNumber);
    const d = model?.bezelMm ? { w: model.bezelMm.width, h: model.bezelMm.height, estimated: false } : h.rc ? dims(h.rc) : { w: 200, h: 150, estimated: true };
    const cut = model?.cutoutMm ? { w: model.cutoutMm.width, h: model.cutoutMm.height, verified: model.verified } : { w: d.w - 15, h: d.h - 15, verified: false };
    doorItems.push({ tag: h.tag, partNumber: h.partNumber, kind: 'hmi', cx: LCX, cy: dy + d.h / 2, w: d.w, h: d.h, legend: [], color: '', estimated: d.estimated, cutout: cut });
    dy += d.h + 40;
  }
  const pitchX = 60, pitchY = 75;
  const cols = Math.max(1, Math.min(6, Math.floor((LX1 - LX0 - 80) / pitchX)));
  for (const kind of order) {
    const list = ops.filter((c) => kindOf(c) === kind).sort((a, b) => naturalCompare(a.tag, b.tag));
    for (let i = 0; i < list.length; i += cols) {
      const rowList = list.slice(i, i + cols);
      const x0 = LCX - ((rowList.length - 1) * pitchX) / 2;
      rowList.forEach((c, k) => {
        const big = kind === 'estop';
        doorItems.push({ tag: c.tag, partNumber: c.partNumber, kind, cx: x0 + k * pitchX, cy: dy + 20, w: big ? 40 : 30, h: big ? 40 : 30, legend: big ? ['EMERGENCY', 'STOP'] : legendOf(c), color: colorOf(c), estimated: !c.part?.widthMm });
      });
      dy += pitchY + (kind === 'estop' ? 10 : 0);
    }
  }
  if (dy > encH - 30) { doorOverflow = true; warnings.push('Door layout: operator devices do not fit on the door at the standard spacing.'); }

  // Through-door disconnect handle: on the disconnect's shaft axis (same point the 3D model and
  // pictures use), so the door cutout lines up with the switch. Fallback when the switch is not
  // placed: right-hand side, 45% down from the top of the door.
  const handleOf = handleRc ?? m.disconnect;
  let handle: PanelLayout['door']['handle'];
  if (handleOf) {
    const ds = items.find((i) => i.category === 'disconnect');
    handle = { tag: handleOf.tag, partNumber: handleOf.partNumber, cx: ds ? ds.x + ds.w / 2 : encW - 70, cy: ds ? ds.y + ds.h / 2 : encH * 0.45 };
    // Keep door devices clear of the handle escutcheon (about 70 mm square): slide the colliding row sideways.
    const KEEP = 40;
    const hits = (d: DoorItem) => Math.abs(d.cx - handle!.cx) < KEEP + d.w / 2 + 3 && Math.abs(d.cy - handle!.cy) < KEEP + d.h / 2 + 3;
    for (const cy of [...new Set(doorItems.filter(hits).map((d) => d.cy))]) {
      const row = doorItems.filter((d) => d.cy === cy);
      const left = Math.min(...row.map((d) => d.cx - d.w / 2)), right = Math.max(...row.map((d) => d.cx + d.w / 2));
      const toLeft = handle.cx - KEEP - 3 - right, toRight = handle.cx + KEEP + 3 - left;
      const shift = handle.cx >= (left + right) / 2 ? toLeft : toRight;
      if (left + shift >= LX0 + 25 && right + shift <= LX1 - 25) for (const d of row) d.cx += shift;
      else { doorOverflow = true; warnings.push(`Door layout: ${row.map((d) => d.tag).join(', ')} collide with the disconnect handle ${handle.tag} — rearrange the door.`); }
    }
  }

  // Every door item (HMI bezel, operators) at least 25 mm from the edges of its door leaf: else the door is too small.
  const tight = doorItems.filter((d) => d.cx - d.w / 2 < LX0 + 25 || d.cx + d.w / 2 > LX1 - 25 || d.cy - d.h / 2 < 25 || d.cy + d.h / 2 > encH - 25);
  if (tight.length && !doorOverflow) { doorOverflow = true; warnings.push(`Door layout: ${tight.map((d) => d.tag).join(', ')} closer than 25 mm to the door ${leaves.length > 1 ? 'leaf edge or the centre split' : 'edge'} — the door is too small.`); }
  if (plinth !== undefined) {
    const low = doorItems.filter((d) => d.kind !== 'hmi' && encH + plinth - d.cy < 600);
    if (low.length) warnings.push(`Door layout: ${low.map((d) => d.tag).join(', ')} less than 600 mm above the floor — operator devices belong 0.6 m to 1.7 m above the floor.`);
  }

  return {
    enclosure: { w: encW, h: encH, d: inMm(num(er, 'depthIn')) ?? num(er, 'depthMm', 'depth'), partNumber: enc?.partNumber, tag: enc?.tag, estimated: encEst },
    backplate, rails, ducts, items, unplaced, notFit, overflow,
    door: {
      w: encW, h: encH, items: doorItems, overflow: doorOverflow, handle, leaves, leaf, plinth,
    }, warnings,
  };
}

/** Spare mounting space on the back panel, for the spare-space design rule (SPARE_RULE). */
export interface SpareSpace {
  /** Per DIN rail (top to bottom): usable length, length taken by parts, spare fraction. */
  rails: { rail: number; lengthMm: number; usedMm: number; spare: number }[];
  /** Whole rails that still fit below the last rail (rail + clearances + duct). */
  extraRails: number;
  /** Spare fraction of the panel: free rail length (incl. room for extra rails) / total. */
  panel: number;
}

export function spareSpace(ctx: DrawingContext): SpareSpace {
  const L = panelLayout(ctx);
  const bp = L.backplate;
  const duct = L.ducts.find((d) => d.orientation === 'v')?.w ?? 40;
  const usable = bp.w - 2 * (MARGIN + duct + CLEAR);
  const parts = L.items.filter((i) => i.category !== 'groundBar');
  const rails = L.rails.map((r, i) => {
    // full-width rails, or the short rails of the tall-part column (their own length)
    const len = Math.min(usable, r.w - 2 * (CLEAR - 4));
    const on = parts.filter((it) => it.y < r.y + r.h && it.y + it.h > r.y && it.x < r.x + r.w && it.x + it.w > r.x);
    const usedMm = Math.min(len, on.reduce((a, it) => a + it.w, 0));
    return { rail: i + 1, lengthMm: len, usedMm, spare: L.overflow ? 0 : 1 - usedMm / len };
  });
  const gb = L.items.filter((i) => i.category === 'groundBar');
  const gbH = gb.length ? Math.max(...gb.map((g) => g.h)) + CLEAR : 0;
  const lowest = Math.max(...L.ducts.filter((d) => d.orientation === 'h').map((d) => d.y + d.h), ...parts.map((it) => it.y + it.h));
  const free = bp.y + bp.h - MARGIN - gbH - lowest;
  const extraRails = L.overflow ? 0 : Math.max(0, Math.floor(free / (RAIL_H + 2 * CLEAR + duct)));
  const total = rails.reduce((a, r) => a + r.lengthMm, 0) + extraRails * usable;
  const spareMm = rails.reduce((a, r) => a + r.lengthMm - r.usedMm, 0) + extraRails * usable;
  return { rails, extraRails, panel: L.overflow || !total ? 0 : spareMm / total };
}

/** Smallest catalog enclosure (with its subpanel) that holds the back-panel parts with the spare-space rule. */
export interface EnclosureFit {
  enclosure: string;
  /** Separate subpanel part, when the enclosure needs one. */
  subpanel?: string;
  description: string;
  /** Spare fraction of the back panel with this enclosure. */
  spare: number;
  /** The design's own enclosure already fits. */
  current: boolean;
}

/** Spare space the panel should keep for later additions (panel-shop rule: 20–30 %; the enclosure is sized for at least this). */
export const SPARE_RULE = 0.2;

const STAINLESS = (p: CatalogPart) => /stainless/i.test(String(p.ratings.material ?? ''));
/** Enclosure material family: steel (painted carbon steel), stainless, or non-metallic (fiberglass, polycarbonate). */
export const enclosureFamily = (p: CatalogPart): 'steel' | 'stainless' | 'nonmetallic' =>
  STAINLESS(p) ? 'stainless' : /fiberglass|polyester|polycarbonate|plastic|pvc|abs/i.test(String(p.ratings.material ?? '')) ? 'nonmetallic' : 'steel';

/** Usable back-panel area of an enclosure (in²). */
export const enclosurePanelArea = (p: CatalogPart) => (num(p.ratings, 'panelWidthIn') ?? 0) * (num(p.ratings, 'panelHeightIn') ?? 0) || (p.widthMm ?? 0) * (p.heightMm ?? 0) / 645;
const isFloorEnclosure = (p: CatalogPart) => /floor|free/i.test(`${p.ratings.mounting ?? ''} ${p.ratings.floorStand ?? ''}`);

/**
 * Order in which enclosures are tried and listed: wall-mount single-door before floor-standing / two-door,
 * then the smaller back panel, 304 before 316 stainless, the shallower one, portrait before landscape.
 */
export function enclosureRank(a: CatalogPart, b: CatalogPart): number {
  const key = (p: CatalogPart) => [Number(isFloorEnclosure(p)), Number((num(p.ratings, 'doors') ?? 1) > 1), enclosurePanelArea(p), Number(/316/.test(String(p.ratings.material ?? ''))), num(p.ratings, 'depthIn') ?? 0, -(num(p.ratings, 'heightIn') ?? 0)];
  const ka = key(a), kb = key(b);
  for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
  return a.partNumber.localeCompare(b.partNumber);
}

/** Catalog enclosures (not subpanels) meeting a rating, of one material family, in enclosureRank order. */
export function enclosuresFor(rating: string | undefined, family?: ReturnType<typeof enclosureFamily>): CatalogPart[] {
  const need = String(rating ?? '').replace(/^NEMA\s*/i, '').toUpperCase();
  return ALL_PARTS
    .filter((p) => p.category === 'enclosure' && String(p.ratings.kind ?? '') !== 'subpanel' && enclosurePanelArea(p) > 0 && (!family || enclosureFamily(p) === family))
    .filter((p) => !need || need === '1' || String(p.ratings.nema ?? '').toUpperCase().split('/').map((x) => x.trim()).includes(need))
    .sort(enclosureRank);
}

/** "24x20x8" from the catalog's inch dimensions. */
export const enclosureSize = (p?: CatalogPart) => (p ? `${num(p.ratings, 'heightIn')}x${num(p.ratings, 'widthIn')}${num(p.ratings, 'depthIn') ? `x${num(p.ratings, 'depthIn')}` : ''}` : '');

export interface EnclosureSearch {
  /** Spare panel space the enclosure must leave (default SPARE_RULE). */
  spare?: number;
  /** Enclosure rating to meet (default the design's). */
  rating?: string;
  /** Which materials to try: the current enclosure's family (steel / stainless / non-metallic; default), stainless only, non-metallic only, or any. */
  material?: 'same' | 'steel' | 'stainless' | 'nonStainless' | 'any';
  /** Ignore the design's own enclosure (the recommendation: the smallest that fits, not "the current one is fine"). */
  fromScratch?: boolean;
}

/** The design with another enclosure (and its subpanel, or none when the enclosure has a fixed panel). */
export function withEnclosure(design: ElectricalDesign, getPart: DrawingContext['getPart'], enclosure: string, subpanel?: string): ElectricalDesign {
  const cat = (c: DesignComponent) => getPart(c.partNumber);
  const isSub = (c: DesignComponent) => cat(c)?.category === 'enclosure' && String(cat(c)?.ratings.kind ?? '') === 'subpanel';
  const enc = design.components.find((c) => cat(c)?.category === 'enclosure' && !isSub(c));
  const sub = design.components.find(isSub);
  const components = design.components
    .filter((c) => c !== sub || !!subpanel)
    .map((c) => (c === enc ? { ...c, partNumber: enclosure } : c === sub && subpanel ? { ...c, partNumber: subpanel } : c));
  if (!enc) components.push({ tag: 'ENC1', partNumber: enclosure, quantity: 1, function: 'Main enclosure', motorTag: null });
  if (subpanel && !sub) components.push({ tag: 'SP1', partNumber: subpanel, quantity: 1, function: 'Back panel', motorTag: null });
  return { ...design, components };
}

/** Back panel and door hold every part (no part left off, the door's operators / HMI fit). */
export function layoutFits(ctx: DrawingContext): boolean {
  const L = panelLayout(ctx);
  return !L.overflow && !L.notFit.length && !L.door.overflow;
}

/**
 * Size the enclosure from the real part footprints: try the catalog enclosures that meet the design's
 * enclosure rating (same maker as the chosen one first, a stainless enclosure only by stainless ones),
 * smallest back panel first, and return the first whose back panel and door hold every part with at
 * least `spare` free. Null when none does.
 */
export function smallestEnclosure(ctx: DrawingContext, opt: number | EnclosureSearch = {}): EnclosureFit | null {
  const o: EnclosureSearch = typeof opt === 'number' ? { spare: opt } : opt;
  const spare = o.spare ?? SPARE_RULE;
  const m = buildModel(ctx);
  const encC = m.rc.find((c) => c.category === 'enclosure' && !isSubpanel(c));
  const subC = m.rc.find((c) => isSubpanel(c));
  const need = String(o.rating ?? ctx.design.inputs.enclosureRating ?? '').replace(/^NEMA\s*/i, '').toUpperCase();
  const panelArea = (p: CatalogPart) => (num(p.ratings, 'panelWidthIn') ?? 0) * (num(p.ratings, 'panelHeightIn') ?? 0) || (p.widthMm ?? 0) * (p.heightMm ?? 0) / 645;
  const maker = encC?.part?.manufacturer;
  const material = o.material ?? 'same';
  const curFamily = encC?.part ? enclosureFamily(encC.part) : need === '4X' ? 'stainless' : 'steel';
  const okMaterial = (p: CatalogPart) => material === 'any' || (material === 'steel' ? enclosureFamily(p) === 'steel' : material === 'stainless' ? STAINLESS(p) : material === 'nonStainless' ? enclosureFamily(p) === 'nonmetallic' : enclosureFamily(p) === curFamily);
  const candidates = ALL_PARTS
    .filter((p) => p.category === 'enclosure' && String(p.ratings.kind ?? '') !== 'subpanel' && panelArea(p) > 0 && okMaterial(p))
    .filter((p) => !need || need === '1' || String(p.ratings.nema ?? '').toUpperCase().split('/').map((x) => x.trim()).includes(need))
    .sort((a, b) => Number(b.manufacturer === maker) - Number(a.manufacturer === maker) || enclosureRank(a, b));
  const subOf = (p: CatalogPart) => { const s = String(p.ratings.subpanel ?? ''); return ALL_PARTS.some((x) => x.partNumber === s) ? s : undefined; };
  const fits = (design: ElectricalDesign) => {
    const c2: DrawingContext = { ...ctx, design, machineLayout: undefined };
    return layoutFits(c2) ? spareSpace(c2).panel : null;
  };
  const curOk = encC && okMaterial(encC.part ?? ({ ratings: {} } as CatalogPart)) && (!need || need === '1' || String(encC.part?.ratings.nema ?? '').toUpperCase().split('/').map((x) => x.trim()).includes(need));
  const cur = curOk && !o.fromScratch ? fits(ctx.design) : null;
  if (cur !== null && cur >= spare && encC) return { enclosure: encC.partNumber, subpanel: subC?.partNumber, description: encC.part?.description ?? encC.partNumber, spare: cur, current: true };
  for (const p of candidates) {
    if (p.partNumber === encC?.partNumber && !curOk) continue;
    if (p.partNumber === encC?.partNumber && cur !== null) { if (cur >= spare) return { enclosure: p.partNumber, subpanel: subC?.partNumber, description: p.description, spare: cur, current: true }; continue; }
    const sp = subOf(p);
    const f = fits(withEnclosure(ctx.design, ctx.getPart, p.partNumber, sp));
    if (f !== null && f >= spare) return { enclosure: p.partNumber, subpanel: sp, description: p.description, spare: f, current: false };
  }
  return null;
}

/**
 * Apply the designer's enclosure pick (or the recommendation when there is none) to a design: the pick is kept when
 * the parts fit it, even when it is larger than needed (with a note); when it is too small the smallest enclosure of
 * its rating and material that holds the parts is used (with a note) and the pick stays recorded in the inputs.
 */
export function chooseEnclosure(ctx: DrawingContext, preference: string | null | undefined): { design: ElectricalDesign; choice: EnclosureChoice } {
  const pref = preference ? ALL_PARTS.find((p) => p.partNumber === preference && p.category === 'enclosure') : undefined;
  const sub = (p: CatalogPart) => { const s = String(p.ratings.subpanel ?? ''); return ALL_PARTS.some((x) => x.partNumber === s) ? s : undefined; };
  const material = pref ? (enclosureFamily(pref) === 'stainless' ? 'stainless' : enclosureFamily(pref) === 'nonmetallic' ? 'nonStainless' : 'steel') as EnclosureSearch['material'] : undefined;
  const rec = smallestEnclosure(ctx, { fromScratch: true, material }) ?? smallestEnclosure(ctx, { fromScratch: true, material, spare: 0 });
  const encC = buildModel(ctx).rc.find((c) => c.category === 'enclosure' && !isSubpanel(c));
  const recPart = rec ? ALL_PARTS.find((p) => p.partNumber === rec.enclosure) : undefined;
  const set = (pn: string, sp: string | undefined) => (pn === encC?.partNumber ? ctx.design : withEnclosure(ctx.design, ctx.getPart, pn, sp));
  const done = (design: ElectricalDesign, choice: EnclosureChoice) => ({ design: { ...design, inputs: { ...design.inputs, enclosurePreference: preference ?? null }, enclosureChoice: choice }, choice });
  if (!pref) {
    const design = rec ? set(rec.enclosure, rec.subpanel) : ctx.design;
    return done(design, { recommended: rec?.enclosure ?? null, preferred: null, used: rec?.enclosure ?? encC?.partNumber ?? '', status: 'recommended' });
  }
  const withPref = set(pref.partNumber, sub(pref));
  if (layoutFits({ ...ctx, design: withPref, machineLayout: undefined })) {
    const larger = !!recPart && recPart.partNumber !== pref.partNumber && enclosurePanelArea(pref) > enclosurePanelArea(recPart);
    const status: EnclosureChoice['status'] = !recPart || recPart.partNumber === pref.partNumber ? 'recommended' : larger ? 'larger' : 'kept';
    const note = status === 'larger' ? `This cabinet is bigger than needed — the recommended size is ${enclosureSize(recPart)} (${recPart!.partNumber}).`
      : status === 'kept' ? `Your size (${enclosureSize(pref)}) holds the parts with less than ${Math.round(SPARE_RULE * 100)} % spare space; the recommended size is ${enclosureSize(recPart)} (${recPart!.partNumber}).` : undefined;
    return done(withPref, { recommended: recPart?.partNumber ?? null, preferred: pref.partNumber, used: pref.partNumber, status, note });
  }
  // too small: the smallest of the pick's rating and material that holds the parts (any spare)
  const works = smallestEnclosure(ctx, { fromScratch: true, material, spare: 0 });
  const usedPart = works ? ALL_PARTS.find((p) => p.partNumber === works.enclosure) : undefined;
  if (!works || !usedPart) return done(withPref, { recommended: null, preferred: pref.partNumber, used: pref.partNumber, status: 'tooSmall', note: `Your size (${enclosureSize(pref)}) is too small for the parts and no catalog enclosure of its rating and material holds them: split the panel.` });
  return done(set(works.enclosure, works.subpanel), { recommended: recPart?.partNumber ?? works.enclosure, preferred: pref.partNumber, used: works.enclosure, status: 'tooSmall',
    note: `Your size (${enclosureSize(pref)}) was too small for the parts; we use ${enclosureSize(usedPart)} (${usedPart.partNumber}).` });
}

/** A way out when the parts don't fit the enclosure (Electrical page banner). */
export interface FitOption {
  kind: 'larger' | 'material' | 'rating' | 'split';
  label: string;
  detail: string;
  /** Enclosure (+ subpanel) to switch to; none for "split". */
  fit?: EnclosureFit;
  /** Enclosure rating to change to ("relax to NEMA 12"). */
  rating?: EnclosureRating;
}

export interface FitProblem {
  /** Back-panel parts left off the panel. */
  notFit: { tag: string; partNumber: string }[];
  /** The door's operators / HMI / handle don't fit the door. */
  door: boolean;
  options: FitOption[];
}

const sizeText = enclosureSize;

/** Null when everything fits; else what doesn't fit and the options (larger enclosure, other 4X material, relaxed rating, split). */
export function enclosureFitProblem(ctx: DrawingContext): FitProblem | null {
  if (!ctx.design.components.some((c) => ctx.getPart(c.partNumber)?.category === 'enclosure')) return null;
  const L = panelLayout(ctx);
  if (layoutFits(ctx)) return null;
  const options: FitOption[] = [];
  const rating = String(ctx.design.inputs.enclosureRating ?? 'NEMA 12');
  const pick = (o: EnclosureSearch) => smallestEnclosure(ctx, o) ?? smallestEnclosure(ctx, { ...o, spare: 0 });
  const label = (f: EnclosureFit, what: string) => `${what} ${sizeText(ALL_PARTS.find((p) => p.partNumber === f.enclosure))} (${f.enclosure})`;
  const larger = pick({});
  if (larger && !larger.current) options.push({ kind: 'larger', fit: larger, label: label(larger, `Use a larger ${rating}`), detail: `${larger.description}${larger.subpanel ? ` with back panel ${larger.subpanel}` : ''}; ${Math.round(larger.spare * 100)} % spare panel space.` });
  const encPart = buildModel(ctx).rc.find((c) => c.category === 'enclosure' && !isSubpanel(c))?.part;
  if (rating === 'NEMA 4X' && encPart && STAINLESS(encPart)) {
    const fg = pick({ material: 'nonStainless' });
    if (fg) options.push({ kind: 'material', fit: fg, label: label(fg, `Use a NEMA 4X ${/fiberglass/i.test(fg.description) ? 'fiberglass' : /polycarbonate/i.test(fg.description) ? 'polycarbonate' : 'non-stainless'}`), detail: `${fg.description}. Check the material suits the washdown / chemicals before choosing it over stainless.` });
  }
  if (rating !== 'NEMA 12' && rating !== 'NEMA 1') {
    const r12 = pick({ rating: 'NEMA 12', material: 'steel' });
    if (r12) options.push({ kind: 'rating', rating: 'NEMA 12', fit: r12, label: `Relax to NEMA 12: ${sizeText(ALL_PARTS.find((p) => p.partNumber === r12.enclosure))} (${r12.enclosure})`, detail: `Only if the location allows it: NEMA 12 is indoor, dust / dripping-liquid tight, not for washdown (${rating} was asked for).` });
  }
  const moved = L.notFit.length ? L.notFit.map((n) => n.tag).join(', ') : 'the drives and power parts';
  options.push({ kind: 'split', label: 'Split into two enclosures', detail: `Put ${moved} in a second ${rating} enclosure (power / drives apart from the controls) and connect them with a cable; add it as a second cabinet in Machine layout.` });
  return { notFit: L.notFit.map((n) => ({ tag: n.tag, partNumber: n.partNumber })), door: L.door.overflow, options };
}

/** Door-mounted accessories that are not operator devices (contact blocks, legend plates sold separately...). */
function isLayoutAccessoryDoor(c: ResolvedComponent): boolean {
  return /\b(contact block|legend plate|lamp module|guard|shaft)\b/i.test(c.part?.description ?? '') && !['pushbutton', 'estop', 'pilotLight', 'selector'].includes(c.category);
}

// ---------------------------------------------------------------------------
// Machining: back-panel drilling and door cutouts (datum = lower-left corner, X right, Y up, mm)
// ---------------------------------------------------------------------------

export interface DrillHole {
  /** "A1", "B4"… (letter = hole code). */
  id: string;
  /** Feature the hole belongs to ("RAIL 1", "DUCT 3", "GB1", "VFD1"…). */
  tag: string;
  x: number;
  y: number;
  /** Diameter drawn and cut: the tap-drill size for tapped holes (the tap is in the hole code's callout). */
  dia: number;
  code: string;
  /** Thread tapped after drilling ("M5", "1/4-20"); the callout beside the hole. */
  tap?: string;
  verified: boolean;
}

export interface DrillCutout {
  id: string;
  tag: string;
  kind: 'round' | 'rect';
  /** Centre. */
  x: number;
  y: number;
  /** Diameter for round, width/height for rect. */
  w: number;
  h: number;
  code: string;
  verified: boolean;
  /** Optional anti-rotation notch (22 mm operators): width x depth at 12 o'clock. */
  notch?: { w: number; d: number };
  /** Size not known from the catalog: centre mark and outline only (not cut), machined per this note. */
  template?: string;
}

export interface HoleCode { code: string; spec: string; count: number; verified: boolean }

export type EnclosureFace = 'bottom' | 'top' | 'left' | 'right';

export interface DrillingPlan {
  kind: 'backpanel' | 'door' | EnclosureFace;
  title: string;
  /** Part / tag being machined. */
  part: string;
  w: number;
  h: number;
  holes: DrillHole[];
  cutouts: DrillCutout[];
  codes: HoleCode[];
  notes: string[];
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** On every machining drawing: the print is scaled, the DXF beside it is real size. */
export const MACHINING_SCALE_NOTE = 'DO NOT SCALE THIS PRINT: THE SHEET SCALE IS IN THE TITLE. CUT FROM THE DIMENSIONS OR FROM THE DXF OF THIS PART, WHICH IS 1:1 (REAL SIZE).';

/** Inches to 3 decimals from mm. */
export const inch3 = (mm: number): string => (mm / 25.4).toFixed(3);
/** Dual dimension for machining: inch first, mm in brackets, e.g. "4.000 [101.6]". */
export const dualDim = (mm: number): string => `${inch3(mm)} [${mm.toFixed(1)}]`;
/** Dual size, e.g. "7.461 x 5.512 [189.5 x 140.0]". */
export const dualSize = (w: number, h: number): string => `${inch3(w)} x ${inch3(h)} [${w.toFixed(1)} x ${h.toFixed(1)}]`;

/** Evenly spaced positions from a to b with at most `pitch` between them (both ends included). */
function spaced(a: number, b: number, pitch: number): number[] {
  if (b - a < 1) return [(a + b) / 2];
  const n = Math.max(1, Math.ceil((b - a) / pitch));
  return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
}

export function finishCodes(holes: DrillHole[], cutouts: DrillCutout[], specs: Record<string, string>): HoleCode[] {
  const out: HoleCode[] = [];
  for (const [code, spec] of Object.entries(specs)) {
    const hs = holes.filter((h) => h.code === code), cs = cutouts.filter((c) => c.code === code);
    const n = hs.length + cs.length;
    if (n) out.push({ code, spec, count: n, verified: [...hs, ...cs].every((x) => x.verified) });
  }
  return out;
}

export function numberIds<T extends { id: string; code: string; x: number; y: number }>(list: T[]): T[] {
  const byCode = new Map<string, number>();
  // top-to-bottom, left-to-right: the order a machinist reads the drawing
  return [...list].sort((a, b) => a.code.localeCompare(b.code) || b.y - a.y || a.x - b.x).map((h) => {
    const n = (byCode.get(h.code) ?? 0) + 1;
    byCode.set(h.code, n);
    return { ...h, id: `${h.code}${n}` };
  });
}

/** Tap-drill diameters (mm): the hole drilled before tapping. */
const TAP_DRILL = { M4: 3.3, M5: 4.2, '1/4-20': 5.1 } as const;

/** Back-panel drilling: DIN rail, wire duct, ground bar and panel-mounted device holes. */
export function backPanelDrilling(ctx: DrawingContext): DrillingPlan {
  const L = panelLayout(ctx);
  const m = buildModel(ctx);
  const bp = L.backplate;
  const X = (x: number) => r1(x - bp.x);
  const Y = (y: number) => r1(bp.y + bp.h - y);
  const holes: DrillHole[] = [];
  const TAP_OF: Record<string, string> = { A: 'M5', B: 'M4', C: '1/4-20', D: 'M5' };
  const add = (code: string, tag: string, x: number, y: number, dia: number, verified: boolean) => holes.push({ id: '', tag, x: X(x), y: Y(y), dia, code, tap: TAP_OF[code], verified });
  // panel-mounted (non-DIN) devices: VFDs and transformers
  const panelMount = L.items.filter((it) => it.category === 'vfd' || m.rc.some((c) => c.tag === it.tag && isTransformer(c)));
  const covered = (x: number, y: number) => panelMount.some((p) => x >= p.x - 2 && x <= p.x + p.w + 2 && y >= p.y - 2 && y <= p.y + p.h + 2);
  L.rails.forEach((r, i) => {
    const cy = r.y + r.h / 2;
    for (const x of spaced(r.x + 25, r.x + r.w - 25, 150)) if (!covered(x, cy)) add('A', `RAIL ${i + 1}`, x, cy, TAP_DRILL.M5, true);
  });
  L.ducts.forEach((d, i) => {
    if (d.orientation === 'h') { const cy = d.y + d.h / 2; for (const x of spaced(d.x + 50, d.x + d.w - 50, 300)) add('B', `DUCT ${i + 1}`, x, cy, TAP_DRILL.M4, true); }
    else { const cx = d.x + d.w / 2; for (const y of spaced(d.y + 50, d.y + d.h - 50, 300)) add('B', `DUCT ${i + 1}`, cx, y, TAP_DRILL.M4, true); }
  });
  for (const it of L.items.filter((i) => i.category === 'groundBar')) {
    const part = m.rc.find((c) => c.tag === it.tag)?.part;
    const sp = num(part?.ratings, 'holeSpacingMm', 'mountingHoleSpacingMm');
    const half = sp !== undefined ? sp / 2 : it.w / 2 - 12.7;
    for (const dx of [-half, half]) add('C', it.tag, it.x + it.w / 2 + dx, it.y + it.h / 2, TAP_DRILL['1/4-20'], sp !== undefined);
  }
  for (const it of panelMount) {
    const part = m.rc.find((c) => c.tag === it.tag)?.part;
    const hw = num(part?.ratings, 'mountHoleSpacingWMm', 'holeSpacingWMm');
    const hh = num(part?.ratings, 'mountHoleSpacingHMm', 'holeSpacingHMm');
    const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
    if (hw !== undefined && hh !== undefined) for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add('D', it.tag, cx + (dx * hw) / 2, cy + (dy * hh) / 2, TAP_DRILL.M5, true);
    else if (it.w < 80) for (const dy of [-1, 1]) add('D', it.tag, cx, cy + dy * (it.h / 2 - 6), TAP_DRILL.M5, false);
    else for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add('D', it.tag, cx + dx * (it.w / 2 - 6), cy + dy * (it.h / 2 - 6), TAP_DRILL.M5, false);
  }
  const ids = numberIds(holes);
  const specs = {
    A: 'M5 TAP, Ø4.2 DRILL (OR #10-32, #21 DRILL) — 35 mm DIN RAIL FIXING',
    B: 'M4 TAP, Ø3.3 DRILL (OR #8-32, #29 DRILL) — WIRE DUCT FIXING',
    C: '1/4-20 TAP, #7 (Ø5.1) DRILL — GROUND BAR, REMOVE PAINT FOR BONDING',
    D: 'M5 TAP, Ø4.2 DRILL — PANEL-MOUNTED DEVICE',
  };
  const unverified = [...new Set(ids.filter((h) => !h.verified).map((h) => h.tag))];
  return {
    kind: 'backpanel', title: 'BACK PANEL DRILLING', part: bp.partNumber ? `${bp.tag} ${bp.partNumber}` : `BACK PANEL ${L.enclosure.partNumber ?? ''}`.trim(),
    w: r1(bp.w), h: r1(bp.h), holes: ids, cutouts: [], codes: finishCodes(ids, [], specs),
    notes: [
      'DATUM: LOWER-LEFT CORNER OF BACK PANEL (FRONT VIEW). DIMENSIONS IN INCHES [mm]. TOLERANCE ±0.020 [±0.5] UNLESS NOTED.',
      'DIN RAIL: HOLES 0.984 [25.0] FROM RAIL ENDS, 5.906 [150.0] MAX. PITCH. WIRE DUCT: 11.811 [300.0] MAX. PITCH, 1.969 [50.0] FROM ENDS.',
      ...(unverified.length ? [`VERIFY WITH DATASHEET: ${unverified.join(', ')} — HOLE PATTERN ESTIMATED (NO MOUNTING DIMENSIONS IN CATALOG).`] : []),
      ...(panelMount.length ? [`DIN RAIL INTERRUPTED BEHIND ${panelMount.map((p) => p.tag).join(', ')} (PANEL-MOUNTED).`] : []),
      ...(L.notFit.length ? [`NOT DRILLED (DOES NOT FIT): ${L.notFit.map((n) => n.tag).join(', ')}.`] : []),
      'DEBURR ALL HOLES. MASK / REMOVE PAINT AT GROUND-BAR AND BONDING POINTS.',
      MACHINING_SCALE_NOTE,
    ],
  };
}

/** Door cutouts: 22 mm operators, HMI, disconnect handle. */
export function doorDrilling(ctx: DrawingContext): DrillingPlan {
  const L = panelLayout(ctx);
  const D = L.door;
  // Double door: the plan is the leaf that carries the devices, dimensioned from its own lower-left corner.
  const lf = D.leaves[D.leaf] ?? { x0: 0, x1: D.w };
  const two = D.leaves.length > 1;
  const side = two ? (D.leaf === 0 ? 'LEFT' : 'RIGHT') : '';
  const X = (x: number) => r1(x - lf.x0);
  const Y = (y: number) => r1(D.h - y);
  const cutouts: DrillCutout[] = [];
  for (const d of D.items) {
    if (d.kind === 'hmi') {
      const c = d.cutout ?? { w: d.w - 15, h: d.h - 15, verified: false };
      cutouts.push({ id: '', tag: d.tag, kind: 'rect', x: X(d.cx), y: Y(d.cy), w: r1(c.w), h: r1(c.h), code: 'F', verified: c.verified });
    } else cutouts.push({ id: '', tag: d.tag, kind: 'round', x: X(d.cx), y: Y(d.cy), w: 22.5, h: 22.5, code: 'E', verified: true, notch: { w: 3.2, d: 1.7 } });
  }
  if (D.handle) cutouts.push({ id: '', tag: D.handle.tag, kind: 'round', x: X(D.handle.cx), y: Y(D.handle.cy), w: 22.5, h: 22.5, code: 'G', verified: false, template: 'PER HANDLE TEMPLATE' });
  const ids = numberIds(cutouts);
  const hmi = ids.find((c) => c.code === 'F');
  const specs = {
    E: `Ø${dualDim(22.5)} PUNCH (22 mm OPERATOR). ANTI-ROTATION NOTCH ${dualSize(3.2, 1.7)} (W x D) AT 12 O'CLOCK ONLY IF THE OPERATOR REQUIRES IT`,
    F: `RECTANGULAR HMI CUTOUT${hmi ? ` ${dualSize(hmi.w, hmi.h)}` : ''} — PER HMI DRAWING${hmi && !hmi.verified ? ' (VERIFY)' : ''}`,
    G: 'DISCONNECT HANDLE: CENTRE MARK ONLY — DRILL PER HANDLE TEMPLATE (e.g. SOCOMEC S0)',
  };
  return {
    kind: 'door', title: two ? `${side} DOOR CUTOUTS` : 'DOOR CUTOUTS', part: `${two ? `${side} ` : ''}DOOR ${L.enclosure.tag ?? ''} ${L.enclosure.partNumber ?? ''}`.trim(),
    w: r1(lf.x1 - lf.x0), h: r1(D.h), holes: [], cutouts: ids, codes: finishCodes([], ids, specs),
    notes: [
      `DATUM: LOWER-LEFT CORNER OF ${two ? `THE ${side} DOOR` : 'DOOR'}, OUTSIDE (FRONT) VIEW. DIMENSIONS IN INCHES [mm]. TOLERANCE ±0.020 [±0.5] UNLESS NOTED.`,
      ...(two ? [`DOUBLE-DOOR ENCLOSURE: ALL CUTOUTS ON THE ${side} DOOR, NONE ON THE ${side === 'RIGHT' ? 'LEFT' : 'RIGHT'} DOOR. DOOR WIDTH TAKEN AS HALF THE ENCLOSURE WIDTH — CHECK THE CENTRE OVERLAP BEFORE CUTTING.`] : []),
      ...L.unplaced.filter((u) => /stack light/i.test(u.reason)).map((u) => `NOT ON THE DOOR: ${u.tag} ${u.partNumber} STACK LIGHT — ON THE ENCLOSURE TOP, SEE THE ENCLOSURE TOP SHEET.`),
      'DOOR SIZE TAKEN AS ENCLOSURE OUTSIDE SIZE — CHECK FLANGE/RETURN AND HINGE CLEARANCE BEFORE CUTTING.',
      'HANDLE: ALIGN WITH DISCONNECT SHAFT CENTRE ON THE BACK PANEL; DRILL MOUNTING HOLES FROM THE HANDLE TEMPLATE.',
      'REINFORCE DOOR AROUND LARGE CUTOUTS; KEEP GASKET LAND CLEAR. DEBURR AND TOUCH UP PAINT.',
      MACHINING_SCALE_NOTE,
    ],
  };
}

/** Greedy word wrap by character count. */
export function wrapWords(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w;
    else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  return out.length ? out : [''];
}

// ---------------------------------------------------------------------------
// Warnings
// ---------------------------------------------------------------------------

/** Things the engineer must check before the drawings are used. */
export function designWarnings(ctx: DrawingContext): string[] {
  const m = buildModel(ctx);
  const w: string[] = [];
  const r = regionSpec(ctx.region);
  if (!r.supplies.includes(ctx.design.inputs.supply)) w.push(`The design is for ${SUPPLY_INFO[ctx.design.inputs.supply].label} ${SUPPLY_INFO[ctx.design.inputs.supply].hz} Hz but the project region is ${r.label} (${r.supplies.map((v) => SUPPLY_INFO[v].label).join(', ')}): update the design for the region.`);
  const unverified = new Map<string, string[]>();
  for (const c of m.rc) {
    if (!c.partNumber) w.push(`${c.tag}: no part number selected.`);
    else if (!c.part) w.push(`${c.tag}: part ${c.partNumber} not found in the catalog — verify the part number.`);
    else if (!c.part.verified) unverified.set(c.partNumber, [...(unverified.get(c.partNumber) ?? []), c.tag]);
  }
  if (unverified.size) w.push(`${unverified.size} part number(s) have catalog data not yet verified against the datasheet: ${[...unverified].map(([pn, tags]) => `${pn} (${tags.join(', ')})`).join('; ')}.`);
  // Panel and door devices the I/O list still draws and wires although they are not in the component list
  // (removed on the Design tab): drawn, but nothing orders them.
  const inBom = new Set(m.rc.map((c) => c.tag));
  const orphan = new Map<string, string[]>();
  const usedBy = (tag: string, why: string) => { if (tag && !inBom.has(tag)) orphan.set(tag, [...(orphan.get(tag) ?? []), why]); };
  for (const p of m.io) if (p.location !== 'field' && p.deviceType !== 'safety-relay-output') usedBy(p.deviceTag, p.address);
  for (const [tag, why] of orphan) w.push(`${tag} is drawn and wired (${why.join(', ')}) but is not in the component list, so it is not in the BOM: add it back on the Design tab, or regenerate the design.`);
  if (!m.disconnect) w.push('No main disconnect in the design (NFPA 79 5.3 requires a supply disconnecting means).');
  const up = isIec(ctx.region) ? null : upstreamOcpd(ctx);
  if (up) w.push(up.text);
  for (const b of m.psBranches) {
    if (isClass2(b.ps) || !b.ps.part) continue;
    const a = psOutA(b.ps);
    w.push(a > DC_WIRE_A
      ? `${b.ps.tag} (${a} A, not NEC Class 2) can exceed the ${DC_WIRE_A} A rating of the 18 AWG control wiring: the 24 VDC feeds to the field strips are fused terminals (4 A); add fused terminals or DC breakers for any other branch wired smaller than its full output.`
      : `${b.ps.tag} (${a} A${a ? ` / ${Math.round(a * 24)} W` : ''}) is not an NEC Class 2 supply: its current limit is below the ${DC_WIRE_A} A rating of the 18 AWG control wiring, so the wiring needs no extra 24 V branch protection, but the 24 VDC field circuits are Class 1 / NFPA 79 control circuits (not Class 2). Choose a Class 2 supply (100 W max.) if the 24 VDC load allows and Class 2 field wiring is wanted.`);
  }
  if (!m.rc.some((c) => c.category === 'enclosure')) w.push('No enclosure selected.');
  if (!m.psBranches.length) w.push('No 24VDC power supply in the design.');
  const xfmrFused = /yes/i.test(String(m.transformer?.part?.ratings.fused ?? ''));
  for (const b of m.psBranches) {
    if (b.protection) continue;
    // Transformers with an integral fuse block protect their secondary (the supply feed) themselves.
    if (b.fromXfmr && xfmrFused) w.push(`${b.ps.tag}: fed through the fuse block of ${m.transformer!.tag} — order and fit the Class CC fuses (primary and secondary) sized per the transformer label.`);
    else w.push(`${b.ps.tag}: no primary protection (breaker/fuses) found — add branch protection.`);
  }
  // A 24VDC supply's AC input must cover the voltage feeding it (phase-phase on 3-phase supplies).
  const feedVolts = SUPPLY_INFO[m.supply].volts;
  const hasTransformer = m.rc.some((c) => c.part?.ratings.kind === 'transformer');
  for (const b of m.psBranches) {
    const range = String(b.ps.part?.ratings.inputVolts ?? '').match(/(\d+)\s*-\s*(\d+)\s*VAC/);
    const sec = num(m.transformer?.part?.ratings, 'secondaryVolts') ?? 120;
    const v = b.fromXfmr ? sec : feedVolts;
    if (range && (v > Number(range[2]) || v < Number(range[1])) && (!hasTransformer || b.fromXfmr)) {
      w.push(`${b.ps.tag}: input rated ${range[1]}–${range[2]} VAC but it is fed at ${v} V${b.fromXfmr ? ' (transformer secondary)' : ` (supply ${m.supply})`}. Use a power supply rated for ${v} V${b.fromXfmr ? '' : ', or feed it from a control power transformer'}.`);
    }
  }
  if (!hasTransformer && feedVolts === 600 && m.psBranches.length) w.push('600 V supply: 24VDC supplies in the catalog accept max. 575 VAC — use a 600 V-primary control power transformer (e.g. CT-xxx-060-12) ahead of the power supply.');
  if (m.transformer) {
    const prim = String(m.transformer.part?.ratings.primaryVolts ?? '');
    const pv = prim.split('/').map(Number).filter((x) => x > 0);
    if (pv.length && !pv.includes(feedVolts === 208 ? 208 : feedVolts)) w.push(`${m.transformer.tag}: primary rated ${prim} V but the supply is ${m.supply} — select a transformer with a ${feedVolts} V primary.`);
    if (!m.xfmrBranch?.protection && !/yes/i.test(String(m.transformer.part?.ratings.fused ?? ''))) w.push(`${m.transformer.tag}: no primary protection found (function "transformer primary") — add fuses/breaker per ${ctx.region === 'Canada' ? 'CEC Rule 26-256' : 'NEC 450.3 / UL 508A'}.`);
  }
  const holders = m.rc.filter((c) => c.category === 'fuse' && !isFuseCartridge(c));
  for (const h of holders) if (!h.fuse) w.push(`${h.tag}: fuse holder without a matching fuse cartridge in the design (link by motorTag or by naming ${h.tag} in the fuse's function).`);
  if (!m.groundBar) w.push('No ground bar in the design.');
  for (const mm of m.motors) {
    const t = mm.motor.tag;
    if (!mm.protection) w.push(`${t}: no branch short-circuit protection (breaker/fuses/MMP) assigned (set motorTag on the part).`);
    if (mm.motor.starter === 'vfd' && !mm.vfd) w.push(`${t}: starter type VFD but no VFD part assigned.`);
    // Drives listed with Class T fuses (their SCCR condition): the branch must use them, in an orderable Class T block.
    const dr = mm.vfd?.part?.ratings;
    if (mm.vfd && dr && String(dr.fuseClass ?? '').toUpperCase() === 'T' && dr.fusePart && !isIec(ctx.region)) {
      const fusePn = String(dr.fusePart);
      const have = mm.protection?.category === 'fuse' && String(mm.protection.fuse?.ratings.fuseClass ?? '').toUpperCase() === 'T';
      if (!have) {
        const fuse = ALL_PARTS.find((p) => p.partNumber === fusePn);
        const poles = mm.motor.voltage && /1PH/i.test(mm.motor.voltage) ? 2 : 3;
        const holder = String(fuse?.ratings.holder ?? '').split('/').map((h) => ALL_PARTS.find((p) => p.partNumber === h.trim())).find((h) => h && num(h.ratings, 'poles') === poles);
        const fa = num(fuse?.ratings, 'amps') ?? num(dr, 'fuseAmps');
        w.push(holder
          ? `${mm.vfd.tag}: the ${mm.vfd.partNumber} SCCR needs Class T ${fusePn} fuses (${fa} A) — use them in a ${holder.partNumber} block instead of ${mm.protection ? `${mm.protection.tag} ${mm.protection.partNumber}` : 'the present branch protection'}.`
          : `No orderable Class T fuse holder above 60 A for ${mm.vfd.tag} (${mm.vfd.partNumber} needs Class T ${fusePn}, ${fa} A, for its ${num(dr, 'sccrKA') ?? '?'} kA SCCR) — use an open-style Class T fuse block from another maker (Bussmann, Mersen, Littelfuse), or keep ${mm.protection ? `${mm.protection.tag} ${mm.protection.partNumber}` : 'a branch breaker'} and mark the lower SCCR the drive manual gives for it.`);
      }
    }
    if (mm.motor.starter === 'contactor-overload') {
      if (!mm.contactors.length) w.push(`${t}: no contactor assigned.`);
      if (!mm.overload) w.push(`${t}: no overload relay assigned.`);
    }
    if (mm.motor.starter === 'motor-protector' && !mm.contactors.length) w.push(`${t}: motor protector without contactor — confirm manual-only control is intended.`);
    if (mm.motor.reversing && mm.motor.starter !== 'vfd' && mm.contactors.length < 2) w.push(`${t}: reversing motor needs two contactors (forward/reverse) with mechanical + electrical interlock.`);
    if (!m.io.some((p) => p.deviceTag && (mm.contactors.some((c) => c.tag === p.deviceTag) || p.deviceTag === mm.vfd?.tag))) w.push(`${t}: no PLC output drives its contactor/VFD (check ioWiring deviceTag).`);
    const v = mm.vfd?.part ? num(mm.vfd.part.ratings, 'hp480', 'hp', 'hp230') : undefined;
    if (v !== undefined && v < mm.motor.hp) w.push(`${t}: VFD ${mm.vfd!.partNumber} rated ${v} HP is below the motor ${mm.motor.hp} HP.`);
    if (mm.motor.voltage !== m.supply) w.push(`${t}: motor voltage ${mm.motor.voltage} differs from supply ${m.supply} — a transformer is required.`);
  }
  if (m.safety.estops.length && !m.safety.relay) w.push('E-stop present but no safety relay — E-stop circuit is drawn as a hardwired MCR chain; perform a risk assessment (ISO 13849 / NFPA 79 9.2.5.4).');
  if (m.safety.relay && !m.safety.estops.length) w.push('Safety relay present but no E-stop device found.');
  if (m.safety.relay && !m.safety.reset) w.push('Safety relay has no reset pushbutton assigned (function "Reset").');
  const ilk = m.motors.filter((mm) => mm.motor.reversing && mm.contactors.length === 2 && mm.contactors.every((c) => m.safety.edm.includes(c.tag)));
  if (ilk.length) w.push(`${ilk.flatMap((mm) => mm.contactors.map((c) => c.tag)).join(', ')}: the reversing interlock uses a second N.C. contact (71-72) — the first N.C. is in the safety relay feedback (EDM) loop; fit a 2 N.O. + 2 N.C. auxiliary block (e.g. Fuji SZ-A22T, not in the parts catalog yet) in place of the 1 N.O. + 1 N.C. block.`);
  const auxMissing = [...m.auxNc].filter(([, a]) => a.missing);
  if (auxMissing.length) w.push(`${auxMissing.map(([t, a]) => `${t} (${a.family})`).join(', ')}: no built-in auxiliary contact — an SZ-A11T front block (1 N.O. + 1 N.C.) is added to the BOM; the feedback / interlock uses its N.C. 61-62. Add it to the design or choose another block.`);
  if (m.motors.some((x) => x.vfd)) w.push('VFD: enter the drive parameters marked NAMEPLATE / SET ON SITE on the drive sheets at commissioning; Safe Torque Off is not used (factory jumper) unless the risk assessment calls for it.');
  const noWiring = m.io.filter((p) => !p.wiring);
  if (noWiring.length) w.push(`${noWiring.length} I/O point(s) without wiring info (${noWiring.slice(0, 6).map((p) => p.address).join(', ')}${noWiring.length > 6 ? '…' : ''}) — drawn as generic devices.`);
  const curtains = (m.safety.extraRelays ?? []).filter((x) => x.kind === 'light-curtain').map((x) => x.relay.tag);
  if (curtains.length && m.servos.some((a) => a.sto)) w.push(`${m.servos.filter((a) => a.sto).map((a) => a.drive.tag).join(', ')}: both STO channels come straight from the safety relay ${m.safety.relay?.tag ?? ''}, so a trip of the light curtain relay ${curtains.join(', ')} does not stop the servo. If the axis is in the guarded area, wire the light curtain into the safety relay's inputs (or use a relay with two safety outputs for each curtain).`);
  for (const a of m.servos.filter((x) => !x.sto && x.stoMissing)) {
    w.push(a.stoMissing === 'no-relay'
      ? `${a.drive.tag}: Safe Torque Off (STO) is not wired because the design has no safety relay — the servo drive cannot run without it. Add a safety relay with at least two N.O. safety outputs.`
      : `${a.drive.tag}: the safety relay ${m.safety.relay?.tag ?? ''} has no free N.O. safety output for the second STO channel — STO is not wired and the drive cannot run. Choose a safety relay with more safety outputs, or take the PLC status signal from its N.C. auxiliary contact.`);
  }
  const slots = m.groups.flatMap((g) => { const n = Number(/:(\d+)$/.exec(g.key)?.[1]); return n > 0 ? [{ slot: n, part: g.partNumber ? ctx.getPart(g.partNumber) : undefined }] : []; });
  w.push(...motionWarnings(ctx.getPart(ctx.plc.cpuPartNumber), ctx.plc.cpuPartNumber, m.io, slots));
  // Analog points (DF) are in ctx.io but not in the discrete m.io.
  const extra = ctx.design.ioWiring.filter((x) => !m.io.some((p) => p.address.toUpperCase() === x.address.toUpperCase()) && !(/^DF\d+$/i.test(x.address) && ctx.io.some((p) => p.address.toUpperCase() === x.address.toUpperCase())));
  if (extra.length) w.push(`ioWiring entries not in the project I/O list: ${extra.map((x) => x.address).join(', ')}.`);
  const unaddressed = ctx.io.filter((p) => !p.address).length;
  if (unaddressed) w.push(`${unaddressed} project I/O point(s) have no PLC address and are not drawn.`);
  // capacity
  let inCap = 0, outCap = 0, capKnown = false;
  // Module lines can carry a quantity (e.g. 2 x 16-point input modules).
  const caps: [CatalogPart | undefined, number][] = [[m.plcPart, 1], ...m.rc.filter((c) => c.category === 'plcModule').map((c): [CatalogPart | undefined, number] => [c.part, Math.max(1, c.comp.quantity)])];
  for (const [p, qty] of caps) {
    const i = num(p?.ratings, 'inputs', 'discreteInputs', 'di', 'dcInputs'); const o = num(p?.ratings, 'outputs', 'discreteOutputs', 'do', 'dcOutputs');
    if (i !== undefined || o !== undefined) capKnown = true;
    inCap += (i ?? 0) * qty; outCap += (o ?? 0) * qty;
  }
  const nIn = m.io.filter((p) => p.type === 'input').length, nOut = m.io.filter((p) => p.type === 'output').length;
  if (capKnown && nIn > inCap) w.push(`PLC inputs over capacity: ${nIn} used, ${inCap} available — add an input module.`);
  if (capKnown && nOut > outCap) w.push(`PLC outputs over capacity: ${nOut} used, ${outCap} available — add an output module.`);
  for (const g of m.groups) {
    if (g.type === 'input' && g.points.some((p) => p.deviceType === 'sensor-npn') && g.points.some((p) => p.deviceType === 'sensor-pnp')) w.push(`${g.label}: mixed PNP and NPN sensors on one common — not possible; split commons or change sensors.`);
    // NPN sensors put the common on +24V: the group's dry contacts are wired to switch 0V (said, so the electrician
    // does not "fix" them back to +24V, where they could never turn the input ON)
    const dry = g.type === 'input' && g.commonTo === '24+' ? g.points.filter((p) => p.supplyWire === '0V') : [];
    if (dry.length) w.push(`${g.label}: input common on +24V for its NPN sensors — ${dry.map((p) => `${p.deviceTag || p.address} (${p.address})`).join(', ')} switch 0V into their inputs (sourcing inputs); do not feed them +24V. A device that sources +24V (PNP sensor, OSSD) cannot share this common.`);
  }
  for (const p of m.io) if (!p.deviceTag && p.wiring) w.push(`${p.address}: wiring has no device tag.`);
  // relay logic: every device of a rung is a part of the design (the converter maps each original tag to one), each
  // coil is rated for the rung's rail, and what the reading could not give is asked (relayLogic.ts questions)
  const logic = ctx.design.inputs.relayLogic;
  if (logic) {
    const byTag = new Map(ctx.design.components.map((c) => [c.tag, c]));
    const all = logic.rungs.flatMap((r) => r.path.flatMap((e) => (e.t === 'branch' ? e.paths.flat() : [e])));
    const missing = [...new Set(all.map((e) => e.tag))].filter((t) => t !== '?' && !byTag.has(t));
    if (missing.length) w.push(`Relay logic: ${missing.join(', ')} drawn on the ladder but not in the design's parts — add the part or correct the tag.`);
    for (const c of new Set(all.filter((e) => e.t === 'coil' && e.kind !== 'drive-input').map((e) => e.tag))) {
      const part = byTag.get(c) ? ctx.getPart(byTag.get(c)!.partNumber) : undefined;
      const rating = String(part?.ratings.coilVoltage ?? part?.ratings.volts ?? '');
      if (part && rating && !coilMatchesRail(logic.supply, rating)) w.push(`Relay logic: ${c} ${part.partNumber} is rated ${rating}, but its rung is on the ${logic.supply === '120VAC' ? '120 VAC' : '24 VDC'} rail — choose the ${logic.supply === '120VAC' ? '120 VAC' : '24 VDC'} coil version.`);
    }
    for (const q of m.ladder?.questions ?? []) w.push(`Relay logic: ${q}`);
  }

  w.push(...panelLayout(ctx).warnings);
  // cooling: heat the walls cannot shed needs a filter fan, a heat exchanger or an air conditioner in the design
  {
    const hmiH = ctx.hmiPartNumber ? getHmi(ctx.hmiPartNumber) : undefined;
    const heat = cabinetHeat(ctx.design.components, ctx.getPart, hmiH && ctx.getPart(ctx.hmiPartNumber!)?.category !== 'plc' ? { partNumber: hmiH.partNumber, sizeIn: hmiH.sizeIn } : undefined);
    const cover = heat.ventilation ? coolingCover(ctx.design.components, ctx.getPart, heat.ventilation, ALLOWED_RISE_C) : null;
    if (cover?.fitted && !cover.covers) w.push(`Cabinet cooling too small: the fitted cooling carries ${Math.round(cover.share * 100)} % of the ${heat.ventilation!.wattsToRemove.toFixed(0)} W the walls cannot shed — fit a filter fan of >= ${Math.ceil(heat.ventilation!.airflowM3h)} m³/h, a larger heat exchanger / air conditioner, or a larger enclosure.`);
    if (heat.ventilation && !cover?.fitted) w.push(`Cabinet cooling missing: ${heat.watts.toFixed(0)} W raise the enclosure ${heat.rise!.toFixed(0)} °C (limit ${ALLOWED_RISE_C} °C) — add a filter fan of >= ${Math.ceil(heat.ventilation.airflowM3h)} m³/h with filters (NEMA 1/12), a heat exchanger or an air conditioner, or a larger enclosure.`);
    if (m.fan && !m.fan.dc) w.push(`${m.fan.tag} ${m.fan.partNumber}: AC filter fan — wire it from the control voltage through ${m.fan.thermostat ?? 'a thermostat'} (not drawn).`);
  }
  // one CPU: a second one (e.g. a CPU left in the required parts after a CPU change) is drawn and ordered twice
  const cpus = m.rc.filter((c) => c.category === 'plc');
  if (cpus.length > 1) w.push(`${cpus.length} PLC CPUs in the design (${cpus.map((c) => `${c.tag} ${c.partNumber}`).join(', ')}): keep only the project's CPU ${ctx.plc.cpuPartNumber} — remove the others or update the design.`);
  {
    // enclosure sized from the real footprints: too small (or below the spare rule) -> name the smallest that fits
    const fit = smallestEnclosure(ctx);
    if (fit && !fit.current) {
      const enc = m.rc.find((c) => c.category === 'enclosure' && !isSubpanel(c));
      w.push(`Enclosure ${enc ? `${enc.tag} ${enc.partNumber}` : '(none)'} is too small for the parts with ${Math.round(SPARE_RULE * 100)} % spare space: use ${fit.enclosure}${fit.subpanel ? ` with back panel ${fit.subpanel}` : ''} (${Math.round(fit.spare * 100)} % spare).`);
    } else if (!fit && panelLayout(ctx).overflow) w.push('No catalog enclosure holds all back-panel parts: split the panel or add a larger enclosure to the catalog.');
    else if (!fit) w.push(`The back panel holds all parts but has only ${Math.round(spareSpace(ctx).panel * 100)} % spare space (rule: ${Math.round(SPARE_RULE * 100)} %), and no larger catalog enclosure is available: split the panel or accept less spare space.`);
  }
  w.push(...m.machine.warnings);
  w.push(ctx.region === 'Canada'
    ? 'Wire sizes are suggestions (75°C copper); verify against CEC Table 2 / CSA C22.2 No. 14 and the protective device ratings.'
    : 'Wire sizes are suggestions (75°C copper); verify against NFPA 79 Table 12.5.1 / UL 508A and the protective device ratings.');
  w.push(ctx.region === 'Canada'
    ? 'Calculate and mark the panel SCCR and verify available fault current (CSA C22.2 No. 14 / CEC); obtain CSA/cUL field or factory certification.'
    : 'Calculate and mark the panel SCCR (UL 508A SB) and verify available fault current.');
  return w;
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function bomCsv(ctx: DrawingContext): string {
  const rows: (string | number)[][] = [['Item', 'Qty', 'Part Number', 'Manufacturer', 'Description', 'Device Tags', 'Category']];
  for (const g of billOfMaterials(ctx)) for (const l of g.lines) rows.push([l.item, l.qty, l.partNumber, l.manufacturer, l.description, l.tags.join(' '), g.title]);
  return csv(rows);
}

/** Effective machine wiring (design.machine completed with defaults). */
export function machineWiring(ctx: DrawingContext): MachineWiring {
  return buildModel(ctx).machine.wiring;
}

/** Field cables W001…: trunks cabinet→JB, device cables, motor cables. */
export function cableSchedule(ctx: DrawingContext): Cable[] {
  return buildModel(ctx).machine.cables;
}

/** Junction box terminal plans (incoming trunk cores, outgoing device cables). */
export function junctionBoxPlans(ctx: DrawingContext): JunctionBoxPlan[] {
  return buildModel(ctx).machine.jbs;
}

export function cableScheduleCsv(ctx: DrawingContext): string {
  const rows: (string | number)[][] = [['Cable', 'Kind', 'Zone', 'From', 'To', 'Type', 'Part Number', 'Size', 'Length', 'Spare Cores', 'Core', 'Color', 'Wire', 'Core From', 'Core To']];
  for (const c of cableSchedule(ctx)) for (const k of c.cores) rows.push([c.tag, c.kind, c.zone, c.from, c.to, c.type, c.partNumber ?? '', c.size, c.length, c.spareCores, k.core, k.color, k.wire, k.from, k.to]);
  return csv(rows);
}

export function wireListCsv(ctx: DrawingContext): string {
  const rows: (string | number)[][] = [['Wire', 'From', 'To', 'Color', 'Size', 'Function']];
  for (const w of wireNumbers(ctx)) rows.push([w.wire, w.from, w.to, w.color, w.size, w.function]);
  return csv(rows);
}

export function terminalPlanCsv(ctx: DrawingContext): string {
  const rows: (string | number)[][] = [['Strip', 'Terminal', 'Wire', 'Internal', 'External', 'Type']];
  for (const s of terminalPlan(ctx)) for (const t of s.terminals) rows.push([s.tag, t.number, t.wire, t.internal, t.external, t.kind]);
  return csv(rows);
}

// ---------------------------------------------------------------------------
// Document control, PLC rack and nameplate data (used by the drawing set)
// ---------------------------------------------------------------------------

export type RevisionEntry = DocInfo['revisions'][number];

export interface RevisionState {
  /** Current revision letter ("A" when nothing has been issued yet). */
  rev: string;
  /** Date of the current revision ("" when not issued). */
  date: string;
  /** True until a revision whose description mentions "construction" (and not "not for construction") exists. */
  preliminary: boolean;
  /** Stamp text, e.g. "PRELIMINARY — NOT FOR CONSTRUCTION" or "ISSUED FOR CONSTRUCTION". */
  status: string;
  /** All revisions, oldest first (empty when not yet issued). */
  revisions: RevisionEntry[];
  current?: RevisionEntry;
}

/** Current revision, issue status and history from the project's document control data. */
export function revisionState(doc: DocInfo | undefined): RevisionState {
  const revisions = (doc?.revisions ?? []).filter((r) => r && (r.rev || r.description || r.date));
  const current = revisions[revisions.length - 1];
  const preliminary = !issuedForConstruction({ revisions, checkedBy: doc?.checkedBy, approvedBy: doc?.approvedBy });
  const rev = current?.rev?.trim() || 'A';
  let status = 'PRELIMINARY — NOT FOR CONSTRUCTION';
  if (!preliminary) status = /as[- ]?built/i.test(current?.description ?? '') ? 'AS-BUILT' : 'ISSUED FOR CONSTRUCTION';
  return { rev, date: current?.date?.trim() ?? '', preliminary, status, revisions, current };
}

/** Drawing / document number prefix: the user's prefix (upper case) or "PRJ". */
export function drawingPrefix(doc: DocInfo | undefined): string {
  return (doc?.prefix ?? '').trim().toUpperCase().replace(/\s+/g, '-') || 'PRJ';
}

export interface PlcRackSlot {
  /** 0 = CPU, 1..8 = expansion slots (CLICK numbering: X101 = slot 1 point 01). */
  slot: number;
  tag: string;
  partNumber: string;
  part?: CatalogPart;
  description: string;
  /** Discrete input / output point counts from the catalog (0 when unknown). */
  inputs: number;
  outputs: number;
  outputStyle: IoGroup['outputStyle'];
  /** True when the catalog gives the point counts (spare points can be listed). */
  known: boolean;
}

/** CPU + discrete I/O modules in slot order, with point counts from the catalog. */
export function plcRack(ctx: DrawingContext): PlcRackSlot[] {
  const m = buildModel(ctx);
  const ins = (p?: CatalogPart) => num(p?.ratings, 'inputs', 'discreteInputs', 'di', 'dcInputs');
  const outs = (p?: CatalogPart) => num(p?.ratings, 'outputs', 'discreteOutputs', 'do', 'dcOutputs');
  const out: PlcRackSlot[] = [];
  const cpu = m.plcPart;
  out.push({
    slot: 0, tag: m.plcTag, partNumber: ctx.plc.cpuPartNumber, part: cpu, description: cpu?.description ?? ctx.plc.cpuLabel,
    inputs: ins(cpu) ?? 0, outputs: outs(cpu) ?? 0, outputStyle: outputStyleOf(ctx.plc.cpuPartNumber, cpu), known: ins(cpu) !== undefined || outs(cpu) !== undefined,
  });
  const modules = byCat(m.rc, 'plcModule');
  let free = 0;
  for (const mod of modules) {
    const fixed = num(mod.part?.ratings, 'slot');
    const slot = fixed ?? ++free;
    const i = ins(mod.part), o = outs(mod.part);
    if (i === undefined && o === undefined) continue; // analog / specialty modules: not discrete I/O
    out.push({ slot, tag: mod.tag, partNumber: mod.partNumber, part: mod.part, description: mod.part?.description ?? mod.comp.function, inputs: i ?? 0, outputs: o ?? 0, outputStyle: outputStyleOf(mod.partNumber, mod.part), known: true });
  }
  return out.sort((a, b) => a.slot - b.slot);
}

export interface NameplateData {
  supplyText: string;
  volts: number;
  phases: 1 | 3;
  hz: number;
  /** Largest motor full-load current (NEC/CEC table), null without motors. */
  largestMotorFla: number | null;
  /** Panel full-load current: motors + estimated control load (A). */
  fullLoadAmps: number;
  motorAmps: number;
  controlAmps: number;
  enclosureType: string;
  /** Short-circuit current rating is not calculated — always "to be determined". */
  sccr: string;
  /** Circuits supplied from outside the main disconnect (none are modelled: false unless a component says so). */
  multipleSources: boolean;
  disconnectTag: string;
}

/** Data for the panel nameplate (supply, full-load current, enclosure type). Estimates are flagged in the text. */
export function panelNameplate(ctx: DrawingContext): NameplateData {
  const m = buildModel(ctx);
  const volts = SUPPLY_INFO[m.supply].volts;
  const motorAmps = m.motors.reduce((s, x) => s + x.fla, 0);
  const largest = m.motors.length ? Math.max(...m.motors.map((x) => x.fla)) : null;
  let controlAmps = 0;
  if (m.transformer) {
    const va = num(m.transformer.part?.ratings, 'va') ?? 0;
    controlAmps = va / volts;
  } else {
    for (const b of m.psBranches) {
      const w = num(b.ps.part?.ratings, 'watts') ?? (num(b.ps.part?.ratings, 'outputAmps', 'amps') ?? 0) * 24;
      const three = b.feedWires.length === 3;
      controlAmps += w / 0.85 / (three ? Math.sqrt(3) * volts : volts);
    }
  }
  const r1v = (v: number) => Math.round(v * 10) / 10;
  const multipleSources = m.rc.some((c) => /\b(separate|external|foreign|second) (supply|source)|\bups\b|multiple sources/i.test(`${c.comp.function} ${c.part?.description ?? ''}`));
  return {
    supplyText: supplyText(m.supply), volts, phases: m.phases, hz: SUPPLY_INFO[m.supply].hz, largestMotorFla: largest,
    fullLoadAmps: r1v(motorAmps + controlAmps), motorAmps: r1v(motorAmps), controlAmps: r1v(controlAmps),
    enclosureType: ctx.design.inputs.enclosureRating, sccr: 'TBD — CALCULATE', multipleSources, disconnectTag: m.disconnect?.tag ?? 'DS1',
  };
}
