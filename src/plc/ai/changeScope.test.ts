/// <reference types="node" />
/**
 * A program change on a big program: the AI writes back what it is sent, so only the chosen block goes (with the
 * I/O it uses), the answer changes only that block, and when nothing fits the user is told what to do.
 * Run with:  npx tsx src/plc/ai/changeScope.test.ts
 */
import assert from 'node:assert/strict';
import { importProgramFiles } from '../import';
import { applyUpgrade } from '../import/ui/applyUpgrade';
import { collectProject } from '../../deliverables/collect';
import { seedSampleProject } from '../../preview/sampleProject';
import { approxTokens, PROGRAM_OUT_TOKENS } from '../../lib/ai/budget';
import { l5x } from '../import/__fixtures__/bigPrograms';
import { GENERAL_BLOCK, scopeToBlock } from '../sim/blocks';
import { changeScope, type PlcContext } from './ladderAI';
import type { LadderProgram } from '../core/ladder';

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log('  ok ', name); };
const ctxOf = (p: ReturnType<typeof collectProject>): PlcContext => ({ profile: p.profile, cpu: p.cpu, io: p.io, addresses: p.addresses });

test('a program that fits is sent whole, as before', () => {
  seedSampleProject();
  const p = collectProject();
  const s = changeScope(p.ladder, ctxOf(p), null, '');
  assert.ok(!('tooBig' in s) && !s.part && s.program === p.ladder);
});

const { program, main } = importProgramFiles([{ name: 'big.L5X', text: l5x(200, 1024) }]);
applyUpgrade(program, main.text);
const p = collectProject();
const ctx = ctxOf(p);
const block = p.ladder.blocks![7];

test('a big program with no block chosen: the user is asked to choose a block', () => {
  const s = changeScope(p.ladder, ctx, null, '');
  assert.ok('tooBig' in s);
  assert.match(s.tooBig, /too big for the AI to change in one go \(\d+ rungs\)\. Choose one block/);
});

test('a big program with a block chosen: only that block and the I/O it uses are sent', () => {
  const s = changeScope(p.ladder, ctx, block.id, block.name);
  assert.ok(!('tooBig' in s) && s.part);
  assert.ok(s.program.rungs.length > 0 && s.program.rungs.every((r) => r.block === block.id));
  assert.ok(approxTokens(JSON.stringify(s.program)) <= PROGRAM_OUT_TOKENS);
  assert.ok(s.ctx.io.length > 0 && s.ctx.io.length < p.io.length / 10, `${s.ctx.io.length} of ${p.io.length} I/O`);

  // the AI changes a rung of the block and adds one: the rest of the program is kept, nothing counted as left out
  const answer: LadderProgram = { ...s.program, rungs: [{ ...s.program.rungs[0], comment: 'changed' }, ...s.program.rungs.slice(1), { id: 'new-1', comment: 'added', branches: [], outputs: [{ type: 'OUT', address: s.program.rungs[0].outputs[0]?.type === 'OUT' ? s.program.rungs[0].outputs[0].address : 'X' }] }] };
  const merged = scopeToBlock(p.ladder, answer, block.id, true);
  assert.equal(merged.outside, 0);
  assert.equal(merged.program.rungs.length, p.ladder.rungs.length + 1);
  assert.equal(merged.program.rungs.find((r) => r.id === s.program.rungs[0].id)?.comment, 'changed');
  assert.equal(merged.program.rungs.find((r) => r.id === 'new-1')?.block, block.id);
  const others = (q: LadderProgram) => JSON.stringify(q.rungs.filter((r) => r.block !== block.id && r.id !== 'new-1'));
  assert.equal(others(merged.program), others(p.ladder));
});

test('a block too big on its own: split it, or change it by hand', () => {
  const rungs = Array.from({ length: 6000 }, (_, i) => ({ id: `r${i}`, comment: `step ${i}`, branches: [[{ type: 'NO' as const, address: `C${i}` }]], outputs: [{ type: 'OUT' as const, address: `C${i + 1}` }] }));
  const s = changeScope({ rungs, tags: [] }, ctx, GENERAL_BLOCK, 'General');
  assert.ok('tooBig' in s);
  assert.match(s.tooBig, /The block General is too big .* Split it into smaller blocks, or make this change by hand\./);
});

console.log(`changeScope.test: all passed (${passed})`);
