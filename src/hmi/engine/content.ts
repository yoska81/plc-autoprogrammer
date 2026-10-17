/**
 * HMI content model: what the operator panel shows, without pixels or addresses. The rules read it
 * from the I/O list (and the electrical design's wiring when there is one); the AI may only rename,
 * regroup and add small things (src/lib/ai/hmiContentAI.ts). `buildHmi` (./build.ts) turns it into
 * screens with every tag assigned.
 */
import type { IOPoint } from '../../types/io';
import type { FieldDeviceType, IOWiring } from '../../electrical/types';
import type { HmiState } from '../types';
import { deviceTypeOf, TWO_HAND_RE } from '../../electrical/engine/machineModel';

export type ActuatorKind = 'motor' | 'drive' | 'cylinder' | 'valve' | 'heater';

/** A physical point the HMI shows (PLC address + what it is). */
export interface HmiPoint { address: string; description: string }

export interface HmiActuator {
  name: string;
  kind: ActuatorKind;
  /** Outputs that move it: run / reverse (motors, drives), extend / retract (cylinders), on (valves, heaters). */
  run?: HmiPoint;
  reverse?: HmiPoint;
  extend?: HmiPoint;
  retract?: HmiPoint;
  /** Position / running feedback inputs. */
  feedback: HmiPoint[];
  /** Drive fault or overload-tripped input. */
  fault?: HmiPoint;
  /** Analog speed reference (drives). */
  speedRef?: HmiAnalog;
  /** Hand operation on the Manual screen (hold-to-run). */
  manual: boolean;
}

export interface HmiAnalog { address: string; name: string; units: string; min: number; max: number; kind: 'input' | 'output' }

/** A discrete input that is itself an alarm or warning (over-temperature limit, air pressure low, film low). */
export interface HmiAlarmInput { point: HmiPoint; text: string; /** The input value that means "alarm". */ activeWhen: boolean; severity: 'alarm' | 'warning' }

/** Process setpoints the operator sets: the heater's temperature and the dwell (seal) time. */
export interface HmiProcess {
  /** Temperature control of a heater from an analog temperature input. */
  temp?: { heater: HmiPoint; pv: HmiAnalog; default: number };
  /** Dwell / seal time in ms (the cycle's timed step reads it). */
  dwell?: { defaultMs: number; name: string };
}

export interface HmiContent {
  machineName: string;
  actuators: HmiActuator[];
  safetyOk?: HmiPoint;
  /** Input that counts parts (part-at-end photo-eye, product sensor). */
  partSensor?: HmiPoint;
  analogs: HmiAnalog[];
  /** Machine state word texts (value 0 = stopped). */
  states: HmiState[];
  /** Two-hand start buttons: the cycle starts only with both (anti-tie-down in the PLC, safety in the two-hand relay). */
  twoHand?: HmiPoint[];
  alarmInputs?: HmiAlarmInput[];
  process?: HmiProcess;
  /** Every discrete point for the Diagnostics screen, in address order. */
  io: (HmiPoint & { type: 'input' | 'output' })[];
  questions: string[];
}

/** An input that is an alarm or fault in itself. */
/** A guard-door / safety-gate interlock input (its monitoring contact): never an actuator's position feedback. */
const GUARD_RE = /\b(guard\s*door|safety\s*(gate|door)|interlock(ed)?\s*(door|gate|switch)|door\s*interlock|guard\s*(closed|switch|interlock))\b/i;
const ALARM_WORDS = /\b(fault|faulted|trip|tripped|alarm|overload|over-?temp\w*|high[- ]?limit|jam\w*)\b/i;

/** Which coil of a pair moves out (extend, advance, close a gripper, press down) and which moves back. */
const EXTEND = /\b(extend\w*|advance\w*|forward|clamp|down|close|in)\b/i;
const RETRACT = /\b(retract\w*|return\w*|back|unclamp|up|open|out)\b/i;
const FEEDBACK = /\b(extended|retracted|advanced|returned|up|down|open(ed)?|closed|home|in|out|clamped|unclamped|position)\b/i;
const GENERIC = new Set(['ssr', 'solenoid', 'sol', 'valve', 'coil', 'output', 'cylinder', 'motor', 'contactor', 'starter', 'run', 'vfd', 'drive', 'sensor', 'switch', 'prox', 'limit', 'the', 'and']);
const keyWords = (s: string) => s.toLowerCase().replace(/\b(extend\w*|retract\w*|advance\w*|return\w*|forward|reverse|fwd|rev|up|down|open|close|clamp|unclamp|in|out|extended|retracted|on|off)\b/g, ' ')
  .split(/[^a-z0-9]+/).filter((w) => (w.length > 1 || /^\d+$/.test(w)) && !GENERIC.has(w));
/** Shared name words; numbers must agree ("Belt 2 fault" is not Belt 1's). */
const shareKey = (a: string, b: string) => {
  const A = keyWords(a), B = keyWords(b);
  const na = A.filter((w) => /^\d+$/.test(w)), nb = B.filter((w) => /^\d+$/.test(w));
  if (na.length && nb.length && !na.some((n) => nb.includes(n))) return false;
  return A.some((w) => !/^\d+$/.test(w) && B.includes(w));
};
const title = (s: string) => s.replace(/\s+/g, ' ').trim().replace(/(^|\s)\w/g, (c) => c.toUpperCase());

/** Name of an actuator from its output description ("Pusher solenoid" -> "Pusher"). */
function nameOf(desc: string): string {
  // Ratings are not part of the name: "Film unwinder (0.18 kW, 1800 rpm, with STO)" / "Pump 5 HP 480 V" -> "Film Unwinder" / "Pump".
  // Only the name part: a description often goes on ("AC motor with 1:10 gear reducer, runs until the mark is seen").
  const head = desc.split(/[:;,(—–]| - |\b(?:with|runs?|controlled|until|for|which|that|driven|via)\b/i)[0].trim() || desc;
  const bare = head.replace(/\([^)]*\)/g, ' ').replace(/\b\d+(\.\d+)?\s*(kw|hp|rpm|vac|vdc|v|a|amps?|hz|ph|phase)\b/gi, ' ').replace(/\b(approx\.?|with sto|sto)\b/gi, ' ');
  const w = keyWords(bare.replace(/\b(ac|dc|3-?ph|three[- ]phase|single[- ]phase)\b/gi, ' ')).slice(0, 4);
  return title(w.join(' ')) || title(keyWords(desc).slice(0, 4).join(' ')) || title(desc);
}

const PART = /\b(part|product|present|presence|photo|eye|count|carton|box|bottle|pouch)\b/i;

/**
 * Content read from the I/O list by rules. `addresses`: point id -> PLC address; `wiring`: the
 * electrical design's I/O wiring (device types and tags) when there is one; `motorOf`: device tag ->
 * motor tag and description (reversing contactor pairs, drives).
 */
export function defaultHmiContent(opts: {
  io: IOPoint[]; addresses: Map<string, string>; machineName: string;
  wiring?: IOWiring[]; motorOf?: Map<string, { tag: string; description: string }>;
  /** The specification: dwell time and temperature defaults. */
  spec?: string;
}): HmiContent {
  const wiring = new Map((opts.wiring ?? []).map((w) => [w.address.toUpperCase(), w] as const));
  const pts = opts.io
    .map((p) => ({ p, address: (opts.addresses.get(p.id) ?? '').toUpperCase() }))
    .filter((x) => x.address);
  const typeOf = (x: { p: IOPoint; address: string }): FieldDeviceType => wiring.get(x.address)?.deviceType ?? deviceTypeOf(x.p);
  const point = (x: { p: IOPoint; address: string }): HmiPoint => ({ address: x.address, description: x.p.description || x.address });
  const discrete = pts.filter((x) => x.p.signal !== 'analog');
  const inputs = discrete.filter((x) => x.p.type === 'input');
  const outputs = discrete.filter((x) => x.p.type === 'output');
  const used = new Set<string>();
  const actuators: HmiActuator[] = [];
  const questions: string[] = [];
  // Guard doors first, so no cylinder or motor takes "guard door closed" as its position feedback.
  const guards = inputs.filter((x) => GUARD_RE.test(x.p.description) && !/\b(e-?stop|light\s*curtain|safety relay)\b/i.test(x.p.description));
  for (const x of guards) used.add(x.address);

  // Motors and drives: outputs on contactors / drives, grouped per motor (forward + reverse on one motor).
  const motorKey = (x: { p: IOPoint; address: string }) => {
    const tag = wiring.get(x.address)?.deviceTag;
    const m = tag ? opts.motorOf?.get(tag) : undefined;
    return m ? `m:${m.tag}` : tag && /^VFD/i.test(tag) ? `d:${tag}` : `n:${keyWords(x.p.description).join(' ')}`;
  };
  const motorOuts = outputs.filter((x) => { const t = typeOf(x); return (t === 'contactor-coil' || t === 'vfd-input') && !/\bheat\w*\b/i.test(x.p.description); });
  const groups = new Map<string, typeof motorOuts>();
  for (const x of motorOuts) groups.set(motorKey(x), [...(groups.get(motorKey(x)) ?? []), x]);
  for (const [key, xs] of groups) {
    const drive = xs.some((x) => typeOf(x) === 'vfd-input');
    const rev = xs.find((x) => /\b(rev|reverse|backward)\b/i.test(x.p.description));
    const run = xs.find((x) => x !== rev && !/\b(speed|preset)\b/i.test(x.p.description)) ?? xs[0];
    const tag = wiring.get(run.address)?.deviceTag;
    const motor = key.startsWith('m:') && tag ? opts.motorOf?.get(tag) : undefined;
    const name = motor ? nameOf(motor.description) : nameOf(run.p.description);
    for (const x of xs) used.add(x.address);
    const a: HmiActuator = { name, kind: drive ? 'drive' : 'motor', run: point(run), ...(rev ? { reverse: point(rev) } : {}), feedback: [], manual: true };
    // Drive fault / overload tripped / running feedback with the same device tag or name.
    for (const i of inputs) {
      if (used.has(i.address)) continue;
      const sameTag = tag && wiring.get(i.address)?.deviceTag === tag;
      if (!sameTag && !shareKey(i.p.description, run.p.description)) continue;
      if (/\b(fault|trip\w*|overload|alarm)\b/i.test(i.p.description)) { a.fault = point(i); used.add(i.address); }
      else if (/\b(running|run feedback|at speed|aux)\b/i.test(i.p.description)) { a.feedback.push(point(i)); used.add(i.address); }
    }
    actuators.push(a);
  }

  // Cylinders and valves: solenoid outputs; extend / retract pairs share one actuator.
  const sols = outputs.filter((x) => typeOf(x) === 'solenoid');
  const done = new Set<string>();
  for (const x of sols) {
    if (done.has(x.address)) continue;
    done.add(x.address);
    const d = x.p.description;
    const dump = /\b(dump|exhaust|main air|air supply|blow ?off|vacuum)\b/i.test(d);
    const pair = sols.find((y) => !done.has(y.address) && shareKey(y.p.description, d) && keyWords(y.p.description).join(' ') === keyWords(d).join(' '));
    if (pair) done.add(pair.address);
    const [ext, ret] = pair && RETRACT.test(d) && !EXTEND.test(d) ? [pair, x] : [x, pair];
    const a: HmiActuator = {
      name: nameOf(d), kind: dump ? 'valve' : 'cylinder', extend: point(ext), ...(ret ? { retract: point(ret) } : {}),
      feedback: [], manual: !dump,
    };
    for (const i of inputs) {
      if (used.has(i.address) || !FEEDBACK.test(i.p.description) || !shareKey(i.p.description, d)) continue;
      a.feedback.push(point(i)); used.add(i.address);
    }
    actuators.push(a);
  }

  // Heaters: shown and alarmed, not jogged.
  for (const x of outputs.filter((y) => !used.has(y.address) && /\bheat\w*\b/i.test(y.p.description))) {
    used.add(x.address);
    const a: HmiActuator = { name: nameOf(x.p.description), kind: 'heater', run: point(x), feedback: [], manual: false };
    for (const i of inputs) if (!used.has(i.address) && /\b(temp\w*|thermostat|heat\w*)\b/i.test(i.p.description) && !ALARM_WORDS.test(i.p.description)) { a.feedback.push(point(i)); used.add(i.address); }
    actuators.push(a);
  }

  const twoHand = inputs.filter((x) => !used.has(x.address) && TWO_HAND_RE.test(x.p.description)).slice(0, 2);
  for (const x of twoHand) used.add(x.address);
  const safety = inputs.find((x) => typeOf(x) === 'safety-relay-output' && !/\blight\s*curtain\b.*\b(clear|ossd)\b/i.test(x.p.description));
  if (safety) used.add(safety.address);
  const part = inputs.find((x) => !used.has(x.address) && (typeOf(x) === 'sensor-pnp' || typeOf(x) === 'sensor-npn') && PART.test(x.p.description));
  if (!safety) questions.push('The I/O list has no "Safety OK" input from the safety relay: the HMI cannot show the safety state until one is added.');

  // Analog points: values on a Process screen; a speed reference belongs to its drive.
  const analogs: HmiAnalog[] = pts.filter((x) => x.p.signal === 'analog').map((x) => ({
    address: x.address, name: title(x.p.description.replace(/\b(transmitter|sensor|signal|reference|ref)\b/gi, '').replace(/\(\s*([^)]*?)\s*\)/g, (_, w: string) => (w ? `(${w})` : '')).replace(/\(\s*\)/g, '')) || x.address,
    units: x.p.analog?.units ?? '', min: x.p.analog?.min ?? 0, max: x.p.analog?.max ?? 100, kind: x.p.type,
  }));
  for (const an of analogs.filter((y) => y.kind === 'output' && /\b(hz|%)$/i.test(y.units))) {
    const drive = actuators.find((a) => a.kind === 'drive' && !a.speedRef && (shareKey(a.name, an.name) || actuators.filter((b) => b.kind === 'drive').length === 1));
    if (drive) drive.speedRef = an;
  }

  // Inputs that are alarms in themselves: limits, faults, pressure / level OK switches, material low or out.
  if (part) used.add(part.address);
  const alarmInputs: HmiAlarmInput[] = [];
  // A guard door open: latched alarm (stops the cycle, the interlock already stopped the motion); input ON = closed
  // unless the text says "open".
  for (const x of guards) {
    const name = x.p.description.replace(/\s*\((?:[^)]*)\)\s*$/, '').replace(/\b(closed|open|switch|interlock(ed)?|ok)\b/gi, '').replace(/\s+/g, ' ').trim();
    alarmInputs.push({ point: point(x), text: `${name.charAt(0).toUpperCase()}${name.slice(1)} open`, activeWhen: /\bopen\b/i.test(x.p.description) && !/\bclosed\b/i.test(x.p.description), severity: 'alarm' });
  }
  for (const x of inputs) {
    if (used.has(x.address)) continue;
    const t = typeOf(x), d = x.p.description;
    if (t === 'pushbutton-no' || t === 'pushbutton-nc' || t === 'selector' || t === 'estop-contact') continue;
    const name = d.replace(/\s*\((?:[^)]*)\)\s*$/, '').trim();
    if (/\blight\s*curtain\b/i.test(d) && /\b(clear|ok|ossd)\b/i.test(d)) alarmInputs.push({ point: point(x), text: 'Light curtain interrupted', activeWhen: false, severity: 'warning' });
    else if (ALARM_WORDS.test(d)) alarmInputs.push({ point: point(x), text: name.replace(/\btripped\b/i, 'tripped'), activeWhen: true, severity: 'alarm' });
    else if (/\b(pressure|air|vacuum|level|flow)\b/i.test(d) && /\b(ok|healthy|present)\b/i.test(d)) alarmInputs.push({ point: point(x), text: `${name.replace(/\b(ok|healthy|present)\b/i, '').trim()} low`, activeWhen: false, severity: 'alarm' });
    else if (/\b(low|empty|out|missing)\b/i.test(d) && /\b(film|roll|level|material|label|supply|reel|web|tank|hopper|pressure|air)\b/i.test(d)) {
      const out = /\b(empty|out|missing)\b/i.test(d);
      alarmInputs.push({ point: point(x), text: name.replace(/\s+(sensor|switch|eye)$/i, ''), activeWhen: true, severity: out ? 'alarm' : 'warning' });
    } else continue;
    used.add(x.address);
  }

  // Process setpoints: a heater with an analog temperature gets a temperature setpoint; a dwell / seal time from the spec.
  const spec = opts.spec ?? '';
  const process: HmiProcess = {};
  const heater = actuators.find((a) => a.kind === 'heater');
  const pv = analogs.find((an) => an.kind === 'input' && /\b(temp\w*|thermocouple)\b/i.test(an.name));
  if (heater?.run && pv) {
    const fromSpec = Number(/(\d{2,4})\s*°?\s*(?:c|f|deg)\b/i.exec(spec)?.[1] ?? NaN);
    const def = Number.isFinite(fromSpec) && fromSpec >= pv.min && fromSpec <= pv.max ? fromSpec : Math.round(pv.min + (pv.max - pv.min) * 0.5);
    process.temp = { heater: heater.run, pv, default: def };
  }
  const dwell = /\b(dwell|seal\w*|hold)\b/i.exec(spec);
  if (dwell) {
    const sec = Number(/(\d+(?:\.\d+)?)\s*(?:s|sec|seconds)\b/i.exec(spec.slice(Math.max(0, dwell.index - 60), dwell.index + 80))?.[1] ?? 1.5);
    process.dwell = { defaultMs: Math.round(sec * 1000), name: /seal/i.test(dwell[1]) ? 'Seal time' : 'Dwell time' };
  }

  return {
    machineName: opts.machineName.trim() || 'Machine',
    actuators,
    ...(safety ? { safetyOk: point(safety) } : {}),
    ...(part ? { partSensor: point(part) } : {}),
    ...(twoHand.length ? { twoHand: twoHand.map(point) } : {}),
    ...(alarmInputs.length ? { alarmInputs } : {}),
    ...(process.temp || process.dwell ? { process } : {}),
    analogs,
    states: [
      { value: 0, text: 'Stopped', style: 'normal' },
      { value: 1, text: 'Running', style: 'ok' },
      { value: 2, text: 'Faulted', style: 'alarm' },
      { value: 3, text: 'Manual', style: 'warning' },
      { value: 4, text: 'Safety Stop', style: 'alarm' },
    ],
    io: discrete.map((x) => ({ ...point(x), type: x.p.type })).sort((a, b) => (a.type === b.type ? a.address.localeCompare(b.address, undefined, { numeric: true }) : a.type === 'input' ? -1 : 1)),
    questions,
  };
}
