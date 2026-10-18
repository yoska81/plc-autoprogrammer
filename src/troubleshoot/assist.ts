/**
 * The help around guided fault finding (steps.ts), rules first: works with no API key.
 * - matchSymptom: what the technician says or types ("the box stop eye never comes on", "X4 keeps flickering",
 *   "conveyor motor won't start") → the PLC points it most likely means, each with the symptom; a function that
 *   won't go or a stuck step also names the StuckTarget for "why is it stuck?" (Dev 2's guide.ts) to look at first.
 * - matchMachineSymptom: the machine-level symptom (Dev 1's machineSymptoms map for the machine type) and its causes.
 * - rankCauses: the likely causes for a point and symptom, in plain words, ordered by what is on its wiring path
 *   (field cable, series contacts, fuses, the kind of device; the maker's causes from Dev 1's deviceFaults when the
 *   device's part is known) and by what the project's fault log found there before.
 * - With a key, the AI may only choose among the rule answers (a point and symptom from the list, an order of the
 *   same causes) or reword a step; a rewording that loses a reading, terminal, wire number or warning is dropped.
 * Types are the parts of Debug 4's WiringPath / Step / FaultLogEntry this reads (structurally the same).
 */

import { findSymptom, rankedCauses, symptomMap, type MachineSymptom, type MachineSymptomMap, type SymptomCause } from './kbStub';
import type { SymptomKind } from './kbStub';

export type Symptom = 'never-on' | 'always-on' | 'flickers' | 'output-dead' | 'analog-wrong';

/** Dev 1's device fault kind for an operator symptom (deviceFaults faultsOfKind); none for flicker / analog. */
export const FAULT_KIND: Partial<Record<Symptom, SymptomKind>> = { 'never-on': 'no-input', 'always-on': 'stuck-on', 'output-dead': 'output-no-motion' };

/** What "why is it stuck?" (Dev 2's whyStuck.ts StuckTarget) should look at first: an output, or a cycle step. */
export type StuckTarget = { output: string } | { step: number };
/** A cycle step, for matching "stops at filling" (number and name). */
export interface AssistStep { n: number; name: string }

export interface AssistHop {
  kind: string;
  tag: string;
  terminal?: string;
  wire?: string;
  label: string;
  location?: 'cabinet' | 'door' | 'field';
  common?: boolean;
  measure?: { kind: string; expect: string };
}
export interface AssistPath {
  address: string;
  description: string;
  type: 'input' | 'output';
  analog: boolean;
  device: string;
  signal: AssistHop[];
  supply: AssistHop[];
  ret: AssistHop[];
}
/** The parts of a fault log entry this reads. */
export interface AssistLogEntry { address: string; date: string; found: string; fix: string; practice?: boolean }

/** The symptoms that fit a point (as steps.ts symptomsFor). */
export const symptomsOf = (p: AssistPath): Symptom[] => (p.analog ? ['analog-wrong'] : p.type === 'output' ? ['output-dead'] : ['never-on', 'always-on', 'flickers']);

// ── Free text → point + symptom ──

/** Symptom words (English, Spanish, German): the more specific first. */
const SAYS: [Symptom | 'not-working', RegExp][] = [
  ['flickers', /flicker|flutter|chatter|drops? (out|off)|dropping out|intermittent|on and off|off and on|comes and goes|sometimes|random(ly)?|cuts? out|parpade|intermitente|flacker|sporadisch/],
  ['always-on', /always on|stays? on|stuck on|on all the time|(won'?t|will not|doesn'?t|does not|never) (go|turn|switch)(es)? off|constantly on|permanently on|siempre (encendid|activ)|se queda (encendid|activ)|immer an|bleibt an/],
  ['analog-wrong', /reads? wrong|wrong (value|reading|level|temp|pressure|number)|out of range|reads? (zero|0|max|full|too high|too low)|stuck at|jump(s|ing)?|erratic|no reading|valor (incorrecto|errone)|falscher wert|fuera de rango/],
  ['output-dead', /(won'?t|will not|doesn'?t|does not|never|not|can'?t) (run|start|move|open|close|turn|spin|extend|retract|fire|energi[sz]e|pull in|work)(s|ing)?|nothing happens|no power|not running|not moving|isn'?t (running|moving)|dead|no arranca|no se mueve|no funciona|läuft nicht|bewegt sich nicht|geht nicht/],
  ['never-on', /(never|won'?t|doesn'?t|does not|not|no longer) (come|comes|coming|turn|switch|go|light)s? on|never on|(not|doesn'?t|won'?t|never) (detect|see|sense|pick up|register|read)(s|ing)?|no signal|led (is )?(off|out)|no (light|led)|nunca (enciende|se activa)|no detecta|kommt nicht|erkennt nicht/],
  ['not-working', /not working|doesn'?t work|broken|faulty|problem|issue|fault|no funciona|kaputt|defekt/],
];

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'on', 'off', 'in', 'at', 'to', 'is', 'it', 'its', 'my', 'our', 'this', 'that', 'not', 'no', 'never', 'always', 'keeps', 'keep', 'does', 'doesn', 'won', 'will', 'all', 'time', 'stays', 'stay', 'come', 'comes', 'turn', 'turns', 'when', 'while', 'with', 'there', 'any', 'more', 'longer', 'working', 'work', 'sometimes', 'just', 'now', 'again', 'el', 'la', 'los', 'las', 'de', 'del', 'que', 'se', 'der', 'die', 'das', 'ist', 'nicht']);
/** Words of a text, lower case; names split at _ and case changes. */
function wordsOf(text: string): string[] {
  const words = text.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().match(/[a-zà-ÿ]{2,}/g) ?? [];
  return [...new Set(words.filter((w) => !STOP.has(w)))];
}
/** Same word: the same 4-letter stem (sensor ≈ sensors), or a whole word inside a compound (button ≈ pushbutton). */
const sameWord = (a: string, b: string) => a.slice(0, 4) === b.slice(0, 4) || (a.length >= 4 && b.includes(a)) || (b.length >= 4 && a.includes(b));
/** "X4", "x004", "%IX0.3", "I0.3", "Y 2" → a comparable key (letter + number without leading zeros). */
function addrKey(a: string): string {
  const m = /^%?([A-Z]+)\s*0*(\d+(?:\.\d+)?)$/i.exec(a.trim().replace(/^%([IQ])X/i, '%$1'));
  return m ? `${m[1].toUpperCase()}${m[2]}` : a.trim().toUpperCase();
}
const ADDR_IN_TEXT = /(?<![A-Za-z0-9])%?[IQXYM][XWD]?\s?\d+(?:\.\d+)?\b/gi;

export interface SymptomMatch {
  address: string;
  symptom: Symptom;
  /**
   * The words name a machine function that won't go ("won't start", "never moves") or a stuck step ("stops at
   * filling"): look at why it is stuck first (whyStuck / guide.ts), the wiring only when that points there.
   */
  target?: StuckTarget;
  /** 0…1: how sure the rules are. */
  score: number;
  /** Why this point, in plain words. */
  why: string;
}

/**
 * The symptom the words say, for a point (a general "not working" picks the point's usual one). `fit`: how well
 * the words fit this kind of point (1 = said of it, 0.75 = said of another kind and carried over).
 */
function symptomFor(text: string, p: AssistPath): { s: Symptom; fit: number } | null {
  const fits = symptomsOf(p);
  for (const [s, re] of SAYS) {
    if (!re.test(text)) continue;
    if (s === 'not-working') return { s: fits[0], fit: 0.9 };
    if (fits.includes(s)) return { s, fit: 1 };
    // "Never comes on" said about an output: the PLC turns it on, nothing happens.
    if (p.type === 'output' && (s === 'never-on' || s === 'flickers')) return { s: 'output-dead', fit: 0.9 };
    if (p.type === 'input' && !p.analog && s === 'output-dead') return { s: 'never-on', fit: 0.75 };
  }
  return null;
}

const FUNCTION_WONT = /(won'?t|will not|doesn'?t|does not|never|not|can'?t) (start|run|move|go|cycle|turn on)|stops? (at|in|on|during|after)|stuck (at|in|on)|hangs? (at|in)|no arranca|bleibt stehen/;

/** The points a description of the problem most likely means, best first (empty when nothing matches). */
export function matchSymptom(text: string, paths: AssistPath[], steps: AssistStep[] = []): SymptomMatch[] {
  const out = matchPoints(text, paths);
  const said = text.toLowerCase();
  if (!FUNCTION_WONT.test(said)) return out;
  // "Stops at filling" / "stuck at step 20": the step.
  const words = wordsOf(text);
  const n = /\bstep\s*(\d+)/i.exec(text)?.[1];
  const step = n !== undefined ? steps.find((x) => x.n === Number(n)) ?? { n: Number(n), name: '' } : steps.find((x) => wordsOf(x.name).some((w) => words.some((t) => sameWord(t, w))));
  if (step && /stops?|stuck|hangs?|bleibt/.test(said)) {
    const s: StuckTarget = { step: step.n };
    return out.length ? out.map((m, i) => (i === 0 ? { ...m, target: s } : m)) : [{ address: '', symptom: 'output-dead', score: 0.6, target: s, why: `Step ${step.n}${step.name ? ` (${step.name})` : ''}: the machine stops there` }];
  }
  // "The capper never starts": its output, through why-stuck first.
  return out.map((m) => (paths.find((p) => p.address === m.address)?.type === 'output' && !paths.find((p) => p.address === m.address)?.analog ? { ...m, target: { output: m.address } } : m));
}

function matchPoints(text: string, paths: AssistPath[]): SymptomMatch[] {
  const said = text.toLowerCase();
  const words = wordsOf(text);
  const addrs = new Set((text.match(ADDR_IN_TEXT) ?? []).map(addrKey));
  const out: SymptomMatch[] = [];
  for (const p of paths) {
    const reasons: string[] = [];
    let score = 0;
    if (addrs.has(addrKey(p.address))) { score += 1; reasons.push(`address ${p.address}`); }
    if (p.device && new RegExp(`\\b${p.device.replace(/[^\w]/g, '')}\\b`, 'i').test(text)) { score += 0.9; reasons.push(`device ${p.device}`); }
    const own = wordsOf(`${p.description} ${p.device}`);
    const hit = own.filter((w) => words.some((t) => sameWord(t, w)));
    if (hit.length) {
      score += 0.8 * (hit.length / Math.min(own.length, 3));
      const shown = (p.description.match(/[A-Za-zà-ÿ]{2,}/g) ?? []).filter((w) => hit.includes(w.toLowerCase()));
      reasons.push(`"${shown.join(' ') || hit.join(' ')}"`);
    }
    if (score <= 0) continue;
    const s = symptomFor(said, p);
    out.push({ address: p.address, symptom: s?.s ?? symptomsOf(p)[0], score: Math.min(1, score) * (s?.fit ?? 0.7), why: `${p.description || p.address} (${p.address}): matches ${reasons.join(', ')}${s ? '' : '; what it does is not clear, so the usual check is offered'}` });
  }
  return out.sort((a, b) => b.score - a.score);
}

// ── Likely causes ──

export interface Cause {
  id: string;
  /** The cause, in plain words. */
  text: string;
  /** Why it is likely here. */
  why: string;
  weight: number;
}

const DEVICE_KIND: [RegExp, string][] = [
  [/photo|eye|\bpe\d*\b|beam|reflect/i, 'photo eye'],
  [/prox|inductive|capacitive|\bpx\d*\b/i, 'proximity sensor'],
  [/limit|\bls\d*\b/i, 'limit switch'],
  [/push ?button|\bpb\b|_pb\b|button|e-?stop|selector|switch/i, 'switch'],
  [/motor|conveyor|pump|fan|agitator|contactor|starter|\bm\d+\b/i, 'motor'],
  [/valve|solenoid|\bsv\d*\b|\bsol\b|cylinder|pusher/i, 'valve'],
  [/lamp|light|beacon|horn|buzzer|stack/i, 'lamp'],
  [/level|pressure|temp|flow|transmitter|\btt\d*|\bpt\d*|\blt\d*/i, 'transmitter'],
];
const kindOf = (p: AssistPath) => DEVICE_KIND.find(([re]) => re.test(`${p.description} ${p.device}`))?.[1] ?? '';

/** What a fault log "found" text points at. */
const LOG_CAUSE: [RegExp, string][] = [
  [/loose|wiggle|flicker|intermittent/i, 'loose'],
  [/open|broken wire|break|cut/i, 'wire'],
  [/short/i, 'short'],
  [/supply|fuse|breaker|tripped|overload|no 24|power/i, 'supply'],
  [/0 ?v|return|common/i, 'return'],
  [/device|sensor|switch|eye|valve|coil|motor|load|transmitter|replace|align|dirty|target/i, 'device'],
  [/setting|range|scal|preset|program|force/i, 'setting'],
];

/** A device fault entry (Dev 1's deviceFaults FaultEntry: the parts read here). */
export interface AssistDeviceFault { title: string; causes: string[]; fix: string[]; source: string }

/**
 * The likely causes for a point and symptom, most likely first (rules only). `deviceFaults`: the device's own
 * fault entries for this symptom (faultsOfKind on its catalog part, FAULT_KIND): they replace the general
 * "the device" cause with the maker's causes.
 */
export function rankCauses(p: AssistPath, symptom: Symptom, log: AssistLogEntry[] = [], deviceFaults: AssistDeviceFault[] = []): Cause[] {
  const kind = kindOf(p);
  const dev = p.device ? `${p.device}${kind ? ` (${kind})` : ''}` : kind || 'the device';
  const all = [...p.signal, ...p.supply, ...p.ret];
  const field = p.signal.filter((h) => h.location === 'field' || h.kind === 'cable' || h.kind === 'junction-box').length;
  const joints = p.signal.filter((h) => h.kind === 'terminal' || h.kind === 'junction-box').length;
  const contacts = p.signal.filter((h) => h.kind === 'contact');
  const protection = all.filter((h) => h.kind === 'protection');
  const wireNo = p.signal.find((h) => h.wire)?.wire;
  const c: Cause[] = [];
  const add = (id: string, weight: number, text: string, why: string) => c.push({ id, text, why, weight });
  const cable = field ? `it runs out to the machine (${field} field hop${field === 1 ? '' : 's'})` : 'its wiring';
  switch (symptom) {
    case 'never-on':
      add('device', kind === 'photo eye' || kind === 'proximity sensor' ? 3 : 2.2, `${dev} does not switch: misaligned, dirty, out of range or failed`, kind === 'photo eye' ? 'Photo eyes go out of alignment and get dirty more than anything else on the path.' : kind === 'proximity sensor' ? 'A proximity sensor too far from its target, or hit and damaged, is the most common cause.' : 'The device at the end of the path switches the signal.');
      add('wire', 1.5 + 0.5 * field, `An open wire${wireNo ? ` (wire ${wireNo})` : ''} between the PLC and ${dev}`, `${cable[0].toUpperCase()}${cable.slice(1)}: cables at the machine get pulled, cut or crushed.`);
      add('loose', 1 + 0.4 * joints, 'A loose or corroded terminal', `${joints || 'Every'} terminal${joints === 1 ? '' : 's'} on the signal path.`);
      if (contacts.length) add('contact', 1.4, `A series contact that stays open: ${contacts.map((h) => h.label).join(', ')}`, 'The signal passes through it.');
      add('supply', 1 + 0.5 * protection.length, `No supply at ${dev}: a fuse or breaker off, or its feed wire open`, protection.length ? `${protection.map((h) => h.tag).join(', ')} on its feed.` : 'A sensor needs its 24 V to switch.');
      add('return', 0.8, 'The 0 V return or the input module common is open', 'Every point on that common goes dead at once: check whether other inputs are off too.');
      break;
    case 'always-on':
      add('device', 2.6, `${dev} is made all the time: a target or dirt in front of it, a stuck or held button, or a failed sensor`, 'The device is the usual reason a signal never goes off.');
      add('short', 1.2 + 0.4 * field, `The signal wire${wireNo ? ` (wire ${wireNo})` : ''} is shorted to 24 V`, `${cable[0].toUpperCase()}${cable.slice(1)}: a crushed cable can short its cores together.`);
      add('setting', 0.8, 'The input is forced in the PLC, or the program reads a different address', 'A forgotten force looks like a stuck device.');
      break;
    case 'flickers':
      add('loose', 2.4 + 0.4 * joints, 'A loose terminal or connector on the signal path', `${joints || 'Every'} terminal${joints === 1 ? '' : 's'} and the device connector: a wiggle test finds it.`);
      add('wire', 1.4 + 0.6 * field, 'A damaged cable that opens when the machine moves', field ? `${cable[0].toUpperCase()}${cable.slice(1)}: watch it while the machine runs.` : 'Look for a cable that moves with the machine.');
      add('device', kind === 'photo eye' ? 2.2 : 1.6, `${dev} on the edge of switching: alignment, distance, vibration or a shiny target`, 'A sensor right at its switching distance flickers with vibration.');
      add('supply', 0.9, 'The 24 V supply dips (overloaded or a bad connection)', 'Several points flickering together point here.');
      break;
    case 'output-dead':
      add('device', kind === 'motor' ? 1.8 : 2.4, `${dev} itself: ${kind === 'motor' ? 'the motor, its contactor coil or the drive' : kind === 'valve' ? 'a burnt solenoid coil, or a stuck valve / no air' : kind === 'lamp' ? 'the bulb or LED' : 'the load does not work'}`, 'The load is the last thing on the path.');
      if (protection.length) add('supply', 2.2, `A tripped fuse, breaker or overload: ${protection.map((h) => h.tag).join(', ')}`, kind === 'motor' ? 'Motors trip their overload; check it first.' : 'A shorted load blows its fuse.');
      else add('supply', 1.2, 'No supply to the output or the load (a fuse or breaker off)', 'Check the feed before the load.');
      add('wire', 1.3 + 0.5 * field, `An open wire${wireNo ? ` (wire ${wireNo})` : ''} between the PLC output and ${dev}`, `${cable[0].toUpperCase()}${cable.slice(1)}.`);
      if (contacts.length) add('contact', 1.6, `A series contact that stays open: ${contacts.map((h) => h.label).join(', ')}`, 'An interlock or relay contact in the load circuit.');
      add('return', 0.8, 'The load return (0 V / neutral) or the output common is open', 'Every output on that common goes dead at once.');
      add('plc', 0.6, 'The PLC output itself is damaged (it shows ON but gives no voltage)', 'Outputs burn out after a short on the load.');
      break;
    case 'analog-wrong':
      add('setting', 2.2, 'The scaling or range in the program does not match the transmitter (for example 0–10 V set, 4–20 mA wired)', 'The most common cause of a value that is wrong but steady.');
      add('wire', 1.6 + 0.2 * field, 'The current loop is open: 0 mA (or below 4 mA) reads as zero or a fault', 'An open loop reads the bottom of the range.');
      add('device', 1.6, `${dev}: failed, set to another range, or not calibrated`, 'Check its own display or test it against a meter.');
      add('noise', 1 + 0.4 * field, 'Electrical noise: the shield not earthed at one end, or the cable runs with motor cables', 'A value that jumps around points here.');
      add('supply', 1, 'No loop power (24 V) at the transmitter', 'A 2-wire transmitter needs 24 V in its loop.');
      break;
  }
  // The maker's causes for this device, in their order, in place of the general one.
  const own = deviceFaults.flatMap((f) => f.causes.slice(0, 3).map((cause) => ({ cause, f }))).slice(0, 4);
  const general = c.find((x) => x.id === 'device');
  if (own.length && general) {
    c.splice(c.indexOf(general), 1, ...own.map(({ cause, f }, i) => ({ id: i ? `device:${i}` : 'device', text: `${p.device || 'The device'}: ${cause}`, why: `${f.title} (maker's manual: ${f.source})`, weight: general.weight - i * 0.3 })));
  }
  // The project's own history on this point: what was found before comes first.
  const past = log.filter((e) => !e.practice && addrKey(e.address) === addrKey(p.address));
  for (const x of c) {
    const times = past.filter((e) => LOG_CAUSE.some(([re, id]) => id === x.id.split(':')[0] && re.test(`${e.found} ${e.fix}`)));
    if (!times.length) continue;
    x.weight += 1.5 * times.length;
    const last = [...times].sort((a, b) => b.date.localeCompare(a.date))[0];
    x.why = `Found here ${times.length === 1 ? 'once' : `${times.length} times`} before (last ${last.date.slice(0, 10)}: ${last.found}). ${x.why}`;
  }
  return c.sort((a, b) => b.weight - a.weight);
}

// ── Machine-level symptoms (Dev 1's machineSymptoms: roll former / flying shear …) ──

export interface MachineMatch { map: MachineSymptomMap; symptom: MachineSymptom; causes: SymptomCause[]; score: number }

/**
 * The machine-level symptom the words describe, for the machine type the project is ("roll former", from its
 * name or description): Dev 1's findSymptom first (every word must match), else the symptom sharing most words.
 */
export function matchMachineSymptom(text: string, machine: string, data?: MachineSymptomMap[]): MachineMatch | null {
  const map = symptomMap(machine, data);
  if (!map) return null;
  const exact = findSymptom(map, text);
  if (exact) return { map, symptom: exact, causes: rankedCauses(exact), score: 1 };
  const words = wordsOf(text).filter((w) => w.length > 2);
  let best: { s: MachineSymptom; score: number } | null = null;
  for (const s of map.symptoms) {
    const own = wordsOf([s.symptom, ...s.aliases].join(' ')).filter((w) => w.length > 2);
    const hit = words.filter((t) => own.some((w) => sameWord(t, w))).length;
    const score = words.length ? hit / words.length : 0;
    if (hit >= 2 && score > (best?.score ?? 0.4)) best = { s, score };
  }
  return best ? { map, symptom: best.s, causes: rankedCauses(best.s), score: best.score } : null;
}

// ── The AI on top: only choosing among the rule answers, or rewording ──

/** Asks the AI with a JSON schema; returns its JSON text (assistAI.ts gives one for the app's AI settings). */
export type Ask = (system: string, user: string, schema: Record<string, unknown>) => Promise<string>;

const parse = <T>(s: string): T | null => { try { return JSON.parse(s) as T; } catch { return null; } };

/** With a key: the AI picks the point and symptom among the rule matches (or all points when none matched). */
export async function aiMatchSymptom(ask: Ask, text: string, paths: AssistPath[], rules = matchSymptom(text, paths)): Promise<SymptomMatch[]> {
  const pool = rules.length ? paths.filter((p) => rules.some((r) => r.address === p.address)) : paths;
  const list = pool.slice(0, 60).map((p) => `${p.address} | ${p.description} | ${p.device} | ${p.type}${p.analog ? ' analog' : ''} | symptoms: ${symptomsOf(p).join(', ')}`).join('\n');
  const schema = { type: 'object', additionalProperties: false, required: ['address', 'symptom'], properties: { address: { type: 'string' }, symptom: { type: 'string', enum: ['never-on', 'always-on', 'flickers', 'output-dead', 'analog-wrong'] } } };
  try {
    const r = parse<{ address: string; symptom: Symptom }>(await ask('A maintenance technician describes a machine problem. Pick the one PLC point it is about and its symptom, only from the list.', `Problem: ${text}\n\nPoints (address | description | device | type | symptoms):\n${list}`, schema));
    const p = r && pool.find((x) => x.address === r.address);
    if (!p || !symptomsOf(p).includes(r!.symptom)) return rules;
    const pick: SymptomMatch = { address: p.address, symptom: r!.symptom, score: 1, why: rules.find((x) => x.address === p.address)?.why ?? `${p.description || p.address} (${p.address}): chosen by the AI from the description` };
    return [pick, ...rules.filter((x) => x.address !== p.address)];
  } catch {
    return rules;
  }
}

/** With a key: the AI may reorder the rule causes (never add or drop one). */
export async function aiRankCauses(ask: Ask, p: AssistPath, symptom: Symptom, causes: Cause[], said = ''): Promise<Cause[]> {
  const schema = { type: 'object', additionalProperties: false, required: ['order'], properties: { order: { type: 'array', items: { type: 'string' } } } };
  try {
    const r = parse<{ order: string[] }>(await ask(
      'Order these possible causes of a machine fault from most to least likely. Use only the ids given.',
      `Point ${p.address} (${p.description}, ${p.type}), device ${p.device || 'unknown'}, symptom ${symptom}.${said ? ` The technician said: ${said}` : ''}\nCauses:\n${causes.map((c) => `${c.id}: ${c.text}`).join('\n')}`,
      schema,
    ));
    const ids = (r?.order ?? []).filter((id, i, all) => causes.some((c) => c.id === id) && all.indexOf(id) === i);
    if (!ids.length) return causes;
    return [...ids.map((id) => causes.find((c) => c.id === id)!), ...causes.filter((c) => !ids.includes(c.id))];
  } catch {
    return causes;
  }
}

/** Safety and meter sentences of the steps (steps.ts) that are kept word for word. */
const EXACT = ['Switch off and lock out first.', 'Keep everyone clear first — the machine will move.', 'never across the terminals (that shorts the transmitter)', 'Meter on DC volts.', 'Meter on AC volts.', 'Meter on DC millivolts.', 'Power OFF and locked out, meter on continuity.'];

/** What a step must keep, whatever the wording: its safety sentences as written, readings, terminals and wire numbers. */
export function mustKeep(say: string): string[] {
  return [...EXACT.filter((x) => say.includes(x)), ...tokensToKeep(say)];
}
function tokensToKeep(say: string): string[] {
  const nums = say.match(/\d+(?:[.,]\d+)?(?:\s?(?:VDC|VAC|V|mA|mV|ms|s|%))?/g) ?? [];
  const tags = say.match(/\b[A-Z][A-Z0-9]*\d[A-Z0-9]*(?:[-:.][A-Z0-9]+)*\b|\b\d+[A-Z]+\d*\b/g) ?? [];
  const words = say.match(/lock(ed)? out|SERIES|never|mains|qualified|DANGER|power OFF|continuity/gi) ?? [];
  return [...new Set([...nums.map((n) => n.replace(/\s+/g, '')), ...tags, ...words.map((w) => w.toLowerCase())])];
}
/** Words that reverse or weaken an instruction ("Do NOT lock out", "no need to switch off", "skip the lock-out"). */
const NEGATION = /\b(not|no|never|don'?t|doesn'?t|isn'?t|aren'?t|won'?t|can'?t|cannot|without|skip(ped|ping)?|unnecessary|needless|optional|instead|avoid|ignore|nor|neither|none)\b|n't\b/gi;
const negations = (t: string) => (t.match(NEGATION) ?? []).length;
const keeps = (orig: string, next: string) => {
  const flat = next.replace(/\s+/g, '').toLowerCase();
  // Every reading, terminal and safety sentence is still there, and no negation was added: a rewording may not
  // turn "Switch off and lock out first." into "Do not lock out" while keeping the words.
  return mustKeep(orig).every((k) => flat.includes(k.replace(/\s+/g, '').toLowerCase())) && negations(next) <= negations(orig);
};

/** A sentence about safety: never sent to the AI, always shown and spoken as the rules wrote it. */
const SAFETY = /lock ?(ed )?out|lockout|switch(ed)? off|power|energi[sz]|de-?energi|voltage|volts?\b|\bforc(e|ed|ing)\b|override|keep (everyone )?clear|clear of|\bSTO\b|safe torque|e-?stop|emergency|mains|danger|\bPPE\b|qualified|\bSERIES\b|\blive\b|isolat|guard|interlock|machine will move|never across|\brunning\b|\brun\b|\bleave\b|\bstay(s|ing)?\b|start(ed|s)? up|\bmoving\b|\bmotion\b/i;
/** Sentences: a break only after . ? ! followed by a space ("Q0.1", "%I0.5", "TB1-12" and "2.5 V" stay whole). */
const sentences = (t: string) => t.split(/(?<=[.?!])\s+(?=\S)/).map((x) => x.trim()).filter(Boolean);

/** Words that carry no instruction of their own (articles, pronouns, plain connectors). Modal words (can, may, ok…) are not here. */
const FILLER = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'to', 'on', 'in', 'at', 'by', 'for', 'with', 'from', 'into', 'onto', 'is', 'are', 'it', 'its', 'this', 'that', 'these', 'those', 'you', 'your', 'do', 'does', 'then', 'there', 'here', 'now', 'first', 'next', 'between', 'each', 'both']);
const contentWords = (t: string) => (t.toLowerCase().match(/[a-zà-ÿ]+/g) ?? []).filter((w) => !FILLER.has(w));
/**
 * The allowlist: a reworded sentence may only use the words of the sentence it rewords (same stem: "measure" ≈
 * "measuring"), never new ones, and stays one sentence. So the AI can shorten and simplify, never add meaning
 * ("Feel free to reach inside", "Bypass the door switch" bring words the rule text does not have).
 */
const onlyOwnWords = (orig: string, next: string) => {
  const own = contentWords(orig);
  const same = (a: string, b: string) => a === b || (a.length >= 4 && b.length >= 4 && a.slice(0, 4) === b.slice(0, 4));
  return sentences(next).length <= 1 && contentWords(next).every((w) => own.some((o) => same(o, w)));
};

/**
 * With a key: a step in plainer words (or in the technician's language). Safety sentences are never sent to the AI:
 * they stay exactly as written, in their place; only the other sentences are reworded, each one checked (its
 * readings, terminals and wire numbers kept, no negation added, no safety wording brought in). Anything else: the
 * rule text.
 */
export async function aiPlainStep(ask: Ask, say: string, language = 'en'): Promise<string> {
  const parts = sentences(say);
  const plain = parts.map((x, i) => ({ x, i })).filter(({ x }) => !SAFETY.test(x));
  if (!plain.length) return say;
  const schema = { type: 'object', additionalProperties: false, required: ['sentences'], properties: { sentences: { type: 'array', items: { type: 'string' } } } };
  try {
    const r = parse<{ sentences: string[] }>(await ask(
      `Reword each sentence of one fault-finding step for a maintenance technician at the machine: plain words, ${language === 'en' ? 'English' : `language code ${language}`}. One sentence out for each sentence in, same order. Keep every number, unit, terminal, wire number and device tag exactly as written. Do not add steps, advice or warnings.`,
      plain.map(({ x }, k) => `${k + 1}. ${x}`).join('\n'), schema,
    ));
    const out = r?.sentences?.map((t) => t.trim().replace(/^\d+\.\s*/, '')) ?? [];
    if (out.length !== plain.length) return say;
    const next = [...parts];
    for (let k = 0; k < plain.length; k++) {
      const t = out[k];
      const o = plain[k].x;
      if (!t || t.length > o.length * 2 + 60 || SAFETY.test(t) || !keeps(o, t) || !onlyOwnWords(o, t)) return say;
      next[plain[k].i] = t;
    }
    return next.join(' ');
  } catch {
    return say;
  }
}
