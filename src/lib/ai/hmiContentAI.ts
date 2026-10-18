import { isAnalog, type IOPoint } from '../../types/io';
import type { ElectricalDesign } from '../../electrical/types';
import type { HmiDesign, HmiState, HmiStyle } from '../../hmi/types';
import { buildHmi, defaultHmiContent, type HmiContent } from '../../hmi/engine';
import { inferRoles } from '../../hmi/engine/roles';
import { plcChangesFor, type UpgradeRoles } from '../../hmi/engine/upgradeHmi';
import { rungAddresses, rungWrites, type LadderProgram } from '../../plc/core/ladder';
import { callClaude } from './anthropic';
import type { AiOptions } from './machineModelAI';

/**
 * HMI, rules first and AI second: the rule-based engine (src/hmi/engine) builds every screen from the
 * I/O list in milliseconds; the AI (when a key is set) only makes small choices on top — the machine
 * name, actuator names, which actuators get manual jogs, the machine-state texts of the cycle and
 * questions — as a short JSON. AI failure or no key: the rules' screens as they are.
 */

const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const STYLES: HmiStyle[] = ['normal', 'ok', 'warning', 'alarm'];

export const HMI_CONTENT_SCHEMA = obj({
  machineName: { type: 'string' },
  actuators: { type: 'array', items: obj({ index: { type: 'integer' }, name: { type: 'string' }, manual: { type: 'boolean' } }) },
  states: { type: 'array', items: obj({ value: { type: 'integer' }, text: { type: 'string' }, style: { type: 'string', enum: STYLES } }) },
});

const SYSTEM = `You name things on an operator touch panel whose screens a rule-based generator builds from the machine's I/O list (it lays out every screen and assigns every PLC tag — never give coordinates, addresses or screens).
- machineName: short machine name for the header (2–4 words, from the specification).
- actuators: for each actuator listed (by index) a short operator name (1–3 words, e.g. "Infeed Belt", "Sealing Head") and manual = true when an operator may jog it by hand in Manual mode (false for heaters, safety dump valves, anything dangerous to jog).
- states: the machine-state word texts in the order the PLC sets them: 0 Stopped (normal) first; Running (ok); one entry per main step of the cycle the specification describes (e.g. "Sealing", "Cooling", ok); then Faulted (alarm), Manual (warning) and Safety Stop (alarm). 4–10 entries, values 0,1,2… in order, texts of 1–2 words.`;

// questions are asked at the machine description stage; older recorded answers may still carry some
interface AiContent { machineName: string; actuators: { index: number; name: string; manual: boolean }[]; states: HmiState[]; questions?: string[] }

/** The AI's small choices on top of the rules' content; anything invalid is ignored. */
export function mergeHmiContent(ai: AiContent, base: HmiContent): HmiContent {
  const actuators = base.actuators.map((a, i) => {
    const x = ai.actuators?.find((y) => y.index === i);
    if (!x) return a;
    const name = x.name?.trim().slice(0, 24) || a.name;
    // The rules never make a dump valve or heater jog-able, whatever the AI says.
    return { ...a, name, manual: a.kind === 'valve' || a.kind === 'heater' ? false : x.manual !== false };
  });
  const st = (ai.states ?? []).filter((s) => s.text?.trim());
  const okStates = st.length >= 3 && st.length <= 12 && st[0].value === 0 && new Set(st.map((s) => s.value)).size === st.length;
  return {
    ...base,
    machineName: ai.machineName?.trim().slice(0, 32) || base.machineName,
    actuators,
    states: okStates ? st.map((s) => ({ value: s.value, text: s.text.trim().slice(0, 20), style: STYLES.includes(s.style) ? s.style : 'normal' })) : base.states,
    questions: [...base.questions, ...(ai.questions ?? []).slice(0, 4)],
  };
}

export interface HmiProjectInput {
  io: IOPoint[];
  addresses: Map<string, string>;
  machineName: string;
  spec: string;
  electrical?: ElectricalDesign | null;
  panel: { partNumber: string; widthPx: number; heightPx: number };
  plcText?: string;
  now?: string;
  /** The HMI being redesigned: every function keeps its address (roles inferred for older designs). */
  existingHmi?: HmiDesign | null;
  /** The current PLC program: new HMI tags never take an address it uses. */
  program?: LadderProgram | null;
  /** Upgrade of an imported program: its own addresses for the HMI's functions (src/plc/import/hmiRoles.ts). */
  upgradeRoles?: UpgradeRoles | null;
}

/** Rules' content for the project: the electrical design's wiring links reversing contactors and drives to their motor. */
export function projectHmiContent(o: HmiProjectInput): HmiContent {
  const motors = new Map((o.electrical?.inputs.motors ?? []).map((m) => [m.tag, m.description]));
  const motorOf = new Map((o.electrical?.components ?? []).filter((c) => c.motorTag && motors.has(c.motorTag)).map((c) => [c.tag, { tag: c.motorTag!, description: motors.get(c.motorTag!)! }]));
  return defaultHmiContent({ io: o.io, addresses: o.addresses, machineName: o.machineName, wiring: o.electrical?.ioWiring, motorOf, spec: o.spec });
}

export async function hmiContentFromSpec(opts: AiOptions & { spec: string; base: HmiContent }): Promise<{ content: HmiContent; promptChars: number }> {
  const acts = opts.base.actuators.map((a, i) => `${i}: ${a.kind} "${a.name}" — ${[a.run, a.reverse, a.extend, a.retract].filter(Boolean).map((p) => p!.description).join(', ')}`).join('\n') || '(none)';
  const content = `Machine specification:\n${opts.spec || '(not given)'}\n\nActuators found in the I/O list:\n${acts}\n\nAnalog values: ${opts.base.analogs.map((a) => a.name).join(', ') || 'none'}`;
  const { text } = await callClaude({ apiKey: opts.apiKey, model: opts.model, effort: opts.effort, signal: opts.signal, cache: opts.cache, task: 'hmi-names', system: SYSTEM, messages: [{ role: 'user', content }], schema: HMI_CONTENT_SCHEMA });
  let parsed: AiContent;
  try { parsed = JSON.parse(text); } catch (err) { throw new Error('The AI answer could not be read.', { cause: err }); }
  return { content: mergeHmiContent(parsed, opts.base), promptChars: SYSTEM.length + content.length + JSON.stringify(HMI_CONTENT_SCHEMA).length };
}

export interface RuleHmiResult { design: HmiDesign; explanation: string; reasoning: null; source: 'ai' | 'rules'; aiError?: string }

/** The project's HMI: rules' screens, with the AI's names and cycle states when a key is set. Never fails because of the AI. */
export async function generateRuleBasedHmi(opts: Partial<AiOptions> & HmiProjectInput): Promise<RuleHmiResult> {
  const base = projectHmiContent(opts);
  let content = base, source: RuleHmiResult['source'] = 'rules', aiError: string | undefined;
  if (opts.apiKey && opts.model && opts.effort) {
    try {
      content = (await hmiContentFromSpec({ apiKey: opts.apiKey, model: opts.model, effort: opts.effort, signal: opts.signal, cache: opts.cache, spec: opts.spec, base })).content;
      source = 'ai';
    } catch (err) {
      if (opts.signal?.aborted) throw err;
      aiError = err instanceof Error ? err.message : String(err);
    }
  }
  // Address stability: the existing HMI's functions keep their addresses; new tags avoid every address in use.
  const inferred = opts.existingHmi ? inferRoles(opts.existingHmi.tags, { content: base, screens: opts.existingHmi.screens, alarms: opts.existingHmi.alarms }).tags : [];
  // An upgraded program: the HMI uses the program's own addresses for the functions it already has.
  const roles = opts.upgradeRoles;
  const own = new Set((roles?.tags ?? []).map((t) => t.role));
  const keepTags = [...(roles?.tags ?? []), ...inferred.filter((t) => !own.has(t.role))];
  const usedAddresses = (opts.program?.rungs ?? []).flatMap((r) => [...rungAddresses(r), ...rungWrites(r)]).filter((a) => /^[A-Z]+\d+$/i.test(a));
  const design = buildHmi(content, { ...opts.panel, plcText: opts.plcText, now: opts.now, keepTags, usedAddresses });
  if (roles && opts.program) {
    const analogIn = new Set(opts.io.filter((p) => p.type === 'input' && isAnalog(p)).map((p) => (opts.addresses.get(p.id) ?? '').toUpperCase()).filter(Boolean));
    design.plcChanges = plcChangesFor(design, opts.program, roles, analogIn);
    const n = design.plcChanges.length;
    if (n) design.notes.push(`The HMI uses the upgraded program's own addresses where it has them; ${n} HMI function(s) need a change in the PLC program (listed on the review page).`);
    for (const m of roles.missing ?? []) design.notes.push(m);
  }
  if (aiError) {
    const note = `The AI could not name the screens (${aiError}): names and machine states come from the I/O list — check them.`;
    design.notes.unshift(note);
    design.askUser = [note, ...(design.askUser ?? [])];
  }
  const manual = content.actuators.filter((a) => a.manual).length;
  const explanation = `Rule-based HMI for ${content.machineName}: ${design.screens.length} screens (${[...new Set(design.screens.map((s) => s.name.replace(/ \d+\/\d+$/, '')))].join(', ')}), ${manual} actuator(s) with hold-to-run jogs, ${design.alarms.length} alarms, ${design.tags.length} HMI tags.`;
  return { design, explanation, reasoning: null, source, aiError };
}
