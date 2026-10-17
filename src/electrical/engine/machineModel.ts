/**
 * Machine model: the judgement part of an electrical design, small enough for the AI to fill reliably
 * (src/lib/ai/machineModelAI.ts) and always available without it — `defaultMachineModel` reads it from
 * the I/O list, the designer's motor list and the spec with plain rules. The rule-based engine
 * (./index.ts) turns it into the complete ElectricalDesign.
 */
import type { IOPoint } from '../../types/io';
import type { DesignInputs, EnclosureRating, FieldDeviceType, MotorSpec, StarterType } from '../types';
import { looksLeftOver } from '../../spec/leftovers';

export type MotorStart = 'dol' | 'reversing' | 'vfd' | 'motor-protector';

export interface ModelMotor {
  tag: string;
  description: string;
  /** Power in HP (the AI may give kW; converted on merge). */
  hp: number;
  start: MotorStart;
  /** Hoist / lift / incline: braking resistor + brake notes. */
  vertical?: boolean;
  zone?: string;
}

export interface ModelSafety {
  /** Emergency-stop buttons (cabinet door first, then field stations). */
  estops: number;
  guardDoors: { zone: string }[];
  /** heightMm: protected height when the spec gives one. */
  lightCurtains: { zone: string; heightMm?: number }[];
  /** Two-hand control (ISO 13851): a two-hand station into a two-hand safety relay that enables the closing stroke. */
  twoHand?: { zone: string };
}

/** Resistive heater switched by the PLC (SSR or contactor), with its branch protection and over-temperature limit. */
export interface ModelHeater {
  tag: string;
  description: string;
  kw: number;
  /** 1 = single-phase (line-to-line on a 3-phase supply), 3 = three-phase. */
  phases: 1 | 3;
  /** What the PLC output switches: an SSR (time-proportioned) or the heater contactor itself. */
  switching: 'ssr' | 'contactor';
  zone?: string;
}

export interface MachineModel {
  motors: ModelMotor[];
  safety: ModelSafety;
  /** Heaters (from the I/O list and the spec); absent = none. */
  heaters?: ModelHeater[];
  /** Machine areas in order; field devices and motors are placed in them. */
  zones: string[];
  /** Other machines / robots the PLC exchanges signals with (outputs to them get interposing relays). */
  interfaces: string[];
  enclosureRating?: EnclosureRating;
  /** Assumptions the model made (become questions for the user). */
  assumptions: string[];
}

const MOTOR_RE = /\b(motor|conveyor|pump|fan|blower|mixer|agitator|spindle|drive|vfd|compressor)\b/i;
const HP_RE = /(\d+(?:\.\d+)?)\s*(hp|kw)\b/i;
const ZONE_HINT_RE = /\b(infeed|outfeed|in-feed|out-feed|station\s*\d*|zone\s*\d+|cell|conveyor|pusher|tank|mixer|press|loader|unloader|robot|lift|elevator|palletizer|filler|capper|labeler|wrapper)\b/gi;

/** Zone names mentioned in the spec / I/O descriptions, in first-seen order. */
function zonesFrom(texts: string[]): string[] {
  const seen = new Map<string, string>();
  for (const t of texts) for (const m of t.matchAll(ZONE_HINT_RE)) {
    const k = m[1].toLowerCase().replace(/\s+/g, ' ');
    if (!seen.has(k)) seen.set(k, k.replace(/(^|\s)\w/g, (c) => c.toUpperCase()));
  }
  return [...seen.values()].slice(0, 6);
}

export const starterOf = (s: MotorStart): StarterType => (s === 'vfd' ? 'vfd' : s === 'motor-protector' ? 'motor-protector' : 'contactor-overload');

/**
 * The machine model from what the project already knows: the designer's motors (DesignInputs.motors) or,
 * when there are none, one motor per motor-driving output in the I/O list; E-stops from the I/O list;
 * zones from words in the spec / I/O; guard doors and light curtains from the spec text.
 */
/**
 * The designer's motors that this machine's description and I/O list never mention — typically left
 * over from the project this one was copied from (the example's conveyor motor in a sealing head).
 * Only judged when there is a description to compare with.
 */
export function staleMotors(motors: MotorSpec[], io: IOPoint[], spec: string): MotorSpec[] {
  const hay = `${spec}\n${io.map((p) => p.description).join('\n')}`;
  if (!spec.trim()) return [];
  return motors.filter((m) => looksLeftOver(m.description, hay, 1).leftOver);
}

export function defaultMachineModel(io: IOPoint[], inputs: DesignInputs, spec = ''): MachineModel {
  const assumptions: string[] = [];
  const stale = new Set(staleMotors(inputs.motors, io, spec).map((m) => m.tag));
  for (const m of inputs.motors.filter((x) => stale.has(x.tag))) {
    assumptions.push(`${m.tag} ${m.description} (${m.hp} HP) is in the motor list but not in the machine description or I/O list, so it was left out of the design: add it back on the Design tab if this machine has it.`);
  }
  const motors: ModelMotor[] = inputs.motors.filter((m) => !stale.has(m.tag)).map((m) => ({ tag: m.tag, description: m.description, hp: m.hp, start: m.starter === 'vfd' ? 'vfd' : m.starter === 'motor-protector' ? 'motor-protector' : m.reversing ? 'reversing' : 'dol' }));
  if (!motors.length) {
    // One motor per output that runs one (contactor / VFD run), not per direction or speed.
    const outs = io.filter((p) => p.type === 'output' && !/\b(heat\w*|lamp|light|horn|valve|solenoid)\b/i.test(p.description)
      && (p.deviceType === 'contactor-coil' || p.deviceType === 'vfd-input' || (MOTOR_RE.test(p.description) && !/\b(rev|reverse|speed|fault|light)\b/i.test(p.description))));
    for (const p of outs) {
      if (/\b(rev|reverse)\b/i.test(p.description)) continue;
      const name0 = p.description.replace(HP_RE, '').replace(/\b(run|contactor|starter|coil|output|on|vfd|drive)\b/gi, '').replace(/\s+/g, ' ').trim();
      const fromSpec = specPower(spec, name0);
      const hp = Number(HP_RE.exec(p.description)?.[1] ?? 0) * (/kw/i.test(HP_RE.exec(p.description)?.[2] ?? '') ? 1.341 : 1) || fromSpec || 1;
      const vfd = p.deviceType === 'vfd-input' || /\b(vfd|drive|speed)\b/i.test(p.description);
      const reversing = io.some((q) => q !== p && q.type === 'output' && /\b(rev|reverse)\b/i.test(q.description) && wordsShared(p.description, q.description));
      const name = p.description.replace(HP_RE, '').replace(/\b(run|contactor|starter|coil|output|on|vfd|drive)\b/gi, '').replace(/\s+/g, ' ').trim() || 'Motor';
      // New tags skip the left-over motors' tags, so "M1 Conveyor motor … left out" never names a different motor.
      let n = motors.length + 1;
      while (stale.has(`M${n}`) || motors.some((m) => m.tag === `M${n}`)) n++;
      motors.push({ tag: `M${n}`, description: /motor/i.test(name) ? name : `${name} motor`, hp, start: vfd ? 'vfd' : reversing ? 'reversing' : 'dol', ...(/\b(hoist|lift|elevat\w*|crane|winch)\b/i.test(name) ? { vertical: true } : {}) });
      if (!HP_RE.test(p.description) && !fromSpec) assumptions.push(`${name}: motor power not given — assumed ${hp} HP; confirm the nameplate.`);
    }
  }
  const estopIo = io.filter((p) => p.type === 'input' && (p.deviceType === 'estop-contact' || /\b(e-?stop|emergency)\b/i.test(p.description)) && !/\b(ok|relay|healthy|status)\b/i.test(p.description));
  const estops = Math.max(estopIo.length, 1);
  if (!estopIo.length && !/\b(e-?stop|emergency)/i.test(`${spec}\n${io.map((p) => p.description).join('\n')}`)) assumptions.push('One E-stop on the cabinet door assumed (into a safety relay); add field E-stops if operators work away from the panel.');
  const text = `${spec}\n${io.map((p) => p.description).join('\n')}`;
  const zones = zonesFrom([spec, ...io.map((p) => p.description)]);
  const guardDoors = /\b(guard\s*door|interlocked\s*door|door\s*switch|safety\s*gate)\b/i.test(text) ? [{ zone: zones[0] ?? 'Machine' }] : [];
  const lcHeight = Number(/light\s*curtain[^.\n]{0,40}?(\d{3,4})\s*mm/i.exec(text)?.[1] ?? 0);
  const lightCurtains = /\blight\s*curtain/i.test(text) ? [{ zone: zones[0] ?? 'Machine', ...(lcHeight ? { heightMm: lcHeight } : {}) }] : [];
  const twoHand = io.some((p) => p.type === 'input' && TWO_HAND_RE.test(p.description)) || TWO_HAND_RE.test(spec) ? { zone: zones[0] ?? 'Machine' } : undefined;
  const heaters: ModelHeater[] = io.filter((p) => p.type === 'output' && HEATER_RE.test(p.description) && p.signal !== 'analog').map((p, i) => {
    const kw = heaterKw(`${p.description}\n${spec}`);
    if (!kw) assumptions.push(`${p.description}: heater power not given — assumed ${DEFAULT_HEATER_KW} kW single-phase; confirm the heater's rating so its SSR, contactor and fuses can be checked.`);
    return { tag: `HTR${i + 1}`, description: p.description.split(/\s+[—–-]\s+|[(,;]/)[0].trim().replace(/\s+(on|output|ssr|contactor)$/i, '').trim() || p.description, kw: kw ?? DEFAULT_HEATER_KW, phases: /\b3[- ]?(phase|ph)\s+heat|\bheat\w*\b[^.\n,;]{0,20}\b3[- ]?(phase|ph)\b/i.test(`${p.description}. ${spec}`) ? 3 : 1, switching: /\bcontactor\b/i.test(p.description) && !/\bssr\b/i.test(p.description) ? 'contactor' : 'ssr', zone: zones[0] };
  });
  const interfaces = [...new Set(io.filter((p) => p.type === 'output' && /\b(robot|handshake|to (the )?(upstream|downstream|other)|signal to|request to|ready to)\b/i.test(p.description)).map((p) => p.description))];
  return {
    motors, safety: { estops, guardDoors, lightCurtains, ...(twoHand ? { twoHand } : {}) }, ...(heaters.length ? { heaters } : {}), zones: zones.length ? zones : ['Machine'], interfaces,
    enclosureRating: inputs.enclosureRating, assumptions,
  };
}

export const TWO_HAND_RE = /\b(two[- ]?hand|2[- ]?hand|palm button|palm buttons)\b/i;
/** A heater output (not a heat sink, not a heater's status lamp). */
export const HEATER_RE = /\bheat(er|ers|ing)?\b(?!\s*sink)/i;
const DEFAULT_HEATER_KW = 1.5;

/** Heater power from text: "2 kW heater", "heater 1500 W". */
function heaterKw(text: string): number | undefined {
  const m = /(\d+(?:\.\d+)?)\s*(kw|w)\b[^.\n]{0,30}\bheat/i.exec(text) ?? /\bheat\w*\b[^.\n]{0,30}?(\d+(?:\.\d+)?)\s*(kw|w)\b/i.exec(text);
  if (!m) return undefined;
  return m[2].toLowerCase() === 'kw' ? Number(m[1]) : Number(m[1]) / 1000;
}

/** Motor power the spec gives for a named motor: "an unwinder driven by a 0.5 HP motor". */
function specPower(spec: string, name: string): number | undefined {
  const key = name.toLowerCase().split(/\s+/).find((w) => w.length > 3 && w !== 'motor');
  if (!key) return undefined;
  const m = new RegExp(`\\b${key}\\w*\\b[^.\\n]{0,40}?(\\d+(?:\\.\\d+)?)\\s*(hp|kw)\\b`, 'i').exec(spec);
  if (!m) return undefined;
  return Number(m[1]) * (m[2].toLowerCase() === 'kw' ? 1.341 : 1);
}

function wordsShared(a: string, b: string): boolean {
  const w = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length > 2 && !['run', 'rev', 'reverse', 'forward', 'fwd', 'motor', 'output'].includes(x)));
  const A = w(a), B = w(b);
  return [...A].some((x) => B.has(x));
}

/** Field device type of an I/O point when the I/O list doesn't say (same words the simulator uses). */
export function deviceTypeOf(p: IOPoint): FieldDeviceType {
  if (p.deviceType && p.deviceType !== 'other') return p.deviceType as FieldDeviceType;
  const d = p.description.toLowerCase();
  if (p.type === 'input') {
    if (/\b(safety|e-?stop|guard|light curtain)\b/.test(d) && /\b(ok|relay|healthy|status)\b/.test(d)) return 'safety-relay-output';
    if (/\b(e-?stop|emergency)\b/.test(d)) return 'estop-contact';
    if (/\bselector|auto\/manual|hand|mode switch|key switch\b/.test(d)) return 'selector';
    if (/\bstop\b/.test(d) && /\b(pb|button|push)\b|\bstop$/.test(d)) return 'pushbutton-nc';
    if (/\b(pb|button|push ?button|start|reset|jog|ack)\b/.test(d)) return 'pushbutton-no';
    if (/\bpressure\b/.test(d) && /\bswitch\b/.test(d)) return 'pressure-switch';
    if (/\blimit switch\b/.test(d)) return 'limit-switch';
    if (/\b(fault|tripped|overload)\b/.test(d) && /\b(vfd|drive)\b/.test(d)) return 'vfd-input';
    return 'sensor-pnp';
  }
  if (/\b(stack|tower)\b/.test(d)) return 'stack-light';
  if (/\b(light|lamp|pilot|indicator|beacon)\b/.test(d)) return 'pilot-light';
  if (/\b(vfd|drive)\b/.test(d)) return 'vfd-input';
  if (/\b(motor|contactor|starter|pump|fan|conveyor|blower|mixer)\b/.test(d)) return 'contactor-coil';
  if (/\b(solenoid|valve|cylinder|sol|gripper|clamp|vacuum)\b/.test(d)) return 'solenoid';
  if (/\b(relay|horn|buzzer|siren)\b/.test(d)) return 'relay-coil';
  return 'relay-coil';
}
