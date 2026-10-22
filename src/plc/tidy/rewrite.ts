/**
 * "Simplify blocks with AI": the AI rewrites one block at a time in a simpler shape (only that block is sent and
 * written back), and a rewrite is kept only when
 *  - it writes nothing the block did not write before and adds no instruction the simulator cannot run,
 *  - it is simpler (fewer rungs + contacts + instructions),
 *  - the checker finds no new error, and
 *  - the behaviour check finds 0 differences against the program as it is with the blocks kept so far.
 * Everything else is dropped with its reason. The blocks kept come together as one proposal to approve.
 */
import type { ProjectSnapshot } from '../../deliverables/collect';
import { approxTokens, programSlice } from '../../lib/ai/budget';
import { rewriteBlockLadder, type AIConfig, type PlcContext } from '../ai/ladderAI';
import { rungAddresses, rungWrites, type LadderProgram, type Rung } from '../core/ladder';
import { validateProgram } from '../core/validate';
import { rungDeps } from './deps';
import { equivalenceSummary, type EquivalenceOptions, type EquivalenceResult } from './equivalence';
import { externalAddresses } from './reorganize';

/** A block's program JSON the AI may get and write back (about 8,000 tokens): its answer stays well under the cap. */
export const BLOCK_TOKENS = 8_000;

export interface RewriteCandidate { id: string; name: string; rungs: number; ok: boolean; why?: string }
export interface KeptRewrite { id: string; name: string; before: number; after: number; rungsBefore: number; rungsAfter: number; summary: string; explanation: string }
export interface DroppedRewrite { id: string; name: string; why: string }
export interface RewriteResult { program: LadderProgram; kept: KeptRewrite[]; dropped: DroppedRewrite[]; final: EquivalenceResult | null }

type Check = (a: LadderProgram, b: LadderProgram, o: Omit<EquivalenceOptions, 'onProgress' | 'sim'>) => Promise<EquivalenceResult>;

const blockOf = (l: LadderProgram, r: Rung) => (r.block && (l.blocks ?? []).some((b) => b.id === r.block) ? r.block : '');
const up = (a: string) => a.trim().toUpperCase();
/** How much there is to read: rungs, contacts and instructions. */
export const sizeOf = (rungs: Rung[]) => rungs.reduce((n, r) => n + 1 + r.branches.reduce((m, b) => m + b.length, 0) + r.outputs.length, 0);
const hasBarrier = (r: Rung) => rungDeps(r).barrier;

/** The blocks the AI may rewrite, and why the others may not. */
export function rewriteCandidates(l: LadderProgram): RewriteCandidate[] {
  const defs = [...(l.blocks ?? []).map((b) => ({ id: b.id, name: b.name })), ...(l.rungs.some((r) => !blockOf(l, r)) ? [{ id: '', name: 'General' }] : [])];
  return defs.map((d) => {
    const rungs = l.rungs.filter((r) => blockOf(l, r) === d.id);
    const why = rungs.length < 2 ? 'one rung: nothing to simplify'
      : rungs.some(hasBarrier) ? 'has instructions of the original PLC or indexed addressing the simulator cannot check'
        : approxTokens(JSON.stringify(programSlice(l, rungs))) > BLOCK_TOKENS ? `too big for one AI answer (${rungs.length} rungs): split it first`
          : undefined;
    return { id: d.id, name: d.name, rungs: rungs.length, ok: !why, ...(why ? { why } : {}) };
  });
}

/** What the block must keep writing (read elsewhere, or seen outside the PLC) and what it reads from outside. */
export function blockInterface(p: ProjectSnapshot, l: LadderProgram, blockId: string) {
  const mine = l.rungs.filter((r) => blockOf(l, r) === blockId), others = l.rungs.filter((r) => blockOf(l, r) !== blockId);
  const writes = new Set(mine.flatMap((r) => rungWrites(r).map(up)));
  const readElsewhere = new Set(others.flatMap((r) => [...rungAddresses(r)].map(up)));
  const ext = externalAddresses(p);
  const keep = [...writes].filter((a) => readElsewhere.has(a) || ext.has(a) || /^(Y|T|CT|TD|CTD|DS|DD|DF|DH)\d+$/.test(a)).sort();
  const reads = [...new Set(mine.flatMap((r) => [...rungAddresses(r)].map(up)))].filter((a) => !writes.has(a) && /^[A-Z]/.test(a)).sort();
  const internal = [...writes].filter((a) => !keep.includes(a)).sort();
  return { keep, reads, writes, free: internal.length ? `none new; reuse only the block's own internal addresses (${internal.join(', ')})` : 'none: use only the addresses above' };
}

/** The program with one block's rungs replaced (in the place of its first rung) and the new tags added. */
function splice(l: LadderProgram, blockId: string, rungs: Rung[], tags: LadderProgram['tags']): LadderProgram {
  const at = l.rungs.findIndex((r) => blockOf(l, r) === blockId);
  const used = new Set(l.rungs.filter((r) => blockOf(l, r) !== blockId).map((r) => r.id));
  const fresh = rungs.map((r, i) => {
    let id = `${blockId || 'general'}_s${i + 1}`;
    for (let k = 2; used.has(id); k++) id = `${blockId || 'general'}_s${i + 1}_${k}`;
    used.add(id);
    const { block: _b, ...rest } = r;
    void _b;
    return { ...rest, id, ...(blockId ? { block: blockId } : {}) };
  });
  const out = l.rungs.filter((r) => blockOf(l, r) !== blockId);
  out.splice(Math.max(0, at), 0, ...fresh);
  const have = new Set(l.tags.map((t) => up(t.address)));
  return { ...l, rungs: out, tags: [...l.tags, ...tags.filter((t) => !have.has(up(t.address)))] };
}

/**
 * Rewrite the chosen blocks one at a time. `check` is the behaviour check (in a worker on the page). Each rewrite
 * is checked against the program with the rewrites kept so far; with more than one kept, the result is checked once
 * more against the original.
 */
export async function simplifyBlocks(
  p: ProjectSnapshot, ctx: PlcContext, ai: AIConfig, chosen: string[], check: Check,
  o: { stage?: (text: string) => void; errors?: (l: LadderProgram) => number } = {},
): Promise<RewriteResult> {
  const plant = p.io.map((x) => ({ address: p.addresses.get(x.id) ?? '', description: x.description, type: x.type, category: x.category }));
  const observe = [...externalAddresses(p)];
  const errors = o.errors ?? ((l: LadderProgram) => validateProgram(l, p.profile, new Set([...p.addresses.values()])).filter((i) => i.severity === 'error').length);
  let cur = p.ladder;
  const kept: KeptRewrite[] = [], dropped: DroppedRewrite[] = [];
  const cands = new Map(rewriteCandidates(p.ladder).map((c) => [c.id, c]));
  for (const [k, id] of chosen.entries()) {
    const c = cands.get(id);
    if (!c) continue;
    const name = c.name;
    if (!c.ok) { dropped.push({ id, name, why: c.why! }); continue; }
    o.stage?.(`block ${k + 1} of ${chosen.length} (${name}): the AI rewrites it`);
    const mine = cur.rungs.filter((r) => blockOf(cur, r) === id);
    const slice = programSlice(cur, mine);
    const iface = blockInterface(p, cur, id);
    const used = new Set([...iface.writes, ...iface.reads]);
    let r;
    try {
      r = await rewriteBlockLadder(ai, { ...ctx, io: ctx.io.filter((pt) => used.has(up(ctx.addresses.get(pt.id) ?? ''))) }, slice, name, iface);
    } catch (err) {
      if (ai.signal?.aborted) throw err;
      dropped.push({ id, name, why: `the AI did not answer (${err instanceof Error ? err.message : String(err)})` });
      continue;
    }
    const rungs = r.program?.rungs ?? [];
    if (!rungs.length) { dropped.push({ id, name, why: `the AI kept it as it is: ${r.explanation.split('\n')[0]}` }); continue; }
    if (rungs.some((x) => x.outputs.some((y) => y.type === 'RAW') || x.branches.some((b) => b.some((y) => y.type === 'RAW')))) { dropped.push({ id, name, why: 'the rewrite has instructions the app cannot read' }); continue; }
    const extra = [...new Set(rungs.flatMap((x) => rungWrites(x).map(up)))].filter((a) => !iface.writes.has(a));
    if (extra.length) { dropped.push({ id, name, why: `the rewrite writes ${extra.slice(0, 4).join(', ')}, which the block did not write` }); continue; }
    const missing = iface.keep.filter((a) => !rungs.some((x) => rungWrites(x).map(up).includes(a)));
    if (missing.length) { dropped.push({ id, name, why: `the rewrite no longer writes ${missing.slice(0, 4).join(', ')}` }); continue; }
    const before = sizeOf(mine), after = sizeOf(rungs);
    if (after >= before) { dropped.push({ id, name, why: `not simpler (${after} parts against ${before})` }); continue; }
    const next = splice(cur, id, rungs, r.program?.tags ?? []);
    if (errors(next) > errors(cur)) { dropped.push({ id, name, why: 'the checker finds a new error in the rewrite' }); continue; }
    o.stage?.(`block ${k + 1} of ${chosen.length} (${name}): checking in the simulator`);
    const res = await check(cur, next, { observe, plant, profileId: p.profile.id });
    if (res.differences.length) { dropped.push({ id, name, why: `behaves differently: ${equivalenceSummary(res).split('. ')[0].replace(/^Different behaviour: /, '')}` }); continue; }
    kept.push({ id, name, before, after, rungsBefore: mine.length, rungsAfter: rungs.length, summary: equivalenceSummary(res), explanation: r.explanation });
    cur = next;
  }
  let final: EquivalenceResult | null = null;
  if (kept.length > 1) {
    o.stage?.('all kept blocks together: checking in the simulator');
    final = await check(p.ladder, cur, { observe, plant, profileId: p.profile.id });
    if (final.differences.length) return { program: p.ladder, kept: [], dropped: [...dropped, ...kept.map((x) => ({ id: x.id, name: x.name, why: 'each passed alone, but together they behave differently' }))], final };
  }
  return { program: cur, kept, dropped, final };
}
