import type { HmiDesign } from '../../hmi/types';
import type { ElectricalDesign } from '../../electrical/types';
import { projectHmiContent } from '../../lib/ai/hmiContentAI';
import { inferRoles } from '../../hmi/engine/roles';
import { callClaude } from '../../lib/ai/anthropic';
import { callOpenAI } from '../../lib/ai/openai';
import type { LadderProgram } from '../core/ladder';
import { validateProgram } from '../core/validate';
import type { ProgramResult } from '../engine/program';
import { checkSequence, programWithCycle, type CycleSequence, type CycleStep } from '../engine/sequence';
import type { AIConfig, PlcContext } from './ladderAI';

/**
 * PLC program, rules first and AI second: the rule-based templates (src/plc/engine/program.ts) write
 * safety & modes, alarms, manual, outputs and HMI status — everything the HMI tags need — and the AI
 * only lists the automatic cycle as steps (actions, waits, timeout; src/plc/engine/sequence.ts turns
 * them into rungs). The steps are checked (known actuators and inputs, every step waits for something,
 * checker clean); otherwise, or when the AI fails, the default cycle from the I/O list is used.
 */

const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
/** The cycle as steps (actions, waits, timeout): the template turns it into rungs (src/plc/engine/sequence.ts). */
export const CYCLE_SCHEMA = obj({
  explanation: { type: 'string' },
  steps: {
    type: 'array',
    items: obj({
      name: { type: 'string' },
      actions: { type: 'array', items: obj({ actuator: { type: 'string' }, what: { type: 'string', enum: ['run', 'reverse', 'extend', 'retract'] } }) },
      waitFor: { type: 'array', items: obj({ input: { type: ['string', 'null'] }, on: { type: 'boolean' }, seconds: { type: ['number', 'null'] } }) },
      timeoutSec: { type: ['number', 'null'] },
    }),
  },
  questions: { type: 'array', items: { type: 'string' } },
});

const SYSTEM = `You describe a machine's automatic cycle as a STEP SEQUENCE for a rule-based PLC program generator. It already writes safety, modes, alarms, manual jogs, outputs and HMI status, and turns your steps into ladder (step register, transitions, timers); you only list the steps.
- steps: in order; after the last step the cycle repeats from the first. Each step: a short name ("Head down", "Seal 2 s", "Wait for part"), the actions held ON during the step (actuator + what: run / reverse for motors and drives, extend / retract for cylinders — only from the list given; a single-solenoid cylinder retracts when its extend action is not held), what the step waits for before the next step (ALL of: an input ON or OFF from the list, and/or "seconds" for a timed step), and timeoutSec (fault if the step takes longer; null when it may wait indefinitely, e.g. for the next part).
- Every step must wait for something (a sensor or a time), so the cycle never races.
- Motors that run continuously in Auto: list their run action in every step where they run.
- questions: what the specification leaves open about the cycle, one short sentence each, at most 4.
- explanation: the cycle in plain words.`;

export interface CycleRequest {
  ai: AIConfig;
  base: ProgramResult;
  spec: string;
  /** Inputs the cycle may wait for (address, description). */
  inputs: { address: string; description: string }[];
}

/** Ask the AI for the step sequence (not yet checked). */
export async function cycleFromSpec(r: CycleRequest): Promise<{ sequence: CycleSequence; explanation: string; promptChars: number }> {
  const acts = [...new Map(r.base.autoBits.map((b) => [`${b.actuator}|${b.what}`, b])).values()];
  const content = `Machine specification:
${r.spec || '(not given)'}

Actions (actuator, what, output):
${acts.map((b) => `${b.actuator}\t${b.what}\t${b.output}`).join('\n') || '(none)'}

Inputs to wait for (address, description):
${r.inputs.map((i) => `${i.address}\t${i.description}`).join('\n')}

List the automatic cycle steps.`;
  const text = r.ai.provider === 'anthropic'
    ? (await callClaude({ ...r.ai, system: SYSTEM, messages: [{ role: 'user', content }], schema: CYCLE_SCHEMA })).text
    : await callOpenAI({ ...r.ai, system: SYSTEM, messages: [{ role: 'user', content }], schema: CYCLE_SCHEMA });
  let parsed: { explanation: string; steps: (Omit<CycleStep, 'waitFor'> & { waitFor: { input: string | null; on: boolean; seconds: number | null }[] })[]; questions: string[] };
  try { parsed = JSON.parse(text); } catch (err) { throw new Error('The AI answer could not be read.', { cause: err }); }
  const steps: CycleStep[] = parsed.steps.map((st) => ({
    name: st.name, actions: st.actions, timeoutSec: st.timeoutSec ?? null,
    waitFor: st.waitFor.map((w) => (w.input ? { input: w.input.trim().toUpperCase(), on: w.on !== false } : { seconds: w.seconds ?? 1 })),
  }));
  return { sequence: { steps, questions: parsed.questions ?? [], source: 'ai' }, explanation: parsed.explanation, promptChars: SYSTEM.length + content.length + JSON.stringify(CYCLE_SCHEMA).length };
}

export interface RuleProgramResult { program: LadderProgram; explanation: string; reasoning: null; source: 'ai' | 'rules'; notes: string[]; aiError?: string; sequence: CycleSequence }

/** The program for the project: the standard blocks plus the cycle (the AI's steps when a key is set, else the default steps). Never fails because of the AI. */
export async function generateRuleBasedProgram(o: { ai?: AIConfig; ctx: PlcContext; spec: string; electrical?: ElectricalDesign | null; hmi?: HmiDesign | null }): Promise<RuleProgramResult> {
  const content = projectHmiContent({ io: o.ctx.io, addresses: o.ctx.addresses, machineName: o.hmi?.machineName ?? 'Machine', spec: o.spec, electrical: o.electrical, panel: { partNumber: '', widthPx: 800, heightPx: 480 } });
  // The HMI's own machine states (it may have the cycle's steps from the AI).
  const stateTag = o.hmi ? inferRoles(o.hmi.tags, { content, screens: o.hmi.screens, alarms: o.hmi.alarms }).tags.find((t) => t.role === 'word:state')?.address : undefined;
  const stateEl = o.hmi?.screens.flatMap((s) => s.elements).find((e) => e.kind === 'multistate' && e.address === stateTag && e.states?.length);
  if (stateEl?.states) content.states = stateEl.states;
  const input = { content, hmiTags: o.hmi?.tags, hmiScreens: o.hmi?.screens, hmiAlarms: o.hmi?.alarms, spec: o.spec };
  const ioSet = new Set([...o.ctx.addresses.values()].filter(Boolean).map((a) => a.toUpperCase()));
  const inputs = content.io.filter((p) => p.type === 'input');
  let source: RuleProgramResult['source'] = 'rules', aiError: string | undefined, explanation = '';
  let result = programWithCycle(input);
  if (o.ai?.apiKey && result.base.autoBits.length) {
    try {
      const r = await cycleFromSpec({ ai: o.ai, base: result.base, spec: o.spec, inputs });
      const problems = checkSequence(r.sequence, result.base, new Set(inputs.map((i) => i.address.toUpperCase())));
      if (problems.length) throw new Error(`its cycle steps were not used: ${problems.slice(0, 3).join('; ')}`);
      const withAi = programWithCycle({ ...input, sequence: r.sequence });
      const errors = validateProgram(withAi.program, o.ctx.profile, ioSet, o.hmi ?? undefined).filter((i) => i.severity === 'error');
      if (errors.length) throw new Error(`its cycle did not pass the checker: ${errors[0].message}`);
      result = withAi; source = 'ai'; explanation = r.explanation;
    } catch (err) {
      if (o.ai.signal?.aborted) throw err;
      aiError = err instanceof Error ? err.message : String(err);
      result.notes.unshift(`The AI could not write the cycle (${aiError}): the default cycle from the I/O list is used — check its steps.`);
    }
  }
  const { program, notes, sequence } = result;
  return {
    program, sequence, source, aiError, notes, reasoning: null,
    explanation: `${source === 'ai' ? 'Program from the standard blocks with the cycle steps written by the AI from the specification' : aiError ? 'Program from the standard blocks with the default cycle (rules): the AI\'s cycle was not used, see the notes' : `Program from the standard blocks with the default cycle (rules${o.ai?.apiKey ? '' : ', no AI connected'})`}: ${program.rungs.length} rungs in ${program.blocks?.length ?? 0} blocks; cycle ${sequence.steps.map((st, i) => `${(i + 1) * 10} ${st.name}`).join(' → ') || 'none'}.${explanation ? ` ${explanation}` : ''}${notes.length ? ` Notes: ${notes.join(' ')}` : ''}`,
  };
}
