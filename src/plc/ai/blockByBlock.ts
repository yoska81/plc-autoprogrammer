/**
 * A change to a program too big for one AI answer, made block by block instead of refused: first the AI picks the
 * blocks the request is about (from their names, descriptions and sizes: a small answer), then each part (whole
 * blocks together while they fit one answer, a block too big for one split by its rungs) goes to the AI on its own,
 * with the I/O it uses and the checker's issues on it, and its answer is put back in place. One proposal at the end,
 * with what changed in each part, for one approval.
 */
import type { LadderProgram, Rung } from '../core/ladder';
import { rungAddresses, rungWrites } from '../core/ladder';
import type { ValidationIssue } from '../core/validate';
import { approxTokens, programParts, programSlice, PROGRAM_OUT_TOKENS } from '../../lib/ai/budget';
import { callClaude, type ChatTurn } from '../../lib/ai/anthropic';
import { callOpenAI } from '../../lib/ai/openai';
import { GENERAL_BLOCK } from '../sim/blocks';
import { reviseLadder, type AIConfig, type PlcContext } from './ladderAI';

/** A block of the program as the picker sees it. */
export interface BlockInfo { id: string; name: string; description: string; rungs: number }

/** The program's blocks (the rungs of none as "General"), in program order, with their rung counts. */
export function blocksOf(program: LadderProgram): BlockInfo[] {
  const ids = new Set((program.blocks ?? []).map((b) => b.id));
  const blockOf = (r: Rung) => (r.block && ids.has(r.block) ? r.block : GENERAL_BLOCK);
  const count = new Map<string, number>();
  for (const r of program.rungs) count.set(blockOf(r), (count.get(blockOf(r)) ?? 0) + 1);
  const named = (program.blocks ?? []).filter((b) => count.has(b.id)).map((b) => ({ id: b.id, name: b.name, description: b.description ?? '', rungs: count.get(b.id)! }));
  return count.has(GENERAL_BLOCK) ? [...named, { id: GENERAL_BLOCK, name: 'General', description: 'Rungs in no block', rungs: count.get(GENERAL_BLOCK)! }] : named;
}

const PICK_SCHEMA = {
  type: 'object',
  properties: {
    blocks: { type: 'array', items: { type: 'string' } },
    all: { type: 'boolean' },
    why: { type: 'string' },
  },
  required: ['blocks', 'all', 'why'],
  additionalProperties: false,
} as const;

/** The blocks a request is about: their ids, or all of them ("comment every rung", "go through the whole program"). */
export async function pickBlocks(ai: AIConfig, blocks: BlockInfo[], request: string, signal?: AbortSignal): Promise<{ ids: string[]; why: string }> {
  const system = 'You route a change request for a PLC program to the blocks (program parts) it is about. Answer with the ids of those blocks. If the request is about the whole program (every rung, every block, a rename everywhere, "go through all of it", "block by block"), set "all": true. Choose no block only when the request is not about the program at all.';
  const content = `Blocks (id | name | rungs | what it does):\n${blocks.map((b) => `${b.id} | ${b.name} | ${b.rungs} | ${b.description || '-'}`).join('\n')}\n\nRequest:\n${request}`;
  const messages: ChatTurn[] = [{ role: 'user', content }];
  const text = ai.provider === 'anthropic'
    ? (await callClaude({ ...ai, signal, task: 'program', system, messages, schema: PICK_SCHEMA, maxTokens: 4000 })).text
    : await callOpenAI({ ...ai, signal, system, messages, schema: PICK_SCHEMA });
  let parsed: { blocks: string[]; all: boolean; why: string };
  try { parsed = JSON.parse(text); } catch (err) { throw new Error('The AI\'s choice of blocks could not be read. Please try again.', { cause: err }); }
  const known = new Set(blocks.map((b) => b.id));
  return { ids: parsed.all ? blocks.map((b) => b.id) : parsed.blocks.filter((id) => known.has(id)), why: parsed.why };
}

/** The I/O of the context that these rungs use (each part is sent with its own I/O only). */
function ctxFor(ctx: PlcContext, rungs: Rung[]): PlcContext {
  const used = new Set(rungs.flatMap((r) => [...rungAddresses(r), ...rungWrites(r)]).map((a) => a.toUpperCase()));
  return { ...ctx, io: ctx.io.filter((pt) => used.has((ctx.addresses.get(pt.id) ?? '').toUpperCase())) };
}

/** A part's answer put back in place: its rungs replace the part's rungs (new ones after them, in its block); its tags join the program's. */
export function mergePart(full: LadderProgram, partIds: string[], edited: LadderProgram): LadderProgram {
  const ids = new Set(partIds);
  const first = full.rungs.findIndex((r) => ids.has(r.id));
  const block = first >= 0 ? full.rungs[first].block : undefined;
  const mine = edited.rungs.map((r) => (r.block === undefined && block !== undefined ? { ...r, block } : r));
  const rest = full.rungs.filter((r) => !ids.has(r.id));
  const pos = first < 0 ? rest.length : full.rungs.slice(0, first).filter((r) => !ids.has(r.id)).length;
  const tags = new Map(full.tags.map((t) => [t.address.toUpperCase(), t]));
  for (const t of edited.tags ?? []) tags.set(t.address.toUpperCase(), t);
  return { ...full, rungs: [...rest.slice(0, pos), ...mine, ...rest.slice(pos)], tags: [...tags.values()] };
}

/** The conversation for each part: the opening turn, then the last few turns (alternating, ending before the request). */
function shortHistory(history: ChatTurn[]): ChatTurn[] {
  if (!history.length) return [];
  const turns = history.slice(1).slice(-4);
  while (turns.length && turns[0].role !== 'assistant') turns.shift();
  while (turns.length && turns[turns.length - 1].role !== 'assistant') turns.pop();
  return [history[0], ...turns];
}

export interface ByBlocksResult { program: LadderProgram | null; explanation: string; reasoning: null }

/**
 * The change, part by part. `onlyBlock`: a block the user chose (too big for one answer itself): only its parts.
 * `stage` says where it is ("Block 3 of 12: Conveyor"). Stops at the signal (nothing kept).
 */
export async function reviseByBlocks(
  ai: AIConfig, ctx: PlcContext, program: LadderProgram, issues: ValidationIssue[], history: ChatTurn[], request: string,
  o: {
    signal?: AbortSignal; stage?: (text: string) => void; onlyBlock?: string | null;
    /** Stand-ins for the AI calls (tests). */
    deps?: { pick?: typeof pickBlocks; revise?: typeof reviseLadder };
  },
): Promise<ByBlocksResult> {
  const pick = o.deps?.pick ?? pickBlocks, revise = o.deps?.revise ?? reviseLadder;
  const blocks = blocksOf(program);
  let ids: string[], why = '';
  if (o.onlyBlock) ids = [o.onlyBlock];
  else {
    o.stage?.(`The program has ${program.rungs.length} rungs in ${blocks.length} blocks: finding the blocks your request is about…`);
    ({ ids, why } = await pick(ai, blocks, request, o.signal));
  }
  if (!ids.length) return { program: null, explanation: `No block of the program is about this request${why ? `: ${why}` : '.'} Ask again naming the part of the machine, or choose a block in the list on the left.`, reasoning: null };
  const chosen = new Set(ids);
  const known = new Set((program.blocks ?? []).map((b) => b.id));
  const inChosen = (r: Rung) => chosen.has(r.block && known.has(r.block) ? r.block : GENERAL_BLOCK);
  // whole blocks together while they fit one answer; a block too big for one, by its rungs
  const parts = programParts({ ...program, rungs: program.rungs.filter(inChosen) }, (r) => approxTokens(JSON.stringify(r)), Math.round(PROGRAM_OUT_TOKENS * 0.8));
  const nameOf = new Map(blocks.map((b) => [b.id, b.name]));
  const partName = (rungs: Rung[]) => [...new Set(rungs.map((r) => nameOf.get(r.block && known.has(r.block) ? r.block : GENERAL_BLOCK) ?? 'General'))].join(', ');
  const short = shortHistory(history);
  let current = program;
  const said: string[] = [];
  let changed = 0;
  for (const [i, rungs] of parts.entries()) {
    if (o.signal?.aborted) throw new DOMException('Stopped', 'AbortError');
    const name = partName(rungs);
    o.stage?.(`Part ${i + 1} of ${parts.length}: ${name} (${rungs.length} rungs)…`);
    // the part as it is now (an earlier part's change may have touched its tags)
    const now = current.rungs.filter((r) => rungs.some((x) => x.id === r.id));
    const slice = programSlice(current, now);
    const sentIds = new Set(now.map((r) => r.id));
    const partIssues = issues.filter((x) => x.rungId && sentIds.has(x.rungId));
    const ask = `${request}\n\n(The program is too big to send at once, so it is changed part by part: this is part ${i + 1} of ${parts.length}, "${name}", ${now.length} rungs. Change only what the request asks for in these rungs and return all of them. If nothing in this part needs to change, return "program": null.)`;
    const r = await revise({ ...ai, signal: o.signal }, ctxFor(ctx, now), slice, partIssues, short, ask);
    if (r.program) {
      current = mergePart(current, now.map((x) => x.id), r.program);
      changed++;
      said.push(`• ${name}: ${r.explanation}`);
    }
  }
  if (!changed) return { program: null, explanation: `Went through ${parts.length} part${parts.length === 1 ? '' : 's'} (${[...chosen].map((id) => nameOf.get(id) ?? id).join(', ')}): nothing needed to change.`, reasoning: null };
  return {
    program: current,
    explanation: `Changed block by block (${changed} of ${parts.length} part${parts.length === 1 ? '' : 's'} changed${why ? `; ${why}` : ''}):\n${said.join('\n')}`,
    reasoning: null,
  };
}
