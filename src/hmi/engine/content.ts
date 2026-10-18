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

/**
 * A servo / stepper axis: its drive's status inputs and enable output. The HMI shows its state and
 * position, and commands it (enable, home, jog, move to a target) through HMI tags the PLC program
 * turns into motion (motion instructions or the drive's own I/O).
 */
export interface HmiAxis {
  name: string;
  /** Stable key for the tag roles: the axis's lowest PLC address. */
  key: string;
  /** Position units: mm (default), deg, or counts. */
  units: string;
  ready?: HmiPoint; fault?: HmiPoint; homed?: HmiPoint; inPos?: HmiPoint; limitPos?: HmiPoint; limitNeg?: HmiPoint; enable?: HmiPoint;
  /** Every I/O point of the axis. */
  points: HmiPoint[];
}

/** An incremental encoder on a high-speed counter: the HMI shows its scaled position and speed and can zero it. */
export interface HmiEncoder { name: string; key: string; units: string; channels: HmiPoint[] }

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
  /** No safety relay input: the E-stop contacts the PLC reads directly (NC, ON = not pressed) stand in for Safety OK. */
  estops?: HmiPoint[];
  /** Input that counts parts (part-at-end photo-eye, product sensor). */
  partSensor?: HmiPoint;
  analogs: HmiAnalog[];
  /** Servo / stepper axes (Motion screen). */
  axes?: HmiAxis[];
  /** Encoders on high-speed counters (Motion screen). */
  encoders?: HmiEncoder[];
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
  // Servo axes and encoders first: their fault / limit inputs and enable outputs are not alarms, actuators or feedback.
  const { axes, encoders, taken } = motionContent(discrete.map((x) => ({ ...point(x), type: x.p.type, category: x.p.category })));
  const inputs = discrete.filter((x) => x.p.type === 'input' && !taken.has(x.address));
  const outputs = discrete.filter((x) => x.p.type === 'output' && !taken.has(x.address));
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
  const estops = safety ? [] : inputs.filter((x) => typeOf(x) === 'estop-contact' || (/\b(e-?stop|emergency stop)\b/i.test(x.p.description) && !/\b(ok|relay|healthy|reset)\b/i.test(x.p.description) && typeOf(x) !== 'pushbutton-no'));
  for (const x of estops) used.add(x.address);
  const part = inputs.find((x) => !used.has(x.address) && (typeOf(x) === 'sensor-pnp' || typeOf(x) === 'sensor-npn') && PART.test(x.p.description));
  if (!safety) questions.push('The I/O list has no "Safety OK" input from the safety relay: the HMI cannot show the safety state until one is added.');

  // Analog points: values on a Process screen; a speed reference belongs to its drive.
  const analogs: HmiAnalog[] = pts.filter((x) => x.p.signal === 'analog').map((x) => ({
    address: x.address, name: title(x.p.description.replace(/\(\s*(ultrasonic|radar|laser|sonar|4-20\s*ma|0-10\s*v|analog)\s*\)/gi, '').replace(/\b(transmitter|sensor|signal|reference|ref|ultrasonic)\b/gi, '').replace(/\(\s*([^)]*?)\s*\)/g, (_, w: string) => (w ? `(${w})` : '')).replace(/\(\s*\)/g, '')) || x.address,
    units: x.p.analog?.units ?? '', min: x.p.analog?.min ?? 0, max: x.p.analog?.max ?? 100, kind: x.p.type,
  }));
  // A speed reference: drive units (Hz, %, rpm, m/min) or "speed" / "frequency" in its name (a 4-20 mA reference may be in mA).
  for (const an of analogs.filter((y) => y.kind === 'output' && (/^(hz|%|rpm|r\/min|m\/min|ft\/min)$/i.test(y.units.trim()) || /\b(speed|frequency|freq)\b/i.test(y.name)))) {
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
    ...(estops.length ? { estops: estops.map(point) } : {}),
    ...(part ? { partSensor: point(part) } : {}),
    ...(twoHand.length ? { twoHand: twoHand.map(point) } : {}),
    ...(alarmInputs.length ? { alarmInputs } : {}),
    ...(process.temp || process.dwell ? { process } : {}),
    ...(axes.length ? { axes } : {}),
    ...(encoders.length ? { encoders } : {}),
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

const AXIS_RE = /\b(servo|stepper|axis)\b/i;
const ENCODER_RE = /\bencoder\b/i;

/** A unit named with a ratio wins ("200 pulses/mm", "5 mm/rev", "pulses/deg"). */
const PER_UNIT = /\b(?:pulses?|counts?|ppr|p)\s*\/\s*(mm|deg|degrees?|°)|\b(mm|deg|degrees?|°)\s*\/\s*(?:rev|revolution|pulses?|counts?)\b/i;

/** Position units from the I/O texts: a unit given as a ratio, else degrees, counts / pulses, else millimetres. */
const unitsOf = (texts: string[]) => {
  for (const t of texts) {
    const m = PER_UNIT.exec(t);
    if (m) return /^mm$/i.test(m[1] ?? m[2]) ? 'mm' : 'deg';
  }
  return texts.some((t) => /\b(deg|degrees?|rotary|indexer|turntable)\b|°/i.test(t)) ? 'deg' : texts.some((t) => /\b(counts?|pulses?|ppr)\b/i.test(t)) ? 'counts' : 'mm';
};

/**
 * Servo / stepper axes and encoders from the discrete I/O: points in the Servo/Axis category or naming a
 * servo, stepper or axis, grouped by axis number ("Axis 1 …") or name; encoder channels (A / B / Z) per encoder.
 * Power supplies ("Servo Power OK / Enable") are the safety circuit's, not an axis.
 */
export function motionContent(pts: (HmiPoint & { type: 'input' | 'output'; category?: string })[]): { axes: HmiAxis[]; encoders: HmiEncoder[]; taken: Set<string> } {
  const taken = new Set<string>();
  const groupOf = (d: string, words: RegExp) => {
    const n = /\baxis\s*(\d+|[xyzuvw])\b/i.exec(d) ?? /\b([xyzuvw])[- ]axis\b/i.exec(d);
    if (n) return /^\d+$/.test(n[1]) ? `Axis ${n[1]}` : `${n[1].toUpperCase()} Axis`;
    // "Encoder 1 A" is Encoder 1; "Servo 2 ready" is Axis 2.
    const k = /\b(servo|stepper|encoder)\s*(\d+)\b/i.exec(d);
    if (k) return `${/encoder/i.test(k[1]) ? 'Encoder' : 'Axis'} ${k[2]}`;
    const rest = d.replace(/\([^)]*\)/g, ' ').replace(words, ' ').replace(/\b(servo|stepper|axis|drive|encoder|channel|phase|ready|fault|alarm|home\w*|complete|done|in\s*position|positive|negative|limit|enable\w*|command|jog\w*|move\w*|to|position|[abz]|ok|pulse|input|output)\b/gi, ' ');
    return title(keyWords(rest).slice(0, 3).join(' ')) || 'Axis';
  };
  const axisPts = pts.filter((x) => (x.category === 'Servo/Axis' || AXIS_RE.test(x.description)) && !ENCODER_RE.test(x.description) && !/\bpower\b/i.test(x.description));
  const byAxis = new Map<string, typeof axisPts>();
  for (const x of axisPts) byAxis.set(groupOf(x.description, AXIS_RE), [...(byAxis.get(groupOf(x.description, AXIS_RE)) ?? []), x]);
  const axes: HmiAxis[] = [];
  for (const [name, xs] of byAxis) {
    const ins = xs.filter((x) => x.type === 'input'), outs = xs.filter((x) => x.type === 'output');
    const find = (list: typeof xs, re: RegExp, not?: RegExp) => list.find((x) => re.test(x.description) && !(not && not.test(x.description)));
    const pt = (x?: (typeof xs)[number]) => (x ? { address: x.address, description: x.description } : undefined);
    const a: HmiAxis = {
      name, key: [...xs].sort((p, q) => p.address.localeCompare(q.address, undefined, { numeric: true }))[0].address, units: unitsOf(xs.map((x) => x.description)),
      points: xs.map((x) => ({ address: x.address, description: x.description })),
    };
    const set = <K extends keyof HmiAxis>(k: K, v: HmiAxis[K] | undefined) => { if (v) a[k] = v; };
    set('fault', pt(find(ins, /\b(fault|alarm|error)\b/i)));
    set('ready', pt(find(ins, /\b(ready|servo on|enabled)\b/i)));
    set('homed', pt(find(ins, /\bhome(d)?\b.*\b(complete|done|ok)\b|\bhomed\b/i)));
    set('inPos', pt(find(ins, /\bin[- ]?position\b|\binpos\b/i)));
    set('limitPos', pt(find(ins, /\b(positive|forward|\+)\s*(limit|overtravel)\b|\b(limit|overtravel)\s*(\+|positive|fwd)/i)));
    set('limitNeg', pt(find(ins, /\b(negative|reverse|-)\s*(limit|overtravel)\b|\b(limit|overtravel)\s*(-|negative|rev)/i)));
    set('enable', pt(find(outs, /\b(enable|servo on)\b/i)));
    for (const x of xs) taken.add(x.address);
    axes.push(a);
  }
  // Encoders: counting channels only (an "Encoder position OK" status input is an ordinary input).
  const encPts = pts.filter((x) => x.type === 'input' && ENCODER_RE.test(x.description) && !/\b(ok|fault|alarm|error)\b/i.test(x.description));
  const byEnc = new Map<string, typeof encPts>();
  for (const x of encPts) {
    const k = groupOf(x.description, ENCODER_RE).replace(/^Axis$/, 'Encoder');
    byEnc.set(k, [...(byEnc.get(k) ?? []), x]);
  }
  const encoders: HmiEncoder[] = [...byEnc].map(([name, xs]) => {
    for (const x of xs) taken.add(x.address);
    return {
      name: /encoder/i.test(name) ? name : `${name} encoder`, units: unitsOf(xs.map((x) => x.description)),
      key: [...xs].sort((p, q) => p.address.localeCompare(q.address, undefined, { numeric: true }))[0].address,
      channels: xs.map((x) => ({ address: x.address, description: x.description })),
    };
  });
  return { axes, encoders, taken };
}
