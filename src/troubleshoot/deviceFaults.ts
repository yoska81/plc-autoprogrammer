import type { CatalogCategory, CatalogPart } from '../electrical/types';
import { loadedFaults } from './knowledge';

/**
 * Device fault knowledge for the AI Troubleshooter: per device family, what a healthy device reads at its
 * terminals, what its LEDs / display show, and the common faults with how to confirm each with a meter or the
 * device's own display, and the fix. Every profile cites the maker manuals it comes from (`sources`); nothing
 * here is generic advice without a source. The wiring-path engine asks "what should this terminal read?" and
 * "what does this code mean?"; the why-stuck analyzer asks "which faults explain this symptom?".
 */

/** How a reading is taken. */
export type Meter = 'VDC' | 'VAC' | 'ohms' | 'continuity' | 'mA' | 'display' | 'LED' | 'visual';

/** Expected reading at one terminal (or terminal pair) in one normal state. */
export interface TerminalCheck {
  /** Terminal(s) as marked on the device, measured between: e.g. 'X001 to C0' or 'BN(+) to BU(-)'. */
  terminals: string;
  /** Device state the reading belongs to, e.g. 'target present', 'input ON', 'coil energized', 'run, no fault'. */
  state: string;
  meter: Meter;
  /** The expected reading in words and numbers, e.g. '20.4-28.8 VDC', '< 1 VDC', 'open', '4-20 mA proportional to distance'. */
  expected: string;
  /**
   * The terminal pin pairs measured, in the wire list's spelling (TAG:PIN without the tag): CLICK 'X001'/'C1'/'+V',
   * sensor 'BN'/'BU'/'BK'/'WH', drive 'DI1'/'DCM'/'R1O', relay '13'/'14', coil 'A1'/'A2'. One pair per measurement
   * ('L1-L2, L2-L3, L1-L3' gives three). Absent when the reading is not between terminals (a display value).
   */
  pins?: [string, string][];
  /** Measured on live mains / DC-bus circuits: show LIVE_WORK_CAUTION first (see needsLiveWorkCaution). */
  liveWork?: boolean;
  note?: string;
}

/** Shown before any reading across mains or a drive DC bus. */
export const LIVE_WORK_CAUTION = 'Live work: qualified person only, CAT III/IV meter rated for the circuit, arc-rated PPE. On drives, wait the time on the drive label after power-off (DC bus capacitors) and confirm 0 V on the DC bus before touching.';

/** An LED or display indication and what it means. */
export interface Indicator {
  /** LED / display element as labelled: 'PWR', 'RUN', 'ERR', 'X001 LED', 'output LED (yellow)', 'keypad display'. */
  name: string;
  /** Its state: 'on green', 'flashing red 1 Hz', 'off', 'shows oc'. */
  state: string;
  meaning: string;
}

/**
 * Terminals the device connects internally in a state, as its manual / terminal diagram shows them: a drive relay
 * output (R1O-R1C when faulted per the manual), a safety relay output 13-14 when safety OK, a contactor aux 13-14 when
 * energized, a PNP sensor BN-BK when the target is present. The wiring-path engine follows a path through the device
 * only along these.
 */
export interface InternalPair {
  a: string;
  b: string;
  /** Device state in which a and b are connected: 'energized', 'fault', 'safety OK', 'target present', 'always'. */
  when: string;
  note?: string;
}

/** Kind of blocker a fault explains, for pre-filtering: no input seen, output on but nothing moves, stuck on, trips, a displayed code. */
export type SymptomKind = 'no-input' | 'output-no-motion' | 'stuck-on' | 'trips' | 'display-code';

/** One common fault: how it shows, how to confirm it, the fix. */
export interface FaultEntry {
  /** Set when the data states it; otherwise symptomKindOf() derives it from the code and wording. */
  symptomKind?: SymptomKind;
  /** Device fault / alarm code exactly as displayed, when the device has one: 'oc', 'ov', 'GFF', 'AL.009'. */
  code?: string;
  /** Short name: 'Overcurrent during acceleration'. */
  title: string;
  /** What the technician sees: 'input LED never turns on', 'drive trips when starting'. */
  symptom: string;
  /** Likely causes, most likely first. */
  causes: string[];
  /** How to confirm with a meter or the device display (terminal + expected abnormal reading). */
  confirm: string[];
  /** Corrective action. */
  fix: string[];
  /**
   * Fixes that only apply when the project drawings show NO wiring on the drive's STO / safety inputs (e.g. refit the
   * factory STO jumper). The app must hide these when the project wires STO: never jumper a wired STO circuit.
   */
  fixIfNoStoWiring?: string[];
  /** Manual URL (and page / section when known) for this entry. */
  source: string;
}

/** Which catalog parts a profile describes. All given conditions must hold. */
export interface ProfileMatch {
  categories: CatalogCategory[];
  /** Regex (case-insensitive) on family / series / ratings.family. */
  family?: string;
  /** Regex (case-insensitive) on the part number. */
  partNumber?: string;
  /** Ratings that must match (case-insensitive substring), e.g. { outputType: 'sinking' } or { output: 'PNP' }. */
  ratings?: Record<string, string>;
  /** Manufacturer regex, for profiles of one maker's family. */
  manufacturer?: string;
}

export interface DeviceFaultProfile {
  /** Stable id: 'click-dc-input-sink-source', 'gs20-vfd', 'pnp-3wire-sensor'. */
  id: string;
  title: string;
  match: ProfileMatch;
  /** Healthy readings, per state. Terminals as on the device and in the wire list: 'X001 to C1', 'BK to BU'. */
  normal: TerminalCheck[];
  /** Terminals connected inside the device per state (from the maker's terminal diagram). */
  pairs?: InternalPair[];
  indicators: Indicator[];
  faults: FaultEntry[];
  /** Maker manuals / datasheets the profile comes from. */
  sources: string[];
}

const rx = (s: string | undefined) => (s ? new RegExp(s, 'i') : null);

/** Does a profile describe this catalog part? */
export function profileMatches(m: ProfileMatch, p: CatalogPart): boolean {
  if (!m.categories.includes(p.category)) return false;
  const fam = `${p.family ?? ''} ${p.ratings.series ?? ''} ${p.ratings.family ?? ''}`;
  if (m.family && !rx(m.family)!.test(fam)) return false;
  if (m.partNumber && !rx(m.partNumber)!.test(p.partNumber)) return false;
  if (m.manufacturer && !rx(m.manufacturer)!.test(p.manufacturer)) return false;
  for (const [k, v] of Object.entries(m.ratings ?? {})) if (!String(p.ratings[k] ?? '').toLowerCase().includes(v.toLowerCase())) return false;
  return true;
}

/** Specificity: profiles naming a part number or family come before category-wide ones. */
const weight = (m: ProfileMatch) => (m.partNumber ? 8 : 0) + (m.family ? 4 : 0) + (m.manufacturer ? 2 : 0) + Object.keys(m.ratings ?? {}).length;

/** Fault profiles for a part, most specific first (a GS20 drive gets the GS20 profile before a generic VFD one). */
export function faultProfilesFor(p: CatalogPart, data: DeviceFaultProfile[] = loadedFaults()): DeviceFaultProfile[] {
  return data.filter((d) => profileMatches(d.match, p)).sort((a, b) => weight(b.match) - weight(a.match));
}

/** A displayed fault / alarm code on a part, e.g. faultCode(gs20Part, 'oc'). Case, spaces and dots are ignored. */
export function faultCode(p: CatalogPart, code: string, data: DeviceFaultProfile[] = loadedFaults()): { profile: DeviceFaultProfile; fault: FaultEntry } | undefined {
  // Spaces and dots are display formatting: 'E 001' = 'E001', 'AL.009' = 'AL009'.
  const key = (s: string) => s.toLowerCase().replace(/[\s.]+/g, '');
  const c = key(code);
  for (const profile of faultProfilesFor(p, data)) {
    const fault = profile.faults.find((f) => f.code !== undefined && key(f.code) === c);
    if (fault) return { profile, fault };
  }
  return undefined;
}

/** Faults whose symptom, title or code mention all the given words, across a part's profiles. */
export function faultsMatching(p: CatalogPart, words: string, data: DeviceFaultProfile[] = loadedFaults()): { profile: DeviceFaultProfile; fault: FaultEntry }[] {
  const ws = words.toLowerCase().split(/\s+/).filter(Boolean);
  return faultProfilesFor(p, data).flatMap((profile) => profile.faults
    .filter((f) => ws.every((w) => `${f.code ?? ''} ${f.title} ${f.symptom} ${f.causes.join(' ')}`.toLowerCase().includes(w)))
    .map((fault) => ({ profile, fault })));
}


/** A fault's kind: as set in the data, else from its code (a displayed code) and its wording. */
export function symptomKindOf(f: FaultEntry): SymptomKind | undefined {
  if (f.symptomKind) return f.symptomKind;
  if (f.code) return 'display-code';
  const s = `${f.title} ${f.symptom}`.toLowerCase();
  if (/\btrip|\bblown|nuisance|opens? (on|at|when)/.test(s)) return 'trips';
  if (/stuck|welded|stays? (on|closed|energi)|won'?t (turn|switch) off|does not (turn|switch) off|leakage/.test(s)) return 'stuck-on';
  const neg = /\b(no|not|never|off|doesn'?t|does not|won'?t|cannot|fails?)\b/.test(s);
  // Output side first: an output, load, coil, valve or actuator that should act but doesn't.
  if (neg && /\boutput\b|\by led\b|\bload\b|\bcoil\b|\bvalve\b|actuator|pull(s)? in|\bshift/.test(s)) return 'output-no-motion';
  // Input side: a sensor, contact or encoder whose signal the PLC doesn't see.
  if (neg && /\binput\b|\bx led\b|detect|sensor|pulses?|\bcount|\bsignal/.test(s)) return 'no-input';
  return undefined;
}

/** A part's faults of one kind, most specific profile first. */
export function faultsOfKind(p: CatalogPart, kind: SymptomKind, data: DeviceFaultProfile[] = loadedFaults()): { profile: DeviceFaultProfile; fault: FaultEntry }[] {
  return faultProfilesFor(p, data).flatMap((profile) => profile.faults.filter((f) => symptomKindOf(f) === kind).map((fault) => ({ profile, fault })));
}

/** Terminals that carry mains or drive power wherever they appear (line / load / motor / DC bus). */
const POWER_PINS = new Set(['L', 'N', 'L1', 'L2', 'L3', 'R', 'S', 'T', 'U', 'V', 'W', 'T1', 'T2', 'T3', 'R/L1', 'S/L2', 'T/L3',
  'U/T1', 'V/T2', 'W/T3', '1/L1', '3/L2', '5/L3', '2/T1', '4/T2', '6/T3', 'L/+', 'N/-', 'L1/+', 'L2/N/-', 'DC+', 'DC-', '+1', '+2', 'B1', 'B2']);

/**
 * Is this reading taken on a live mains / DC-bus circuit? Decided by what the terminals are connected to, not by the
 * expected value: a breaker's line-to-load drop or an SSR's L1-T1 drop reads a few volts but sits on mains. True when
 * the data flags it, a pin is a power terminal, the terminals are described as line / load / mains / DC bus, or the
 * reading mentions an AC voltage of 100 V or more (e.g. an A1-A2 supply of 24-240 VAC).
 */
export function needsLiveWorkCaution(t: TerminalCheck): boolean {
  if (t.liveWork) return true;
  if ((t.pins ?? []).some(([a, b]) => POWER_PINS.has(a.toUpperCase()) || POWER_PINS.has(b.toUpperCase()))) return true;
  if (/\b(line|load side|mains|main circuit|dc bus|line[- ]to[- ](line|load)|r\/l1|u\/t1)\b/i.test(t.terminals)) return true;
  const text = `${t.terminals} ${t.state} ${t.expected} ${t.note ?? ''}`;
  return [...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?)\s*)?V\s*(?:AC|~)|(\d+(?:\.\d+)?)\s*VAC/gi)]
    .some((m) => Math.max(Number(m[1] ?? 0), Number(m[2] ?? 0), Number(m[3] ?? 0)) >= 100);
}

/** What the project tells the troubleshooter about its safety wiring. Unknown STO wiring counts as wired. */
export interface SafetyContext {
  /** True when the drawings wire the drive's STO / safety inputs; undefined (unknown) is treated as wired. */
  stoWired?: boolean;
}

/**
 * The fixes to show for a fault. Every consumer must use this (not `fault.fix` directly): it adds the STO-jumper fixes
 * only when the project explicitly has no STO wiring.
 */
export function fixesFor(fault: FaultEntry, ctx: SafetyContext): string[] {
  return ctx.stoWired === false ? [...fault.fix, ...(fault.fixIfNoStoWiring ?? [])] : [...fault.fix];
}

/** A profile's normal readings with the live-work caution attached where the circuit is live. Use this, not `profile.normal`. */
export function readingsFor(profile: DeviceFaultProfile): { reading: TerminalCheck; caution?: string }[] {
  return profile.normal.map((reading) => (needsLiveWorkCaution(reading) ? { reading, caution: LIVE_WORK_CAUTION } : { reading }));
}
