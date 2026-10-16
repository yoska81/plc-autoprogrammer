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
import type {
  CatalogCategory, CatalogPart, DesignComponent, ElectricalDesign, FieldDeviceType, IOWiring,
  MotorSpec, MountLocation, SupplyVoltage,
} from './types';

export interface DrawingContext {
  projectName: string;
  design: ElectricalDesign;
  getPart: (partNumber: string) => CatalogPart | undefined;
  plc: { vendor: string; name: string; cpuPartNumber: string; cpuLabel: string };
  /** Project I/O resolved to PLC addresses. */
  io: { address: string; description: string; type: 'input' | 'output' }[];
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
  const amps = num(r, 'amps', 'current', 'ampRating');
  const range = str(r, 'range', 'setting', 'ampRange');
  const poles = num(r, 'poles');
  const watts = num(r, 'watts');
  const volts = str(r, 'outputVoltage', 'output');
  const hp = num(r, 'hp480', 'hp', 'hp230');
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
const FLA_3PH: [number, number, number, number][] = [
  // hp, 460V, 230V, 208V
  [0.5, 1.1, 2.2, 2.4], [0.75, 1.6, 3.2, 3.5], [1, 2.1, 4.2, 4.6], [1.5, 3.0, 6.0, 6.6], [2, 3.4, 6.8, 7.5],
  [3, 4.8, 9.6, 10.6], [5, 7.6, 15.2, 16.7], [7.5, 11, 22, 24.2], [10, 14, 28, 30.8], [15, 21, 42, 46.2],
  [20, 27, 54, 59.4], [25, 34, 68, 74.8], [30, 40, 80, 88], [40, 52, 104, 114], [50, 65, 130, 143],
  [60, 77, 154, 169], [75, 96, 192, 211], [100, 124, 248, 273],
];
const FLA_1PH_115: [number, number][] = [[0.17, 4.4], [0.25, 5.8], [0.33, 7.2], [0.5, 9.8], [0.75, 13.8], [1, 16], [1.5, 20], [2, 24], [3, 34], [5, 56]];

/** Motor full-load amps per NEC tables (next size up when the HP is between rows). */
export function motorFla(hp: number, voltage: SupplyVoltage): number {
  if (voltage === '120VAC-1PH') {
    const row = FLA_1PH_115.find(([h]) => h >= hp) ?? FLA_1PH_115[FLA_1PH_115.length - 1];
    return row[1];
  }
  const row = FLA_3PH.find(([h]) => h >= hp) ?? FLA_3PH[FLA_3PH.length - 1];
  return voltage === '480VAC-3PH' ? row[1] : voltage === '240VAC-3PH' ? row[2] : row[3];
}

/** Suggested copper conductor (75°C, in enclosure) for a continuous current, min 14 AWG for power. */
export function awgFor(amps: number): string {
  const table: [number, string][] = [[15, '14 AWG'], [20, '12 AWG'], [30, '10 AWG'], [40, '8 AWG'], [55, '6 AWG'], [70, '4 AWG'], [95, '2 AWG'], [130, '1/0 AWG'], [175, '2/0 AWG'], [230, '4/0 AWG']];
  return (table.find(([a]) => a >= amps) ?? table[table.length - 1])[1];
}

function supplyPhases(s: SupplyVoltage): 1 | 3 { return s === '120VAC-1PH' ? 1 : 3; }

export function supplyText(s: SupplyVoltage): string {
  switch (s) {
    case '120VAC-1PH': return '120VAC 1PH 60Hz';
    case '208VAC-3PH': return '208VAC 3PH 60Hz';
    case '240VAC-3PH': return '240VAC 3PH 60Hz';
    case '480VAC-3PH': return '480VAC 3PH 60Hz';
  }
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

export interface PsBranch { protection?: ResolvedComponent; ps: ResolvedComponent; feedWires: string[]; protectedPoles: number }
export interface AuxBranch { protection: ResolvedComponent; feedWires: string[]; protectedPoles: number }

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
  /** For PLC-driven coils on the control sheet: chain of series devices and wires. */
  coilChain?: { devices: { tag: string; terminals: string; nc: boolean; kind: 'ol' | 'interlock' }[]; wires: string[] };
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

export interface SafetyModel {
  relay?: ResolvedComponent;
  estops: string[];
  reset?: string;
  mcr?: ResolvedComponent;
  edm: string[];
  statusInput?: IoPoint;
  /** Wire supplying PLC outputs: 24+S when switched by safety, else 24+. */
  outputSupply: string;
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
}

export interface TerminalStrip {
  tag: string;
  title: string;
  terminals: Terminal[];
  endPlates: number;
  endStops: number;
}

export interface ElectricalModel {
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
}

const cache = new WeakMap<DrawingContext, ElectricalModel>();

/** Builds (and caches per context object) the full derived model. */
export function buildModel(ctx: DrawingContext): ElectricalModel {
  const hit = cache.get(ctx);
  if (hit) return hit;
  const m = computeModel(ctx);
  cache.set(ctx, m);
  return m;
}

export function resolveComponents(ctx: DrawingContext): ResolvedComponent[] {
  return ctx.design.components.map((comp) => {
    const part = comp.partNumber ? ctx.getPart(comp.partNumber) : undefined;
    const category = part?.category ?? guessCategory(comp.tag);
    return { comp, tag: comp.tag, partNumber: comp.partNumber, part, category, mount: part?.mount ?? defaultMount(category) };
  });
}

function byCat(rc: ResolvedComponent[], ...cats: CatalogCategory[]) {
  return rc.filter((c) => cats.includes(c.category)).sort((a, b) => naturalCompare(a.tag, b.tag));
}

function poles(rc: ResolvedComponent | undefined, fallback: number): number {
  return num(rc?.part?.ratings, 'poles') ?? fallback;
}

/** Device location for an I/O point. */
function ioLocation(rc: ResolvedComponent | undefined, t: FieldDeviceType): IoPoint['location'] {
  if (t === 'contactor-coil' || t === 'relay-coil' || t === 'vfd-input' || t === 'safety-relay-output') return 'internal';
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

function outputStyleOf(pn: string | undefined, part: CatalogPart | undefined): IoGroup['outputStyle'] {
  const r = str(part?.ratings, 'outputType', 'outputs', 'output');
  const s = `${r ?? ''} ${part?.description ?? ''} ${pn ?? ''}`.toLowerCase();
  if (/sinking|nPN|dd1|td1/i.test(s)) return 'sinking';
  if (/relay|dre|dr-|tr\b|-tr/i.test(s) && !/sourcing/.test(s)) return 'relay';
  return 'sourcing';
}

function letter(i: number): string { return i === 0 ? '' : String.fromCharCode(64 + i); }

function computeModel(ctx: DrawingContext): ElectricalModel {
  const rc = resolveComponents(ctx);
  const supply = ctx.design.inputs.supply;
  const phases = supplyPhases(supply);
  const incoming = phases === 3 ? ['L1', 'L2', 'L3'] : ['L1', 'N'];
  const bus = phases === 3 ? ['1L1', '1L2', '1L3'] : ['1L1', 'N'];
  const wires: WireRecord[] = [];
  const addWire = (w: WireRecord) => wires.push(w);

  const disconnect = byCat(rc, 'disconnect')[0];
  const looseProt = byCat(rc, 'breaker', 'fuse').filter((c) => !c.comp.motorTag);
  const mainBreaker = looseProt.find((c) => /main/i.test(c.comp.function) && c.category === 'breaker');
  const rest = looseProt.filter((c) => c !== mainBreaker);
  const pss = byCat(rc, 'powerSupply');
  const psProt = rest.filter((c) => /power supply|24 ?v|\bps\d|dc supply|psu/i.test(`${c.comp.function} ${c.comp.tag}`));
  const transformer = rc.find((c) => /transformer/i.test(`${c.part?.description ?? ''} ${c.comp.function}`) && c.category !== 'powerSupply');
  const used = new Set<ResolvedComponent>();
  const psBranches: PsBranch[] = pss.map((ps) => {
    const byName = psProt.find((p) => !used.has(p) && new RegExp(`\\b${ps.tag}\\b`, 'i').test(p.comp.function));
    const protection = byName ?? psProt.filter((p) => !used.has(p))[0];
    if (protection) used.add(protection);
    const inPh = num(ps.part?.ratings, 'phases', 'inputPhases');
    const n = phases === 1 ? 2 : inPh === 3 ? 3 : 2;
    const feedWires = phases === 1 ? [`${ps.tag}-L1`, 'N'] : Array.from({ length: n }, (_, k) => `${ps.tag}-L${k + 1}`);
    return { protection, ps, feedWires, protectedPoles: phases === 1 ? 1 : n };
  });
  const auxBranches: AuxBranch[] = rest.filter((c) => !used.has(c)).map((protection) => {
    const p = Math.min(poles(protection, phases === 1 ? 1 : 2), phases === 1 ? 1 : 3);
    const feedWires = phases === 1 ? [`${protection.tag}-L1`, 'N'] : Array.from({ length: p }, (_, k) => `${protection.tag}-L${k + 1}`);
    return { protection, feedWires, protectedPoles: p };
  });
  const groundBar = byCat(rc, 'groundBar')[0];

  // ---- motors
  const motors: MotorModel[] = ctx.design.inputs.motors.map((motor) => {
    const own = rc.filter((c) => c.comp.motorTag === motor.tag);
    const fla = motorFla(motor.hp, motor.voltage);
    const prot = own.find((c) => c.category === 'motorProtector') ?? own.find((c) => c.category === 'breaker' || c.category === 'fuse');
    let contactors = own.filter((c) => c.category === 'contactor').sort((a, b) => naturalCompare(a.tag, b.tag));
    if (motor.reversing && contactors.length >= 2) {
      const fwd = contactors.find((c) => /fwd|forward/i.test(c.comp.function)) ?? contactors[0];
      const rev = contactors.find((c) => c !== fwd && /rev|reverse/i.test(c.comp.function)) ?? contactors.find((c) => c !== fwd)!;
      contactors = [fwd, rev];
    }
    const overload = own.find((c) => c.category === 'overload');
    const vfd = own.find((c) => c.category === 'vfd');
    const ph = motor.voltage === '120VAC-1PH' ? 2 : 3;
    const idx = Array.from({ length: ph }, (_, k) => k + 1);
    return {
      motor, fla, awg: awgFor(fla * 1.25), protection: prot, contactors, overload, vfd,
      // 120VAC single-phase motors keep the grounded conductor numbered "N" end to end.
      lineWires: idx.map((k) => (ph === 2 && k === 2 ? 'N' : `${motor.tag}-L${k}`)),
      midWires: idx.map((k) => (ph === 2 && k === 2 ? 'N' : `${motor.tag}-C${k}`)),
      loadWires: idx.map((k) => (ph === 2 && k === 2 ? 'N' : `${motor.tag}-T${k}`)),
      terminals: [],
    };
  });

  // ---- safety
  const relay = byCat(rc, 'safetyRelay')[0];
  const estopTags = byCat(rc, 'estop').map((c) => c.tag);
  const ioW = ctx.design.ioWiring;
  for (const w of ioW) if (w.deviceType === 'estop-contact' && !estopTags.includes(w.deviceTag)) estopTags.push(w.deviceTag);
  const resetRc = byCat(rc, 'pushbutton').find((c) => /reset/i.test(c.comp.function));
  const reset = resetRc?.tag ?? ioW.find((w) => /reset/i.test(w.description) && w.deviceType === 'pushbutton-no')?.deviceTag;
  const mcr = byCat(rc, 'relay').find((c) => /master|mcr|safety/i.test(`${c.comp.function} ${c.tag}`));
  const edm = mcr ? [mcr.tag] : motors.flatMap((m) => m.contactors.map((c) => c.tag));
  const hasSafety = !!relay || estopTags.length > 0;
  const safety: SafetyModel = { relay, estops: estopTags, reset, mcr, edm, outputSupply: hasSafety ? '24+S' : '24+' };

  // ---- PLC & IO points
  const plcRc = byCat(rc, 'plc')[0];
  const plcPart = ctx.getPart(ctx.plc.cpuPartNumber) ?? plcRc?.part;
  const plcTag = plcRc?.tag ?? 'PLC1';
  const rcByTag = new Map(rc.map((c) => [c.tag, c] as const));
  const wiringByAddr = new Map(ioW.map((w) => [w.address.toUpperCase(), w] as const));
  let rawIo = ctx.io.filter((p) => p.address);
  if (rawIo.length === 0) rawIo = ioW.map((w) => ({ address: w.address, description: w.description, type: guessIoType(w.address) }));
  const sorted = [...rawIo].sort((a, b) => (a.type === b.type ? naturalCompare(a.address, b.address) : a.type === 'input' ? -1 : 1));
  const counters = { input: 0, output: 0 };
  const io: IoPoint[] = sorted.map((p) => {
    const wiring = wiringByAddr.get(p.address.toUpperCase());
    const deviceType: FieldDeviceType = wiring?.deviceType ?? 'other';
    const deviceTag = wiring?.deviceTag ?? '';
    const loc = ioLocation(rcByTag.get(deviceTag), deviceType);
    const i = counters[p.type]++;
    return { address: p.address, type: p.type, description: p.description || wiring?.description || '', wiring, deviceTag, deviceType, location: loc, group: groupKey(p.address, p.type, i), wire: p.address };
  });

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

  // safety status input
  safety.statusInput = io.find((p) => p.deviceType === 'safety-relay-output');

  // coil chains for PLC-driven contactors/relays
  for (const p of io) {
    if (p.type !== 'output' || (p.deviceType !== 'contactor-coil' && p.deviceType !== 'relay-coil')) continue;
    const devices: NonNullable<IoPoint['coilChain']>['devices'] = [];
    const mm = motors.find((m) => m.contactors.some((c) => c.tag === p.deviceTag));
    if (mm?.overload) devices.push({ tag: mm.overload.tag, terminals: '95-96', nc: true, kind: 'ol' });
    if (mm && mm.motor.reversing && mm.contactors.length === 2) {
      const other = mm.contactors.find((c) => c.tag !== p.deviceTag);
      if (other) devices.push({ tag: other.tag, terminals: '21-22', nc: true, kind: 'interlock' });
    }
    p.coilChain = { devices, wires: [p.address, ...devices.map((_, k) => `${p.address}${letter(k + 1)}`)] };
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
  for (const p of io) if (p.coilChain) zero.push(`${p.deviceTag}:A2`);
  if (io.some((p) => p.type === 'input' && p.location === 'field')) { plus.push('TB2 FIELD 24+'); zero.push('TB2 FIELD 0V'); }
  if (io.some((p) => p.type === 'output' && p.location !== 'internal')) {
    const anySink = groups.some((g) => g.type === 'output' && g.outputStyle === 'sinking');
    zero.push('TB3 LOAD 0V');
    if (anySink) outSupply.push('TB3 LOAD 24+S');
  }
  for (const c of plus) add(tb1, { wire: '24+', internal: `${psMain}:+V`, external: c, kind: 'feed', group: '24+' });
  if (safety.outputSupply === '24+S') for (const c of outSupply) add(tb1, { wire: '24+S', internal: relay ? `${mcr ? mcr.tag : relay.tag}:14` : `${estopTags.at(-1) ?? 'ES'}:12`, external: c, kind: 'feed', group: '24+S' });
  else for (const c of outSupply) add(tb1, { wire: '24+', internal: `${psMain}:+V`, external: c, kind: 'feed', group: '24+' });
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
      const sensor = p.deviceType === 'sensor-pnp' || p.deviceType === 'sensor-npn';
      p.signalTerminal = add(tb2, { wire: p.address, internal: `${plcTag}:${p.address}`, external: `${tag}:${sensor ? 'BK' : 'NO'}`, kind: 'feed', group: tag });
      p.supplyTerminal = add(tb2, { wire: '24+', internal: 'TB1 24+ (jumper)', external: `${tag}:${sensor ? 'BN' : 'C'}`, kind: 'feed', group: tag });
      if (sensor) p.returnTerminal = add(tb2, { wire: '0V', internal: 'TB1 0V (jumper)', external: `${tag}:BU`, kind: 'feed', group: tag });
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
      const pin = p.deviceType === 'stack-light' ? `${tag}:${(p.description.match(/red|amber|yellow|green|blue|white|horn|buzzer/i)?.[0] ?? p.address).toUpperCase()}` : `${tag}:${p.deviceType === 'pilot-light' ? 'X1' : 'A1'}`;
      p.signalTerminal = add(tb3, { wire: p.address, internal: `${plcTag}:${p.address}`, external: pin, kind: 'feed', group: tag });
      const retWire = sink ? safety.outputSupply : '0V';
      const key = `${tag}|${retWire}`;
      if (retDone.has(key)) p.returnTerminal = retDone.get(key);
      else {
        p.returnTerminal = add(tb3, { wire: retWire, internal: `TB1 ${retWire} (jumper)`, external: `${tag}:${p.deviceType === 'pilot-light' ? 'X2' : p.deviceType === 'stack-light' ? 'COM' : 'A2'}`, kind: 'feed', group: tag });
        retDone.set(key, p.returnTerminal);
      }
    }
    add(tb3, { wire: 'PE', internal: groundBar?.tag ?? 'PE BAR', external: 'FIELD PE', kind: 'ground', group: 'PE' });
    addSpares(tb3, 2);
  }

  // ---- wires
  const pe = groundBar?.tag ?? 'PE BAR';
  const dsTag = disconnect?.tag ?? 'DS1';
  const loadPhase = (k: number) => (phases === 1 && k === 1 ? 'N' : `T${k + 1}`);
  const fullLoad = motors.reduce((s, m) => s + m.fla, 0);
  const largest = motors.reduce((s, m) => Math.max(s, m.fla), 0);
  const mainAwg = awgFor(fullLoad + largest * 0.25 + psBranches.length * 2);
  incoming.forEach((w, k) => addWire({ wire: w, from: 'SUPPLY', to: phases === 1 && k === 1 ? `${pe} (N)` : `${dsTag}:L${k + 1}`, color: w === 'N' ? 'WH' : 'BK', size: mainAwg, function: `Incoming supply ${supplyText(supply)}` }));
  addWire({ wire: 'PE', from: 'SUPPLY PE', to: pe, color: 'GN/YE', size: mainAwg, function: 'Incoming protective earth' });
  // bus chain
  const busTaps: { tag: string; poles: number }[] = [];
  if (mainBreaker) busTaps.push({ tag: mainBreaker.tag, poles: phases === 1 ? 1 : 3 });
  for (const m of motors) if (m.protection ?? m.vfd ?? m.contactors[0]) busTaps.push({ tag: (m.protection ?? m.vfd ?? m.contactors[0]).tag, poles: m.lineWires.length });
  for (const b of psBranches) busTaps.push({ tag: b.protection?.tag ?? b.ps.tag, poles: b.feedWires.length });
  for (const b of auxBranches) busTaps.push({ tag: b.protection.tag, poles: b.feedWires.length });
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
  for (const b of psBranches) {
    b.feedWires.forEach((w, k) => addWire({ wire: w, from: w === 'N' ? 'N' : `${b.protection?.tag ?? '1L'}:T${k + 1}`, to: `${b.ps.tag}:${w === 'N' ? 'N' : phases === 1 ? 'L' : `L${k + 1}`}`, color: w === 'N' ? 'WH' : 'BK', size: '14 AWG', function: `${b.ps.tag} primary feed` }));
    addWire({ wire: 'PE', from: `${b.ps.tag}:PE`, to: pe, color: 'GN/YE', size: '14 AWG', function: `${b.ps.tag} ground` });
    addWire({ wire: '24+', from: `${b.ps.tag}:+V`, to: 'TB1 24+', color: 'BU', size: '16 AWG', function: '+24VDC distribution' });
    addWire({ wire: '0V', from: `${b.ps.tag}:-V`, to: 'TB1 0V', color: 'WH/BU', size: '16 AWG', function: '0V DC common' });
  }
  if (psBranches.length) addWire({ wire: '0V', from: 'TB1 0V', to: pe, color: 'WH/BU', size: '14 AWG', function: '0V bonded to PE (grounded DC control circuit)' });
  for (const b of auxBranches) b.feedWires.forEach((w, k) => addWire({ wire: w, from: `${b.protection.tag}:T${k + 1}`, to: b.protection.comp.function || 'LOAD', color: w === 'N' ? 'WH' : 'BK', size: '14 AWG', function: b.protection.comp.function }));
  for (const m of motors) {
    const prot = m.protection?.tag;
    const lineTo = m.vfd ? m.vfd.tag : m.contactors[0]?.tag;
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
      const devs = estopTags.length ? estopTags : ['ES?'];
      devs.forEach((tag, k) => {
        const [t1, t2] = contactTerms.split('-');
        addWire({ wire: k === 0 ? a : `${a}${letter(k)}`, from: k === 0 ? `${relay.tag}:${a}` : `${devs[k - 1]}:${t2}`, to: `${tag}:${t1}`, color: 'BU', size: '18 AWG', function: 'E-stop channel' });
      });
      addWire({ wire: b, from: `${devs[devs.length - 1]}:${contactTerms.split('-')[1]}`, to: `${relay.tag}:${b}`, color: 'BU', size: '18 AWG', function: 'E-stop channel' });
    };
    chain('S11', 'S12', '11-12');
    chain('S21', 'S22', '21-22');
    const rs = [reset ?? 'RESET', ...edm];
    rs.forEach((tag, k) => addWire({ wire: k === 0 ? 'S33' : `S33${letter(k)}`, from: k === 0 ? `${relay.tag}:S33` : `${rs[k - 1]}:${k - 1 === 0 ? '14' : '22'}`, to: `${tag}:${k === 0 ? '13' : '21'}`, color: 'BU', size: '18 AWG', function: k === 0 ? 'Safety reset' : 'Feedback (EDM) loop' }));
    addWire({ wire: 'S34', from: `${rs[rs.length - 1]}:${rs.length === 1 ? '14' : '22'}`, to: `${relay.tag}:S34`, color: 'BU', size: '18 AWG', function: 'Feedback (EDM) loop' });
    addWire({ wire: '24+', from: 'TB1 24+', to: `${relay.tag}:13`, color: 'BU', size: '18 AWG', function: 'Safety output supply' });
    if (mcr) {
      addWire({ wire: 'SR14', from: `${relay.tag}:14`, to: `${mcr.tag}:A1`, color: 'BU', size: '18 AWG', function: 'MCR coil (safety output)' });
      addWire({ wire: '0V', from: `${mcr.tag}:A2`, to: 'TB1 0V', color: 'WH/BU', size: '18 AWG', function: 'MCR coil' });
      addWire({ wire: '24+', from: 'TB1 24+', to: `${mcr.tag}:13`, color: 'BU', size: '18 AWG', function: 'MCR contact supply' });
      addWire({ wire: '24+S', from: `${mcr.tag}:14`, to: 'TB1 24+S', color: 'BU', size: '16 AWG', function: 'Safety-switched +24V' });
    } else addWire({ wire: '24+S', from: `${relay.tag}:14`, to: 'TB1 24+S', color: 'BU', size: '16 AWG', function: 'Safety-switched +24V' });
    if (safety.statusInput) {
      addWire({ wire: '24+', from: 'TB1 24+', to: `${relay.tag}:23`, color: 'BU', size: '18 AWG', function: 'Safety status contact' });
      addWire({ wire: safety.statusInput.address, from: `${relay.tag}:24`, to: `${plcTag}:${safety.statusInput.address}`, color: 'BU', size: '18 AWG', function: 'Safety relay status to PLC' });
    }
  } else if (estopTags.length) {
    estopTags.forEach((tag, k) => addWire({ wire: k === 0 ? '24+' : `ES${k}`, from: k === 0 ? 'TB1 24+' : `${estopTags[k - 1]}:12`, to: `${tag}:11`, color: 'BU', size: '18 AWG', function: 'E-stop chain' }));
    addWire({ wire: '24+S', from: `${estopTags[estopTags.length - 1]}:12`, to: mcr ? `${mcr.tag}:A1` : 'TB1 24+S', color: 'BU', size: '16 AWG', function: 'E-stop switched +24V' });
  }
  // PLC power & commons
  addWire({ wire: '24+', from: 'TB1 24+', to: `${plcTag}:24V`, color: 'BU', size: '18 AWG', function: 'PLC power' });
  addWire({ wire: '0V', from: `${plcTag}:0V`, to: 'TB1 0V', color: 'WH/BU', size: '18 AWG', function: 'PLC power' });
  for (const g of groups) {
    const slot = g.key.split(':')[1];
    if (g.type === 'input') addWire({ wire: g.commonTo, from: `${g.devTag}:COM`, to: `TB1 ${g.commonTo}`, color: g.commonTo === '0V' ? 'WH/BU' : 'BU', size: '18 AWG', function: `Input common slot ${slot}` });
    else if (g.outputStyle === 'sinking') addWire({ wire: '0V', from: `${g.devTag}:C`, to: 'TB1 0V', color: 'WH/BU', size: '18 AWG', function: `Output common slot ${slot}` });
    else addWire({ wire: safety.outputSupply, from: `TB1 ${safety.outputSupply}`, to: `${g.devTag}:+V`, color: 'BU', size: '18 AWG', function: `Output supply slot ${slot}` });
  }
  // IO wires
  for (const p of io) {
    if (safety.statusInput === p) continue;
    const tag = p.deviceTag || '(device)';
    const g = groups.find((x) => x.key === p.group);
    if (p.type === 'input') {
      if (p.signalTerminal) {
        addWire({ wire: p.address, from: `${tag}:${p.deviceType.startsWith('sensor') ? 'BK' : 'NO'}`, to: p.signalTerminal, color: p.deviceType.startsWith('sensor') ? 'BK (cable)' : 'BU', size: '18 AWG', function: p.description });
        addWire({ wire: p.address, from: p.signalTerminal, to: `${plcTag}:${p.address}`, color: 'BU', size: '18 AWG', function: p.description });
        if (p.supplyTerminal) addWire({ wire: '24+', from: p.supplyTerminal, to: `${tag}:${p.deviceType.startsWith('sensor') ? 'BN' : 'C'}`, color: p.deviceType.startsWith('sensor') ? 'BN (cable)' : 'BU', size: '18 AWG', function: `${tag} supply` });
        if (p.returnTerminal) addWire({ wire: '0V', from: p.returnTerminal, to: `${tag}:BU`, color: 'BU (cable)', size: '18 AWG', function: `${tag} 0V` });
      } else {
        addWire({ wire: '24+', from: 'TB1 24+', to: `${tag}:C`, color: 'BU', size: '18 AWG', function: `${tag} supply` });
        addWire({ wire: p.address, from: `${tag}:${p.deviceType === 'pushbutton-nc' ? 'NC' : 'NO'}`, to: `${plcTag}:${p.address}`, color: 'BU', size: '18 AWG', function: p.description });
      }
    } else {
      const sink = g?.outputStyle === 'sinking';
      if (p.coilChain) {
        const ch = p.coilChain;
        ch.devices.forEach((d, k) => addWire({ wire: ch.wires[k], from: k === 0 ? `${plcTag}:${p.address}` : `${ch.devices[k - 1].tag}:${ch.devices[k - 1].terminals.split('-')[1]}`, to: `${d.tag}:${d.terminals.split('-')[0]}`, color: 'BU', size: '18 AWG', function: p.description }));
        const last = ch.devices.length ? `${ch.devices[ch.devices.length - 1].tag}:${ch.devices[ch.devices.length - 1].terminals.split('-')[1]}` : `${plcTag}:${p.address}`;
        addWire({ wire: ch.wires[ch.wires.length - 1], from: last, to: `${tag}:A1`, color: 'BU', size: '18 AWG', function: p.description });
        addWire({ wire: '0V', from: `${tag}:A2`, to: 'TB1 0V', color: 'WH/BU', size: '18 AWG', function: `${tag} coil return` });
      } else if (p.signalTerminal) {
        addWire({ wire: p.address, from: `${plcTag}:${p.address}`, to: p.signalTerminal, color: 'BU', size: '18 AWG', function: p.description });
        addWire({ wire: p.address, from: p.signalTerminal, to: tbExternal(strips, p.signalTerminal), color: 'BU', size: '18 AWG', function: p.description });
        if (p.returnTerminal) addWire({ wire: sink ? safety.outputSupply : '0V', from: tbExternal(strips, p.returnTerminal), to: p.returnTerminal, color: sink ? 'BU' : 'WH/BU', size: '18 AWG', function: `${tag} return` });
      } else {
        addWire({ wire: p.address, from: `${plcTag}:${p.address}`, to: `${tag}:${p.deviceType === 'vfd-input' ? 'DI' : p.deviceType === 'pilot-light' ? 'X1' : 'A1'}`, color: 'BU', size: '18 AWG', function: p.description });
        if (p.deviceType === 'vfd-input') addWire({ wire: '0V', from: `${tag}:DCM`, to: 'TB1 0V', color: 'WH/BU', size: '18 AWG', function: `${tag} digital input common` });
        else addWire({ wire: sink ? safety.outputSupply : '0V', from: `${tag}:${p.deviceType === 'pilot-light' ? 'X2' : 'A2'}`, to: `TB1 ${sink ? safety.outputSupply : '0V'}`, color: sink ? 'BU' : 'WH/BU', size: '18 AWG', function: `${tag} return` });
      }
    }
  }

  return {
    rc, supply, phases, incoming, bus, disconnect, mainBreaker, psBranches, auxBranches, transformer, groundBar,
    motors, safety, io, groups, strips, wires, plcPart, plcTag, mainAwg,
  };
}

function tbExternal(strips: TerminalStrip[], label: string): string {
  for (const s of strips) for (const t of s.terminals) if (t.label === label) return t.external;
  return '?';
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
  enclosure: 'Enclosure', disconnect: 'Disconnect', breaker: 'Circuit breakers', fuse: 'Fuses', powerSupply: 'Power supplies',
  contactor: 'Contactors', overload: 'Overload relays', motorProtector: 'Motor protectors', vfd: 'Variable frequency drives',
  relay: 'Relays', safetyRelay: 'Safety relays', terminal: 'Terminal blocks', terminalAccessory: 'Terminal accessories',
  pushbutton: 'Pushbuttons', estop: 'Emergency stops', pilotLight: 'Pilot lights', selector: 'Selector switches', stackLight: 'Stack lights',
  plc: 'PLC', plcModule: 'PLC I/O modules', hmi: 'HMI', sensor: 'Sensors', solenoidValve: 'Solenoid valves', dinRail: 'DIN rail',
  wireDuct: 'Wire duct', groundBar: 'Ground bars', fan: 'Fans & filters', other: 'Miscellaneous',
};
const CAT_ORDER: CatalogCategory[] = ['enclosure', 'disconnect', 'breaker', 'fuse', 'motorProtector', 'contactor', 'overload', 'vfd', 'powerSupply',
  'plc', 'plcModule', 'hmi', 'safetyRelay', 'relay', 'estop', 'pushbutton', 'selector', 'pilotLight', 'stackLight', 'sensor', 'solenoidValve',
  'terminal', 'terminalAccessory', 'groundBar', 'dinRail', 'wireDuct', 'fan', 'other'];

export function categoryTitle(c: CatalogCategory | 'note'): string { return c === 'note' ? 'Derived quantities (part to be selected)' : CAT_TITLES[c]; }

/** Terminal counts implied by the terminal plan. */
export function terminalCounts(ctx: DrawingContext) {
  const strips = terminalPlan(ctx);
  let feed = 0, ground = 0, endPlates = 0, endStops = 0;
  for (const s of strips) {
    for (const t of s.terminals) if (t.kind === 'ground') ground++; else feed++;
    endPlates += s.endPlates; endStops += s.endStops;
  }
  return { feed, ground, endPlates, endStops };
}

export function billOfMaterials(ctx: DrawingContext): BomGroup[] {
  const m = buildModel(ctx);
  const tc = terminalCounts(ctx);
  const lines = new Map<string, BomLine>();
  for (const c of m.rc) {
    const key = `${c.category}|${c.partNumber}`;
    const l = lines.get(key);
    if (l) { l.qty += c.comp.quantity; l.tags.push(c.tag); continue; }
    lines.set(key, {
      item: 0, qty: c.comp.quantity, partNumber: c.partNumber, manufacturer: c.part?.manufacturer ?? '',
      description: c.part?.description ?? `${c.comp.function} (part not found in catalog — verify)`, tags: [c.tag], category: c.category,
    });
  }
  const notes: BomLine[] = [];
  const all = [...lines.values()];
  const isGround = (l: BomLine) => /ground|pe\b|earth/i.test(`${l.description} ${ctx.getPart(l.partNumber)?.ratings?.type ?? ''}`);
  const feedLine = all.find((l) => l.category === 'terminal' && !isGround(l));
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
}
export interface PanelLayout {
  enclosure: { w: number; h: number; d?: number; partNumber?: string; tag?: string; estimated: boolean };
  backplate: Rect & { estimated: boolean };
  rails: Rect[];
  ducts: (Rect & { orientation: 'h' | 'v' })[];
  items: PlacedItem[];
  /** Mounted elsewhere (fans, side-mounted) — listed only. */
  unplaced: { tag: string; partNumber: string; reason: string }[];
  overflow: boolean;
  door: { w: number; h: number; items: DoorItem[]; overflow: boolean };
  warnings: string[];
}

const DEFAULT_DIMS: Partial<Record<CatalogCategory, [number, number]>> = {
  disconnect: [90, 120], breaker: [18, 85], fuse: [18, 80], motorProtector: [45, 95], contactor: [45, 80], overload: [45, 70],
  vfd: [100, 180], powerSupply: [50, 100], plc: [60, 90], plcModule: [25, 90], relay: [16, 80], safetyRelay: [22.5, 100],
  groundBar: [100, 25], other: [50, 50], terminal: [6.2, 45], hmi: [200, 150],
};

function dims(c: ResolvedComponent): { w: number; h: number; estimated: boolean } {
  const pw = c.part?.widthMm, ph = c.part?.heightMm;
  if (pw && ph) return { w: pw, h: ph, estimated: false };
  const d = DEFAULT_DIMS[c.category] ?? [50, 50];
  let w = pw ?? d[0];
  if (!pw && (c.category === 'breaker' || c.category === 'fuse')) w = d[0] * poles(c, c.comp.motorTag ? 3 : 2);
  return { w, h: ph ?? d[1], estimated: true };
}

/** Breakers sit side by side and CLICK modules snap onto the CPU: no gap inside those groups. */
function gapBefore(prev: PlacedItem | undefined, it: PlacedItem): number {
  if (!prev) return 0;
  const grp = (c: CatalogCategory) => (c === 'breaker' || c === 'fuse' ? 'cb' : c === 'plc' || c === 'plcModule' ? 'plc' : c);
  if (grp(prev.category) === grp(it.category) && (grp(it.category) === 'cb' || grp(it.category) === 'plc')) return 0;
  if (prev.category === 'terminal' && it.category === 'terminal') return 10;
  return GAP;
}

const RAIL_H = 35;
const DUCT = 40;
const CLEAR = 12;
const MARGIN = 15;
const GAP = 4;

export function panelLayout(ctx: DrawingContext): PanelLayout {
  const m = buildModel(ctx);
  const warnings: string[] = [];
  const enc = byCat(m.rc, 'enclosure')[0];
  let encW = enc?.part?.widthMm, encH = enc?.part?.heightMm;
  let encEst = false;
  if (!encW || !encH) { encW = 610; encH = 762; encEst = true; warnings.push(enc ? `Enclosure ${enc.partNumber}: dimensions missing — layout uses an estimated 610 x 762 mm (24" x 30").` : 'No enclosure part in the design — layout uses an estimated 610 x 762 mm (24" x 30") enclosure.'); }
  const bpW0 = num(enc?.part?.ratings, 'backPanelWidthMm', 'panelWidthMm', 'subpanelWidthMm');
  const bpH0 = num(enc?.part?.ratings, 'backPanelHeightMm', 'panelHeightMm', 'subpanelHeightMm');
  const bpEst = !bpW0 || !bpH0;
  const bpW = bpW0 ?? encW - 76, bpH = bpH0 ?? encH - 76;
  const backplate = { x: (encW - bpW) / 2, y: (encH - bpH) / 2, w: bpW, h: bpH, estimated: bpEst };
  if (bpEst && !encEst) warnings.push(`Back-panel size not in catalog data for ${enc?.partNumber ?? 'enclosure'} — estimated as enclosure minus 76 mm.`);

  const bp = m.rc.filter((c) => c.mount === 'backplate' && !['enclosure', 'dinRail', 'wireDuct', 'terminal', 'terminalAccessory'].includes(c.category));
  const unplaced: PanelLayout['unplaced'] = [];
  const mk = (c: ResolvedComponent): PlacedItem => {
    const d = dims(c);
    return { tag: c.tag, partNumber: c.partNumber, category: c.category, label: c.tag, estimated: d.estimated, x: 0, y: 0, w: d.w, h: d.h };
  };
  const expand = (c: ResolvedComponent): PlacedItem[] => Array.from({ length: Math.max(1, c.comp.quantity) }, (_, k) => {
    const it = mk(c);
    if (c.comp.quantity > 1) it.label = `${c.tag}${k > 0 ? `.${k + 1}` : ''}`;
    return it;
  });
  const rows: { name: string; items: PlacedItem[] }[] = [
    { name: 'power', items: [] }, { name: 'control', items: [] }, { name: 'starters', items: [] }, { name: 'terminals', items: [] },
  ];
  const sortKey = (c: ResolvedComponent) => {
    const order: CatalogCategory[] = ['disconnect', 'breaker', 'fuse', 'powerSupply', 'plc', 'plcModule', 'motorProtector', 'contactor', 'vfd', 'safetyRelay', 'relay', 'other', 'groundBar'];
    const i = order.indexOf(c.category);
    return i < 0 ? 99 : i;
  };
  const used = new Set<ResolvedComponent>();
  const sortedBp = [...bp].sort((a, b) => sortKey(a) - sortKey(b) || (a === m.mainBreaker ? -1 : b === m.mainBreaker ? 1 : naturalCompare(a.tag, b.tag)));
  for (const c of sortedBp) {
    if (used.has(c)) continue;
    used.add(c);
    if (c.category === 'fan') { unplaced.push({ tag: c.tag, partNumber: c.partNumber, reason: 'Enclosure side/door mounted' }); continue; }
    if (c.category === 'overload') {
      // stacked under its contactor when one exists
      const k = bp.find((x) => x.category === 'contactor' && x.comp.motorTag && x.comp.motorTag === c.comp.motorTag);
      if (k) continue;
    }
    if (['disconnect', 'breaker', 'fuse'].includes(c.category)) rows[0].items.push(...expand(c));
    else if (['powerSupply', 'plc', 'plcModule'].includes(c.category)) rows[1].items.push(...expand(c));
    else if (c.category === 'groundBar') rows[0].items.push(...expand(c));
    else if (c.category === 'contactor') {
      const it = mk(c);
      const ol = bp.find((x) => x.category === 'overload' && x.comp.motorTag && x.comp.motorTag === c.comp.motorTag);
      const mm = m.motors.find((x) => x.motor.tag === c.comp.motorTag);
      const isRev = mm && mm.contactors[1]?.tag === c.tag;
      if (ol && !isRev) {
        const o = mk(ol);
        used.add(ol);
        it.sub = [{ ...it }, o];
        it.w = Math.max(it.w, o.w); it.h = it.h + o.h; it.estimated = it.estimated || o.estimated;
        it.label = `${c.tag}/${ol.tag}`;
      }
      rows[2].items.push(it);
    } else rows[2].items.push(...expand(c));
  }
  // PLC parts not in components (cpu from ctx)
  if (!m.rc.some((c) => c.category === 'plc') && m.plcPart) {
    rows[1].items.unshift({ tag: m.plcTag, partNumber: m.plcPart.partNumber, category: 'plc', label: m.plcTag, estimated: !(m.plcPart.widthMm && m.plcPart.heightMm), x: 0, y: 0, w: m.plcPart.widthMm ?? 60, h: m.plcPart.heightMm ?? 90 });
  }
  // terminal strips
  const termPart = m.rc.find((c) => c.category === 'terminal');
  const tw = termPart?.part?.widthMm ?? 6.2;
  const th = termPart?.part?.heightMm ?? 45;
  for (const s of m.strips) {
    const w = s.terminals.length * tw + s.endPlates * 1.5 + s.endStops * 9;
    rows[3].items.unshift({ tag: s.tag, partNumber: termPart?.partNumber ?? '', category: 'terminal', label: `${s.tag} (${s.terminals.length})`, estimated: !(termPart?.part?.widthMm), x: 0, y: 0, w, h: th });
  }
  // keep terminal strips in TB order, ground bar last
  rows[3].items.sort((a, b) => (a.category === 'groundBar' ? 1 : 0) - (b.category === 'groundBar' ? 1 : 0) || naturalCompare(a.tag, b.tag));

  // Place rows into rails
  const innerX0 = backplate.x + MARGIN + DUCT + CLEAR;
  const innerW = backplate.w - 2 * (MARGIN + DUCT + CLEAR);
  const rails: Rect[] = [];
  const ducts: PanelLayout['ducts'] = [];
  const items: PlacedItem[] = [];
  let y = backplate.y + MARGIN;
  const bands: { items: PlacedItem[]; h: number }[] = [];
  for (const row of rows) {
    if (!row.items.length) continue;
    let cur: PlacedItem[] = [];
    let used2 = 0;
    for (const it of row.items) {
      const need = gapBefore(cur[cur.length - 1], it) + it.w;
      if (cur.length && used2 + need > innerW) { bands.push({ items: cur, h: 0 }); cur = []; used2 = 0; }
      used2 += gapBefore(cur[cur.length - 1], it) + it.w;
      cur.push(it);
      if (it.w > innerW) warnings.push(`${it.tag} (${it.w} mm wide) is wider than the usable back-panel width.`);
    }
    if (cur.length) bands.push({ items: cur, h: 0 });
  }
  for (const b of bands) b.h = Math.max(RAIL_H, ...b.items.map((i) => i.h)) + 2 * CLEAR;
  const ductTop = y;
  ducts.push({ x: backplate.x + MARGIN, y, w: backplate.w - 2 * MARGIN, h: DUCT, orientation: 'h' });
  y += DUCT;
  for (const b of bands) {
    const cy = y + b.h / 2;
    rails.push({ x: backplate.x + MARGIN + DUCT + 4, y: cy - RAIL_H / 2, w: backplate.w - 2 * (MARGIN + DUCT + 4), h: RAIL_H });
    let x = innerX0;
    b.items.forEach((it, k) => {
      x += k > 0 ? gapBefore(b.items[k - 1], it) : 0;
      it.x = x; it.y = cy - it.h / 2;
      if (it.sub) { let sy = it.y; for (const s of it.sub) { s.x = x + (it.w - s.w) / 2; s.y = sy; sy += s.h; } }
      x += it.w;
      items.push(it);
    });
    y += b.h;
    ducts.push({ x: backplate.x + MARGIN, y, w: backplate.w - 2 * MARGIN, h: DUCT, orientation: 'h' });
    y += DUCT;
  }
  const bottom = y;
  ducts.push({ x: backplate.x + MARGIN, y: ductTop + DUCT, w: DUCT, h: Math.max(0, bottom - ductTop - 2 * DUCT), orientation: 'v' });
  ducts.push({ x: backplate.x + backplate.w - MARGIN - DUCT, y: ductTop + DUCT, w: DUCT, h: Math.max(0, bottom - ductTop - 2 * DUCT), orientation: 'v' });
  const overflow = bottom + MARGIN > backplate.y + backplate.h + 0.01;
  if (overflow) warnings.push(`Back-panel layout overflows: needs ${Math.round(bottom + MARGIN - backplate.y)} mm of height, ${Math.round(backplate.h)} mm available — use a larger enclosure or rearrange.`);
  const est = items.filter((i) => i.estimated && i.category !== 'terminal').map((i) => i.tag);
  if (est.length) warnings.push(`Estimated dimensions used for: ${est.join(', ')} — confirm with datasheets before releasing the layout.`);

  // Door
  const doorRc = m.rc.filter((c) => c.mount === 'door' && c.category !== 'fan');
  const doorItems: DoorItem[] = [];
  const colorOf = (c: ResolvedComponent) => {
    const s = `${str(c.part?.ratings, 'color', 'lensColor', 'buttonColor') ?? ''} ${c.part?.description ?? ''} ${c.comp.function}`.toLowerCase();
    return (s.match(/\b(red|green|amber|yellow|blue|white|black|clear)\b/)?.[1] ?? (c.category === 'estop' ? 'red' : '')).toUpperCase();
  };
  const legendOf = (c: ResolvedComponent) => wrapWords((str(c.part?.ratings, 'legend') ?? c.comp.function ?? c.tag).toUpperCase(), 12).slice(0, 2);
  const hmis = doorRc.filter((c) => c.category === 'hmi');
  const ops = doorRc.filter((c) => c.category !== 'hmi');
  const kindOf = (c: ResolvedComponent): DoorItem['kind'] => c.category === 'pushbutton' ? 'pushbutton' : c.category === 'estop' ? 'estop' : c.category === 'pilotLight' ? 'pilot' : c.category === 'selector' ? 'selector' : 'other';
  const order: DoorItem['kind'][] = ['pilot', 'selector', 'pushbutton', 'other', 'estop'];
  let dy = 90;
  let doorOverflow = false;
  for (const h of hmis) {
    const d = dims(h);
    doorItems.push({ tag: h.tag, partNumber: h.partNumber, kind: 'hmi', cx: encW / 2, cy: dy + d.h / 2, w: d.w, h: d.h, legend: [], color: '', estimated: d.estimated });
    dy += d.h + 40;
  }
  const pitchX = 60, pitchY = 75;
  const cols = Math.max(1, Math.min(6, Math.floor((encW - 80) / pitchX)));
  for (const kind of order) {
    const list = ops.filter((c) => kindOf(c) === kind).sort((a, b) => naturalCompare(a.tag, b.tag));
    for (let i = 0; i < list.length; i += cols) {
      const rowList = list.slice(i, i + cols);
      const x0 = encW / 2 - ((rowList.length - 1) * pitchX) / 2;
      rowList.forEach((c, k) => {
        const big = kind === 'estop';
        doorItems.push({ tag: c.tag, partNumber: c.partNumber, kind, cx: x0 + k * pitchX, cy: dy + 20, w: big ? 40 : 30, h: big ? 40 : 30, legend: big ? ['EMERGENCY', 'STOP'] : legendOf(c), color: colorOf(c), estimated: !c.part?.widthMm });
      });
      dy += pitchY + (kind === 'estop' ? 10 : 0);
    }
  }
  if (dy > encH - 40) { doorOverflow = true; warnings.push('Door layout: operator devices do not fit on the door at the standard spacing.'); }

  return {
    enclosure: { w: encW, h: encH, d: enc?.part ? num(enc.part.ratings, 'depthMm', 'depth') : undefined, partNumber: enc?.partNumber, tag: enc?.tag, estimated: encEst },
    backplate, rails, ducts, items, unplaced, overflow,
    door: { w: encW, h: encH, items: doorItems, overflow: doorOverflow }, warnings,
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
  const unverified = new Map<string, string[]>();
  for (const c of m.rc) {
    if (!c.partNumber) w.push(`${c.tag}: no part number selected.`);
    else if (!c.part) w.push(`${c.tag}: part ${c.partNumber} not found in the catalog — verify the part number.`);
    else if (!c.part.verified) unverified.set(c.partNumber, [...(unverified.get(c.partNumber) ?? []), c.tag]);
  }
  if (unverified.size) w.push(`${unverified.size} part number(s) have catalog data not yet verified against the datasheet: ${[...unverified].map(([pn, tags]) => `${pn} (${tags.join(', ')})`).join('; ')}.`);
  if (!m.disconnect) w.push('No main disconnect in the design (NFPA 79 5.3 requires a supply disconnecting means).');
  if (!m.rc.some((c) => c.category === 'enclosure')) w.push('No enclosure selected.');
  if (!m.psBranches.length) w.push('No 24VDC power supply in the design.');
  for (const b of m.psBranches) if (!b.protection) w.push(`${b.ps.tag}: no primary protection (breaker/fuses) found — add branch protection.`);
  if (!m.groundBar) w.push('No ground bar in the design.');
  for (const mm of m.motors) {
    const t = mm.motor.tag;
    if (!mm.protection) w.push(`${t}: no branch short-circuit protection (breaker/fuses/MMP) assigned (set motorTag on the part).`);
    if (mm.motor.starter === 'vfd' && !mm.vfd) w.push(`${t}: starter type VFD but no VFD part assigned.`);
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
  if (m.motors.some((x) => x.vfd)) w.push('VFD: confirm Safe Torque Off / enable wiring and drive parameter settings (not shown in detail).');
  const noWiring = m.io.filter((p) => !p.wiring);
  if (noWiring.length) w.push(`${noWiring.length} I/O point(s) without wiring info (${noWiring.slice(0, 6).map((p) => p.address).join(', ')}${noWiring.length > 6 ? '…' : ''}) — drawn as generic devices.`);
  const extra = ctx.design.ioWiring.filter((x) => !m.io.some((p) => p.address.toUpperCase() === x.address.toUpperCase()));
  if (extra.length) w.push(`ioWiring entries not in the project I/O list: ${extra.map((x) => x.address).join(', ')}.`);
  const unaddressed = ctx.io.filter((p) => !p.address).length;
  if (unaddressed) w.push(`${unaddressed} project I/O point(s) have no PLC address and are not drawn.`);
  // capacity
  let inCap = 0, outCap = 0, capKnown = false;
  const caps = [m.plcPart, ...m.rc.filter((c) => c.category === 'plcModule').map((c) => c.part)];
  for (const p of caps) {
    const i = num(p?.ratings, 'inputs', 'di', 'dcInputs'); const o = num(p?.ratings, 'outputs', 'do', 'dcOutputs');
    if (i !== undefined || o !== undefined) capKnown = true;
    inCap += i ?? 0; outCap += o ?? 0;
  }
  const nIn = m.io.filter((p) => p.type === 'input').length, nOut = m.io.filter((p) => p.type === 'output').length;
  if (capKnown && nIn > inCap) w.push(`PLC inputs over capacity: ${nIn} used, ${inCap} available — add an input module.`);
  if (capKnown && nOut > outCap) w.push(`PLC outputs over capacity: ${nOut} used, ${outCap} available — add an output module.`);
  for (const g of m.groups) {
    if (g.type === 'input' && g.points.some((p) => p.deviceType === 'sensor-npn') && g.points.some((p) => p.deviceType === 'sensor-pnp')) w.push(`${g.label}: mixed PNP and NPN sensors on one common — not possible; split commons or change sensors.`);
  }
  for (const p of m.io) if (!p.deviceTag && p.wiring) w.push(`${p.address}: wiring has no device tag.`);
  w.push(...panelLayout(ctx).warnings);
  w.push('Wire sizes are suggestions (75°C copper); verify against NFPA 79 Table 12.5.1 / UL 508A and the protective device ratings.');
  w.push('Calculate and mark the panel SCCR (UL 508A SB) and verify available fault current.');
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
