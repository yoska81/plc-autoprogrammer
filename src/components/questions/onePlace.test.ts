/// <reference types="node" />
/**
 * Questions are asked in ONE place, the Machine description page:
 * 1. a new project answers everything there (checklist + follow-ups) → Update all → no open question anywhere;
 * 2. a gap a later stage finds (an AI note) appears only on the Machine description page, the stage still completes;
 * 3. old projects: open questions sitting on later pages are listed on the Machine description page, deduplicated.
 * Run with:  npx tsx src/components/questions/onePlace.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { installQaSync, registerStageQuestions } from './qa';
import { duplicateOpen, useQuestionStore, type Question } from './useQuestionStore';
import { quickChoices } from './parse';
import { missingNeeds, NEEDS } from '../../spec/needs';
import { setClaudeInterceptor, type ClaudeOptions } from '../../lib/ai/anthropic';
import { runUpdateAll, type StepResult } from '../../spec/updateAll';
import { useSpecStore } from '../../store/useSpecStore';
import { useIOStore } from '../../store/useIOStore';
import { useElectricalStore } from '../../store/useElectricalStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useProjectsStore } from '../../store/useProjectsStore';
import { EMPTY_SECTIONS, specToText } from '../../spec/types';

const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };

const P = useProjectsStore.getState().activeId;
const list = () => useQuestionStore.getState().byProject[P ?? 'default'] ?? [];
const open = () => list().filter((q) => q.status === 'open');
const answer = (q: Question, text: string) => useQuestionStore.getState().answer(P, q.id, text, 'answered');

// ── A new web line: description only ──
useSpecStore.setState({ sections: { ...EMPTY_SECTIONS, overview: 'Web line: an unwinder motor M1 feeds the web to a rewinder motor M2. A photo-eye detects a web break.' }, questions: [] });
useIOStore.getState().importPoints([
  { type: 'input', description: 'E-Stop OK (safety relay)', category: 'Safety' },
  { type: 'input', description: 'Start Button', category: 'Operator/HMI' },
  { type: 'input', description: 'Stop Button', category: 'Operator/HMI' },
  { type: 'input', description: 'Web break photo-eye', category: 'Sensors' },
  { type: 'output', description: 'Unwinder motor run', category: 'Motor' },
  { type: 'output', description: 'Rewinder motor run', category: 'Motor' },
] as never, true);
useElectricalStore.getState().setInputs({ ...useElectricalStore.getState().inputs, motors: [] });
installQaSync();
registerStageQuestions();

// The checklist asks what every later stage needs, on the Machine description page, grouped by topic.
const asked = open();
assert.ok(asked.length >= 10, `checklist asked ${asked.length}`);
assert.ok(asked.every((q) => q.source === 'spec' && q.topic), 'asked for the machine description, with a topic');
for (const id of ['brand', 'sensor-type', 'supply', 'motor-nameplates', 'starters', 'enclosure', 'sccr', 'hmi-size', 'cycle', 'timings', 'modes']) assert.ok(asked.some((q) => q.need === id), `asks ${id}`);
assert.ok(!asked.some((q) => q.need === 'vfd-speed'), 'no VFD follow-up before a VFD is mentioned');

// Answer everything there; an answer that needs a follow-up brings it right away.
const ANSWERS: Record<string, string> = {
  brand: 'AutomationDirect CLICK PLC and C-more HMI.',
  'sensor-type': 'PNP, 24 VDC.',
  spares: '20 % spare I/O.',
  supply: '480 VAC 3-phase 60 Hz.',
  'motor-nameplates': 'M1 unwinder 2 HP 480 V 3.4 A FLA; M2 rewinder 2 HP 480 V 3.4 A FLA.',
  starters: 'Both M1 and M2 on VFDs.',
  'vfd-speed': 'Speed 10–60 Hz set on the HMI, 2 s ramps.',
  enclosure: 'NEMA 12 painted steel.',
  sccr: '10 kA available fault current.',
  standards: 'NFPA 79 and UL 508A.',
  location: 'Indoor, 0–40 °C, no wash-down.',
  'hmi-size': '7" HMI.',
  'hmi-look': 'Standard colours; passwords: operator none, maintenance 1111, engineer 2222.',
  cycle: 'Start: rewinder then unwinder ramp to speed; web break or Stop: both ramp down.',
  timings: 'Web break alarm after 0.5 s; ramp 2 s.',
  setpoints: 'Line speed 10–60 Hz on the HMI.',
  modes: 'Auto and Manual jog of each motor.',
};
answer(open().find((q) => q.need === 'starters')!, ANSWERS.starters);
registerStageQuestions();
assert.ok(open().some((q) => q.need === 'vfd-speed' && q.topic === 'Power and motors'), 'the VFD follow-up is asked right away, on the same page');
for (let round = 0; round < 5 && open().length; round++) {
  for (const q of open()) answer(q, (q.need && ANSWERS[q.need]) || quickChoices(q.text)[0] || 'As described.');
  registerStageQuestions();
}
assert.deepEqual(open().map((q) => q.text), [], 'everything answered on the Machine description page');
assert.deepEqual(missingNeeds({ text: specToText(useSpecStore.getState().sections), sections: useSpecStore.getState().sections }).map((n) => n.id)
  .filter((id) => !list().some((q) => q.need === id && q.status !== 'open')), [], 'the checklist is covered by the answers');

// ── Update all: the AI rewords what was already answered; nothing is asked again ──
useSettingsStore.setState({ anthropicApiKey: 'k', anthropicModel: 'm' } as never);
setClaudeInterceptor(async (o: ClaudeOptions) => {
  if (o.system.startsWith('You read a machine specification')) {
    return { reasoning: null, text: JSON.stringify({
      motors: [
        { tag: 'M1', description: 'Unwinder motor', power: 2, unit: 'hp', powerGiven: true, start: 'vfd', vertical: false, zone: 'Unwind' },
        { tag: 'M2', description: 'Rewinder motor', power: 2, unit: 'hp', powerGiven: true, start: 'vfd', vertical: false, zone: 'Rewind' },
      ],
      estops: 1, guardDoors: [], lightCurtains: [], zones: ['Unwind', 'Rewind'], interfaces: [],
      questions: ['Confirm the unwinder motor M1 nameplate full-load current for the VFD overload setting.', 'Confirm the site supply voltage is 480 VAC.', 'Confirm the available fault current at the panel for the SCCR.'],
    }) };
  }
  throw new Error('not mocked: the rules build this stage');
});
const results: StepResult[] = [];
await runUpdateAll(['electrical', 'hmi', 'program'], (r) => results.push(r));
assert.ok(results.filter((r) => r.status === 'done').length >= 2, JSON.stringify(results));
registerStageQuestions();
for (const stage of ['io', 'electrical', 'hmi', 'program', 'review'] as const) {
  const items = list().filter((q) => q.source === stage);
  assert.deepEqual(items.filter((q) => q.status === 'open').map((q) => q.text), [], `no open question from ${stage}`);
}
assert.deepEqual(open().map((q) => q.text), [], 'no open question anywhere after Update all');
assert.ok(list().some((q) => q.source === 'electrical' && q.known), 'the stage notes were settled by the Machine description answers');

// ── A gap a stage finds: asked on the Machine description page only; the stage still completes ──
setClaudeInterceptor(async () => ({ reasoning: null, text: JSON.stringify({
  motors: [{ tag: 'M1', description: 'Unwinder motor', power: 2, unit: 'hp', powerGiven: true, start: 'vfd', vertical: false, zone: 'Unwind' }],
  estops: 1, guardDoors: [], lightCurtains: [], zones: ['Unwind'], interfaces: [],
  questions: ['The unwinder brake coil is 220 VAC but the control supply is 120 VAC: how is the brake fed?'],
}) }));
const r2: StepResult[] = [];
await runUpdateAll(['electrical'], (r) => r2.push(r));
assert.equal(r2[0]?.status, 'done', 'the stage completes with its default');
registerStageQuestions();
const gap = open();
assert.equal(gap.length, 1);
assert.match(gap[0].text, /brake coil is 220 VAC/);
assert.equal(gap[0].source, 'electrical', 'found by the electrical design');
assert.equal(gap[0].topic, 'Found while designing: Electrical design', 'asked under its own heading on the Machine description page');
// The stage pages only list assumptions (read-only); the one question list is on the Machine description page.
const src = join(import.meta.dirname, '../..');
const files = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? files(p) : /\.tsx$/.test(f) ? [p] : []; });
const usesList = files(src).filter((f) => /import QuestionList from/.test(readFileSync(f, 'utf8'))).map((f) => f.slice(src.length + 1));
// The new-project wizard's description step is the machine description being written.
assert.deepEqual(usesList, ['pages/NewProjectPage.tsx', 'pages/SpecPage.tsx'], 'only the Machine description asks');

// ── Old projects: open questions left on later pages show on the Machine description page, once ──
useQuestionStore.getState().sync('old', 'electrical', [{ text: 'Confirm the rewinder motor M2 full-load current.' }]);
useQuestionStore.getState().sync('old', 'hmi', [{ text: 'Confirm the rewinder motor M2 full-load current for the overload.' }]);
const old = useQuestionStore.getState().byProject.old;
assert.equal(old.length - duplicateOpen(old).size, 1, 'the same question from two pages is asked once');
assert.ok(NEEDS.every((n) => n.question.length > 10));
console.log('one-place question tests passed');
