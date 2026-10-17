/**
 * HMI content model: what the operator panel shows, without pixels or addresses. The rules read it
 * from the I/O list (and the electrical design's wiring when there is one); the AI may only rename,
 * regroup and add small things (src/lib/ai/hmiContentAI.ts). `buildHmi` (./build.ts) turns it into
 * screens with every tag assigned.
 */
import type { IOPoint } from '../../types/io';
import type { FieldDeviceType, IOWiring } from '../../electrical/types';
import type { HmiState } from '../types';
import { deviceTypeOf } from '../../electrical/engine/machineModel';

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

export interface HmiContent {
  machineName: string;
  actuators: HmiActuator[];
  safetyOk?: HmiPoint;
  /** Input that counts parts (part-at-end photo-eye, product sensor). */
  partSensor?: HmiPoint;
  analogs: HmiAnalog[];
  /** Machine state word texts (value 0 = stopped). */
  states: HmiState[];
  /** Every discrete point for the Diagnostics screen, in address order. */
  io: (HmiPoint & { type: 'input' | 'output' })[];
  questions: string[];
}

/** Which coil of a pair moves out (extend, advance, close a gripper, press down) and which moves back. */
const EXTEND = /\b(extend\w*|advance\w*|forward|clamp|down|close|in)\b/i;
const RETRACT = /\b(retract\w*|return\w*|back|unclamp|up|open|out)\b/i;
const FEEDBACK = /\b(extended|retracted|advanced|returned|up|down|open(ed)?|closed|home|in|out|clamped|unclamped|position)\b/i;
const GENERIC = new Set(['solenoid', 'sol', 'valve', 'coil', 'output', 'cylinder', 'motor', 'contactor', 'starter', 'run', 'vfd', 'drive', 'sensor', 'switch', 'prox', 'limit', 'the', 'and']);
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
  const w = keyWords(desc);
  return title(w.join(' ')) || title(desc);
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
    for (const i of inputs) if (!used.has(i.address) && /\b(temp\w*|thermostat|heat\w*)\b/i.test(i.p.description)) { a.feedback.push(point(i)); used.add(i.address); }
    actuators.push(a);
  }

  const safety = inputs.find((x) => typeOf(x) === 'safety-relay-output');
  const part = inputs.find((x) => !used.has(x.address) && (typeOf(x) === 'sensor-pnp' || typeOf(x) === 'sensor-npn') && PART.test(x.p.description));
  if (!safety) questions.push('The I/O list has no "Safety OK" input from the safety relay: the HMI cannot show the safety state until one is added.');

  // Analog points: values on a Process screen; a speed reference belongs to its drive.
  const analogs: HmiAnalog[] = pts.filter((x) => x.p.signal === 'analog').map((x) => ({
    address: x.address, name: title(x.p.description.replace(/\b(transmitter|sensor|signal|reference|ref)\b/gi, '')) || x.address,
    units: x.p.analog?.units ?? '', min: x.p.analog?.min ?? 0, max: x.p.analog?.max ?? 100, kind: x.p.type,
  }));
  for (const an of analogs.filter((y) => y.kind === 'output' && /\b(hz|%)$/i.test(y.units))) {
    const drive = actuators.find((a) => a.kind === 'drive' && !a.speedRef && (shareKey(a.name, an.name) || actuators.filter((b) => b.kind === 'drive').length === 1));
    if (drive) drive.speedRef = an;
  }

  return {
    machineName: opts.machineName.trim() || 'Machine',
    actuators,
    ...(safety ? { safetyOk: point(safety) } : {}),
    ...(part ? { partSensor: point(part) } : {}),
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
