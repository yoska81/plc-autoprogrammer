/// <reference types="node" />
/**
 * A change to a program too big for one AI answer, made block by block: the blocks the request is about are picked,
 * each part goes alone (a block too big for one answer split by its rungs), each answer is put back in place, one
 * proposal at the end; a part with nothing to change stays as it is; nothing changed is said.
 * Run with:  npx tsx src/plc/ai/blockByBlock.test.ts
 */
import assert from 'node:assert/strict';
import type { LadderProgram, Rung } from '../core/ladder';
import { blocksOf, mergePart, reviseByBlocks } from './blockByBlock';
import type { AIConfig, PlcContext } from './ladderAI';

// a big program: 3 blocks, the middle one far too big for one answer
const rung = (id: string, block: string, n: number): Rung => ({ id, block, comment: `Rung ${id} ${'x'.repeat(400)}`, branches: [[{ type: 'NO', address: `C${n}` }]], outputs: [{ type: 'OUT', address: `C${n + 1}` }] });
const program: LadderProgram = {
  tags: [],
  blocks: [{ id: 'a', name: 'Safety', description: 'E-stop' }, { id: 'b', name: 'Cycle', description: 'The automatic cycle' }, { id: 'c', name: 'Alarms', description: '' }],
  rungs: [...Array.from({ length: 5 }, (_, i) => rung(`a${i}`, 'a', i)), ...Array.from({ length: 1200 }, (_, i) => rung(`b${i}`, 'b', 100 + i)), ...Array.from({ length: 5 }, (_, i) => rung(`c${i}`, 'c', 2000 + i))],
};
assert.deepEqual(blocksOf(program).map((b) => `${b.name}:${b.rungs}`), ['Safety:5', 'Cycle:1200', 'Alarms:5']);

const ai = { provider: 'anthropic', apiKey: 'k', model: 'm' } as unknown as AIConfig;
const ctx = { io: [], addresses: new Map() } as unknown as PlcContext;
const sent: number[] = [];
const stages: string[] = [];
// the AI: picks the Cycle block; in each part it marks every rung's comment, but leaves the parts with no rung b1 alone
const revise = async (_ai: AIConfig, _c: PlcContext, slice: LadderProgram) => {
  sent.push(slice.rungs.length);
  if (!slice.rungs.some((r) => r.id === 'b1' || r.id === 'b1100')) return { program: null, explanation: 'Nothing here.', reasoning: null };
  return { program: { ...slice, rungs: slice.rungs.map((r) => ({ ...r, comment: `${r.comment} (done)` })) }, explanation: 'Commented.', reasoning: null };
};
const r = await reviseByBlocks(ai, ctx, program, [], [], 'Comment the cycle', {
  stage: (t) => stages.push(t),
  deps: { pick: async (_a, blocks) => ({ ids: blocks.filter((b) => b.name === 'Cycle').map((b) => b.id), why: 'the request is about the cycle' }), revise },
});
assert.ok(sent.length > 1 && sent.reduce((a, b) => a + b, 0) === 1200, `the Cycle block in parts that fit (${sent.join(', ')})`);
assert.ok(stages.some((s) => /Part 1 of \d+: Cycle/.test(s)), stages.join(' | '));
assert.ok(r.program, 'one proposal');
const p = r.program!;
assert.equal(p.rungs.length, program.rungs.length, 'every rung still there, in place');
assert.deepEqual(p.rungs.map((x) => x.id), program.rungs.map((x) => x.id), 'in the same order');
assert.ok(p.rungs.find((x) => x.id === 'b1')!.comment.endsWith('(done)') && p.rungs.find((x) => x.id === 'b1100')!.comment.endsWith('(done)'), 'changed parts put back');
assert.ok(!p.rungs.find((x) => x.id === 'a0')!.comment.endsWith('(done)'), 'blocks not picked untouched');
assert.match(r.explanation, /Changed block by block \(2 of \d+ parts changed; the request is about the cycle\)/);

// nothing to change anywhere: said, no proposal; no block picked: said
const none = await reviseByBlocks(ai, ctx, program, [], [], 'x', { deps: { pick: async () => ({ ids: ['a'], why: '' }), revise: async () => ({ program: null, explanation: '', reasoning: null }) } });
assert.equal(none.program, null);
assert.match(none.explanation, /nothing needed to change/);
const no = await reviseByBlocks(ai, ctx, program, [], [], 'x', { deps: { pick: async () => ({ ids: [], why: 'it is about the HMI' }), revise } });
assert.match(no.explanation, /No block of the program is about this request: it is about the HMI/);

// a block chosen by the user: only its parts, no picking
sent.length = 0;
await reviseByBlocks(ai, ctx, program, [], [], 'x', { onlyBlock: 'c', deps: { pick: async () => { throw new Error('no pick'); }, revise } });
assert.deepEqual(sent, [5]);

// mergePart: new rungs after the part's, in its block; tags joined
const m = mergePart(program, ['c0'], { tags: [{ address: 'C9000', nickname: 'New', comment: '' }], rungs: [program.rungs.find((x) => x.id === 'c0')!, { id: 'n1', comment: 'new', branches: [], outputs: [] }] });
assert.equal(m.rungs.find((x) => x.id === 'n1')!.block, 'c');
assert.equal(m.rungs.findIndex((x) => x.id === 'n1'), m.rungs.findIndex((x) => x.id === 'c0') + 1);
assert.ok(m.tags.some((t) => t.address === 'C9000'));

console.log(`blockByBlock.test: all passed (${stages.length} progress lines)`);
