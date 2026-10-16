/**
 * Plant model: the field devices around the PLC, simulated simply enough to
 * test a program against "the machine" instead of toggling inputs by hand.
 *
 * Built from the I/O list (+ the electrical I/O wiring when there is one).
 * Outputs are paired with their feedback inputs by description words, e.g.
 * "Pusher solenoid" (Y002) drives "Pusher extended" / "Pusher retracted",
 * "Pump motor contactor" drives "Pump running", a conveyor motor moves parts
 * past the "Part at end" photo-eye. Everything is deterministic and the
 * device params are plain data, so a UI can edit them.
 */
import type { FieldDeviceType, IOWiring } from '../../electrical/types';
import { normAddress } from './engine';
import { buildAnalogDevices, stepAnalog, type AnalogInDevice, type AnalogOutDevice } from './analogModel';

export type { AnalogInDevice, AnalogOutDevice } from './analogModel';

export interface SimIOPoint {
  address: string;
  description: string;
  type: 'input' | 'output' | string;
  category: string;
  /** Analog point (4-20 mA / 0-10 V on a DF register) with its engineering-unit scale. */
  analog?: { min: number; max: number; units: string } | null;
}

export type LightColor = 'red' | 'amber' | 'green' | 'blue' | 'white';

/**
 * Device bypass: the device stops being simulated and reports "healthy".
 * `value` is the held input value for devices that have one (sensor,
 * pushbutton, selector, conveyor sensors); cylinders and motors simply follow
 * their command instantly, E-stops / safety relays read OK.
 */
export interface DeviceBypass { on: boolean; value: boolean }

interface Base { id: string; label: string; tag?: string; bypass?: DeviceBypass }

export interface PushbuttonDevice extends Base {
  kind: 'pushbutton';
  input: string;
  /** NC contact: the input is ON while the button is released. */
  nc: boolean;
  color: LightColor | 'black';
  state: { pressed: boolean };
}

export interface SelectorDevice extends Base {
  kind: 'selector';
  input: string;
  state: { on: boolean };
}

export interface EstopDevice extends Base {
  kind: 'estop';
  /** NC contact input; null = only feeds a safety relay. */
  input: string | null;
  state: { pressed: boolean };
}

export interface SafetyRelayDevice extends Base {
  kind: 'safetyRelay';
  input: string;
}

export interface SensorDevice extends Base {
  kind: 'sensor';
  input: string;
  state: { on: boolean };
}

export interface CylinderDevice extends Base {
  kind: 'cylinder';
  extendOutput: string;
  /** Double-solenoid valve: second output retracts; null = spring return. */
  retractOutput: string | null;
  extendedInput: string | null;
  retractedInput: string | null;
  travelMs: number;
  /** 0 = retracted, 1 = extended. */
  state: { pos: number };
}

export interface MotorDevice extends Base {
  kind: 'motor';
  output: string;
  feedbackInput: string | null;
  feedbackDelayMs: number;
  /** Shown inside a conveyor card. */
  conveyorId: string | null;
  state: { running: boolean; feedback: boolean; fbTimerMs: number; angle: number };
}

export interface ConveyorSensor { input: string; label: string; position: number }

export interface ConveyorDevice extends Base {
  kind: 'conveyor';
  motorId: string;
  sensors: ConveyorSensor[];
  /** Cylinder that pushes parts off at the end; null = remove by hand. */
  pusherId: string | null;
  /** A new part is loaded after this much conveyor running time. */
  spawnEveryMs: number;
  /** Time for a part to travel the full belt. */
  travelMs: number;
  state: { parts: { id: number; pos: number }[]; spawnTimerMs: number; nextId: number; belt: number; removed: number };
}

export interface IndicatorDevice extends Base {
  kind: 'indicator';
  output: string;
  style: 'light' | 'buzzer' | 'relay';
  color: LightColor;
}

export interface StackLightDevice extends Base {
  kind: 'stackLight';
  segments: { output: string; label: string; color: LightColor | 'buzzer' }[];
}

export type SimDevice =
  | PushbuttonDevice | SelectorDevice | EstopDevice | SafetyRelayDevice | SensorDevice
  | CylinderDevice | MotorDevice | ConveyorDevice | IndicatorDevice | StackLightDevice
  | AnalogInDevice | AnalogOutDevice;

export type DeviceKind = SimDevice['kind'];

export interface MachineModel {
  devices: SimDevice[];
  /** Last input values the machine drove, used to report changes. */
  inputs: Map<string, boolean>;
}

/** Part centre where parts stop (end of belt). */
export const PART_END = 0.92;
const PART_GAP = 0.14;
const SENSOR_WINDOW = 0.06;

// ------------------------------------------------------------ text helpers

const GENERIC = new Set([
  'the', 'a', 'an', 'of', 'to', 'for', 'and', 'at', 'is', 'on', 'off', 'in', 'out', 'up', 'down',
  'solenoid', 'sol', 'valve', 'coil', 'sensor', 'prox', 'proximity', 'switch', 'limit', 'ls', 'photo', 'eye',
  'photoeye', 'pe', 'feedback', 'fb', 'contactor', 'motor', 'starter', 'output', 'input', 'pb', 'button',
  'pushbutton', 'push', 'extended', 'extend', 'retracted', 'retract', 'advanced', 'advance', 'returned', 'return',
  'home', 'running', 'run', 'aux', 'status', 'signal', 'cmd', 'command', 'vfd', 'drive', 'relay', 'position',
  'pos', 'cylinder', 'actuator', 'reed', 'magnetic', 'mag', 'forward', 'back', 'fwd', 'rev', 'lowered', 'raised',
  'lower', 'raise', 'open', 'opened', 'close', 'closed', 'k', 'm', 'on/off', 'detect', 'detected', 'present',
]);
const ALIASES: Record<string, string> = { cyl: 'cylinder', conv: 'conveyor', pusher: 'pusher', pushers: 'pusher', clmp: 'clamp' };

function words(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9/]+/g, ' ').split(' ').filter(Boolean).map((w) => ALIASES[w] ?? w);
}

function subject(s: string): string[] {
  return words(s).filter((w) => !GENERIC.has(w));
}

const has = (s: string, re: RegExp) => re.test(s.toLowerCase());

const EXTENDED_RE = /\b(extended|extend|advanced|advance|out|forward|fwd|down|lowered|work|clamped|closed)\b/;
const RETRACTED_RE = /\b(retracted|retract|returned|return|home|in|back|up|raised|unclamped|opened|open)\b/;
const RUNNING_RE = /\b(running|run|feedback|fb|aux|status|on)\b/;
const PART_RE = /\b(part|parts|product|box|item|carton|bottle|tray|piece|case|bag|photo|eye|photoeye|pe|present|presence|detect)\b/;
const CONVEYOR_RE = /\b(conveyor|conveyors|conv|belt|roller|indexer)\b/;
const PUSHER_RE = /\b(push|pusher|kick|kicker|eject|ejector|reject|divert|diverter|sweep|transfer)\b/;

/** Shared subject words; null when numbers disagree ("Clamp 1" vs "Clamp 2"). */
function overlap(a: string, b: string): number | null {
  const sa = subject(a), sb = subject(b);
  const na = sa.filter((w) => /^\d+$/.test(w)), nb = sb.filter((w) => /^\d+$/.test(w));
  if (na.length && nb.length && !na.some((n) => nb.includes(n))) return null;
  return sa.filter((w) => sb.includes(w)).length;
}

function colorOf(s: string): LightColor | null {
  const t = s.toLowerCase();
  if (/\b(red|fault|alarm|error|stop)\b/.test(t)) return 'red';
  if (/\b(amber|yellow|orange|warn|warning|caution)\b/.test(t)) return 'amber';
  if (/\b(green|run|running|ok|ready|go|start)\b/.test(t)) return 'green';
  if (/\b(blue|reset|attention)\b/.test(t)) return 'blue';
  if (/\b(white|clear|power|on)\b/.test(t)) return 'white';
  return null;
}

// ------------------------------------------------------------ classification

type InKind = 'pushbutton' | 'selector' | 'estop' | 'safetyRelay' | 'sensor';
type OutKind = 'solenoid' | 'motor' | 'light' | 'stack' | 'buzzer' | 'relay';

function classifyInput(p: SimIOPoint, t: FieldDeviceType | undefined): { kind: InKind; nc: boolean } {
  const d = p.description;
  switch (t) {
    case 'pushbutton-no': return { kind: 'pushbutton', nc: false };
    case 'pushbutton-nc': return { kind: 'pushbutton', nc: true };
    case 'selector': return { kind: 'selector', nc: false };
    case 'estop-contact': return { kind: 'estop', nc: true };
    case 'safety-relay-output': return { kind: 'safetyRelay', nc: false };
    case 'sensor-pnp': case 'sensor-npn': case 'limit-switch': case 'pressure-switch':
      return { kind: 'sensor', nc: false };
    default: break;
  }
  if (has(d, /\b(e-?stop|emergency)\b/)) {
    return has(d, /\b(ok|healthy|relay|safety|reset)\b/) ? { kind: 'safetyRelay', nc: false } : { kind: 'estop', nc: true };
  }
  if (has(d, /\b(safety|guard|light curtain|interlock)\b/) && has(d, /\b(ok|relay|healthy)\b/)) return { kind: 'safetyRelay', nc: false };
  if (has(d, /\b(selector|switch.*(auto|manual|mode)|mode|auto\/manual|hand|ss\d*)\b/) && !has(d, /\blimit\b/)) return { kind: 'selector', nc: false };
  if (has(d, /\b(button|pb\d*|push ?button|start|stop|reset|jog|ack|acknowledge)\b/) && !has(d, /\b(sensor|prox|eye)\b/)) {
    return { kind: 'pushbutton', nc: has(d, /\bstop\b/) };
  }
  return { kind: 'sensor', nc: false };
}

function classifyOutput(p: SimIOPoint, t: FieldDeviceType | undefined): OutKind {
  const d = p.description;
  switch (t) {
    case 'solenoid': return 'solenoid';
    case 'contactor-coil': case 'vfd-input': return 'motor';
    case 'stack-light': return has(d, /\b(buzzer|horn|siren|audible)\b/) ? 'buzzer' : 'stack';
    case 'pilot-light': return 'light';
    default: break;
  }
  if (has(d, /\b(stack|tower)\b/)) return 'stack';
  if (has(d, /\b(buzzer|horn|siren|beacon audible|audible)\b/)) return 'buzzer';
  if (has(d, /\b(light|lamp|pilot|indicator|led|beacon)\b/)) return 'light';
  if (has(d, /\b(solenoid|sol|valve|cylinder|cyl|vacuum|gripper|clamp)\b/) || p.category === 'Pneumatic') return 'solenoid';
  if (has(d, /\b(motor|contactor|starter|vfd|drive|pump|fan|conveyor|belt|spindle|mixer|blower)\b/) || p.category === 'Conveyor') return 'motor';
  return 'relay';
}

// ------------------------------------------------------------ build

export function buildMachineModel(io: SimIOPoint[], wiring: IOWiring[]): MachineModel {
  const wireBy = new Map(wiring.map((w) => [normAddress(w.address), w]));
  const allPts = io
    .filter((p) => p.address && p.address.trim())
    .map((p) => ({ ...p, address: normAddress(p.address) }));
  // Analog points (DF registers) get analog devices; everything below is discrete.
  const isAnalogPt = (p: SimIOPoint) => Boolean(p.analog) || /^DF\d+$/.test(p.address);
  const points = allPts.filter((p) => !isAnalogPt(p));
  const inputs = points.filter((p) => p.type === 'input');
  const outputs = points.filter((p) => p.type === 'output');
  const claimed = new Set<string>();
  const devices: SimDevice[] = [];
  let n = 0;
  const id = (k: string) => `${k}${++n}`;
  const tagOf = (a: string) => wireBy.get(a)?.deviceTag;
  const descOf = (p: SimIOPoint) => p.description || wireBy.get(p.address)?.description || p.address;

  const inKinds = new Map(inputs.map((p) => [p.address, classifyInput({ ...p, description: descOf(p) }, wireBy.get(p.address)?.deviceType)]));
  const sensorInputs = () => inputs.filter((p) => !claimed.has(p.address) && inKinds.get(p.address)?.kind === 'sensor');

  /** Best unclaimed sensor input sharing subject words with `desc` and matching `re`. */
  function pick(desc: string, re: RegExp, not?: RegExp): SimIOPoint | null {
    let best: SimIOPoint | null = null, bestScore = 0;
    for (const p of sensorInputs()) {
      const d = descOf(p);
      if (!has(d, re) || (not && has(d, not))) continue;
      const s = overlap(desc, d);
      if (s !== null && s > bestScore) { best = p; bestScore = s; }
    }
    if (best) claimed.add(best.address);
    return best;
  }

  // --- outputs
  const outKinds = new Map(outputs.map((p) => [p.address, classifyOutput({ ...p, description: descOf(p) }, wireBy.get(p.address)?.deviceType)]));
  const solenoids = outputs.filter((p) => outKinds.get(p.address) === 'solenoid');
  const retractSols = new Set<string>();
  const cylinders: CylinderDevice[] = [];
  for (const s of solenoids) {
    if (retractSols.has(s.address)) continue;
    const d = descOf(s);
    if (has(d, /\b(retract|return|unclamp|open|up|raise)\b/) && solenoids.some((o) => o !== s && (overlap(d, descOf(o)) ?? 0) > 0)) continue; // handled by its partner
    // double-solenoid partner
    let retract: SimIOPoint | null = null;
    for (const o of solenoids) {
      if (o === s || retractSols.has(o.address)) continue;
      const od = descOf(o);
      if (has(od, /\b(retract|return|unclamp|open|up|raise)\b/) && (overlap(d, od) ?? 0) > 0) { retract = o; break; }
    }
    if (retract) retractSols.add(retract.address);
    claimed.add(s.address);
    const ext = pick(d, EXTENDED_RE, RETRACTED_RE);
    const ret = pick(d, RETRACTED_RE, EXTENDED_RE);
    const name = subject(d).join(' ') || d;
    const cyl: CylinderDevice = {
      id: id('cyl'), kind: 'cylinder', label: capital(name), tag: tagOf(s.address),
      extendOutput: s.address, retractOutput: retract?.address ?? null,
      extendedInput: ext?.address ?? null, retractedInput: ret?.address ?? null,
      travelMs: 800, state: { pos: 0 },
    };
    cylinders.push(cyl);
    devices.push(cyl);
  }

  const motors: MotorDevice[] = [];
  for (const m of outputs.filter((p) => outKinds.get(p.address) === 'motor')) {
    const d = descOf(m);
    const fb = pick(d, RUNNING_RE, /\b(fault|overload|trip|tripped|alarm|error)\b/);
    const motor: MotorDevice = {
      id: id('mtr'), kind: 'motor', label: d, tag: tagOf(m.address), output: m.address,
      feedbackInput: fb?.address ?? null, feedbackDelayMs: 200, conveyorId: null,
      state: { running: false, feedback: false, fbTimerMs: 0, angle: 0 },
    };
    motors.push(motor);
    devices.push(motor);
  }

  // conveyors: conveyor motors + product sensors
  const convMotors = motors.filter((m) => {
    const p = outputs.find((o) => o.address === m.output);
    return has(m.label, CONVEYOR_RE) || p?.category === 'Conveyor';
  });
  const conveyors: ConveyorDevice[] = convMotors.map((m) => ({
    id: id('conv'), kind: 'conveyor', label: capital(subject(m.label).join(' ') || 'Conveyor'), motorId: m.id,
    sensors: [], pusherId: null, spawnEveryMs: 4000, travelMs: 4000,
    // first part loads as soon as the belt starts
    state: { parts: [], spawnTimerMs: 4000, nextId: 1, belt: 0, removed: 0 },
  }));
  convMotors.forEach((m, i) => { m.conveyorId = conveyors[i].id; });
  if (conveyors.length) {
    for (const p of sensorInputs()) {
      const d = descOf(p);
      if (!has(d, PART_RE) && p.category !== 'Product Detection') continue;
      let best = conveyors[0], bestScore = -1;
      for (const c of conveyors) {
        const m = motors.find((x) => x.id === c.motorId)!;
        const s = overlap(m.label, d) ?? -1;
        if (s > bestScore) { best = c; bestScore = s; }
      }
      const position = has(d, /\b(entry|infeed|in-feed|start|upstream|load|loading|begin|beginning)\b/) ? 0.12
        : has(d, /\b(middle|mid|center|centre|position|station)\b/) ? 0.5 : PART_END;
      best.sensors.push({ input: p.address, label: d, position });
      claimed.add(p.address);
    }
    for (const c of conveyors) {
      const pusher = cylinders.find((cy) => has(cy.label, PUSHER_RE)) ?? (cylinders.length === 1 && conveyors.length === 1 ? cylinders[0] : undefined);
      if (pusher && !conveyors.some((o) => o.pusherId === pusher.id)) c.pusherId = pusher.id;
    }
    devices.push(...conveyors);
  }

  // indicators / stack lights
  const stack: StackLightDevice = { id: id('stack'), kind: 'stackLight', label: 'Stack light', segments: [] };
  for (const o of outputs) {
    const k = outKinds.get(o.address);
    const d = descOf(o);
    if (k === 'stack' || (k === 'buzzer' && has(d, /\b(stack|tower)\b/))) {
      stack.segments.push({ output: o.address, label: d, color: k === 'buzzer' ? 'buzzer' : colorOf(d) ?? 'white' });
    } else if (k === 'light' || k === 'buzzer' || k === 'relay') {
      devices.push({
        id: id('ind'), kind: 'indicator', label: d, tag: tagOf(o.address), output: o.address,
        style: k === 'relay' ? 'relay' : k, color: colorOf(d) ?? (k === 'buzzer' ? 'amber' : 'green'),
      });
    }
  }
  if (stack.segments.length) {
    const order: (LightColor | 'buzzer')[] = ['red', 'amber', 'green', 'blue', 'white', 'buzzer'];
    stack.segments.sort((a, b) => order.indexOf(a.color) - order.indexOf(b.color));
    devices.push(stack);
  }

  // --- inputs that are not feedbacks
  const front: SimDevice[] = [];
  const estops: EstopDevice[] = [];
  let hasRelay = false;
  for (const p of inputs) {
    if (claimed.has(p.address)) continue;
    const { kind, nc } = inKinds.get(p.address)!;
    const d = descOf(p);
    const tag = tagOf(p.address);
    switch (kind) {
      case 'pushbutton':
        front.push({ id: id('pb'), kind, label: d, tag, input: p.address, nc, color: colorOf(d) ?? 'black', state: { pressed: false } });
        break;
      case 'selector':
        front.push({ id: id('ss'), kind, label: d, tag, input: p.address, state: { on: false } });
        break;
      case 'estop': {
        const e: EstopDevice = { id: id('es'), kind, label: d, tag, input: p.address, state: { pressed: false } };
        estops.push(e);
        front.push(e);
        break;
      }
      case 'safetyRelay':
        hasRelay = true;
        front.push({ id: id('sr'), kind, label: d, tag, input: p.address });
        break;
      case 'sensor':
        devices.push({ id: id('sen'), kind, label: d, tag, input: p.address, state: { on: false } });
        break;
    }
  }
  // A safety relay needs an E-stop to follow even when its contacts aren't wired to the PLC.
  if (hasRelay && !estops.length) {
    front.unshift({ id: id('es'), kind: 'estop', label: 'E-stop (to safety relay)', input: null, state: { pressed: false } });
  }
  // Operator devices first: E-stop, safety, buttons, selectors; then the machine.
  const rank: Partial<Record<DeviceKind, number>> = { estop: 0, safetyRelay: 1, pushbutton: 2, selector: 3 };
  front.sort((a, b) => (rank[a.kind] ?? 9) - (rank[b.kind] ?? 9));
  const all = [...front, ...devices];
  for (const d of all) {
    if (d.kind === 'analogIn' || d.kind === 'analogOut') continue;
    const inputsOf = deviceAddresses(d).inputs;
    if (!inputsOf.length && d.kind !== 'estop') continue;
    const value = d.kind === 'pushbutton' ? d.nc : d.kind !== 'conveyor'; // healthy default
    d.bypass = { on: false, value };
  }
  const analogDevices = buildAnalogDevices(
    allPts.filter(isAnalogPt).map((p) => ({ address: p.address, description: descOf(p), type: p.type === 'output' ? 'output' as const : 'input' as const, min: p.analog?.min ?? 0, max: p.analog?.max ?? 100, units: p.analog?.units ?? '' })),
    allPts.filter((p) => p.type === 'output').map((p) => ({ address: p.address, description: descOf(p) })),
  );
  const model: MachineModel = { devices: [...all, ...analogDevices], inputs: new Map() };
  model.inputs = machineInputs(model);
  return model;
}

/** Current analog input values (engineering units) the machine presents to the DF registers. */
export function machineAnalogValues(model: MachineModel): Map<string, number> {
  const out = new Map<string, number>();
  for (const d of model.devices) if (d.kind === 'analogIn') out.set(d.input, d.state.value);
  return out;
}

/** Move an analog input (slider); a process continues from the new value. */
export function setAnalogValue(model: MachineModel, id: string, value: number): void {
  const d = model.devices.find((x) => x.id === id);
  if (d?.kind === 'analogIn') d.state.value = Math.max(d.min, Math.min(d.max, value));
}

function capital(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// ------------------------------------------------------------ runtime

/** Every input value the machine currently drives. */
export function machineInputs(model: MachineModel): Map<string, boolean> {
  const out = new Map<string, boolean>();
  const byp = (d: SimDevice) => !!d.bypass?.on;
  const estopPressed = model.devices.some((d) => d.kind === 'estop' && d.state.pressed && !byp(d));
  for (const d of model.devices) {
    const held = d.bypass?.on ? d.bypass.value : undefined;
    switch (d.kind) {
      case 'pushbutton': out.set(d.input, held ?? (d.nc ? !d.state.pressed : d.state.pressed)); break;
      case 'selector': out.set(d.input, held ?? d.state.on); break;
      case 'estop': if (d.input) out.set(d.input, byp(d) || !d.state.pressed); break;
      case 'safetyRelay': out.set(d.input, byp(d) || !estopPressed); break;
      case 'sensor': out.set(d.input, held ?? d.state.on); break;
      case 'cylinder':
        if (d.extendedInput) out.set(d.extendedInput, d.state.pos >= 0.999);
        if (d.retractedInput) out.set(d.retractedInput, d.state.pos <= 0.001);
        break;
      case 'motor': if (d.feedbackInput) out.set(d.feedbackInput, d.state.feedback); break;
      case 'conveyor':
        for (const s of d.sensors) out.set(s.input, held ?? d.state.parts.some((p) => Math.abs(p.pos - s.position) <= SENSOR_WINDOW));
        break;
      default: break;
    }
  }
  return out;
}

type OutputReader = Map<string, boolean> | ((address: string) => boolean);

/**
 * Advance the machine by dtMs with the PLC's current outputs.
 * Returns the inputs whose value changed since the last call.
 */
export function stepMachine(model: MachineModel, plcOutputs: OutputReader, dtMs: number, plcWords: (a: string) => number = () => 0): Map<string, boolean> {
  const out = (a: string) => (typeof plcOutputs === 'function' ? plcOutputs(a) : plcOutputs.get(a) ?? false);
  const aOuts = new Map(model.devices.filter((d): d is AnalogOutDevice => d.kind === 'analogOut').map((d) => [d.output, d]));
  stepAnalog(model.devices.filter((d): d is AnalogInDevice | AnalogOutDevice => d.kind === 'analogIn' || d.kind === 'analogOut'), out, plcWords, dtMs, aOuts);
  const byId = new Map(model.devices.map((d) => [d.id, d]));
  for (const d of model.devices) {
    if (d.kind === 'cylinder') {
      const ext = out(d.extendOutput);
      const ret = d.retractOutput ? out(d.retractOutput) : !ext;
      const v = d.bypass?.on ? 1 : dtMs / Math.max(1, d.travelMs); // bypassed: sensors follow the valve at once
      if (ext && !ret) d.state.pos = Math.min(1, d.state.pos + v);
      else if (ret && !ext) d.state.pos = Math.max(0, d.state.pos - v);
    } else if (d.kind === 'motor') {
      const on = out(d.output);
      d.state.running = on;
      if (on) d.state.angle = (d.state.angle + dtMs * 0.6) % 360;
      if (d.bypass?.on) { d.state.feedback = on; d.state.fbTimerMs = 0; }
      else if (on !== d.state.feedback) {
        d.state.fbTimerMs += dtMs;
        if (d.state.fbTimerMs >= d.feedbackDelayMs) { d.state.feedback = on; d.state.fbTimerMs = 0; }
      } else d.state.fbTimerMs = 0;
    }
  }
  for (const d of model.devices) {
    if (d.kind !== 'conveyor') continue;
    const motor = byId.get(d.motorId);
    const running = motor?.kind === 'motor' && motor.state.running;
    const st = d.state;
    if (running) {
      st.belt = (st.belt + dtMs / d.travelMs) % 1;
      const v = dtMs / Math.max(1, d.travelMs);
      // front part first so followers queue behind it
      st.parts.sort((a, b) => b.pos - a.pos);
      for (let i = 0; i < st.parts.length; i++) {
        const limit = i === 0 ? PART_END : st.parts[i - 1].pos - PART_GAP;
        const np = Math.min(st.parts[i].pos + v, limit);
        if (np > st.parts[i].pos) st.parts[i].pos = np;
      }
      st.spawnTimerMs += dtMs;
      const last = st.parts[st.parts.length - 1];
      if (st.spawnTimerMs >= d.spawnEveryMs && (!last || last.pos >= PART_GAP)) {
        st.parts.push({ id: st.nextId++, pos: 0 });
        st.spawnTimerMs = 0;
      }
    }
    const pusher = d.pusherId ? byId.get(d.pusherId) : undefined;
    if (pusher?.kind === 'cylinder' && pusher.state.pos >= 0.9) {
      const before = st.parts.length;
      st.parts = st.parts.filter((p) => p.pos < PART_END - 0.1);
      st.removed += before - st.parts.length;
    }
  }
  const now = machineInputs(model);
  const changes = new Map<string, boolean>();
  for (const [a, v] of now) if (model.inputs.get(a) !== v) changes.set(a, v);
  model.inputs = now;
  return changes;
}

/** Load a part at the start of a conveyor (manual). */
export function addPart(model: MachineModel, conveyorId: string): void {
  const c = model.devices.find((d) => d.id === conveyorId);
  if (c?.kind !== 'conveyor') return;
  const last = [...c.state.parts].sort((a, b) => a.pos - b.pos)[0];
  if (last && last.pos < PART_GAP) return;
  c.state.parts.push({ id: c.state.nextId++, pos: 0 });
  c.state.spawnTimerMs = 0;
}

/** Take the front part off a conveyor (manual). */
export function removePart(model: MachineModel, conveyorId: string): void {
  const c = model.devices.find((d) => d.id === conveyorId);
  if (c?.kind !== 'conveyor' || !c.state.parts.length) return;
  c.state.parts.sort((a, b) => b.pos - a.pos);
  c.state.parts.shift();
  c.state.removed++;
}

/** Field-device addresses of a device (inputs it drives, outputs it reads). */
export function deviceAddresses(d: SimDevice): { inputs: string[]; outputs: string[] } {
  switch (d.kind) {
    case 'pushbutton': case 'selector': case 'safetyRelay': case 'sensor': return { inputs: [d.input], outputs: [] };
    case 'estop': return { inputs: d.input ? [d.input] : [], outputs: [] };
    case 'cylinder': return {
      inputs: [d.extendedInput, d.retractedInput].filter((x): x is string => !!x),
      outputs: [d.extendOutput, d.retractOutput].filter((x): x is string => !!x),
    };
    case 'motor': return { inputs: d.feedbackInput ? [d.feedbackInput] : [], outputs: [d.output] };
    case 'conveyor': return { inputs: d.sensors.map((s) => s.input), outputs: [] };
    case 'indicator': return { inputs: [], outputs: [d.output] };
    case 'stackLight': return { inputs: [], outputs: d.segments.map((s) => s.output) };
    case 'analogIn': return { inputs: [d.input], outputs: [] };
    case 'analogOut': return { inputs: [], outputs: [d.output] };
  }
}

/** Turn a device bypass on/off and optionally set its held value. */
export function setDeviceBypass(model: MachineModel, id: string, on: boolean, value?: boolean): void {
  const d = model.devices.find((x) => x.id === id);
  if (!d?.bypass) return;
  d.bypass.on = on;
  if (value !== undefined) d.bypass.value = value;
}
