/// <reference types="node" />
/**
 * Update all when the AI is aborted mid-run: every stage falls back to the rules (electrical, HMI and the PLC
 * program, new or existing); Cancel stops the run.
 * Run with:  npx tsx src/spec/updateAll.test.ts
 */
import assert from 'node:assert/strict';
import { setClaudeInterceptor } from '../lib/ai/anthropic';
import { clearAiCache } from '../lib/ai/cache';
import { runUpdateAll, type StepResult } from './updateAll';
import { EMPTY_SECTIONS } from './types';
import { useSpecStore } from '../store/useSpecStore';
import { useIOStore } from '../store/useIOStore';
import { useSettingsStore, type StageMode } from '../store/useSettingsStore';
import { useProgramStore } from '../store/useProgramStore';

let passed = 0;
const failures: string[] = [];
async function test(name: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { failures.push(name); console.log(`  FAIL ${name}\n       ${(e as Error).message}`); }
}
const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };
console.info = () => {};

const aborted = () => Object.assign(new Error('Request was aborted.'), { name: 'AbortError' });
/** Every AI request is under way for a moment, then aborted (a dropped stream, a stopped request); the run itself is not cancelled. */
const abortMidRequest = () => setClaudeInterceptor(async () => { await new Promise((r) => setTimeout(r, 20)); throw aborted(); });
const steps = ['electrical', 'hmi', 'program'] as const;

function machine(mode: StageMode) {
  useSpecStore.setState({ sections: { ...EMPTY_SECTIONS, overview: 'Web line: an unwinder motor M1 feeds the web to a rewinder motor M2. A photo-eye detects a web break.' }, questions: [] });
  useIOStore.getState().importPoints([
    { type: 'input', description: 'E-Stop OK (safety relay)', category: 'Safety' },
    { type: 'input', description: 'Start Button', category: 'Operator/HMI' },
    { type: 'input', description: 'Stop Button', category: 'Operator/HMI' },
    { type: 'input', description: 'Web break photo-eye', category: 'Sensors' },
    { type: 'output', description: 'Unwinder motor run', category: 'Motor' },
    { type: 'output', description: 'Rewinder motor run', category: 'Motor' },
  ] as never, true);
  useSettingsStore.setState({ anthropicApiKey: 'k', stageModes: { equipment: mode, electrical: mode, hmi: mode, program: mode } });
  useProgramStore.setState({ ladder: { ...useProgramStore.getState().ladder, rungs: [] }, proposal: null });
}
const final = (rs: StepResult[], step: string) => rs.filter((r) => r.step === step && !r.provisional).at(-1);

console.log('Update all: the AI aborted mid-run');

for (const mode of ['ai', 'quick-then-ai'] as const) {
  await test(`${mode}: a new program is written by the rules`, async () => {
    await clearAiCache();
    machine(mode);
    abortMidRequest();
    const rs: StepResult[] = [];
    await runUpdateAll([...steps], (r) => rs.push(r));
    assert.equal(final(rs, 'electrical')?.status, 'done', JSON.stringify(rs));
    assert.equal(final(rs, 'program')?.status, 'done', JSON.stringify(rs));
    assert.ok(useProgramStore.getState().ladder.rungs.length > 10);
  });

  await test(`${mode}: an existing program gets the rules' program as a proposal (not a failed stage); the program itself is kept`, async () => {
    await clearAiCache();
    machine(mode);
    abortMidRequest();
    await runUpdateAll([...steps], () => {});
    const before = useProgramStore.getState().ladder;
    assert.ok(before.rungs.length > 10);
    // the spec changes, so the program stage revises the program with the AI, which is aborted
    useSpecStore.setState({ sections: { ...useSpecStore.getState().sections, overview: `${useSpecStore.getState().sections.overview} The rewinder has a dancer arm.` } });
    const rs: StepResult[] = [];
    await runUpdateAll([...steps], (r) => rs.push(r));
    const p = final(rs, 'program');
    assert.equal(p?.status, 'proposal', JSON.stringify(rs));
    assert.match(p?.message ?? '', /The AI could not update the program \(.*\): a rules program \(\d+ rungs/);
    const proposal = useProgramStore.getState().proposal;
    assert.ok(proposal?.program.rungs.length, 'the rules program waits for approval');
    assert.match(proposal!.explanation, /^The AI could not update the program/);
    assert.equal(useProgramStore.getState().ladder, before, 'the current program is not replaced');
  });
}

await test('no API key, existing program: "No API key — built from rules" (no AI asked); a waiting proposal is named as replaced', async () => {
  await clearAiCache();
  machine('ai');
  abortMidRequest();
  await runUpdateAll([...steps], () => {});
  const before = useProgramStore.getState().ladder;
  let asked = 0;
  setClaudeInterceptor(async () => { asked++; throw aborted(); });
  useSettingsStore.setState({ anthropicApiKey: '' });
  const change = (text: string) => useSpecStore.setState({ sections: { ...useSpecStore.getState().sections, overview: `${useSpecStore.getState().sections.overview} ${text}` } });
  change('The rewinder has a dancer arm.');
  const rs: StepResult[] = [];
  await runUpdateAll([...steps], (r) => rs.push(r));
  const p = final(rs, 'program');
  assert.equal(p?.status, 'proposal', JSON.stringify(rs));
  assert.match(p?.message ?? '', /^No API key — built from rules: a rules program \(\d+ rungs, default cycle\) is waiting/);
  assert.doesNotMatch(p?.message ?? '', /replaces/, 'no proposal was waiting');
  assert.equal(asked, 0, 'no AI request without a key');
  assert.equal(useProgramStore.getState().ladder, before);
  // the spec changes again while that proposal still waits: the new one says it replaces it
  change('The unwinder has a brake.');
  const rs2: StepResult[] = [];
  await runUpdateAll([...steps], (r) => rs2.push(r));
  assert.match(final(rs2, 'program')?.message ?? '', /It replaces the proposal that was waiting\.$/, JSON.stringify(rs2));
});

await test('Cancel during the AI stops the run (no fallback, no proposal)', async () => {
  await clearAiCache();
  machine('ai');
  const ctrl = new AbortController();
  setClaudeInterceptor(async (o) => {
    setTimeout(() => ctrl.abort(), 10);
    await new Promise((_, reject) => o.signal?.addEventListener('abort', () => reject(aborted()), { once: true }));
    return { text: '{}', reasoning: null };
  });
  const rs: StepResult[] = [];
  await runUpdateAll([...steps], (r) => rs.push(r), { signal: ctrl.signal });
  assert.ok(!rs.some((r) => r.status === 'done' && !r.provisional), JSON.stringify(rs));
  assert.equal(useProgramStore.getState().proposal, null);
  assert.equal(useProgramStore.getState().ladder.rungs.length, 0);
});

setClaudeInterceptor(null);
console.log(failures.length ? `\n${failures.length} failed` : `\n${passed} passed, 0 failed`);
process.exit(failures.length ? 1 : 0);
