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
import { foreignRatings } from './foreignParts';
import type { DrawnComponent, DrawnRatings, ExistingMachine } from './types';

export interface ConvertTarget {
  region: Region;
  supply: SupplyVoltage;
  /** Control voltage of the new panel (coils, operator devices). */
  controlVolts: '24VDC' | '120VAC';
}

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
  if (ENGINE_PICKS.has(c.category)) {
    return { oldTag: c.tag, newTag, from, to: null, alternatives: [], differences: [], status: 'engine', reason: 'Chosen by the design from the I/O list and the equipment choice.' };
  }
  // an overload is set to the motor's current, which changes with the voltage: the design sizes it for the new motor
  if ((c.category === 'overload' || c.category === 'motorProtector') && (target.region === 'US' || target.region === 'Canada')) {
    return { oldTag: c.tag, newTag, from, to: null, alternatives: [], differences: [`Set for the motor's full-load current at ${target.supply.replace('VAC-3PH', ' V')} (was ${r.minAmps ?? '?'}-${r.maxAmps ?? '?'} A at the old voltage)`], status: 'engine',
      reason: 'Sized by the design from the motor\'s new full-load current (NEC 430.32).' };
  }
  const list = candidates(c, r, target, hp);
  if (!list.length) {
    const missing = c.category === 'overload' || c.category === 'motorProtector' ? 'the setting range' : c.category === 'vfd' ? 'the motor power' : 'the ratings';
    return { oldTag: c.tag, newTag, from, to: null, alternatives: [], differences: [], status: 'to-select',
      reason: `No catalog part matches${r.amps !== null || r.kw !== null || r.minAmps !== null ? '' : `: ${missing} is not on the drawing`}. Pick one, or let the design size it from the motors.` };
  }
  const [to, ...alternatives] = list;
  return { oldTag: c.tag, newTag, from, to, alternatives: alternatives.slice(0, 4), differences: differences(c, r, to, target), status: 'matched', reason: `${to.manufacturer} ${to.partNumber}: same function and ratings for ${target.region === 'US' ? 'North America (UL)' : target.region}.` };
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
}

/** The whole conversion of an existing machine to the target standard. */
export function convertMachine(m: ExistingMachine, target: ConvertTarget = NA_TARGET): Conversion {
  const sup = targetSupply(m.supplyDrawn, target);
  const questions: SyncItem[] = sup.question ? [sup.question] : [];
  const motorKw = m.motors.map((mm) => ({ tag: mm.tag, kw: mm.kw, hp: mm.hp ?? (mm.kw !== null ? kwToHp(mm.kw) : 0) }));
  const motors: MotorSpec[] = m.motors.map((mm, i) => ({
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
  if (m.safety.estops.length && !m.safety.safetyRelay) {
    questions.push({ text: `The existing E-stop (${m.safety.estops.join(', ')}) is single-channel, without a safety relay. The new design uses a monitored safety relay. What safety category / performance level does the risk assessment require?`, section: 'safety', assumption: 'Category 3, PL d' });
  }
  for (const [i, mm] of m.motors.entries()) {
    if (!motorKw[i].hp) questions.push({ text: `What is the power of ${mm.tag} (${mm.description})? It is not on the drawings.`, section: 'motion', assumption: '1 HP' });
  }
  const tags = naTags(m.components);
  // a drive is sized by the motor it runs: the largest VFD-driven motor when the drive's own power isn't drawn
  const vfdHp = Math.max(0, ...motors.filter((x) => x.starter === 'vfd').map((x) => x.hp));
  const parts = m.components.map((c) => crossMatch(c, tags.get(c.tag) ?? c.tag, target, c.category === 'vfd' && c.ratings.kw === null && vfdHp ? vfdHp : undefined));
  return { target, supply: sup.supply, supplyNote: sup.note, motors, motorKw, tags, parts, questions };
}
