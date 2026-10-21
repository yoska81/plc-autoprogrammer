import type { Effort } from '../../store/useSettingsStore';
import type { IOPoint } from '../../types/io';
import type { DesignInputs } from '../../electrical/types';
import { defaultMachineModel, generateDesign, type EngineInput, type EngineResult, type MachineModel } from '../../electrical/engine';
import type { ModelMotor, MotorStart } from '../../electrical/engine/machineModel';
import { callClaude } from './anthropic';
import { ANSWERED_RULE } from '../../components/questions/classify';
import { specForAI } from './specForAI';

/**
 * Electrical design, rule-based first and AI second: the AI reads the specification into a small
 * machine model (motors, safety devices, zones, other machines, open questions) — no catalog, no part
 * numbers — and the rule-based engine (src/electrical/engine) designs the panel from it. When there
 * is no API key or the AI fails, the engine runs from the model it reads itself, so a design is
 * always produced.
 */

const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const zoneList = { type: 'array', items: obj({ zone: { type: 'string' } }) };

export const MACHINE_MODEL_SCHEMA = obj({
  motors: {
    type: 'array',
    items: obj({
      tag: { type: 'string' },
      description: { type: 'string' },
      power: { type: 'number' },
      unit: { type: 'string', enum: ['hp', 'kW'] },
      powerGiven: { type: 'boolean' },
      start: { type: 'string', enum: ['dol', 'reversing', 'vfd', 'motor-protector'] },
      vertical: { type: 'boolean' },
      zone: { type: 'string' },
    }),
  },
  estops: { type: 'integer' },
  guardDoors: zoneList,
  lightCurtains: zoneList,
  zones: { type: 'array', items: { type: 'string' } },
  interfaces: { type: 'array', items: { type: 'string' } },
  questions: { type: 'array', items: { type: 'string' } },
});

const SYSTEM = `You read a machine specification and its I/O list and describe the machine's electrical load and safety for a rule-based panel designer (it picks every part itself — do not name parts or sizes of breakers, contactors, wires or enclosures).
- motors: every motor the machine has, in order. Keep the designer's motor list exactly (tag, power, start method) and add motors the spec or I/O list mentions that are missing. "power" + "unit" as stated; when not stated estimate it and set powerGiven false. "start": vfd when the spec mentions variable speed, a drive, ramps or speed setpoints; reversing for an across-the-line motor that runs both ways; motor-protector only when the spec asks for one; otherwise dol. "vertical" for hoists, lifts and other overhauling loads. "zone": the machine area it is in.
- estops: number of E-stop buttons (at least 1: the cabinet door).
- guardDoors / lightCurtains: each interlocked guard door / light curtain the spec mentions, with its zone.
- zones: the machine areas in order (e.g. "Infeed conveyor", "Pusher station"), 1-6 short names.
- interfaces: the I/O descriptions of outputs that signal another machine or robot.
- questions: what the designer must confirm (unstated motor powers, supply, safety assumptions), one short sentence each.
${ANSWERED_RULE}`;

interface AiModel {
  motors: { tag: string; description: string; power: number; unit: 'hp' | 'kW'; powerGiven: boolean; start: MotorStart; vertical: boolean; zone: string }[];
  estops: number;
  guardDoors: { zone: string }[];
  lightCurtains: { zone: string }[];
  zones: string[];
  interfaces: string[];
  questions: string[];
}

/** The AI's model on top of the rules' own reading: the designer's motor list always wins. */
export function mergeMachineModel(ai: AiModel, base: MachineModel, inputs: DesignInputs): MachineModel {
  // The designer's motors still in the base model (stale ones were left out by defaultMachineModel).
  const own = new Set(base.motors.filter((m) => inputs.motors.some((x) => x.tag === m.tag)).map((m) => m.tag));
  const aiMotors: ModelMotor[] = ai.motors.map((m) => ({
    tag: m.tag, description: m.description, hp: Math.max(0.25, m.unit === 'kW' ? m.power / 0.7457 : m.power), start: m.start,
    ...(m.vertical ? { vertical: true } : {}), ...(m.zone ? { zone: m.zone } : {}),
  }));
  const motors = own.size
    ? [...base.motors.map((m) => ({ ...m, ...pick(aiMotors.find((a) => a.tag === m.tag)) })), ...aiMotors.filter((m) => !own.has(m.tag))]
    : aiMotors.length ? aiMotors : base.motors;
  const zones = ai.zones.map((z) => z.trim()).filter(Boolean).slice(0, 6);
  const notGiven = ai.motors.filter((m) => !m.powerGiven && !own.has(m.tag)).map((m) => `${m.tag} ${m.description}: power not given — assumed ${m.power} ${m.unit}; confirm the nameplate.`);
  return {
    motors,
    // Devices the I/O list itself shows (a light curtain input, two-hand buttons) stay even when the AI misses them.
    safety: {
      estops: Math.max(1, ai.estops, base.safety.estops),
      guardDoors: ai.guardDoors.length ? ai.guardDoors : base.safety.guardDoors,
      lightCurtains: ai.lightCurtains.length ? ai.lightCurtains : base.safety.lightCurtains,
      ...(base.safety.twoHand ? { twoHand: base.safety.twoHand } : {}),
    },
    ...(base.heaters?.length ? { heaters: base.heaters } : {}),
    zones: zones.length ? zones : base.zones,
    interfaces: [...new Set([...base.interfaces, ...ai.interfaces])],
    enclosureRating: base.enclosureRating,
    assumptions: [...new Set([...base.assumptions.filter((a) => /left out of the design|heater power not given/.test(a)), ...notGiven, ...ai.questions])],
  };
}
/** Only the AI's placement details for a designer motor (its power and starter stay the designer's). */
const pick = (m: ModelMotor | undefined): Partial<ModelMotor> => (m ? { ...(m.zone ? { zone: m.zone } : {}), ...(m.vertical ? { vertical: true } : {}) } : {});

export interface AiOptions { apiKey: string; model: string; effort: Effort; signal?: AbortSignal; /** May answer from the answer cache (Update all). */ cache?: boolean }

export async function machineModelFromSpec(opts: AiOptions & { spec: string; io: IOPoint[]; inputs: DesignInputs }): Promise<{ model: MachineModel; reasoning: string | null; promptChars: number }> {
  const base = defaultMachineModel(opts.io, opts.inputs, opts.spec);
  // Only the designer's motors this machine mentions (left-over ones would be copied back by the AI).
  const kept = new Set(base.motors.map((m) => m.tag));
  const motors = opts.inputs.motors.filter((m) => kept.has(m.tag)).map((m) => `${m.tag}: ${m.description}, ${m.hp} HP, ${m.starter}${m.reversing ? ', reversing' : ''}`).join('\n') || '(none)';
  const io = opts.io.map((p) => `${p.type}\t${p.description}`).join('\n') || '(no I/O yet)';
  const content = `Machine specification:\n${specForAI(opts.spec, 'machine') || '(not given)'}\n\nSupply: ${opts.inputs.supply}\nDesigner's motor list:\n${motors}\n\nI/O list (type, description):\n${io}`;
  const { text, reasoning } = await callClaude({ ...opts, task: 'machine', system: SYSTEM, messages: [{ role: 'user', content }], schema: MACHINE_MODEL_SCHEMA });
  let parsed: AiModel;
  try { parsed = JSON.parse(text); } catch (err) { throw new Error('The AI answer could not be read.', { cause: err }); }
  return { model: mergeMachineModel(parsed, base, opts.inputs), reasoning, promptChars: SYSTEM.length + content.length + JSON.stringify(MACHINE_MODEL_SCHEMA).length };
}

export type RuleDesignResult = EngineResult & {
  reasoning: string | null;
  /** 'ai' = the AI read the machine model; 'rules' = the engine's own reading (no key, or the AI failed). */
  source: 'ai' | 'rules';
  aiError?: string;
};

/**
 * The electrical design for the project: AI machine model (when a key is set) → rule-based engine.
 * Never fails because of the AI: any AI error falls back to the rules' own model and is reported in
 * `aiError` and in the design notes.
 */
export async function generateRuleBasedDesign(opts: Partial<AiOptions> & Omit<EngineInput, 'model'> & { spec: string }): Promise<RuleDesignResult> {
  const base = defaultMachineModel(opts.io, opts.inputs, opts.spec);
  let model = base, reasoning: string | null = null, source: RuleDesignResult['source'] = 'rules', aiError: string | undefined;
  if (opts.apiKey && opts.model && opts.effort) {
    try {
      const r = await machineModelFromSpec({ apiKey: opts.apiKey, model: opts.model, effort: opts.effort, signal: opts.signal, cache: opts.cache, spec: opts.spec, io: opts.io, inputs: opts.inputs });
      model = r.model; reasoning = r.reasoning; source = 'ai';
    } catch (err) {
      if (opts.signal?.aborted) throw err;
      aiError = err instanceof Error ? err.message : String(err);
    }
  }
  const r = generateDesign({ ...opts, model });
  if (aiError) {
    const note = `The AI could not read the specification (${aiError}): the design uses the rules' reading of the I/O list and motor list — check the motors and safety devices.`;
    r.design.notes.unshift(note);
    r.design.askUser = [note, ...(r.design.askUser ?? [])];
  }
  return { ...r, reasoning, source, aiError };
}
