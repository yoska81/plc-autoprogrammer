/// <reference types="node" />
/**
 * How big each AI request is on a big imported project (the made-up Yaskawa line of __fixtures__/bigYaskawa.ts:
 * 182 drawings, ~3900 rungs, 249 I/O): the machine description without the app-written lists and cut per task,
 * the fix-it chat with an overview and the block's own issues, the design review's parts sharing one cached
 * prefix and all read, the full-AI electrical design with only the parts the machine can use, max_tokens per task.
 * Prints the size of every call next to its size before these changes.
 * Run with:  npx tsx src/lib/ai/tokens.test.ts
 */
import assert from 'node:assert/strict';
import { measureCalls, table, tokens, type Measured } from './__fixtures__/measureCalls';
import { bigYaskawaSpec } from './__fixtures__/bigYaskawa';
import { SHORTENED, SPEC_CHARS, specForAI } from './specForAI';
import { specToText, EMPTY_SECTIONS } from '../../spec/types';
import { issueList, MAX_PROJECT_ISSUES } from '../../plc/ai/ladderAI';
import { designCatalog } from './electricalAI';
import { catalogFor } from '../../electrical/catalogs';
import { setClaudeInterceptor, type ClaudeOptions } from './anthropic';
import { clearAiCache } from './cache';
import { runUpdateAll, type StepResult } from '../../spec/updateAll';
import { useSettingsStore } from '../../store/useSettingsStore';
import { collectProject } from '../../deliverables/collect';
import { runAiReview } from '../../review/reviewAI';
import { checksFor } from '../../review/actions';
import type { ValidationIssue } from '../../plc/core/validate';

let passed = 0;
const test = async (name: string, fn: () => void | Promise<void>) => { await fn(); passed++; console.log('  ok ', name); };
console.info = () => {};

/** Tokens of each call on this project before these changes (measured with the same stub, same project). */
const BEFORE: Record<string, number> = {
  equipment: 22734, io: 20580, 'machine model': 19071, 'HMI names': 17324, 'full-AI HMI': 22367, 'full-AI program': 24025,
  'full-AI electrical': 277015, 'fix-it (per block)': 25379, 'design review': 568883, 'engineer review': 20586,
};

await test('the description: the app-written lists are left out, the rest cut per task at line ends, overview first', () => {
  const spec = bigYaskawaSpec();
  const full = specToText(spec);
  assert.match(full, /^Timers:$/m);
  assert.match(full, /^I\/O by register word:$/m);
  for (const task of Object.keys(SPEC_CHARS) as (keyof typeof SPEC_CHARS)[]) {
    const t = specForAI(spec, task);
    assert.ok(t.length <= SPEC_CHARS[task], `${task}: ${t.length} > ${SPEC_CHARS[task]}`);
    assert.doesNotMatch(t, /^(Timers|Counters|Other I\/O|I\/O by register word|Drawings \(in scan order\)):$/m, task);
    assert.doesNotMatch(t, /\((input|output), I?O?B[0-9A-F]+\)$/m, `${task}: an I/O line`);
    assert.ok(t.startsWith('## Machine overview\nBottling line: bottles are filled'), `${task}: overview first`);
    assert.match(t, /## Questions and answers\nQ: Question 1 about the Infeed\?/, `${task}: the answers keep their start`);
    assert.match(t, /^## Motors and drives\nServo axes on MECHATROLINK/m, `${task}: the axes stay`);
    assert.ok(t.includes(SHORTENED), task);
    assert.match(t, /lists of I\/O points, timers, counters, register words and drawings are left out/);
  }
  // Text in, text out: the same as from the sections.
  assert.equal(specForAI(full, 'io'), specForAI(spec, 'io'));
  // A short description of the user's own is sent whole.
  const own = { ...EMPTY_SECTIONS, overview: 'A conveyor moves boxes to a pusher.', sequence: '1. Start the conveyor.\n2. Push each box.', qa: 'Q: Speed?\nA: 20 boxes a minute.' };
  assert.equal(specForAI(own, 'equipment'), specToText(own));
  assert.equal(specForAI('', 'io'), '');
});

await test('fix-it: the block\'s own issues and at most 5 about the whole project', () => {
  const wide = Array.from({ length: 55 }, (_, i): ValidationIssue => ({ severity: 'warning', message: `project-wide ${i}` } as ValidationIssue));
  const own = Array.from({ length: 8 }, (_, i): ValidationIssue => ({ severity: 'error', rungId: `r${i}`, message: `rung issue ${i}` } as ValidationIssue));
  const text = issueList([...wide, ...own]);
  assert.equal((text.match(/project-wide \d+/g) ?? []).length, MAX_PROJECT_ISSUES);
  assert.equal((text.match(/rung issue \d+/g) ?? []).length, 8);
  assert.match(text, /… and 50 more about the whole project/);
  assert.equal(issueList([]), '(none)');
});

let m!: Measured;
await test('every call on the big project is within its budget (before → after printed)', async () => {
  m = await measureCalls((t) => ({ role: 'user', content: `Machine specification (overview):\n${specForAI(t, 'fix-it')}` }));
  const median = (k: string) => { const s = m[k].map((r) => r.chars).sort((a, b) => a - b); return tokens(s[s.length >> 1]); };
  const sum = (k: string) => tokens(m[k].reduce((n, r) => n + r.chars, 0));
  console.log(table(m).split('\n').map((l) => `      ${l}  (before ${BEFORE[l.slice(0, 20).trim()]})`).join('\n'));
  // Update all (equipment + I/O + machine model + HMI names): from ~80k to under 30k.
  assert.ok(sum('equipment') + sum('io') + sum('machine model') + sum('HMI names') <= 30_000);
  for (const [k, max] of [['equipment', 10_000], ['io', 10_000], ['machine model', 6_000], ['HMI names', 4_000], ['full-AI HMI', 10_000], ['full-AI program', 12_000], ['engineer review', 10_000]] as const) assert.ok(sum(k) <= max, `${k}: ${sum(k)} > ${max}`);
  assert.ok(median('fix-it (per block)') <= 10_000, `fix-it ${median('fix-it (per block)')}`);
  // The design review: ≤ 60 % of before, every part read, the parts after the shared prefix.
  assert.ok(sum('design review') <= 0.6 * BEFORE['design review'], `review ${sum('design review')}`);
  assert.ok(m['design review'].every((r) => r.cached > 0), 'the project is the cached prefix of every part');
  assert.ok(sum('full-AI electrical') <= 100_000, `electrical ${sum('full-AI electrical')}`);
});

await test('max_tokens per task: small JSON answers 8–16k, the program the full 64k', () => {
  assert.equal(m.equipment[0].maxTokens, 8000);
  assert.equal(m['HMI names'][0].maxTokens, 8000);
  assert.equal(m['machine model'][0].maxTokens, 8000);
  assert.equal(m.io[0].maxTokens, 16000);
  assert.equal(m['design review'][0].maxTokens, 16000);
  assert.equal(m['full-AI program'][0].maxTokens, 64000);
});

await test('the design review reads every part of the big program, in parallel parts', async () => {
  const p = collectProject();
  const asked: string[] = [];
  setClaudeInterceptor(async (o: ClaudeOptions) => { asked.push(JSON.stringify(o.messages)); o.onStarted?.(); return { text: '{"summary":"fine","findings":[]}', reasoning: null }; });
  const r = await runAiReview({ provider: 'anthropic', apiKey: 'k', model: 'm', effort: 'low' }, p, checksFor(p));
  setClaudeInterceptor(null);
  assert.ok(asked.length > 1);
  assert.doesNotMatch(r.summary, /checked by the rule checks only/);
  assert.match(r.summary, new RegExp(`read it in ${asked.length} parts\\.`));
  assert.ok(asked.every((t) => !/Rung ids in order/.test(t)), 'no rung-id list');
  assert.ok(asked.every((t) => /Rung \d+ \(id r\d+\)/.test(t)), 'each rung with its id');
});

await test('the full-AI electrical catalog: no field sensors or encoders, only the project\'s panel, a spread of enclosures', () => {
  const p = collectProject();
  const all = catalogFor();
  const c = designCatalog(all, { profile: p.profile, cpu: p.cpu, io: p.io, machineDescription: specToText(p.spec), inputs: { supply: '480VAC-3PH', enclosureRating: 'NEMA 12', notes: '', motors: [], requiredParts: [] }, hmiPartNumber: 'cMT2078X' });
  assert.ok(c.length < all.length / 2, `${c.length} of ${all.length}`);
  assert.ok(!c.some((x) => x.category === 'sensor' || x.category === 'encoder' || x.category === 'servoDrive'));
  assert.ok(c.filter((x) => x.category === 'hmi').every((x) => x.partNumber === 'cMT2078X'));
  assert.ok(c.filter((x) => x.category === 'enclosure' && x.ratings.kind !== 'subpanel').length <= 30);
  assert.ok(!c.some((x) => x.category === 'vfd'), 'a servo axis "not a VFD" asks for no drive');
});

await test('Update all on a program read from the machine: the equipment is kept, no AI asked', async () => {
  await clearAiCache();
  useSettingsStore.setState({ anthropicApiKey: 'k', stageModes: { equipment: 'ai', electrical: 'ai', hmi: 'ai', program: 'ai' } });
  let asked = 0;
  setClaudeInterceptor(async (o: ClaudeOptions) => { if (o.task === 'equipment') asked++; throw new Error('no'); });
  const rs: StepResult[] = [];
  await runUpdateAll(['equipment'], (r) => rs.push(r));
  setClaudeInterceptor(null);
  assert.equal(asked, 0);
  assert.match(rs.at(-1)?.message ?? '', /Kept the machine's own CPU-301.*the AI was not asked/);
});

console.log(`tokens.test: all passed (${passed})`);
