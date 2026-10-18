/**
 * Convert an existing machine (read from IEC / Chinese drawings) to a target standard, by default North
 * America: supply (380/400 V 50 Hz → 480 V 60 Hz), motor power (kW → standard HP), NFPA device tags
 * (QF1 → CB1, KM1 → K1, SB2 → PB2…), and every part cross-matched to a catalog part with the old → new
 * table and what differs. A part with no catalog match is "to select", never guessed; operator devices,
 * PLC and terminals are chosen by the design engine from the I/O and the equipment choice.
 */
import { ALL_PARTS } from '../electrical/catalogs';
import type { CatalogCategory, CatalogPart, MotorSpec, StarterType, SupplyVoltage } from '../electrical/types';
import type { Region } from '../standards/regions';
import type { SyncItem } from '../components/questions/useQuestionStore';
import type { SpecSectionId } from '../spec/types';
import { foreignRatings } from './foreignParts';
import { similarity } from './functionKept';
import type { ImportedIO } from '../lib/ai/importAI';
import type { DriveStop, DrawnCircuit, DrawnComponent, DrawnRatings, ExistingMachine } from './types';

export interface ConvertTarget {
  region: Region;
  supply: SupplyVoltage;
  /** Control voltage of the new panel (coils, operator devices). */
  controlVolts: '24VDC' | '120VAC';
  /** A machine without a PLC: keep its relay logic (with parts for the target) or move it into a new PLC (default). */
  logic?: LogicChoice;
}

export type LogicChoice = 'keep-relays' | 'plc';

export const NA_TARGET: ConvertTarget = { region: 'US', supply: '480VAC-3PH', controlVolts: '24VDC' };

/** NEMA standard motor powers, HP. */
const HP = [0.25, 0.33, 0.5, 0.75, 1, 1.5, 2, 3, 5, 7.5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200];

/** The standard HP motor for a kW rating: the smallest that gives the same power (3 kW → 5 HP, 4 kW → 5 HP, 0.75 kW → 1 HP). */
export function kwToHp(kw: number): number {
  const hp = kw / 0.746;
  // 8 % margin: a 4 kW motor is a 5 HP motor (5.36 HP exact), not 7.5 HP
  return HP.find((h) => h >= hp * 0.92) ?? Math.ceil(hp);
}

/** AWG for a metric conductor (next equal or larger copper size). */
export function mm2ToAwg(mm2: number): string {
  const table: [number, string][] = [[0.82, '18'], [1.31, '16'], [2.08, '14'], [3.31, '12'], [5.26, '10'], [8.37, '8'], [13.3, '6'], [21.2, '4'], [33.6, '2'], [53.5, '1/0'], [67.4, '2/0'], [85, '3/0'], [107, '4/0']];
  return `${(table.find(([a]) => a >= mm2 * 0.98) ?? table[table.length - 1])[1]} AWG`;
}

/** The target supply for what is drawn, and what the change means. */
export function targetSupply(drawn: ExistingMachine['supplyDrawn'], target: ConvertTarget): { supply: SupplyVoltage; note: string; question?: SyncItem } {
  const v = drawn.volts ?? 0;
  const phases = drawn.phases ?? (v >= 300 ? 3 : null);
  const from = drawn.text || [drawn.volts && `${drawn.volts} V`, drawn.hz && `${drawn.hz} Hz`, phases && `${phases}-phase`].filter(Boolean).join(' ') || 'not shown';
  if (target.region !== 'US' && target.region !== 'Canada') return { supply: target.supply, note: `Supply as drawn: ${from}; kept for the target region.` };
  if (phases === 1) return { supply: '120VAC-1PH', note: `Single-phase supply as drawn (${from}) becomes 120 VAC 1-phase.`, question: { text: `The drawings show a single-phase supply (${from}). Is the new supply 120 VAC single-phase or 208/240 V?`, section: 'utilities', assumption: '120 VAC single-phase' } };
  const supply = target.region === 'Canada' ? '600VAC-3PH' : target.supply;
  const hz = drawn.hz === 50 ? ' The motors were drawn for 50 Hz: at 60 Hz a motor turns 20 % faster, so speeds are kept by the new motor selection, gearing or the drive settings.' : '';
  return {
    supply,
    note: `Supply ${from} → ${supply.replace('VAC-3PH', ' VAC 3-phase 60 Hz')}.${hz}`,
    ...(!drawn.volts ? { question: { text: 'The drawings don\'t show the supply voltage. What supply is available at the new site?', section: 'utilities' as const, assumption: supply.replace('VAC-3PH', ' VAC 3-phase') } } : {}),
  };
}

/** NFPA-style tag prefix for a device category. */
const PREFIX: Partial<Record<CatalogCategory, string>> = {
  breaker: 'CB', disconnect: 'DS', fuse: 'FU', contactor: 'K', overload: 'OL', motorProtector: 'MP', vfd: 'VFD', relay: 'CR',
  safetyRelay: 'SR', powerSupply: 'PS', terminal: 'TB', pushbutton: 'PB', estop: 'ES', pilotLight: 'PL', selector: 'SS',
  stackLight: 'SL', plc: 'PLC', plcModule: 'PLC', hmi: 'HMI', solenoidValve: 'SOL', fan: 'FAN', enclosure: 'ENC',
};

/** A sensor's prefix from what it is (limit switch, photo-eye, pressure switch, proximity). */
function sensorPrefix(c: DrawnComponent): string {
  const d = `${c.tag} ${c.description}`.toLowerCase();
  if (/press|sp\d/.test(d)) return 'PRS';
  if (/photo|光电|eye|beam/.test(d)) return 'PE';
  if (/prox|接近|inductive|capacitive/.test(d)) return 'PX';
  return 'LS';
}

/** Old → new tag for every component (numbered per prefix in drawing order). */
export function naTags(components: DrawnComponent[]): Map<string, string> {
  const count = new Map<string, number>();
  const out = new Map<string, string>();
  const num = (t: string) => Number(t.match(/\d+/)?.[0] ?? 0);
  for (const c of [...components].sort((a, b) => a.tag.localeCompare(b.tag, undefined, { numeric: true }) || num(a.tag) - num(b.tag))) {
    if (out.has(c.tag)) continue;
    const prefix = c.category === 'sensor' ? sensorPrefix(c) : PREFIX[c.category];
    if (!prefix) { out.set(c.tag, c.tag); continue; }
    const n = (count.get(prefix) ?? 0) + 1;
    count.set(prefix, n);
    out.set(c.tag, prefix === 'PLC' || prefix === 'HMI' || prefix === 'ENC' ? (n === 1 ? prefix : `${prefix}${n}`) : `${prefix}${n}`);
  }
  return out;
}

const IO_CATEGORY: Partial<Record<ImportedIO['deviceType'], DrawnComponent['category']>> = {
  'pushbutton-no': 'pushbutton', 'pushbutton-nc': 'pushbutton', selector: 'selector', 'estop-contact': 'estop', 'sensor-pnp': 'sensor', 'sensor-npn': 'sensor',
  'limit-switch': 'sensor', 'pressure-switch': 'sensor', 'contactor-coil': 'contactor', 'relay-coil': 'relay', solenoid: 'solenoidValve', 'pilot-light': 'pilotLight', 'stack-light': 'stackLight',
};

/** Field devices the drawings show only in the I/O list (buttons, switches, lamps without a parts-list row), so they are renamed too. */
export function ioOnlyDevices(m: ExistingMachine): DrawnComponent[] {
  const known = new Set(m.components.map((c) => c.tag));
  const out = new Map<string, DrawnComponent>();
  for (const p of m.io) {
    const category = IO_CATEGORY[p.deviceType];
    if (!p.deviceTag || known.has(p.deviceTag) || out.has(p.deviceTag) || !category || !/^[A-Z]{1,3}\d+$/.test(p.deviceTag)) continue;
    out.set(p.deviceTag, { tag: p.deviceTag, partNumber: null, manufacturer: null, description: p.description, category, ratings: { amps: null, poles: null, coilVoltage: null, kA: null, curve: null, minAmps: null, maxAmps: null, kw: null, outputVolts: null, outputAmps: null }, confidence: p.confidence, source: p.source });
  }
  return [...out.values()];
}

/** Safety parts: kept by function, never certified by the conversion. */
export const REVALIDATE = 'Safety function: re-validate after the conversion';

/** Parts the engine chooses itself (from the I/O, the equipment choice and the motors). */
const ENGINE_PICKS = new Set<CatalogCategory>(['pushbutton', 'estop', 'pilotLight', 'selector', 'stackLight', 'plc', 'plcModule', 'hmi', 'terminal', 'terminalAccessory', 'sensor', 'solenoidValve', 'enclosure', 'dinRail', 'wireDuct', 'groundBar']);

export interface PartMatch {
  oldTag: string;
  newTag: string;
  from: { partNumber: string | null; manufacturer: string | null; description: string; category: CatalogCategory; ratings: DrawnRatings };
  to: CatalogPart | null;
  /** Other catalog parts that fit (best first). */
  alternatives: CatalogPart[];
  /** What changes: ratings, coil voltage, listing. */
  differences: string[];
  /** matched: a catalog equivalent; engine: chosen by the design engine; to-select: no match, the user picks. */
  status: 'matched' | 'engine' | 'to-select';
  reason: string;
}

const n = (v: unknown) => { const x = parseFloat(String(v)); return Number.isFinite(x) ? x : NaN; };
const coilOf = (p: CatalogPart) => String(p.ratings.coilVoltage ?? p.ratings.coil ?? '').toUpperCase().replace(/\s/g, '');
const coilFits = (p: CatalogPart, want: string) => { const c = coilOf(p); return c.includes(want) || (want === '24VDC' && c.includes('24VAC/VDC')) || (want === '120VAC' && /^1(10|15|20)VAC/.test(c)); };
const naListed = (p: CatalogPart) => p.ratings.ul !== undefined || p.vendor === undefined || ['automationdirect', 'allen-bradley', 'eaton', 'hoffman'].includes(p.vendor);

/** The drawn ratings with what a known part number tells (Dev 1's foreign-part data, then the part number's own pattern). */
export function ratingsOf(c: DrawnComponent): DrawnRatings {
  const known = c.partNumber ? foreignRatings(c.partNumber) : null;
  const out = { ...c.ratings };
  for (const [k, v] of Object.entries(known ?? {})) if (out[k as keyof DrawnRatings] === null && v !== undefined) (out as Record<string, unknown>)[k] = v;
  return out;
}

/** Catalog parts that do this part's job in the target standard, best first. */
export function candidates(c: DrawnComponent, r: DrawnRatings, target: ConvertTarget, hp?: number): CatalogPart[] {
  const pool = ALL_PARTS.filter((p) => p.category === c.category && (target.region === 'US' || target.region === 'Canada' ? naListed(p) : true));
  const fits = (p: CatalogPart): boolean => {
    const q = p.ratings;
    switch (c.category) {
      case 'contactor':
        return (r.poles === null || n(q.poles) === r.poles) && (r.amps === null || n(q.amps) >= r.amps) && coilFits(p, target.controlVolts);
      case 'breaker':
        return (r.poles === null || n(q.poles) === r.poles) && (r.amps === null || n(q.amps) === r.amps) && (!r.curve || String(q.curve ?? '').toUpperCase() === r.curve.toUpperCase())
          && (r.kA === null || n(q.interruptingKA) >= Math.min(r.kA, 10)) && (target.region !== 'US' || /489/.test(String(q.ul ?? '')) || q.branchRated === 'yes');
      case 'overload': case 'motorProtector': {
        if (r.minAmps === null || r.maxAmps === null) return false;
        const mid = (r.minAmps + r.maxAmps) / 2;
        return n(q.minAmps) <= mid && mid <= n(q.maxAmps);
      }
      case 'powerSupply':
        return (r.outputVolts === null || n(q.outputVolts) === r.outputVolts) && (r.outputAmps === null || n(q.outputAmps) >= r.outputAmps);
      case 'fuse':
        return r.amps !== null && n(q.amps) === r.amps;
      case 'relay':
        return coilFits(p, target.controlVolts) && (r.amps === null || n(q.contactAmps ?? q.amps) >= r.amps);
      case 'safetyRelay':
        return coilFits(p, target.controlVolts);
      case 'vfd': {
        const want = hp ?? (r.kw !== null ? kwToHp(r.kw) : null);
        const have = n(q.hp480 ?? q.hp460);
        return want !== null && have >= want && String(q.inputPhases ?? '3').includes('3');
      }
      case 'disconnect':
        return r.amps === null || n(q.amps) >= r.amps;
      default:
        return false;
    }
  };
  const size = (p: CatalogPart) => n(p.ratings.amps ?? p.ratings.outputAmps ?? p.ratings.hp480 ?? p.ratings.maxAmps ?? 0);
  return pool.filter(fits).sort((a, b) => Number(Boolean(b.verified)) - Number(Boolean(a.verified)) || size(a) - size(b));
}

/** What changes between the drawn part and its replacement. */
function differences(c: DrawnComponent, r: DrawnRatings, to: CatalogPart, target: ConvertTarget): string[] {
  const out: string[] = [];
  const q = to.ratings;
  if (r.coilVoltage && coilOf(to) && !coilOf(to).includes(r.coilVoltage.toUpperCase().replace(/\s/g, ''))) out.push(`Coil ${r.coilVoltage} → ${q.coilVoltage ?? q.coil}`);
  if (r.amps !== null && q.amps !== undefined && n(q.amps) !== r.amps) out.push(`Rating ${r.amps} A → ${q.amps} A`);
  if (r.kA !== null && q.interruptingKA !== undefined && n(q.interruptingKA) !== r.kA) out.push(`Breaking capacity ${r.kA} kA → ${q.interruptingKA} kA${target.region === 'US' ? ' (UL 489)' : ''}`);
  if (r.minAmps !== null && q.minAmps !== undefined && (n(q.minAmps) !== r.minAmps || n(q.maxAmps) !== r.maxAmps)) out.push(`Setting range ${r.minAmps}-${r.maxAmps} A → ${q.minAmps}-${q.maxAmps} A`);
  if (c.category === 'breaker' && (target.region === 'US' || target.region === 'Canada')) out.push('IEC 60898 MCB → UL 489 branch-circuit breaker');
  if (q.forUse) out.push(`Mounts on ${q.forUse}`);
  if (!to.verified) out.push(`ratings not fully verified${to.verify ? `: ${to.verify}` : ''}`);
  return out;
}

/** One component: its new tag and catalog equivalent. */
export function crossMatch(c: DrawnComponent, newTag: string, target: ConvertTarget, hp?: number): PartMatch {
  const r = ratingsOf(c);
  const from = { partNumber: c.partNumber, manufacturer: c.manufacturer, description: c.description, category: c.category, ratings: r };
  // operator devices drawn as 'other' (speed pots, pendants) are chosen by the design too
  if (ENGINE_PICKS.has(c.category) || (c.category === 'other' && /potentiometer|\bpot\b|调速|电位器|pendant|遥控/i.test(c.description))) {
    return { oldTag: c.tag, newTag, from, to: null, alternatives: [], differences: c.category === 'estop' ? [REVALIDATE] : [], status: 'engine', reason: 'Chosen by the design from the I/O list and the equipment choice.' };
  }
  // an overload is set to the motor's current, which changes with the voltage: the design sizes it for the new motor
  if ((c.category === 'overload' || c.category === 'motorProtector') && (target.region === 'US' || target.region === 'Canada')) {
    return { oldTag: c.tag, newTag, from, to: null, alternatives: [], differences: [`Set for the motor's full-load current at ${target.supply.replace('VAC-3PH', ' V')} (was ${r.minAmps ?? '?'}-${r.maxAmps ?? '?'} A at the old voltage)`], status: 'engine',
      reason: 'Sized by the design from the motor\'s new full-load current (NEC 430.32).' };
  }
  const list = candidates(c, r, target, hp);
  if (!list.length) {
    const missing = c.category === 'overload' || c.category === 'motorProtector' ? 'the setting range is' : c.category === 'vfd' ? 'the motor power is' : 'the rating is';
    return { oldTag: c.tag, newTag, from, to: null, alternatives: [], differences: [], status: 'to-select',
      reason: `No catalog part matches${r.amps !== null || r.kw !== null || r.minAmps !== null ? '' : `: ${missing} not on the drawing`}. Pick one, or let the design size it from the motors.` };
  }
  const [to, ...alternatives] = list;
  const listing = to.ratings.ul ? `maker's listing: UL ${String(to.ratings.ul).replace(/^UL\s*/i, '')}` : 'listing: see the maker\'s data';
  return { oldTag: c.tag, newTag, from, to, alternatives: alternatives.slice(0, 4), differences: [...differences(c, r, to, target), ...(c.category === 'safetyRelay' ? [REVALIDATE] : [])], status: 'matched', reason: `${to.manufacturer} ${to.partNumber}: same function and ratings (${listing}).` };
}

export interface Conversion {
  target: ConvertTarget;
  supply: SupplyVoltage;
  supplyNote: string;
  /** Motors for the new design (power in HP, target voltage). */
  motors: MotorSpec[];
  /** Original motor tag → new tag (M1 stays M1). */
  motorKw: { tag: string; kw: number | null; hp: number }[];
  tags: Map<string, string>;
  parts: PartMatch[];
  /** Questions for the Machine description page (what the conversion can't decide). */
  questions: SyncItem[];
  /** What the new design must add to be right for the target standard (safety relay + STO…). */
  recommendations: { text: string; section: SpecSectionId }[];
  /** No PLC on the old machine: the chosen way to keep its logic (null: it had a PLC). */
  logic: LogicChoice | null;
  /** Each control circuit, where its function goes and how it reads with the new tags. */
  circuits: ConvertedCircuit[];
  /** The I/O list for the new design: the original points plus the field devices of the relay circuits moved into the PLC. */
  io: ImportedIO[];
}

export interface ConvertedCircuit {
  /** C1, C2… in the order read: the key of the circuit's rung on the new drawings. */
  id: string;
  circuit: DrawnCircuit;
  /** relays: kept as a hardwired circuit; program: becomes PLC logic; drive: stays in the drive's / controller's own logic. */
  becomes: 'relays' | 'program' | 'drive';
  /** The circuit with the new tags, e.g. "K2: SS4 cutting on (NO), K1 aux (NO), K2 seal-in (NO)". */
  text: string;
}

/** The way a machine's logic is kept: its own PLC, or (no PLC) the user's choice, by default a new PLC. */
export const logicChoice = (m: ExistingMachine, target: ConvertTarget): LogicChoice | null => (m.controller === 'plc' ? null : target.logic ?? 'plc');

/** Replace the old device tags in a text with the new ones (whole tags only: KM1 never touches KM10). */
export function retag(text: string, tags: Map<string, string>): string {
  const olds = [...tags.keys()].filter((t) => t && tags.get(t) !== t).sort((a, b) => b.length - a.length);
  if (!olds.length) return text;
  const re = new RegExp(`(?<![A-Za-z0-9])(${olds.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![A-Za-z0-9])`, 'g');
  return text.replace(re, (t) => tags.get(t) ?? t);
}

/** Where each circuit's function goes. A drive's or controller's built-in logic stays there (a servo keeps positioning); relay logic follows the choice. */
export function convertCircuits(m: ExistingMachine, tags: Map<string, string>, logic: LogicChoice | null): ConvertedCircuit[] {
  return m.circuits.map((c, i) => {
    const becomes = c.logicIn === 'drive' ? 'drive' as const : logic === 'keep-relays' ? 'relays' as const : 'program' as const;    return { id: `C${i + 1}`, circuit: c, becomes, text: retag(`${c.output}: ${c.function}${c.conditions.length ? ` (${c.conditions.join(', ')})` : ''}${c.setting && !c.function.includes(c.setting) ? `; setting: ${c.setting}` : ''}`, tags) };
  });
}

const INPUT_DEVICE: Partial<Record<DrawnComponent['category'], ImportedIO['deviceType']>> = { pushbutton: 'pushbutton-no', selector: 'selector', sensor: 'sensor-pnp' };
const OUTPUT_DEVICE: Partial<Record<DrawnComponent['category'], ImportedIO['deviceType']>> = { solenoidValve: 'solenoid', pilotLight: 'pilot-light', stackLight: 'stack-light', contactor: 'contactor-coil' };

/**
 * The I/O list for the new design. With the relay logic moved into a PLC, every field device of a relay
 * circuit becomes I/O (buttons, switches, sensors in; motor contactors, valves, lamps out) unless the
 * drawings' I/O list already has it; relays and timers become program logic, not I/O. A main contactor
 * goes to the safety circuit, not to an output.
 */
export function newIo(m: ExistingMachine, logic: LogicChoice | null): ImportedIO[] {
  if (logic !== 'plc') return m.io;
  const named = new Set(m.io.map((p) => p.deviceTag).filter(Boolean));
  const extra: ImportedIO[] = [];
  for (const c of m.circuits.filter((x) => x.logicIn !== 'drive')) {
    for (const tag of c.devices) {
      const comp = m.components.find((x) => x.tag === tag);
      if (!comp || named.has(tag)) continue;
      const input = INPUT_DEVICE[comp.category];
      const output = OUTPUT_DEVICE[comp.category];
      if (!input && !output) continue;
      // a contactor is an output only when it is the circuit's own coil, and not the main contactor
      if (comp.category === 'contactor' && (c.output !== tag || /main|总|主接触/i.test(comp.description))) continue;
      named.add(tag);
      extra.push({
        address: `${tag} (was relay logic)`, description: comp.description, type: input ? 'input' : 'output',
        category: comp.category === 'sensor' ? 'Product Detection' : comp.category === 'contactor' ? 'Conveyor' : comp.category === 'solenoidValve' ? 'Pneumatic' : 'Operator/HMI',
        deviceTag: tag, deviceType: (input ?? output)!, confidence: comp.confidence, source: `${comp.source} (circuit of ${c.output})`,
      });
    }
  }
  return [...m.io, ...extra];
}

/** How every drive (VFD, servo drive) stops now; a drive the drawings don't describe is "unknown". */
export function driveStops(m: ExistingMachine): DriveStop[] {
  const tags = [...new Set([...m.components.filter((c) => c.category === 'vfd').map((c) => c.tag), ...m.axes.map((a) => a.driveTag)])];
  return tags.map((tag) => m.safety.drives?.find((d) => d.tag === tag) ?? { tag, sto: 'unknown' as const, stopsBy: '' });
}

/**
 * A safety relay is not enough when a drive's Safe Torque Off isn't wired to it: the drive then stops only
 * through a single run contact, which is one channel, whatever category the drawings claim. Null when every
 * drive's STO is wired (or there is no safety relay: that case is the "add a safety relay" recommendation).
 */
export function stoFinding(m: ExistingMachine): string | null {
  if (m.safety.kind !== 'safety-relay') return null;
  const open = driveStops(m).filter((d) => d.sto !== 'wired');
  if (!open.length) return null;
  const how = open.map((d) => `${d.tag} (${d.sto === 'none' ? 'no STO' : d.sto === 'not-wired' ? 'STO not wired' : 'STO not shown'}${d.stopsBy ? `; stops only by ${d.stopsBy}` : ''})`).join(', ');
  const claimed = m.safety.category?.replace(/\s*\(claimed\)/i, '') || null;
  return `${claimed ? `The drawings claim ${claimed}, but ` : ''}the safety relay ${m.safety.safetyRelay ?? ''} does not remove torque from ${how}: a single channel, so ${claimed ? `the claimed ${claimed} is not met` : 'the stop is not two-channel'}. Wire the Safe Torque Off inputs to the safety relay (STO-capable drives), or stop each drive through two monitored contactors (NFPA 79 9.2.5.4, ISO 13849-1). Re-validate after the conversion.`.replace('relay  does', 'relay does');
}

/** The whole conversion of an existing machine to the target standard. */
export function convertMachine(m: ExistingMachine, target: ConvertTarget = NA_TARGET): Conversion {
  const sup = targetSupply(m.supplyDrawn, target);
  const questions: SyncItem[] = sup.question ? [sup.question] : [];
  // servo motors belong to their axis (the motion design), not to the panel's starters
  const panelMotors = m.motors.filter((mm) => mm.kind !== 'servo');
  const motorKw = panelMotors.map((mm) => ({ tag: mm.tag, kw: mm.kw, hp: mm.hp ?? (mm.kw !== null ? kwToHp(mm.kw) : 0) }));
  const motors: MotorSpec[] = panelMotors.map((mm, i) => ({
    tag: mm.tag.replace(/^[^A-Z]*/i, '').match(/^M\d+/i)?.[0].toUpperCase() ?? `M${i + 1}`,
    description: mm.description,
    hp: motorKw[i].hp || 1,
    voltage: sup.supply,
    starter: (mm.starter ?? 'contactor-overload') as StarterType,
    reversing: mm.reversing,
  }));
  if (m.supplyDrawn.hz === 50 && (target.region === 'US' || target.region === 'Canada') && m.motors.length) {
    questions.push({ text: 'The motors were 50 Hz and turn about 20 % faster on 60 Hz. Must every speed stay as it was (new gearing or drive settings), or is the faster speed acceptable?', section: 'motion', assumption: 'Keep the original speeds' });
  }
  const drives = [...m.components.filter((c) => c.category === 'vfd').map((c) => c.tag), ...m.axes.map((a) => a.driveTag)];
  if (m.safety.estops.length && m.safety.kind === 'control-only') {
    questions.push({ text: `The existing E-stop (${m.safety.estops.join(', ')}) is only an input of a drive or controller: it is not a safety circuit. The new design stops through a monitored safety relay${drives.length ? ' and the drives\' Safe Torque Off' : ''}. What safety category / performance level does the risk assessment require?`, section: 'safety', assumption: 'Category 3, PL d' });
  } else if (m.safety.estops.length && !m.safety.safetyRelay) {
    questions.push({ text: `The existing E-stop (${m.safety.estops.join(', ')}) is single-channel, without a safety relay. The new design uses a monitored safety relay. What safety category / performance level does the risk assessment require?`, section: 'safety', assumption: 'Category 3, PL d' });
  }
  const logic = logicChoice(m, target);
  if (logic) {
    const by = m.controller === 'servo-drive' ? 'the servo drive\'s built-in controller' : m.controller === 'relays' ? 'relay logic' : 'its own controller';
    questions.push(logic === 'plc'
      ? { text: `The machine has no PLC: ${by} runs it. The conversion moves the relay logic into a new PLC (the drives keep their built-in functions). Is that right, or should the relay logic be kept?`, section: 'sequence', assumption: 'A PLC runs the logic; the drives keep their built-in functions' }
      : { text: `The machine has no PLC: ${by} runs it, and the conversion keeps the relay logic with parts for the new standard. Is that right, or should the logic move into a PLC?`, section: 'sequence', assumption: 'Keep the relay logic' });
  }
  const recommendations: Conversion['recommendations'] = [];
  const sto = stoFinding(m);
  if (sto) {
    recommendations.push({ section: 'safety', text: sto });
    const unknown = driveStops(m).filter((d) => d.sto === 'unknown').map((d) => d.tag);
    if (unknown.length) questions.push({ text: `The drawings don't show whether the Safe Torque Off of ${unknown.join(', ')} is wired to the safety relay. Is it?`, section: 'safety', assumption: 'Not wired: the new design wires it' });
  }
  if (m.safety.kind !== 'safety-relay' && (m.safety.estops.length || drives.length)) {
    recommendations.push({ section: 'safety', text: `${m.safety.kind === 'control-only' ? `The E-stop (${m.safety.estops.join(', ') || '—'}) only signals ${drives.length ? drives.join(', ') : 'the controller'}: that is not a safety circuit. ` : ''}Add a monitored safety relay (category / PL from the risk assessment)${drives.length ? ` and wire the Safe Torque Off (STO) inputs of ${drives.join(', ')} to it` : ''}, so an E-stop removes power or torque (NFPA 79 9.2.2, 9.2.5.4). Re-validate after the conversion.` });
  }
  for (const a of m.axes) {
    recommendations.push({ section: 'motion', text: `Servo axis ${a.tag} (${a.description}): drive ${a.driveTag}${a.drivePart ? ` ${a.drivePart}` : ''}, ${a.motorKw ?? '?'} kW servo motor${a.encoder ? `, ${a.encoder}` : ''}${a.brakingResistor ? `, braking resistor ${a.brakingResistor}` : ''}: kept as one axis; the drive, motor, cables and braking resistor are chosen together by the motion design for ${target.supply.replace('VAC-3PH', ' V')}.` });
  }
  for (const [i, mm] of panelMotors.entries()) {
    // the drawings' own questions may already ask it
    const asked = m.questions.some((q) => /power|kw/i.test(q.text) && similarity(q.text, mm.description) >= 0.3);
    if (!motorKw[i].hp && !asked) questions.push({ text: `What is the power of ${mm.tag} (${mm.description})? It is not on the drawings.`, section: 'motion', assumption: '1 HP' });
  }
  // North America renames the devices (QF1 → CB1…); an IEC target keeps the drawing's own tags
  const na = target.region === 'US' || target.region === 'Canada';
  const tags = na ? naTags([...m.components, ...ioOnlyDevices(m)]) : new Map(m.components.map((c) => [c.tag, c.tag]));
  // a drive is sized by the motor it runs: the largest VFD-driven motor when the drive's own power isn't drawn
  const vfdHp = Math.max(0, ...motors.filter((x) => x.starter === 'vfd').map((x) => x.hp));
  // the axis' own devices, by tag: drive, motor, braking resistor, encoder ("line-length encoder PG1 on CN1-11/13")
  const tagIn = (t: string | null) => (t ?? '').match(/\b[A-Z]{1,3}\d+\b/g)?.filter((x) => m.components.some((c) => c.tag === x)) ?? [];
  const axisTags = new Set(m.axes.flatMap((a) => [a.driveTag, a.motorTag, ...tagIn(a.brakingResistor), ...tagIn(a.encoder)]));
  const stoOpen = new Set(driveStops(m).filter((d) => d.sto !== 'wired').map((d) => d.tag));
  const parts = m.components.map((c) => {
    // a servo axis is chosen as a whole by the motion design (drive, motor, encoder, braking resistor)
    if (axisTags.has(c.tag)) {
      const isDrive = m.axes.some((a) => a.driveTag === c.tag);
      return { oldTag: c.tag, newTag: tags.get(c.tag) ?? c.tag, from: { partNumber: c.partNumber, manufacturer: c.manufacturer, description: c.description, category: c.category, ratings: ratingsOf(c) }, to: null, alternatives: [],
        differences: isDrive ? [...(stoOpen.has(c.tag) ? ['STO wired to the safety relay'] : []), REVALIDATE] : [], status: 'engine' as const, reason: 'Servo axis: drive, motor, encoder and braking resistor are chosen together by the motion design.' };
    }
    const m2 = crossMatch(c, tags.get(c.tag) ?? c.tag, target, c.category === 'vfd' && c.ratings.kw === null && vfdHp ? vfdHp : undefined);
    // a drive whose STO isn't wired now stops through it
    return c.category === 'vfd' && stoOpen.has(c.tag) ? { ...m2, differences: [...m2.differences, 'STO wired to the safety relay', REVALIDATE] } : m2;
  });
  return { target, supply: sup.supply, supplyNote: sup.note, motors, motorKw, tags, parts, questions, recommendations, logic, circuits: convertCircuits(m, tags, logic), io: newIo(m, logic) };
}
