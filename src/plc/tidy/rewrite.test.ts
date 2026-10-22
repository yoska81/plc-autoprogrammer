/// <reference types="node" />
/**
 * "Simplify blocks with AI": only the block is sent and written back; a rewrite is kept only when it is simpler,
 * writes nothing new, keeps its interface and behaves the same in the simulator; otherwise it is dropped with the
 * reason. Run with:  npx tsx src/plc/tidy/rewrite.test.ts
 */
import assert from 'node:assert/strict';
import { seedSampleProject } from '../../preview/sampleProject';
import { collectProject } from '../../deliverables/collect';
import { useProgramStore } from '../../store/useProgramStore';
import { setClaudeInterceptor, type ClaudeOptions } from '../../lib/ai/anthropic';
import { clearAiCache } from '../../lib/ai/cache';
import type { LadderProgram, Rung } from '../core/ladder';
import type { PlcContext } from '../ai/ladderAI';
import { checkEquivalence } from './equivalence';
import { rewriteCandidates, simplifyBlocks } from './rewrite';

const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };
console.info = () => {};
const ai = { provider: 'anthropic' as const, apiKey: 'k', model: 'm', effort: 'low' as const };
const profiles: (string | undefined)[] = [];
const check = async (a: LadderProgram, b: LadderProgram, o: { profileId?: string }) => { profiles.push(o.profileId); return checkEquivalence(a, b, { random: 40, steps: 30, profileId: o.profileId }); };
const NO = (address: string) => ({ type: 'NO' as const, address });
const OUT = (address: string) => ({ type: 'OUT' as const, address });

// Block "b": X001 AND X002 through an internal bit to Y001 (two rungs); block "c" the same for Y002; "raw" keeps an
// instruction of another PLC.
function project() {
  seedSampleProject();
  const l: LadderProgram = {
    tags: [], blocks: [{ id: 'b', name: 'Lamp one', description: '' }, { id: 'c', name: 'Lamp two', description: '' }, { id: 'raw', name: 'Kept', description: '' }],
    rungs: [
      { id: 'b1', block: 'b', comment: '', branches: [[NO('X001'), NO('X002')]], outputs: [OUT('C10')] },
      { id: 'b2', block: 'b', comment: '', branches: [[NO('C10')]], outputs: [OUT('Y001')] },
      { id: 'c1', block: 'c', comment: '', branches: [[NO('X003')]], outputs: [OUT('C20')] },
      { id: 'c2', block: 'c', comment: '', branches: [[NO('C20'), NO('X004')]], outputs: [OUT('Y002')] },
      { id: 'r1', block: 'raw', comment: '', branches: [[NO('X005')]], outputs: [{ type: 'RAW', text: 'JMP L1', vendor: 'logix' } as never] },
      { id: 'r2', block: 'raw', comment: '', branches: [[NO('X006')]], outputs: [OUT('Y003')] },
    ],
  };
  useProgramStore.getState().setGeneratedLadder(l, 'x', null);
  const p = collectProject();
  const ctx: PlcContext = { profile: p.profile, cpu: p.cpu, io: p.io, addresses: p.addresses };
  return { p, ctx };
}
const rung = (id: string, branches: Rung['branches'], outputs: Rung['outputs']): Rung => ({ id, comment: `${id} comment`, branches, outputs });
/** Answers with the rewrite given for each block (by the block id in the request). */
function answer(by: Record<string, Rung[] | null>, seen: ClaudeOptions[] = []) {
  setClaudeInterceptor(async (o: ClaudeOptions) => {
    seen.push(o);
    const content = String(o.messages[o.messages.length - 1].content);
    const id = /\(block "([^"]*)"\)/.exec(content)?.[1] ?? '';
    const rungs = by[id];
    return { text: JSON.stringify({ explanation: `Rewrote ${id}.`, program: rungs ? { tags: [], blocks: [{ id, name: id, description: '' }], rungs: rungs.map((r) => ({ ...r, block: id })) } : null }), reasoning: null };
  });
}

// Candidates: the block with a kept instruction is not offered, with the reason.
{
  const { p } = project();
  const c = rewriteCandidates(p.ladder);
  assert.deepEqual(c.map((x) => [x.id, x.ok]), [['b', true], ['c', true], ['raw', false]]);
  assert.match(c[2].why!, /original PLC/);
}

// A correct, simpler rewrite is kept; a wrong one is dropped by the simulator; only the block is sent.
{
  await clearAiCache();
  const { p, ctx } = project();
  const seen: ClaudeOptions[] = [];
  answer({
    b: [rung('n1', [[NO('X001'), NO('X002')]], [OUT('Y001')])],
    c: [rung('n1', [[NO('X003')], [NO('X004')]], [OUT('Y002')])], // OR instead of AND: wrong
  }, seen);
  const r = await simplifyBlocks(p, ctx, ai, ['b', 'c', 'raw'], check);
  setClaudeInterceptor(null);
  assert.deepEqual(r.kept.map((k) => k.id), ['b']);
  assert.equal(r.kept[0].rungsAfter, 1);
  assert.match(r.kept[0].summary, /^Same behaviour in \d+ test sequences/);
  assert.deepEqual(r.dropped.map((d) => d.id), ['c', 'raw']);
  assert.match(r.dropped[0].why, /behaves differently/);
  assert.equal(seen.length, 2, 'the kept-instruction block is not sent');
  for (const o of seen) {
    assert.equal(o.task, 'simplify');
    assert.equal(o.maxTokens, 32_000, 'the simplify task cap');
    const content = String(o.messages[0].content);
    assert.ok(!content.includes('"X006"'), 'another block is never sent');
  }
  assert.deepEqual(r.program.rungs.map((x) => x.id), ['b_s1', 'c1', 'c2', 'r1', 'r2'], 'in its place; the rest as it was');
  assert.equal(r.program.rungs[0].block, 'b');
}

// Dropped with the reason: writes something new; no longer writes an output; not simpler; the AI keeps it.
{
  await clearAiCache();
  const { p, ctx } = project();
  answer({ b: [rung('n1', [[NO('X001'), NO('X002')]], [OUT('Y001'), OUT('C99')])] });
  let r = await simplifyBlocks(p, ctx, ai, ['b'], check);
  assert.match(r.dropped[0].why, /writes C99/);
  answer({ b: [rung('n1', [[NO('X001'), NO('X002')]], [OUT('C10')])] });
  r = await simplifyBlocks(p, ctx, ai, ['b'], check);
  assert.match(r.dropped[0].why, /no longer writes Y001/);
  answer({ b: [rung('n1', [[NO('X001'), NO('X002')]], [OUT('C10')]), rung('n2', [[NO('C10'), NO('C10')]], [OUT('Y001')])] });
  r = await simplifyBlocks(p, ctx, ai, ['b'], check);
  assert.match(r.dropped[0].why, /not simpler/);
  answer({ b: null });
  r = await simplifyBlocks(p, ctx, ai, ['b'], check);
  setClaudeInterceptor(null);
  assert.match(r.dropped[0].why, /kept it as it is/);
  assert.equal(r.program, p.ladder, 'nothing kept: the program as it was');
}

// Two blocks kept: checked together against the original at the end.
{
  await clearAiCache();
  const { p, ctx } = project();
  answer({
    b: [rung('n1', [[NO('X001'), NO('X002')]], [OUT('Y001')])],
    c: [rung('n1', [[NO('X003'), NO('X004')]], [OUT('Y002')])],
  });
  const r = await simplifyBlocks(p, ctx, ai, ['b', 'c'], check);
  setClaudeInterceptor(null);
  assert.deepEqual(r.kept.map((k) => k.id), ['b', 'c']);
  assert.ok(r.final && r.final.differences.length === 0);
  assert.equal(r.program.rungs.length, 4);
}

assert.ok(profiles.length && profiles.every((x) => x === 'click'), `the check runs with the project's PLC: ${[...new Set(profiles)].join()}`);

console.log('tidy rewrite tests passed');
