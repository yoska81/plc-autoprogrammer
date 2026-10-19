/// <reference types="node" />
/**
 * Update all's program step on a project that already has a program: the app's own, unchanged program is rebuilt
 * (kept as a version), so every HMI tag stays implemented after a redesign; one changed by hand only gets a proposal.
 * Run with:  npx tsx src/spec/updateAll.rebuild.test.ts
 */
import assert from 'node:assert/strict';
import { runUpdateAll, type StepResult } from './updateAll';
import { LADDER, seedSampleProject } from '../preview/sampleProject';
import { useProgramStore } from '../store/useProgramStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useStageStore } from '../store/useStageStore';

const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };
console.info = () => {};

/** The example project with its program as the app generated it. */
function example() {
  seedSampleProject();
  useProgramStore.getState().setGeneratedLadder(structuredClone(LADDER), 'Example.', null);
}

async function runProgram(): Promise<StepResult | undefined> {
  // The design changed since the program was written (as after a redesign): its stage is stale. Quick mode: the
  // rules write it (no AI, no key).
  useStageStore.setState((st) => ({ sources: { ...st.sources, program: { ...st.sources.program, ioFp: 'before the redesign', at: '' } as never } }));
  useSettingsStore.setState({ anthropicApiKey: '', stageModes: { ...useSettingsStore.getState().stageModes, program: 'quick' } });
  const rs: StepResult[] = [];
  await runUpdateAll(['program'], (r) => rs.push(r));
  return rs.filter((r) => r.step === 'program' && !r.provisional).at(-1);
}

// The example's program was generated here: Update all rebuilds it and keeps the previous one as a version.
{
  example();
  assert.equal(useProgramStore.getState().ladderOrigin, 'app');
  const before = useProgramStore.getState().versions.length;
  const r = await runProgram();
  assert.equal(r?.status, 'done', JSON.stringify(r));
  assert.match(r?.message ?? '', /The previous program is kept as a version/);
  assert.equal(useProgramStore.getState().proposal, null);
  assert.equal(useProgramStore.getState().versions.length, before + 1, 'the previous program is a version');
}

// Changed by hand: only a proposal; the program stays as the user left it.
{
  example();
  const prog = useProgramStore.getState();
  const edited = { ...prog.ladder, rungs: prog.ladder.rungs.map((x, i) => (i === 0 ? { ...x, comment: 'My own rung' } : x)) };
  prog.editLadder(edited);
  assert.equal(useProgramStore.getState().ladderOrigin, 'user');
  const r = await runProgram();
  assert.equal(r?.status, 'proposal', JSON.stringify(r));
  assert.equal(useProgramStore.getState().ladder.rungs[0].comment, 'My own rung', 'the hand-edited program is kept');
  assert.ok(useProgramStore.getState().proposal);
}

// Read from a file or recovered: the user's, never rebuilt.
{
  example();
  useProgramStore.getState().setGeneratedLadder(useProgramStore.getState().ladder, 'Recovered.', null, 'user');
  const r3 = await runProgram();
  assert.equal(r3?.status, 'proposal');
}

console.log('update all rebuild tests passed');
