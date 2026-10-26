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
import { approxTokens, programSlice, tokensOfLength } from '../../lib/ai/budget';
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

/**
 * What the AI rewrites of a block, one part at a time: the whole block when it fits one answer and the simulator can
 * check all of it; else its runs of rungs between the ones the simulator cannot check (kept instructions of the
 * original PLC, indexed addressing: they stay as they are), each cut to what fits one answer. A part of one rung is
 * not worth it.
 */
export interface RewriteUnit { id: string; blockId: string; name: string; rungIds: string[] }

export function rewriteUnits(l: LadderProgram, blockId: string, name: string): RewriteUnit[] {
  const rungs = l.rungs.filter((r) => blockOf(l, r) === blockId);
  const fits = (rs: Rung[]) => approxTokens(JSON.stringify(programSlice(l, rs))) <= BLOCK_TOKENS;
  if (rungs.length >= 2 && !rungs.some(hasBarrier) && fits(rungs)) return [{ id: blockId, blockId, name, rungIds: rungs.map((r) => r.id) }];
  // a part's size added up as it grows (its slice measured anew for every rung took seconds on a big block): the rungs,
  // the tags they bring in, the rest of the slice once; a little over the slice's real size (a comma per entry)
  const tagLen = new Map(l.tags.map((t) => [t.address.toUpperCase(), JSON.stringify(t).length + 1]));
  const baseLen = JSON.stringify(programSlice(l, [])).length + (blockId ? JSON.stringify((l.blocks ?? []).find((b) => b.id === blockId) ?? {}).length + 1 : 0);
  const runs: Rung[][] = [];
  let cur: Rung[] = [], len = baseLen, tags = new Set<string>();
  const close = () => { if (cur.length >= 2) runs.push(cur); cur = []; len = baseLen; tags = new Set(); };
  const grow = (r: Rung) => {
    const fresh = [...new Set([...rungAddresses(r), ...rungWrites(r)].map(up))].filter((a) => tagLen.has(a) && !tags.has(a));
    return { add: JSON.stringify(r).length + 1 + fresh.reduce((n, a) => n + tagLen.get(a)!, 0), fresh };
  };
  for (const r of rungs) {
    if (hasBarrier(r)) { close(); continue; }
    let g = grow(r);
    if (cur.length && tokensOfLength(len + g.add) > BLOCK_TOKENS) { close(); g = grow(r); }
    cur.push(r); len += g.add; for (const a of g.fresh) tags.add(a);
  }
  close();
  return runs.map((rs, i) => ({ id: `${blockId || 'general'}~${i + 1}`, blockId, name: runs.length > 1 ? `${name} (part ${i + 1} of ${runs.length})` : name, rungIds: rs.map((r) => r.id) }));
}

/** The blocks the AI may rewrite (a big one in parts), and why the others may not. */
export function rewriteCandidates(l: LadderProgram): RewriteCandidate[] {
  const defs = [...(l.blocks ?? []).map((b) => ({ id: b.id, name: b.name })), ...(l.rungs.some((r) => !blockOf(l, r)) ? [{ id: '', name: 'General' }] : [])];
  return defs.map((d) => {
    const rungs = l.rungs.filter((r) => blockOf(l, r) === d.id);
    const units = rewriteUnits(l, d.id, d.name);
    const why = rungs.length < 2 ? 'one rung: nothing to simplify'
      : !units.length ? 'has instructions of the original PLC or indexed addressing the simulator cannot check, between every two rungs'
        : undefined;
    return { id: d.id, name: units.length > 1 ? `${d.name} (in ${units.length} parts)` : d.name, rungs: rungs.length, ok: !why, ...(why ? { why } : {}) };
  });
}

/** What the rungs must keep writing (read elsewhere, or seen outside the PLC) and what they read from outside. */
export function blockInterface(p: ProjectSnapshot, l: LadderProgram, rungIds: string[]) {
  const ids = new Set(rungIds);
  const mine = l.rungs.filter((r) => ids.has(r.id)), others = l.rungs.filter((r) => !ids.has(r.id));
  const writes = new Set(mine.flatMap((r) => rungWrites(r).map(up)));
  const readElsewhere = new Set(others.flatMap((r) => [...rungAddresses(r)].map(up)));
  const ext = externalAddresses(p);
  const keep = [...writes].filter((a) => readElsewhere.has(a) || ext.has(a) || /^(Y|T|CT|TD|CTD|DS|DD|DF|DH)\d+$/.test(a)).sort();
  const reads = [...new Set(mine.flatMap((r) => [...rungAddresses(r)].map(up)))].filter((a) => !writes.has(a) && /^[A-Z]/.test(a)).sort();
  const internal = [...writes].filter((a) => !keep.includes(a)).sort();
  return { keep, reads, writes, free: internal.length ? `none new; reuse only the block's own internal addresses (${internal.join(', ')})` : 'none: use only the addresses above' };
}

/** The program with a part's rungs replaced (in the place of its first rung, in its block) and the new tags added. */
function splice(l: LadderProgram, u: RewriteUnit, rungs: Rung[], tags: LadderProgram['tags']): LadderProgram {
  const ids = new Set(u.rungIds), blockId = u.blockId;
  const at = l.rungs.findIndex((r) => ids.has(r.id));
  const used = new Set(l.rungs.filter((r) => !ids.has(r.id)).map((r) => r.id));
  const fresh = rungs.map((r, i) => {
    let id = `${u.id || 'general'}_s${i + 1}`;
    for (let k = 2; used.has(id); k++) id = `${u.id || 'general'}_s${i + 1}_${k}`;
    used.add(id);
    const { block: _b, ...rest } = r;
    void _b;
    return { ...rest, id, ...(blockId ? { block: blockId } : {}) };
  });
  const out = l.rungs.filter((r) => !ids.has(r.id));
  out.splice(Math.max(0, l.rungs.slice(0, Math.max(0, at)).filter((r) => !ids.has(r.id)).length), 0, ...fresh);
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
  // the chosen blocks, a big one in parts (worked out on the original: a part's rungs keep their ids until it is kept)
  // (a block that cannot be simplified is said in its place in the order chosen)
  const plan: (RewriteUnit | DroppedRewrite)[] = [];
  for (const id of chosen) {
    const c = cands.get(id);
    if (!c) continue;
    if (!c.ok) plan.push({ id, name: c.name, why: c.why! });
    else plan.push(...rewriteUnits(p.ladder, id, (p.ladder.blocks ?? []).find((b) => b.id === id)?.name ?? 'General'));
  }
  const units = plan.filter((x): x is RewriteUnit => 'rungIds' in x);
  for (const item of plan) {
    if (!('rungIds' in item)) { dropped.push(item); continue; }
    const u = item, k = units.indexOf(u);
    const id = u.id, name = u.name;
    o.stage?.(`part ${k + 1} of ${units.length} (${name}): the AI rewrites it`);
    const ids = new Set(u.rungIds);
    const mine = cur.rungs.filter((r) => ids.has(r.id));
    if (mine.length < 2) continue;
    const slice = programSlice(cur, mine);
    const iface = blockInterface(p, cur, u.rungIds);
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
    const next = splice(cur, u, rungs, r.program?.tags ?? []);
    if (errors(next) > errors(cur)) { dropped.push({ id, name, why: 'the checker finds a new error in the rewrite' }); continue; }
    o.stage?.(`part ${k + 1} of ${units.length} (${name}): checking in the simulator`);
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
