import type { Effort } from '../../store/useSettingsStore';
import type { CpuModel, PlcProfile } from '../../plc/core/profile';
import type { IOCategory, IOPoint } from '../../types/io';
import type { FieldDeviceType } from '../../electrical/types';
import { specToText, type SpecSections } from '../../spec/types';
import { callClaude } from './anthropic';

const CATEGORIES: IOCategory[] = ['Safety', 'Operator/HMI', 'External Machine', 'Product Detection', 'Conveyor', 'Pneumatic', 'Vacuum', 'Servo/Axis', 'Station 1', 'Station 2', 'Analog/Process', 'Spare'];
const DEVICE_TYPES: FieldDeviceType[] = ['pushbutton-no', 'pushbutton-nc', 'selector', 'estop-contact', 'sensor-pnp', 'sensor-npn', 'limit-switch', 'pressure-switch', 'safety-relay-output', 'contactor-coil', 'relay-coil', 'solenoid', 'pilot-light', 'stack-light', 'vfd-input', 'other'];

export interface GeneratedPoint {
  description: string;
  type: 'input' | 'output';
  category: IOCategory;
  deviceType: FieldDeviceType;
  /** Why this point exists (which spec requirement). */
  reason: string;
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
    }),
  },
  questions: { type: 'array', items: { type: 'string' } },
});

const SYSTEM = `You are a senior controls engineer. From the machine specification, produce the complete discrete PLC I/O list.

Rules:
- One entry per physical PLC input or output point. Typical inputs: E-stop/safety relay status, guard door switches, start/stop/reset pushbuttons, mode selector positions, motor overload/running feedback, VFD fault/ready, cylinder extended/retracted sensors (one per position the spec relies on), part-present photo-eyes, home/limit switches, pressure switches. Typical outputs: contactor coils, VFD run/direction/speed-select, solenoid valves (one per coil; double-acting valves with two coils get two), pilot lights, stack light colors, horn, door lock.
- Functions handled on the HMI (screen buttons, setpoints) are NOT physical I/O; leave them out.
- Descriptions are short and specific, the way they'd appear on a drawing ("Pusher cylinder extended", "Conveyor 1 motor contactor").
- If an existing I/O list is given, KEEP the descriptions of points that are still needed exactly as written so their wiring is preserved, add what's missing, and drop what the spec no longer needs.
- "reason": the spec requirement each point serves.
- "questions": anything ambiguous that changes the I/O count (e.g. "Does the clamp need both open and closed sensors?").
- "explanation": a short summary of the I/O list (counts and main groups).`;

export async function generateIOFromSpec(opts: {
  apiKey: string; model: string; effort: Effort;
  spec: SpecSections; existing: IOPoint[]; profile: PlcProfile; cpu: CpuModel;
}): Promise<{ points: GeneratedPoint[]; explanation: string; questions: string[]; reasoning: string | null }> {
  const existing = opts.existing.length
    ? opts.existing.map((p) => `${p.type}\t${p.category}\t${p.description}`).join('\n')
    : '(none yet)';
  const content = `PLC: ${opts.profile.vendor} ${opts.profile.name}, CPU ${opts.cpu.label}

Machine specification:
${specToText(opts.spec) || '(empty)'}

Existing I/O list (type, category, description):
${existing}

Produce the I/O list.`;
  const { text, reasoning } = await callClaude({
    apiKey: opts.apiKey, model: opts.model, effort: opts.effort,
    system: SYSTEM, messages: [{ role: 'user', content }], schema: SCHEMA,
  });
  try {
    return { ...(JSON.parse(text) as { points: GeneratedPoint[]; explanation: string; questions: string[] }), reasoning };
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
