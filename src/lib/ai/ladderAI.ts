import type { IOPoint } from '../../types/io';
import type { AIProvider, Effort } from '../../store/useSettingsStore';
import type { CpuModel, PlcProfile } from '../../plc/profile';
import { newRungId, type LadderProgram } from '../../plc/ladder';
import { LADDER_RESPONSE_SCHEMA } from '../../plc/schema';
import type { ValidationIssue } from '../../plc/validate';
import { callClaude, type ChatTurn } from './anthropic';
import { callOpenAI } from './openai';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  effort: Effort;
}

export interface PlcContext {
  profile: PlcProfile;
  cpu: CpuModel;
  io: IOPoint[];
  /** I/O point id -> PLC address. */
  addresses: Map<string, string>;
  /** Field wiring from the electrical design (address -> device), when known. */
  wiring?: Map<string, { deviceTag: string; deviceType: string }>;
}

export interface LadderAIResult {
  explanation: string;
  /** null when the AI answered a question without changing the program. */
  program: LadderProgram | null;
  reasoning: string | null;
}

function systemPrompt(ctx: PlcContext): string {
  return `You are a senior controls engineer. You write ladder logic for a ${ctx.profile.vendor} ${ctx.profile.name} PLC (CPU: ${ctx.cpu.label}) that will run a real machine, so correctness and safety matter more than brevity.

You also act as the maintenance engineer for this program: the user describes what the machine should do, or what is wrong with it, and you write or change the program for them. The user may never read the code, so your explanation is how they understand what you did.

${ctx.profile.promptKnowledge(ctx.cpu)}

How to write the program:
- Physical I/O: use only the addresses in the I/O list. If the logic needs a signal that is not in the list, use an internal bit instead and say in the explanation which physical signal is missing.
- Safety first: the first rungs build a safety-OK bit from the safety inputs (E-stop, guards, light curtains, safety relay, air/power OK). Every rung that drives a motion or process output includes that bit. On loss of safety, outputs drop and the sequence returns to its idle step.
- Use start/stop seal-in circuits for run commands, with the stop condition in series.
- Multi-step processes: a step sequencer with one step value or step bit per state, a timeout timer on every step that waits for feedback, and a fault bit that latches on timeout and is cleared by the reset input.
- Drive each output with exactly one OUT coil in the whole program (no double coils). Use SET/RST pairs only for latches.
- Give every rung a short comment a technician can understand.
- List every internal address you use (bits, timers, counters, registers) in "tags" with a short nickname (no spaces, max 24 characters) and a comment.
- Keep the program as simple as the machine allows.

When you change an existing program:
- Keep the "id" of every rung you keep (edited or not). Give new rungs ids like "new-1", "new-2".
- Change only what is needed for the request; don't rewrite rungs that already work.
- If the request is only a question, answer it and return "program": null.

"explanation": plain language for the operator, no code. Say what the program does or what you changed and why, list any assumptions, and list what to check on the machine before running it.`;
}

function ioTable(ctx: PlcContext): string {
  if (!ctx.io.length) return '(no I/O defined yet)';
  return ctx.io
    .map((p) => {
      const a = ctx.addresses.get(p.id) || '';
      const w = a ? ctx.wiring?.get(a) : undefined;
      return `${a || '(unassigned)'}\t${p.type}\t${p.category}\t${p.description || '(no description)'}${w ? `\tfield device ${w.deviceTag} (${w.deviceType})` : ''}`;
    })
    .join('\n');
}

/** Make AI output safe to store: unique rung ids, trimmed upper-case addresses. */
function normalize(program: LadderProgram): LadderProgram {
  const seen = new Set<string>();
  const up = (s: string) => s.trim().toUpperCase();
  return {
    tags: program.tags.map((t) => ({ ...t, address: up(t.address) })),
    rungs: program.rungs.map((r) => {
      const id = !r.id || seen.has(r.id) || r.id.startsWith('new-') ? newRungId() : r.id;
      seen.add(id);
      return {
        ...r,
        id,
        branches: r.branches.map((b) => b.map((el) =>
          el.type === 'CMP' ? { ...el, left: up(el.left), right: up(el.right) } : { ...el, address: up(el.address) })),
        outputs: r.outputs.map((o) => {
          switch (o.type) {
            case 'COPY': return { ...o, source: up(o.source), dest: up(o.dest) };
            case 'MATH': return { ...o, dest: up(o.dest) };
            case 'TMR': case 'CNT':
              return { ...o, address: up(o.address), preset: up(o.preset), resetAddress: o.resetAddress ? up(o.resetAddress) : null };
            default: return { ...o, address: up(o.address) };
          }
        }),
      };
    }),
  };
}

async function run(ai: AIConfig, system: string, messages: ChatTurn[]): Promise<LadderAIResult> {
  let text: string;
  let reasoning: string | null = null;
  if (ai.provider === 'anthropic') {
    ({ text, reasoning } = await callClaude({ ...ai, system, messages, schema: LADDER_RESPONSE_SCHEMA }));
  } else {
    text = await callOpenAI({ ...ai, system, messages, schema: LADDER_RESPONSE_SCHEMA });
  }

  let parsed: { explanation: string; program: LadderProgram | null };
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error('The AI returned a program the app could not read. Please try again.', { cause: err });
  }
  return {
    explanation: parsed.explanation,
    program: parsed.program ? normalize(parsed.program) : null,
    reasoning,
  };
}

export function generateLadder(ai: AIConfig, ctx: PlcContext, description: string): Promise<LadderAIResult> {
  const content = `I/O list (address, type, category, description, field device if known):\n${ioTable(ctx)}\n\nWhat the machine must do:\n${description}\n\nWrite the complete program.`;
  return run(ai, systemPrompt(ctx), [{ role: 'user', content }]);
}

/**
 * Continue the fix-it conversation. `history` holds earlier requests and the
 * AI's explanations; the current program (which may include manual edits) and
 * its validation issues are always sent fresh.
 */
export function reviseLadder(
  ai: AIConfig,
  ctx: PlcContext,
  program: LadderProgram,
  issues: ValidationIssue[],
  history: ChatTurn[],
  request: string,
): Promise<LadderAIResult> {
  const issueText = issues.length
    ? issues.map((i) => `- [${i.severity}] ${i.rungId ? `rung ${i.rungId}: ` : ''}${i.message}`).join('\n')
    : '(none)';
  const content = `I/O list (address, type, category, description, field device if known):\n${ioTable(ctx)}\n\nCurrent program (JSON, includes any manual edits):\n${JSON.stringify(program)}\n\nIssues the app's checker found:\n${issueText}\n\nRequest:\n${request}`;
  return run(ai, systemPrompt(ctx), [...history, { role: 'user', content }]);
}
