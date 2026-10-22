/**
 * "Explain the program": one short page per block, in plain words, from the program itself (no AI needed): what the
 * block does, the field inputs it reads and the outputs it drives, what it takes from and gives to the other blocks,
 * its timers and counters, the steps of a step sequence (a register compared with step numbers and moved to the next
 * one), the alarms it sets, and what the app could not read. The AI may add a summary paragraph per block (aiSummary).
 */
import type { ProjectSnapshot } from '../../deliverables/collect';
import { alarmRows, programInfo, type ProgramInfo } from '../../deliverables/docs/program';
import { rungWrites, type LadderElement, type LadderOutput, type Rung } from '../core/ladder';
import { COMMENTS_SCHEMA, outputText } from './comments';
import { callClaude } from '../../lib/ai/anthropic';
import { callOpenAI } from '../../lib/ai/openai';
import type { AIConfig } from '../ai/ladderAI';

export interface StepExplanation { step: string; does: string[]; next: string[] }

export interface BlockExplanation {
  id: string;
  name: string;
  /** What it does: the block's description, or one made from what it drives. */
  what: string;
  /** "rungs 12–30" */
  rungs: string;
  rungCount: number;
  /** Field inputs it reads ("Start PB (X001)"). */
  inputs: string[];
  /** Field outputs it drives, each with when ("Conveyor (Y001): on while …"). */
  outputs: string[];
  /** Internal values it reads that other blocks write, with those blocks. */
  uses: string[];
  /** Internal values it writes that other blocks read, with those blocks. */
  gives: string[];
  timers: string[];
  counters: string[];
  /** A step sequence: the register and each step. */
  sequence: { register: string; steps: StepExplanation[] } | null;
  alarms: string[];
  /** Rungs kept as instructions of the original PLC (not explained). */
  notRead: string[];
  /** The AI's summary paragraph, when asked for (Explain with AI). */
  aiSummary?: string;
}

export interface ProgramExplanation { title: string; overview: string[]; blocks: BlockExplanation[] }

const GENERAL = '';
const list = (xs: Iterable<string>) => [...new Set(xs)];
const range = (nums: number[]) => {
  if (!nums.length) return 'no rungs';
  const runs: string[] = [];
  for (let i = 0; i < nums.length;) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    runs.push(i === j ? String(nums[i]) : `${nums[i]}–${nums[j]}`);
    i = j + 1;
  }
  return `rung${nums.length > 1 ? 's' : ''} ${runs.join(', ')}`;
};
const hasRaw = (r: Rung) => r.outputs.some((o) => o.type === 'RAW') || r.branches.some((b) => b.some((e) => e.type === 'RAW'));
/** The first kept instruction of a rung, its first line. */
function rawText(r: Rung): string {
  for (const o of r.outputs) if (o.type === 'RAW') return o.text.split('\n')[0];
  for (const b of r.branches) for (const e of b) if (e.type === 'RAW') return e.text.split('\n')[0];
  return 'kept instruction';
}
const fieldInput = (info: ProgramInfo, a: string) => info.kind(a) === 'input';
const fieldOutput = (info: ProgramInfo, a: string) => info.kind(a) === 'output';

/** What a rung reads (contacts, compares, presets, sources): addresses only. */
function readsOf(r: Rung): string[] {
  const out: string[] = [];
  const add = (a?: string | null) => { if (a && /^[A-Za-z_]/.test(a.trim())) out.push(a.trim().toUpperCase()); };
  for (const b of r.branches) for (const el of b) { if (el.type === 'CMP') { add(el.left); add(el.right); } else if (el.type !== 'RAW') add(el.address); }
  for (const o of r.outputs) {
    if (o.type === 'TMR' || o.type === 'CNT') { add(o.preset); add(o.resetAddress); }
    if (o.type === 'COPY') add(o.source);
    if (o.type === 'MATH') for (const t of o.expression.match(/[A-Za-z]+\d+/g) ?? []) add(t);
  }
  return out;
}

/** A word compared with three or more step numbers in the block and moved to them: its step register. */
function stepRegister(rungs: Rung[], declared?: string): string | null {
  const seen = new Map<string, Set<string>>();
  for (const r of rungs) for (const b of r.branches) for (const el of b) {
    if (el.type !== 'CMP' || el.op !== '==') continue;
    const [reg, n] = /^-?\d+$/.test(el.right.trim()) ? [el.left, el.right] : /^-?\d+$/.test(el.left.trim()) ? [el.right, el.left] : [null, null];
    if (!reg || !n) continue;
    const k = reg.trim().toUpperCase();
    (seen.get(k) ?? seen.set(k, new Set()).get(k)!).add(n.trim());
  }
  const moved = (reg: string) => rungs.some((r) => r.outputs.some((o) => o.type === 'COPY' && o.dest.trim().toUpperCase() === reg && /^-?\d+$/.test(o.source.trim())));
  if (declared && seen.has(declared.toUpperCase())) return declared.toUpperCase();
  let best: string | null = null;
  for (const [reg, ns] of seen) if (ns.size >= 3 && moved(reg) && (!best || ns.size > seen.get(best)!.size)) best = reg;
  return best;
}

/** The steps: for each step number, what runs in it and where it goes next (and when). */
function stepsOf(rungs: Rung[], reg: string, info: ProgramInfo): StepExplanation[] {
  const isStep = (el: LadderElement, n?: string) => el.type === 'CMP' && el.op === '==' && ((el.left.trim().toUpperCase() === reg && (!n || el.right.trim() === n)) || (el.right.trim().toUpperCase() === reg && (!n || el.left.trim() === n)));
  const numOf = (el: LadderElement) => (el.type === 'CMP' ? (el.left.trim().toUpperCase() === reg ? el.right : el.left).trim() : '');
  const nums = list(rungs.flatMap((r) => r.branches.flatMap((b) => b.filter((el) => isStep(el)).map(numOf)))).sort((a, b) => Number(a) - Number(b));
  return nums.map((n) => {
    const does: string[] = [], next: string[] = [];
    for (const r of rungs) for (const b of r.branches) {
      if (!b.some((el) => isStep(el, n))) continue;
      // The rung's conditions without the step compare itself.
      const rest: Rung = { ...r, branches: [b.filter((el) => !isStep(el, n))] };
      const when = rest.branches[0].length ? info.conditionText(rest) : '';
      for (const o of r.outputs) {
        if (o.type === 'COPY' && o.dest.trim().toUpperCase() === reg) next.push(`to step ${o.source.trim()}${when ? ` when ${when}` : ''}`);
        else if (o.type !== 'RAW') does.push(`${outputText(o, info)}${when ? ` (when ${when})` : ''}`);
      }
    }
    return { step: n, does: list(does), next: list(next) };
  });
}

/** The AI's summary of a block, with the fingerprint of the block's logic it was written for. */
export interface AiBlockSummary { fp: string; text: string }
export type AiSummaries = Record<string, AiBlockSummary>;

/** A short hash of a block's logic (not its comments): a summary is shown only while the logic is the same. */
export function blockFingerprint(rungs: Rung[]): string {
  const t = JSON.stringify(rungs.map((r) => [r.branches, r.outputs]));
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `${rungs.length}:${(h >>> 0).toString(16)}`;
}

export function explainProgram(p: ProjectSnapshot, ai: AiSummaries = {}): ProgramExplanation {
  const info = programInfo(p);
  const l = p.ladder;
  const blockOf = (r: Rung) => (r.block && (l.blocks ?? []).some((b) => b.id === r.block) ? r.block : GENERAL);
  const defs = [...(l.blocks ?? []).map((b) => ({ id: b.id, name: b.name, description: b.description, never: b.called === false })), ...(l.rungs.some((r) => blockOf(r) === GENERAL) ? [{ id: GENERAL, name: 'General', description: '', never: false }] : [])];
  const nameOf = new Map(defs.map((b) => [b.id, b.name] as const));
  // Which blocks write and read each address.
  const writers = new Map<string, Set<string>>(), readers = new Map<string, Set<string>>();
  for (const r of l.rungs) {
    for (const a of rungWrites(r)) { const k = a.trim().toUpperCase(); (writers.get(k) ?? writers.set(k, new Set()).get(k)!).add(blockOf(r)); }
    for (const a of readsOf(r)) (readers.get(a) ?? readers.set(a, new Set()).get(a)!).add(blockOf(r));
  }
  const alarms = alarmRows(p, info);
  const blocks = defs.map((d): BlockExplanation => {
    const rungs = l.rungs.filter((r) => blockOf(r) === d.id);
    const nums = rungs.map((r) => info.rungNo(r));
    const writes = list(rungs.flatMap((r) => rungWrites(r).map((a) => a.trim().toUpperCase())));
    const reads = list(rungs.flatMap(readsOf));
    const outputs: string[] = [];
    for (const r of rungs) for (const o of r.outputs) {
      if ((o.type === 'OUT' || o.type === 'SET' || o.type === 'RST') && fieldOutput(info, o.address)) {
        const when = info.conditionText(r, o.address) || 'always';
        outputs.push(`${info.ref(o.address)}: ${o.type === 'OUT' ? 'on while' : o.type === 'SET' ? 'switched on when' : 'switched off when'} ${when} (rung ${info.rungNo(r)})`);
      }
    }
    const others = (m: Map<string, Set<string>>, a: string) => [...(m.get(a) ?? [])].filter((b) => b !== d.id).map((b) => nameOf.get(b) ?? 'General');
    const uses = reads.filter((a) => !fieldInput(info, a) && !writes.includes(a) && others(writers, a).length).map((a) => `${info.ref(a)} from ${others(writers, a).join(', ')}`);
    const gives = writes.filter((a) => !fieldOutput(info, a) && others(readers, a).length).map((a) => `${info.ref(a)} to ${others(readers, a).join(', ')}`);
    const timers = rungs.flatMap((r) => r.outputs.filter((o): o is Extract<LadderOutput, { type: 'TMR' }> => o.type === 'TMR').map((o) => `${info.ref(o.address)}: ${o.preset} ${o.unit}${o.mode === 'OFF_DELAY' ? ' off-delay' : ''}, runs while ${info.conditionText(r) || 'always'}`));
    const counters = rungs.flatMap((r) => r.outputs.filter((o): o is Extract<LadderOutput, { type: 'CNT' }> => o.type === 'CNT').map((o) => `${info.ref(o.address)}: counts ${o.direction === 'DOWN' ? 'down' : 'up'} to ${o.preset} when ${info.conditionText(r) || 'always'}${o.resetAddress ? `; reset by ${info.ref(o.resetAddress)}` : ''}`));
    const reg = stepRegister(rungs, l.sequence?.register);
    const fieldOuts = list(writes.filter((a) => fieldOutput(info, a)).map((a) => info.name(a) || a));
    // An import's own description ("Imported from … routine …") says nothing about what the block does.
    const own = /^Imported from /.test(d.description.trim()) ? '' : d.description.trim();
    const what = (d.never ? 'Never runs on the original PLC (no call names this routine). ' : '') + (own
      || (reg ? `Runs a step sequence (${info.ref(reg)})${fieldOuts.length ? ` driving ${fieldOuts.slice(0, 4).join(', ')}${fieldOuts.length > 4 ? ` and ${fieldOuts.length - 4} more` : ''}` : ''}.`
        : fieldOuts.length ? `Drives ${fieldOuts.slice(0, 4).join(', ')}${fieldOuts.length > 4 ? ` and ${fieldOuts.length - 4} more outputs` : ''}.`
          : `Internal logic: ${list(rungs.map((r) => r.comment.split(/[.;]/)[0].trim()).filter(Boolean)).slice(0, 3).join('; ') || `${rungs.length} ${rungs.length === 1 ? 'rung' : 'rungs'} other blocks use`}.`));
    const summary = ai[d.id];
    return {
      id: d.id, name: d.name, what, rungs: range(nums), rungCount: rungs.length,
      ...(summary && summary.fp === blockFingerprint(rungs) ? { aiSummary: summary.text } : {}),
      inputs: reads.filter((a) => fieldInput(info, a)).map(info.ref),
      outputs: list(outputs),
      uses: list(uses), gives: list(gives), timers, counters,
      sequence: reg ? { register: info.ref(reg), steps: stepsOf(rungs, reg, info) } : null,
      alarms: alarms.filter((a) => writes.includes(a.address)).map((a) => `${a.message} (${a.address}): ${a.cause.split('\n')[0]}`),
      notRead: rungs.filter(hasRaw).map((r) => `rung ${info.rungNo(r)}: ${rawText(r)}${r.comment.trim() ? ` (${r.comment.trim()})` : ''}`),
    };
  });
  const io = p.io.length;
  const overview = [
    `${p.projectName || 'The machine'}: ${l.rungs.length} rungs in ${blocks.length} block${blocks.length === 1 ? '' : 's'} on ${p.profile.vendor} ${p.profile.name}${io ? `, ${p.io.filter((x) => x.type === 'input').length} inputs and ${p.io.filter((x) => x.type === 'output').length} outputs` : ''}.`,
    `Blocks: ${blocks.map((b) => `${b.name} (${b.rungs})`).join('; ')}.`,
    ...(blocks.some((b) => b.notRead.length) ? [(() => { const n = blocks.reduce((k, b) => k + b.notRead.length, 0); return `${n} ${n === 1 ? 'rung uses' : 'rungs use'} instructions of the old PLC that the app cannot read; ${n === 1 ? 'it is' : 'they are'} listed in ${n === 1 ? 'its block' : 'their blocks'} and explained only by ${n === 1 ? 'its comment' : 'their comments'}.`; })()] : []),
  ];
  return { title: `How the program works: ${p.projectName || 'machine'}`, overview, blocks };
}

/** The explanation as plain text (Markdown-like), one section per block: for the clipboard and the AI. */
export function explanationText(x: ProgramExplanation): string {
  const out: string[] = [`# ${x.title}`, '', ...x.overview, ''];
  const sec = (title: string, items: string[]) => { if (items.length) out.push(`${title}:`, ...items.map((i) => `- ${i}`)); };
  for (const b of x.blocks) {
    out.push(`## ${b.name} (${b.rungs})`, b.aiSummary ? `${b.aiSummary}` : '', b.what);
    sec('Reads from the machine', b.inputs);
    sec('Drives', b.outputs);
    sec('Uses from other blocks', b.uses);
    sec('Gives to other blocks', b.gives);
    sec('Timers', b.timers);
    sec('Counters', b.counters);
    if (b.sequence) sec(`Steps (${b.sequence.register})`, b.sequence.steps.map((s) => `step ${s.step}: ${s.does.join('; ') || 'waits'}${s.next.length ? `; ${s.next.join('; or ')}` : ''}`));
    sec('Alarms', b.alarms);
    sec('Instructions the app cannot read (kept as they were)', b.notRead);
    out.push('');
  }
  return out.filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
}

/** Characters of one AI request (about 30 000 tokens) and blocks asked in it (a paragraph each, about 150 tokens). */
export const EXPLAIN_PART_CHARS = 100_000;
export const EXPLAIN_PART_BLOCKS = 40;
/** A block's own text in the request: the rules' explanation and its rungs in words, cut at this length. */
const BLOCK_CHARS = 20_000;

const SYSTEM = `You explain a PLC program to a maintenance technician or a programmer who has never seen it.
For each block asked, write one short paragraph (3 to 5 plain sentences): what the block is for on the machine, how it works (the order things happen, what starts and stops it, what it waits for), and what it hands to other blocks. Use the names given, not only addresses. Do not invent devices or behaviour that the text does not show.
Answer only for the keys listed under "Explain", with the exact key.`;

/** One block as the AI reads it: the rules' explanation and each rung in words (never the program JSON). */
function blockText(info: ProgramInfo, b: BlockExplanation, rungs: Rung[]): string {
  const rules = explanationText({ title: '', overview: [], blocks: [{ ...b, aiSummary: undefined }] }).replace(/^# \n+/, '');
  const lines = rungs.map((r) => `rung ${info.rungNo(r)}${r.comment.trim() ? ` [${r.comment.trim()}]` : ''}: ${r.outputs.map((o) => outputText(o, info)).join(', ') || 'no outputs'} WHEN ${r.branches.length ? info.conditionText(r) : 'always'}`);
  const t = `block:${b.id || 'general'}\n${rules}\nRungs:\n${lines.join('\n')}`;
  return t.length <= BLOCK_CHARS ? t : `${t.slice(0, BLOCK_CHARS)}\n(… the rest of this block's rungs left out)`;
}

/**
 * The AI's paragraph for each block: blocks grouped into requests of about EXPLAIN_PART_CHARS and at most
 * EXPLAIN_PART_BLOCKS, only {key, text} asked back. A part that fails is left to the rules (a note says so).
 */
export async function explainWithAi(p: ProjectSnapshot, ai: AIConfig, onProgress?: (done: number, total: number) => void): Promise<{ summaries: AiSummaries; notes: string[] }> {
  const info = programInfo(p);
  const x = explainProgram(p);
  const blockOf = (r: Rung) => (r.block && (p.ladder.blocks ?? []).some((b) => b.id === r.block) ? r.block : GENERAL);
  const items = x.blocks.map((b) => { const rungs = p.ladder.rungs.filter((r) => blockOf(r) === b.id); return { b, rungs, text: blockText(info, b, rungs) }; });
  const parts: (typeof items)[] = [];
  let cur: typeof items = [], size = 0;
  for (const it of items) {
    if (cur.length && (size + it.text.length > EXPLAIN_PART_CHARS || cur.length >= EXPLAIN_PART_BLOCKS)) { parts.push(cur); cur = []; size = 0; }
    cur.push(it); size += it.text.length;
  }
  if (cur.length) parts.push(cur);
  const summaries: AiSummaries = {}, notes: string[] = [];
  for (const [k, part] of parts.entries()) {
    onProgress?.(k, parts.length);
    const keys = new Map<string, (typeof part)[number]>(part.map((it) => [`block:${it.b.id || 'general'}`, it]));
    const content = `Program of ${p.projectName || 'the machine'} (${p.profile.vendor} ${p.profile.name}).\n\n${part.map((it) => it.text).join('\n\n')}\n\nExplain: ${[...keys.keys()].join(', ')}`;
    const maxTokens = Math.min(16_000, 2_000 + 300 * keys.size);
    try {
      const messages = [{ role: 'user' as const, content }];
      const text = ai.provider === 'anthropic'
        ? (await callClaude({ ...ai, task: 'comments', system: SYSTEM, messages, schema: COMMENTS_SCHEMA, maxTokens })).text
        : await callOpenAI({ ...ai, system: SYSTEM, messages, schema: COMMENTS_SCHEMA, maxTokens });
      const parsed = JSON.parse(text) as { items?: { key: string; text: string }[] };
      for (const it of parsed.items ?? []) {
        const got = keys.get(it.key);
        const t = typeof it.text === 'string' ? it.text.replace(/\s+/g, ' ').trim() : '';
        if (got && t) summaries[got.b.id] = { fp: blockFingerprint(got.rungs), text: t.slice(0, 1200) };
      }
    } catch (err) {
      if (ai.signal?.aborted) throw err;
      notes.push(`Part ${k + 1} of ${parts.length}: the AI did not answer (${err instanceof Error ? err.message : String(err)}); those blocks keep the explanation from the program alone.`);
    }
  }
  onProgress?.(parts.length, parts.length);
  return { summaries, notes };
}
