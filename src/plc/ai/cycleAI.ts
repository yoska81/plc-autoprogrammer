import type { HmiDesign } from '../../hmi/types';
import type { ElectricalDesign } from '../../electrical/types';
import { projectHmiContent } from '../../lib/ai/hmiContentAI';
import { callClaude } from '../../lib/ai/anthropic';
import { callOpenAI } from '../../lib/ai/openai';
import { rungWrites, type LadderProgram, type Rung, type TagDefinition } from '../core/ladder';
import { RUNG_SCHEMA } from '../core/schema';
import { validateProgram } from '../core/validate';
import { buildProgram, type ProgramResult } from '../engine/program';
import type { AIConfig, PlcContext } from './ladderAI';

/**
 * PLC program, rules first and AI second: the rule-based templates (src/plc/engine/program.ts) write
 * safety & modes, alarms, manual, outputs and HMI status — everything the HMI tags need — and the AI
 * writes only the "cycle" block: the machine's own automatic sequence, which sets the automatic request
 * bits. A small request with a fixed list of what it may read and write; the block is checked and
 * dropped (rules' default kept) when it breaks the rules or the AI fails.
 */

const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
export const CYCLE_SCHEMA = obj({
  explanation: { type: 'string' },
  rungs: { type: 'array', items: RUNG_SCHEMA },
  tags: { type: 'array', items: obj({ address: { type: 'string' }, nickname: { type: 'string' }, comment: { type: 'string' } }) },
});

const SYSTEM = (profile: string) => `You write ONE block of a ladder program for a ${profile}: the "cycle" block, the machine's automatic sequence. Every other block (safety, modes, alarms, manual jogs, outputs, HMI status) is already written by rules; the outputs block drives each physical output from an automatic request bit you set (AND cycle running AND Safety OK), so you never write outputs.
Rules:
- Write each automatic request bit listed with exactly one OUT coil (or SET/RST pairs). Only those bits, the free bits, the step register, the free timers and the machine-state word may be written. Never write Y outputs, X inputs or any other HMI tag.
- Read anything listed: inputs, request bits, C2 (cycle running), C1 (Safety OK), C3 (any fault), the free memory.
- A step sequencer for multi-step cycles: step register values 0 (idle), 10, 20, 30…; step 0 when the cycle is not running (NC C2 → COPY 0); each step's rung comment names the step ("Step 20: extend the head, wait for head down"); advance on feedback (position sensors) or a timer for timed steps (dwell, seal time); a request bit is ON while its step needs it.
- Motors / drives that should simply run in Auto: their request = cycle running (and any condition the spec gives).
- When the state table has step states (e.g. "Sealing"), write the state word with COPY in the step that matches, as the last rungs of the block (the status block writes Stopped / Running before you and Manual / Faulted / Safety Stop after you).
- Short technician comments; every free address you use in "tags" (PascalCase nickname, max 24 characters).
- "explanation": the cycle in plain words, plus anything the spec leaves open.`;

export interface CycleRequest {
  ai: AIConfig;
  base: ProgramResult;
  spec: string;
  profileName: string;
  /** Inputs the cycle may read (address, description). */
  inputs: { address: string; description: string }[];
  states: { value: number; text: string }[];
  stateWord?: string;
}

/** Ask the AI for the cycle block; returns the block's rungs and tags (not yet checked). */
export async function cycleFromSpec(r: CycleRequest): Promise<{ rungs: Rung[]; tags: TagDefinition[]; explanation: string; promptChars: number }> {
  const content = `Machine specification:\n${r.spec || '(not given)'}

Automatic request bits to set (actuator, what, bit):
${r.base.autoBits.map((b) => `${b.bit}\t${b.actuator} ${b.what} (output ${b.output})`).join('\n') || '(none)'}

Inputs you may read:
${r.inputs.map((i) => `${i.address}\t${i.description}`).join('\n')}

Free memory: bits ${r.base.free.bits}, step register ${r.base.free.steps}, timers ${r.base.free.timers}.
${r.stateWord ? `Machine-state word ${r.stateWord}, state table: ${r.states.map((s) => `${s.value} ${s.text}`).join(', ')}.` : ''}

Write the cycle block.`;
  const system = SYSTEM(r.profileName);
  const text = r.ai.provider === 'anthropic'
    ? (await callClaude({ ...r.ai, system, messages: [{ role: 'user', content }], schema: CYCLE_SCHEMA })).text
    : await callOpenAI({ ...r.ai, system, messages: [{ role: 'user', content }], schema: CYCLE_SCHEMA });
  let parsed: { explanation: string; rungs: Rung[]; tags: TagDefinition[] };
  try { parsed = JSON.parse(text); } catch (err) { throw new Error('The AI answer could not be read.', { cause: err }); }
  return { ...parsed, promptChars: system.length + content.length + JSON.stringify(CYCLE_SCHEMA).length };
}

/** Range check for "C60-C99" / "DS1150-DS1159" / "T20-T39". */
function inRange(address: string, range: string): boolean {
  const m = /^([A-Z]+)(\d+)-([A-Z]+)?(\d+)$/.exec(range);
  const a = /^([A-Z]+)(\d+)$/.exec(address.trim().toUpperCase());
  return !!m && !!a && a[1] === m[1] && Number(a[2]) >= Number(m[2]) && Number(a[2]) <= Number(m[4]);
}

/** Put the AI's cycle block into the rules' program, or say why not. */
export function mergeCycle(base: ProgramResult, block: { rungs: Rung[]; tags: TagDefinition[] }, stateWord: string | undefined, check: (p: LadderProgram) => string[]): { program: LadderProgram; problems: string[] } {
  const allowed = (a: string) => base.autoBits.some((b) => b.bit === a) || a === stateWord || inRange(a, base.free.bits) || inRange(a, base.free.steps) || inRange(a, base.free.timers);
  const problems: string[] = [];
  const rungs = block.rungs.map((r, i) => ({ ...r, id: `r_cycle_${i + 1}`, block: 'cycle' }));
  for (const r of rungs) for (const w of rungWrites(r)) if (!allowed(w.trim().toUpperCase())) problems.push(`writes ${w} (not allowed in the cycle block)`);
  if (!rungs.length) problems.push('no rungs');
  // Request bits the AI did not write stay off (the rules' "not written yet" rung keeps them defined).
  const written = new Set(rungs.flatMap(rungWrites).map((w) => w.trim().toUpperCase()));
  const missing = base.autoBits.filter((b) => !written.has(b.bit));
  const keep: Rung[] = missing.length ? [{ id: 'r_cycle_rest', block: 'cycle', comment: `Not used by the cycle: ${missing.map((b) => `${b.actuator} ${b.what}`).join(', ')} stay off in Auto`, branches: [[{ type: 'NC', address: 'SC1' }]], outputs: missing.map((b) => ({ type: 'OUT', address: b.bit })) }] : [];
  const first = base.program.rungs.findIndex((r) => r.block === 'cycle');
  const others = base.program.rungs.filter((r) => r.block !== 'cycle');
  const at = first < 0 ? others.length : first;
  const program: LadderProgram = {
    ...base.program,
    rungs: [...others.slice(0, at), ...rungs, ...keep, ...others.slice(at)],
    tags: [...base.program.tags, ...block.tags.filter((t) => !base.program.tags.some((x) => x.address === t.address))],
  };
  if (!problems.length) problems.push(...check(program));
  return { program: problems.length ? base.program : program, problems };
}

export interface RuleProgramResult { program: LadderProgram; explanation: string; reasoning: null; source: 'ai' | 'rules'; notes: string[]; aiError?: string }

/** The program for the project: rules' blocks, plus the AI's cycle block when a key is set. Never fails because of the AI. */
export async function generateRuleBasedProgram(o: { ai?: AIConfig; ctx: PlcContext; spec: string; electrical?: ElectricalDesign | null; hmi?: HmiDesign | null }): Promise<RuleProgramResult> {
  const content = projectHmiContent({ io: o.ctx.io, addresses: o.ctx.addresses, machineName: o.hmi?.machineName ?? 'Machine', spec: o.spec, electrical: o.electrical, panel: { partNumber: '', widthPx: 800, heightPx: 480 } });
  // The HMI's own machine states (it may have the cycle's steps from the AI).
  const stateTag = o.hmi?.tags.find((t) => t.role === 'word:state')?.address;
  const stateEl = o.hmi?.screens.flatMap((s) => s.elements).find((e) => e.kind === 'multistate' && e.address === stateTag && e.states?.length);
  if (stateEl?.states) content.states = stateEl.states;
  const base = buildProgram({ content, hmiTags: o.hmi?.tags });
  const ioSet = new Set([...o.ctx.addresses.values()].filter(Boolean));
  const check = (p: LadderProgram) => validateProgram(p, o.ctx.profile, ioSet).filter((i) => i.severity === 'error').map((i) => i.message);
  const notes = [...base.notes];
  let program = base.program, source: RuleProgramResult['source'] = 'rules', aiError: string | undefined, explanation = '';
  const idle = base.autoBits.filter((b) => b.what !== 'run');
  if (o.ai?.apiKey && base.autoBits.length) {
    try {
      const inputs = content.io.filter((p) => p.type === 'input');
      const block = await cycleFromSpec({ ai: o.ai, base, spec: o.spec, profileName: `${o.ctx.profile.vendor} ${o.ctx.profile.name}`, inputs, states: content.states, stateWord: stateTag ?? undefined });
      const merged = mergeCycle(base, block, stateTag, check);
      if (merged.problems.length) throw new Error(`its cycle block was not used: ${merged.problems.slice(0, 3).join('; ')}`);
      program = merged.program; source = 'ai'; explanation = block.explanation;
      for (let i = notes.length - 1; i >= 0; i--) if (/automatic sequence .* not written yet/i.test(notes[i])) notes.splice(i, 1);
    } catch (err) {
      if (o.ai.signal?.aborted) throw err;
      aiError = err instanceof Error ? err.message : String(err);
      notes.unshift(`The AI could not write the cycle (${aiError}): the program has every standard block; ${idle.length ? 'the automatic sequence is still to be written' : 'motors run while the cycle runs'}.`);
    }
  }
  const blocks = program.blocks?.map((b) => b.name).join(', ') ?? '';
  return {
    program, source, aiError, notes, reasoning: null,
    explanation: `${source === 'ai' ? 'Program from the standard blocks with the cycle written from the specification' : 'Program from the standard blocks (rules)'}: ${program.rungs.length} rungs in ${program.blocks?.length ?? 0} blocks (${blocks}).${explanation ? ` Cycle: ${explanation}` : ''}${notes.length ? ` Notes: ${notes.join(' ')}` : ''}`,
  };
}
