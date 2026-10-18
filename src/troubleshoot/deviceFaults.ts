import type { CatalogCategory, CatalogPart } from '../electrical/types';
import { DEVICE_FAULT_DATA } from './deviceFaultData';

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
  note?: string;
}

/** An LED or display indication and what it means. */
export interface Indicator {
  /** LED / display element as labelled: 'PWR', 'RUN', 'ERR', 'X001 LED', 'output LED (yellow)', 'keypad display'. */
  name: string;
  /** Its state: 'on green', 'flashing red 1 Hz', 'off', 'shows oc'. */
  state: string;
  meaning: string;
}

/** One common fault: how it shows, how to confirm it, the fix. */
export interface FaultEntry {
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
  /** Healthy readings, per state. */
  normal: TerminalCheck[];
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
export function faultProfilesFor(p: CatalogPart, data: DeviceFaultProfile[] = DEVICE_FAULT_DATA): DeviceFaultProfile[] {
  return data.filter((d) => profileMatches(d.match, p)).sort((a, b) => weight(b.match) - weight(a.match));
}

/** A displayed fault / alarm code on a part, e.g. faultCode(gs20Part, 'oc'). Case-insensitive. */
export function faultCode(p: CatalogPart, code: string, data: DeviceFaultProfile[] = DEVICE_FAULT_DATA): { profile: DeviceFaultProfile; fault: FaultEntry } | undefined {
  const c = code.trim().toLowerCase();
  for (const profile of faultProfilesFor(p, data)) {
    const fault = profile.faults.find((f) => f.code?.toLowerCase() === c);
    if (fault) return { profile, fault };
  }
  return undefined;
}

/** Faults whose symptom, title or code mention all the given words, across a part's profiles. */
export function faultsMatching(p: CatalogPart, words: string, data: DeviceFaultProfile[] = DEVICE_FAULT_DATA): { profile: DeviceFaultProfile; fault: FaultEntry }[] {
  const ws = words.toLowerCase().split(/\s+/).filter(Boolean);
  return faultProfilesFor(p, data).flatMap((profile) => profile.faults
    .filter((f) => ws.every((w) => `${f.code ?? ''} ${f.title} ${f.symptom} ${f.causes.join(' ')}`.toLowerCase().includes(w)))
    .map((fault) => ({ profile, fault })));
}
