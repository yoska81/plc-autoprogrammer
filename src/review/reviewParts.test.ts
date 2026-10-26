/// <reference types="node" />
/**
 * A big imported program is reviewed by the AI in parts that each fit one request (each with the I/O it uses, after
 * the rest of the project sent as one prompt-cached prefix), at most MAX_REVIEW_PARTS of them, and the summary says
 * what was read; a small project is one request as before.
 * The engineer review gets the program's outline when the whole listing does not fit.
 * Run with:  npx tsx src/review/reviewParts.test.ts
 */
import assert from 'node:assert/strict';
import { importProgramFiles } from '../plc/import';
import { applyUpgrade } from '../plc/import/ui/applyUpgrade';
import { collectProject } from '../deliverables/collect';
import { setClaudeInterceptor, type ClaudeOptions } from '../lib/ai/anthropic';
import { approxTokens, INPUT_TOKENS, programParts } from '../lib/ai/budget';
import { halves, MAX_REVIEW_PARTS, runAiReview } from './reviewAI';
import { runEngineerAI } from '../engineer/engineerAI';
import { l5x } from '../plc/import/__fixtures__/bigPrograms';
import { seedSampleProject } from '../preview/sampleProject';
import { useIOStore } from '../store/useIOStore';
import type { LadderProgram } from '../plc/core/ladder';

let passed = 0;
const test = async (name: string, fn: () => Promise<void> | void) => { await fn(); passed++; console.log('  ok ', name); };
const ai = { provider: 'anthropic' as const, apiKey: 'sk-test', model: 'm', effort: 'low' as const };

const prompts: string[] = [], parts: string[] = [];
let n = 0;
setClaudeInterceptor(async (o: ClaudeOptions) => {
  const c = o.messages[0].content;
  // a part of a big program: the shared project (cached) and the part's own text, as one prompt
  prompts.push(typeof c === 'string' ? c : (c as { text: string }[]).map((b) => b.text).join('\n\n'));
  parts.push(typeof c === 'string' ? c : (c as { text: string }[]).at(-1)!.text);
  o.onStarted?.();
  const k = ++n;
  return { text: JSON.stringify(o.system.includes('electrical engineer')
    ? { summary: 'ok', findings: [] }
    : { summary: `summary ${k}`, findings: [{ severity: 'minor', area: 'program', title: 'Same finding', explanation: 'e', fix: 'f', page: 'program', item: '' }] }), reasoning: null };
});

await test('parts: whole blocks together under the limit; a block too big alone is split by rungs (its last rungs share a part with the next block)', () => {
  const r = (id: string, block: string) => ({ id, block, comment: '', branches: [], outputs: [] });
  const program = { rungs: [r('a', 'A'), r('b', 'A'), r('c', 'B'), r('d', 'C'), r('e', 'C'), r('f', 'C'), r('g', 'C'), r('h', 'D')], tags: [] } as unknown as LadderProgram;
  assert.deepEqual(programParts(program, () => 1, 3).map((p) => p.map((x) => x.id).join('')), ['abc', 'def', 'gh']);
});

await test('a part halved again splits at the block boundary nearest the middle (one block: in the middle)', () => {
  const r = (id: string, block: string) => ({ id, block, comment: '', branches: [], outputs: [] });
  const ids = (h: { id: string }[][]) => h.map((x) => x.map((y) => y.id).join(''));
  assert.deepEqual(ids(halves(['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => r(id, i < 2 ? 'A' : 'B')) as never)), ['ab', 'cdef']);
  assert.deepEqual(ids(halves(['a', 'b', 'c', 'd'].map((id) => r(id, 'A')) as never)), ['ab', 'cd']);
});

await test('a small project is one review request, as before', async () => {
  seedSampleProject();
  prompts.length = 0;
  const r = await runAiReview(ai, collectProject() as never, []);
  assert.equal(prompts.length, 1);
  assert.doesNotMatch(r.summary, /too big/);
});

await test('a big program: parts that each fit, at most MAX_REVIEW_PARTS, findings merged, the summary says what was read', async () => {
  const { program, main } = importProgramFiles([{ name: 'big.L5X', text: l5x(800, 1024) }]);
  applyUpgrade(program, main.text);
  const p = collectProject();
  assert.ok(p.ladder.rungs.length >= 40000, `${p.ladder.rungs.length} rungs`);
  prompts.length = 0; parts.length = 0;
  const r = await runAiReview(ai, p as never, []);
  assert.equal(prompts.length, MAX_REVIEW_PARTS);
  for (const t of prompts) assert.ok(approxTokens(t) <= INPUT_TOKENS, `part of ${approxTokens(t)} tokens`);
  assert.match(parts[0], /^This is part 1 of \d+ of a big program \(rungs 1–\d+\)/);
  assert.match(parts[0], /only the \d+ points this part of the program uses \(2048 in all\)/);
  assert.match(prompts[0], /^The PLC program of this project is too big for one request/);
  assert.match(r.summary, new RegExp(`too big to review in one request: the AI read it in \\d+ parts, the first ${MAX_REVIEW_PARTS} of them`));
  assert.match(r.summary, /checked by the rule checks only/);
  assert.equal(r.findings.length, MAX_REVIEW_PARTS);
  assert.equal(new Set(r.findings.map((f) => f.id)).size, MAX_REVIEW_PARTS, 'ids stay unique across parts');
});

await test('long I/O descriptions: each part is measured and split again, every one fits', async () => {
  const io = useIOStore.getState();
  useIOStore.setState({ projectIO: io.projectIO.map((pt) => ({ ...pt, description: `${pt.description} — ${'wired through the remote junction box, see the field drawings and the loop sheet; '.repeat(5)}` })) });
  prompts.length = 0;
  await runAiReview(ai, collectProject() as never, []);
  assert.equal(prompts.length, MAX_REVIEW_PARTS);
  for (const t of prompts) assert.ok(approxTokens(t) <= INPUT_TOKENS, `part of ${approxTokens(t)} tokens`);
  useIOStore.setState({ projectIO: io.projectIO });
});

await test('the engineer review gets the program as an outline when the listing does not fit', async () => {
  prompts.length = 0;
  await runEngineerAI(ai, collectProject() as never, []);
  assert.equal(prompts.length, 1);
  assert.ok(approxTokens(prompts[0]) <= INPUT_TOKENS, `${approxTokens(prompts[0])} tokens`);
  assert.match(prompts[0], /The rungs are too many to list here/);
});

setClaudeInterceptor(null);
console.log(`reviewParts.test: all passed (${passed})`);
