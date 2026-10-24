/**
 * "Add comments": every blank rung comment, block description and tag comment of a program filled in plain words
 * (what the rung does, under which conditions, who uses the result). The rules write them from the I/O descriptions
 * and the cross-reference; with a key the AI writes them, a part of the program at a time, and the rules fill in what
 * it leaves out. Only comments change: the logic, the addresses and the comments already there never do (checked).
 */
import type { ProjectSnapshot } from '../../deliverables/collect';
import { programInfo, type ProgramInfo } from '../../deliverables/docs/program';
import { rungWrites, type LadderOutput, type LadderProgram, type Rung } from '../core/ladder';
import { programParts } from '../../lib/ai/budget';
import { callClaude } from '../../lib/ai/anthropic';
import { callOpenAI } from '../../lib/ai/openai';
import type { AIConfig } from '../ai/ladderAI';

export interface CommentResult {
  program: LadderProgram;
  /** How many comments were written, and how many of them by the AI. */
  rungs: number;
  blocks: number;
  tags: number;
  byAi: number;
  /** What the AI could not do (a part that failed): those comments came from the rules. */
  notes: string[];
}

const blank = (s: string | undefined) => !s || !s.trim();
const MAX = 240;
const cut = (s: string) => (s.length <= MAX ? s : `${s.slice(0, MAX - 1).replace(/\s+\S*$/, '')}…`);

/** The program with only its comments, block descriptions and tag comments left out: two programs with the same logic match. */
function logicOf(p: LadderProgram): string {
  return JSON.stringify({
    rungs: p.rungs.map((r) => ({ ...r, comment: '' })),
    blocks: (p.blocks ?? []).map((b) => ({ ...b, description: '' })),
    tags: p.tags.map((t) => ({ ...t, comment: '' })),
    sequence: p.sequence ?? null,
    motion: p.motion ?? null,
  });
}

/** Same logic, addresses, names and order: only comments may differ. */
export const sameLogic = (a: LadderProgram, b: LadderProgram) => logicOf(a) === logicOf(b);

/** Plain words for one output instruction. */
export function outputText(o: LadderOutput, info: ProgramInfo): string {
  switch (o.type) {
    case 'OUT': return `turns on ${info.ref(o.address)}`;
    case 'SET': return `latches ${info.ref(o.address)} ON`;
    case 'RST': return `resets ${info.ref(o.address)}`;
    case 'TMR': return `times ${info.ref(o.address)} (${o.preset} ${o.unit}${o.mode === 'OFF_DELAY' ? ', off-delay' : o.accumulate ? ', keeps its time' : ''})`;
    case 'CNT': return `counts ${info.ref(o.address)} ${o.direction === 'DOWN' ? 'down' : 'up'} to ${o.preset}`;
    case 'COPY': return `copies ${info.ref(o.source)} to ${info.ref(o.dest)}`;
    case 'MATH': return `calculates ${info.ref(o.dest)} = ${o.expression}`;
    case 'RAW': return `runs the kept instruction ${o.text.split('\n')[0].slice(0, 60)}`;
  }
}

/** The rules' comment for one rung: what it does, when, and which rungs use the result. */
export function rungComment(r: Rung, info: ProgramInfo): string {
  const self = r.outputs.find((o): o is Extract<LadderOutput, { address: string }> => 'address' in o)?.address;
  const does = r.outputs.map((o) => outputText(o, info));
  const what = does.length ? does.join(', ') : 'does nothing';
  const when = (r.branches.length ? info.conditionText(r, self) : 'always').replace(/\s+/g, ' ');
  const users = [...new Set(rungWrites(r).filter((a) => info.kind(a) !== 'output').flatMap((a) => info.reads.get(a.toUpperCase()) ?? []))]
    .filter((n) => n !== info.rungNo(r)).sort((x, y) => x - y);
  const used = users.length ? ` Used in rung${users.length > 1 ? 's' : ''} ${users.slice(0, 6).join(', ')}${users.length > 6 ? ' and more' : ''}.` : '';
  return cut(`${what[0].toUpperCase()}${what.slice(1)} when ${when}.${used}`);
}

/** The rules' description of a block: the machine parts it drives. */
function blockDescription(rungs: Rung[], name: string, info: ProgramInfo): string {
  const outs = [...new Set(rungs.flatMap(rungWrites).filter((a) => info.kind(a) === 'output'))].map((a) => info.ref(a));
  const inner = [...new Set(rungs.flatMap(rungWrites).filter((a) => info.kind(a) !== 'output'))];
  if (!outs.length && !inner.length) return `${name}: no outputs.`;
  return cut(`${name}: ${outs.length ? `drives ${outs.slice(0, 4).join(', ')}${outs.length > 4 ? ` and ${outs.length - 4} more outputs` : ''}` : `sets ${inner.length} internal value${inner.length > 1 ? 's' : ''}`} (${rungs.length} rung${rungs.length > 1 ? 's' : ''}).`);
}

/** The rules' comment for an internal tag: where it is written and read. */
function tagComment(address: string, info: ProgramInfo): string {
  const w = info.writes.get(address.toUpperCase()) ?? [], r = info.reads.get(address.toUpperCase()) ?? [];
  const list = (l: number[]) => `${l.slice(0, 5).join(', ')}${l.length > 5 ? ' and more' : ''}`;
  if (!w.length && !r.length) return 'Not used by the program.';
  return [w.length ? `Set in rung${w.length > 1 ? 's' : ''} ${list(w)}` : 'Not set by the program (written from outside: HMI or another device)', r.length ? `read in rung${r.length > 1 ? 's' : ''} ${list(r)}` : 'not read by the program'].join('; ') + '.';
}

interface Targets { rungs: Set<string>; blocks: Set<string>; tags: Set<string> }

/** What gets a comment: the blanks, or everything with `rewrite`. */
function targetsOf(p: LadderProgram, rewrite: boolean): Targets {
  return {
    rungs: new Set(p.rungs.filter((r) => rewrite || blank(r.comment)).map((r) => r.id)),
    blocks: new Set((p.blocks ?? []).filter((b) => rewrite || blank(b.description)).map((b) => b.id)),
    tags: new Set(p.tags.filter((t) => rewrite || blank(t.comment)).map((t) => t.address.toUpperCase())),
  };
}

/** The rules' comments for every target of a program. */
export function rulesComments(p: ProjectSnapshot, rewrite = false): CommentResult {
  return withComments(p, targetsOf(p.ladder, rewrite), new Map(), [], 0);
}

/** Write the comments into a copy: the AI's where it gave one, else the rules'. Checked: only comments changed. */
function withComments(p: ProjectSnapshot, t: Targets, ai: Map<string, string>, notes: string[], byAiBase: number): CommentResult {
  const info = programInfo(p);
  let byAi = byAiBase;
  const pick = (key: string, rules: () => string) => { const a = ai.get(key); if (a) { byAi++; return a; } return rules(); };
  const rungs = p.ladder.rungs.map((r) => (t.rungs.has(r.id) ? { ...r, comment: pick(`rung:${r.id}`, () => rungComment(r, info)) } : r));
  const blocks = p.ladder.blocks?.map((b) => (t.blocks.has(b.id) ? { ...b, description: pick(`block:${b.id}`, () => blockDescription(p.ladder.rungs.filter((r) => r.block === b.id), b.name, info)) } : b));
  const tags = p.ladder.tags.map((tg) => (t.tags.has(tg.address.toUpperCase()) ? { ...tg, comment: pick(`tag:${tg.address.toUpperCase()}`, () => tagComment(tg.address, info)) } : tg));
  const program: LadderProgram = { ...p.ladder, rungs, tags, ...(blocks ? { blocks } : {}) };
  if (!sameLogic(p.ladder, program)) throw new Error('Adding comments would have changed the program: nothing was changed.');
  return { program, rungs: t.rungs.size, blocks: t.blocks.size, tags: t.tags.size, byAi: byAi - byAiBase, notes };
}

export const COMMENTS_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: { type: 'object', properties: { key: { type: 'string' }, text: { type: 'string' } }, required: ['key', 'text'], additionalProperties: false },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

const SYSTEM = `You write comments for a PLC ladder program so that any programmer understands it quickly.
For each item asked, write one or two short plain sentences: what it does, why (the machine part or function it serves), and the conditions in words.
Use the names given (I/O descriptions, tag names), not only addresses. Do not invent devices or behaviour that the logic does not show.
Answer only for the keys listed under "Write comments for", with the exact key.`;

/** One rung as the AI reads it: its key, its place, its comment if kept, and its logic in words (never the program JSON). */
function rungLine(r: Rung, info: ProgramInfo, t: Targets): string {
  const self = r.outputs.find((o): o is Extract<LadderOutput, { address: string }> => 'address' in o)?.address;
  return `rung:${r.id} (rung ${info.rungNo(r)}${r.block ? `, block ${r.block}` : ''})${r.comment && !t.rungs.has(r.id) ? ` [comment: ${r.comment}]` : ''}: ${r.outputs.map((o) => outputText(o, info)).join(', ') || 'no outputs'} WHEN ${r.branches.length ? info.conditionText(r, self) : 'always'}`;
}

/** Characters of rung text in one request: about 100 000 (≈ 30 000 tokens), so a big program takes few calls. */
export const PART_CHARS = 100_000;

/**
 * Comments asked in one request: an answer takes about 35 tokens a comment, so 200 is about 7 000 tokens, well under
 * the task's cap (TASK_MAX_TOKENS.comments, 16 000) with room to think; a cut-off answer would be asked again at 64 000.
 */
export const PART_KEYS = 200;

/** Tokens the answer of a part may take: about 70 per comment asked, plus room to think (low effort); never 64 000. */
export const answerTokens = (keys: number) => Math.min(16_000, Math.max(2_000, 1_500 + 70 * keys));

/** A part split again so none asks more than PART_KEYS comments (its rung, the blank tags it writes, its block). */
function splitByKeys(rungs: Rung[], t: Targets): Rung[][] {
  const out: Rung[][] = [];
  let cur: Rung[] = [];
  let seen = new Set<string>();
  for (const r of rungs) {
    const mine = [
      ...(t.rungs.has(r.id) ? [`rung:${r.id}`] : []),
      ...(r.block && t.blocks.has(r.block) ? [`block:${r.block}`] : []),
      ...rungWrites(r).map((a) => a.toUpperCase()).filter((a) => t.tags.has(a)).map((a) => `tag:${a}`),
    ];
    if (cur.length && seen.size + mine.filter((k) => !seen.has(k)).length > PART_KEYS) { out.push(cur); cur = []; seen = new Set(); }
    cur.push(r);
    for (const k of mine) seen.add(k);
  }
  if (cur.length) out.push(cur);
  return out;
}

/** One part's request: the rungs (logic in words and the listing), the blocks and tags to comment. */
function partRequest(p: ProjectSnapshot, info: ProgramInfo, rungs: Rung[], t: Targets): { text: string; keys: Set<string> } {
  const keys = new Set<string>();
  const lines: string[] = [];
  for (const r of rungs) {
    if (t.rungs.has(r.id)) keys.add(`rung:${r.id}`);
    lines.push(rungLine(r, info, t));
  }
  const blockIds = new Set(rungs.map((r) => r.block).filter(Boolean));
  for (const b of p.ladder.blocks ?? []) if (blockIds.has(b.id) && t.blocks.has(b.id)) { keys.add(`block:${b.id}`); lines.push(`block:${b.id}: block "${b.name}"`); }
  const used = new Set(rungs.flatMap((r) => rungWrites(r).map((a) => a.toUpperCase())));
  for (const tg of p.ladder.tags) {
    const a = tg.address.toUpperCase();
    if (t.tags.has(a) && used.has(a)) { keys.add(`tag:${a}`); lines.push(`tag:${a}: ${tg.nickname} — ${tagComment(a, info)}`); }
  }
  return { keys, text: `Program of ${p.projectName || 'the machine'} (${p.profile.name}).\n\n${lines.join('\n')}\n\nWrite comments for: ${[...keys].join(', ')}` };
}

async function ask(ai: AIConfig, content: string, keys: number): Promise<{ key: string; text: string }[]> {
  const messages = [{ role: 'user' as const, content }];
  const maxTokens = answerTokens(keys);
  const text = ai.provider === 'anthropic'
    ? (await callClaude({ ...ai, task: 'comments', system: SYSTEM, messages, schema: COMMENTS_SCHEMA, maxTokens })).text
    : await callOpenAI({ ...ai, system: SYSTEM, messages, schema: COMMENTS_SCHEMA, maxTokens });
  const parsed = JSON.parse(text) as { items?: { key: string; text: string }[] };
  return Array.isArray(parsed.items) ? parsed.items : [];
}

/**
 * Add comments to the project's program: the AI's (with a key) a part at a time, the rules' for anything it leaves
 * out or a part that fails. `rewrite` writes over the comments already there too.
 */
export async function addComments(p: ProjectSnapshot, o: { ai?: AIConfig; rewrite?: boolean; onProgress?: (done: number, total: number) => void } = {}): Promise<CommentResult> {
  const t = targetsOf(p.ladder, Boolean(o.rewrite));
  if (!o.ai?.apiKey || !p.ladder.rungs.length) return withComments(p, t, new Map(), [], 0);
  const info = programInfo(p);
  // Parts measured in the request's own text (the rung lines), about PART_CHARS each, whole blocks together, and at
  // most PART_KEYS comments asked in each.
  // A rung brings its own line and the lines of the blank tags it writes (asked in its part).
  const tagLine = new Map(p.ladder.tags.filter((tg) => t.tags.has(tg.address.toUpperCase())).map((tg) => [tg.address.toUpperCase(), `tag:${tg.address.toUpperCase()}: ${tg.nickname} — ${tagComment(tg.address, info)}`.length + 1]));
  const cost = (r: Rung) => rungLine(r, info, t).length + 1 + [...new Set(rungWrites(r).map((a) => a.toUpperCase()))].reduce((n, a) => n + (tagLine.get(a) ?? 0), 0);
  const parts = programParts(p.ladder, cost, PART_CHARS).flatMap((rs) => splitByKeys(rs, t))
    .filter((rs) => rs.some((r) => t.rungs.has(r.id) || (r.block && t.blocks.has(r.block)) || rungWrites(r).some((a) => t.tags.has(a.toUpperCase()))));
  const got = new Map<string, string>();
  const notes: string[] = [];
  for (const [k, rungs] of parts.entries()) {
    o.onProgress?.(k, parts.length);
    const req = partRequest(p, info, rungs, t);
    if (!req.keys.size) continue;
    try {
      for (const it of await ask(o.ai, req.text, req.keys.size)) {
        const text = typeof it.text === 'string' ? it.text.replace(/\s+/g, ' ').trim() : '';
        // Only the keys asked for, never another rung's comment; the text short and in one piece.
        if (req.keys.has(it.key) && text) got.set(it.key, cut(text));
      }
    } catch (err) {
      if (o.ai.signal?.aborted) throw err;
      notes.push(`Part ${k + 1} of ${parts.length}: the AI did not answer (${err instanceof Error ? err.message : String(err)}); its comments come from the rules.`);
    }
  }
  o.onProgress?.(parts.length, parts.length);
  return withComments(p, t, got, notes, 0);
}
