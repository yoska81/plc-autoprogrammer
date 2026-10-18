import type { Effort } from '../../store/useSettingsStore';
import type { CpuModel, PlcProfile } from '../../plc/core/profile';
import { ANALOG_RANGES, withAnalogRange, type AnalogSpec, type IOCategory, type IOPoint } from '../../types/io';
import type { FieldDeviceType } from '../../electrical/types';
import { specToText, type SpecSections } from '../../spec/types';
import { callClaude } from './anthropic';
import { ANSWERED_RULE } from '../../components/questions/classify';
import { NO_PANEL_RULE } from '../../spec/operatorIo';

const CATEGORIES: IOCategory[] = ['Safety', 'Operator/HMI', 'External Machine', 'Product Detection', 'Conveyor', 'Pneumatic', 'Vacuum', 'Servo/Axis', 'Station 1', 'Station 2', 'Analog/Process', 'Spare'];
const DEVICE_TYPES: FieldDeviceType[] = ['pushbutton-no', 'pushbutton-nc', 'selector', 'estop-contact', 'sensor-pnp', 'sensor-npn', 'limit-switch', 'pressure-switch', 'safety-relay-output', 'contactor-coil', 'relay-coil', 'solenoid', 'pilot-light', 'stack-light', 'vfd-input', 'other'];

export interface GeneratedPoint {
  description: string;
  type: 'input' | 'output';
  category: IOCategory;
  deviceType: FieldDeviceType;
  /** Why this point exists (which spec requirement). */
  reason: string;
  /** "analog" for 4-20 mA / 0-10 V signals; then `analog` gives range and scaling. */
  signal?: 'discrete' | 'analog';
  analog?: AnalogSpec | null;
}

/** Fields of a new I/O point from a generated one. */
export function generatedToPoint(g: GeneratedPoint): Omit<IOPoint, 'id'> {
  return {
    description: g.description, type: g.type, category: g.category, deviceType: g.deviceType,
    ...(g.signal === 'analog' && g.analog ? { signal: 'analog' as const, analog: withAnalogRange(g.description, g.analog) } : {}),
  };
}

/** Fields of a kept point the AI may update (category, device, analog signal). */
export function keptUpdate(point: IOPoint, g: GeneratedPoint): Pick<IOPoint, 'id' | 'category' | 'deviceType' | 'signal' | 'analog'> {
  const base = { id: point.id, category: g.category, deviceType: g.deviceType };
  if (g.signal === undefined) return base; // older answers without a signal: keep the point's own setting
  return g.signal === 'analog' && g.analog ? { ...base, signal: 'analog', analog: withAnalogRange(point.description, g.analog) } : { ...base, signal: undefined, analog: undefined };
}

const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const SCHEMA = obj({
  explanation: { type: 'string' },
  points: {
    type: 'array',
    items: obj({
      description: { type: 'string' },
      type: { type: 'string', enum: ['input', 'output'] },
      category: { type: 'string', enum: CATEGORIES },
      deviceType: { type: 'string', enum: DEVICE_TYPES },
      reason: { type: 'string' },
      signal: { type: 'string', enum: ['discrete', 'analog'] },
      analog: { anyOf: [obj({ range: { type: 'string', enum: ANALOG_RANGES }, min: { type: 'number' }, max: { type: 'number' }, units: { type: 'string' } }), { type: 'null' }] },
    }),
  },
  questions: { type: 'array', items: { type: 'string' } },
});

/** Update all: no reason per point and no explanation (it shows neither); the questions stay (they reach the Machine description page). */
const LEAN_SCHEMA = obj({
  points: { type: 'array', items: obj(Object.fromEntries(Object.entries((SCHEMA.properties.points as { items: { properties: Record<string, unknown> } }).items.properties).filter(([k]) => k !== 'reason'))) },
  questions: SCHEMA.properties.questions,
});
const leanSystem = (sys: string) => sys
  .replace(/^- "(reason|explanation)":.*(\n|$)/gm, '')
  .replace(' Count the analog inputs and outputs in "explanation".', '')
  .trimEnd();

const HMI_RULE = '- Functions handled on the HMI (screen buttons, setpoints) are NOT physical I/O; leave them out.';

const SYSTEM = `You are a senior controls engineer. From the machine specification, produce the complete discrete PLC I/O list.

Rules:
- One entry per physical PLC input or output point. Typical inputs: E-stop/safety relay status, guard door switches, start/stop/reset pushbuttons, mode selector positions, motor overload/running feedback, VFD fault/ready, cylinder extended/retracted sensors (one per position the spec relies on), part-present photo-eyes, home/limit switches, pressure switches. Typical outputs: contactor coils, VFD run/direction/speed-select, solenoid valves (one per coil; double-acting valves with two coils get two), pilot lights, stack light colors, horn, door lock.
${HMI_RULE}
- Safety devices: light curtains, safety mats, interlocked guard doors and pull-cords are wired to a safety relay, not to the PLC as plain inputs. Give the PLC one status input per independent safety function / zone (e.g. "Light curtain zone 1 OK (safety relay)", category Safety, deviceType safety-relay-output) and the reset pushbutton only if the PLC must see it.
- Other equipment (robot, upstream / downstream machine): one point per handshake signal in each direction (e.g. "Robot ready" input, "Robot start pick" output), category External Machine; outputs that switch another machine's input are relay-coil, inputs from its dry contacts are "other".
- VFD-driven motors: run (and direction if reversing) outputs and a fault input (deviceType vfd-input); a speed set from the screen is one analog output per drive (speed reference, 0-10V or 4-20mA, 0–60 Hz); fixed speeds only → preset-speed outputs instead.
- Every point has "signal": "discrete" (on/off, 24 VDC; "analog": null) or "analog". Analog points are 4-20 mA / 0-10 V signals on an analog channel: transmitters (level, pressure, temperature with a 4-20 mA transmitter, flow, weight), analog speed references to VFDs, proportional / modulating valve positions. For each give "analog": { "range": "4-20mA" (preferred for field transmitters) | "0-20mA" | "0-5V" | "0-10V", "min" and "max" = the engineering values at the bottom / top of the range, "units" (e.g. 0–500 "gal", 0–150 "°C", 0–60 "Hz") }, category "Analog/Process", deviceType "other". Use the ranges the spec gives; when it gives none, choose sensible ones and ask in "questions". A thermocouple read directly by a thermocouple input module (e.g. CLICK C0-04THM, no transmitter): "range": "thermocouple", units °C. Raw RTD sensors, and thermocouples where the PLC has no thermocouple input, need a temperature transmitter (4-20 mA) — say so in "questions". Level / pressure / temperature SWITCHES (on/off) stay discrete. Count the analog inputs and outputs in "explanation".
- Servo axes: the drive's handshake points (enable, home, start move / position select, in position, fault) — never the motor or encoder wiring, which is the drive's.
- Descriptions are short and specific, the way they'd appear on a drawing ("Pusher cylinder extended", "Conveyor 1 motor contactor").
- If an existing I/O list is given, KEEP the descriptions of points that are still needed exactly as written so their wiring is preserved, add what's missing, and drop what the spec no longer needs.
- "reason": the spec requirement each point serves.
- "questions": anything ambiguous that changes the I/O count (e.g. "Does the clamp need both open and closed sensors?").
${ANSWERED_RULE}
- "explanation": a short summary of the I/O list (counts and main groups).`;

export async function generateIOFromSpec(opts: {
  apiKey: string; model: string; effort: Effort; signal?: AbortSignal; cache?: boolean;
  spec: SpecSections; existing: IOPoint[]; profile: PlcProfile; cpu: CpuModel;
  /** Update all: no reasons per point and no explanation. */
  lean?: boolean;
  /** The equipment has no touch panel: the operator functions are physical I/O. */
  noPanel?: boolean;
}): Promise<{ points: GeneratedPoint[]; explanation: string; questions: string[]; reasoning: string | null }> {
  const existing = opts.existing.length
    ? opts.existing.map((p) => `${p.type}\t${p.category}\t${p.description}${p.signal === 'analog' && p.analog ? `\tanalog ${p.analog.range} ${p.analog.min}–${p.analog.max} ${p.analog.units}` : ''}`).join('\n')
    : '(none yet)';
  // Only the PLC family: the I/O list does not depend on the CPU model, so it can be asked while the
  // equipment step is still choosing the CPU (and an unchanged spec gives the same request: cached).
  const content = `PLC: ${opts.profile.vendor} ${opts.profile.name}

Machine specification:
${specToText(opts.spec) || '(empty)'}

Existing I/O list (type, category, description):
${existing}

Produce the I/O list.`;
  const base = opts.noPanel ? SYSTEM.replace(HMI_RULE, NO_PANEL_RULE) : SYSTEM;
  const { text, reasoning } = await callClaude({
    apiKey: opts.apiKey, model: opts.model, effort: opts.effort, signal: opts.signal, cache: opts.cache, task: 'io',
    system: opts.lean ? leanSystem(base) : base, messages: [{ role: 'user', content }], schema: opts.lean ? LEAN_SCHEMA : SCHEMA,
  });
  try {
    const r = JSON.parse(text) as { points: GeneratedPoint[]; explanation?: string; questions?: string[] };
    return { points: r.points.map((p) => ({ ...p, reason: p.reason ?? '' })), explanation: r.explanation ?? '', questions: r.questions ?? [], reasoning };
  } catch (err) {
    throw new Error('The AI returned an I/O list the app could not read. Please try again.', { cause: err });
  }
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export interface IOMergePlan {
  kept: { point: IOPoint; next: GeneratedPoint }[];
  added: GeneratedPoint[];
  removed: IOPoint[];
}

/** Match generated points to existing ones by description so addresses and edits survive. */
export function planIOMerge(existing: IOPoint[], generated: GeneratedPoint[]): IOMergePlan {
  const byDesc = new Map(existing.map((p) => [`${p.type}|${norm(p.description)}`, p]));
  const kept: IOMergePlan['kept'] = [];
  const added: GeneratedPoint[] = [];
  const used = new Set<string>();
  for (const g of generated) {
    const match = byDesc.get(`${g.type}|${norm(g.description)}`);
    if (match && !used.has(match.id)) {
      kept.push({ point: match, next: g });
      used.add(match.id);
    } else {
      added.push(g);
    }
  }
  return { kept, added, removed: existing.filter((p) => !used.has(p.id)) };
}
