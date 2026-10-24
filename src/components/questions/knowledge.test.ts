/// <reference types="node" />
/**
 * One answered-knowledge base: a question answered anywhere (a review finding, the review page's
 * question list, "not applicable") is never asked again when the AI rewords it on the next run.
 * Run with:  npx tsx src/components/questions/knowledge.test.ts
 */
import assert from 'node:assert/strict';
import { findKnown, type KnownAnswer } from './knowledge';
import { qaText, reviewDecisions } from './qa';
import { setExternalKnowledge, useQuestionStore } from './useQuestionStore';
import { ANSWERED_RULE, userNotes } from './classify';
import { setClaudeInterceptor, type ClaudeOptions } from '../../lib/ai/anthropic';
import { generateRuleBasedDesign } from '../../lib/ai/machineModelAI';
import { getPart } from '../../electrical/catalog';
import { getCpu, getProfile } from '../../plc/core/profiles';
import { resolveAddresses } from '../../plc/core/profile';
import { moduleSlots } from '../../plc/core/modules';
import { EMPTY_SECTIONS, specToText } from '../../spec/types';
import type { IOPoint } from '../../types/io';
import type { DesignInputs } from '../../electrical/types';
import type { Finding, FindingMark } from '../../review/types';

// ── Matching by meaning ──
const at = { label: 'Design review', route: '/review' };
const known: KnownAnswer[] = [
  { ref: 'a', question: 'Conveyor M1 is in the motor list but not in the specification: does it exist?', answer: 'No, there is no conveyor M1.', where: at },
  { ref: 'b', question: 'Unwinder motor 220 V on a 480 VAC 3-phase supply: how is it fed?', answer: 'Use a 480 V motor on its VFD.', where: at },
  { ref: 'c', question: 'What is the unwinder motor full-load current?', answer: '4.2 A', where: at },
  { ref: 'd', question: 'Is motor M2 2 HP?', answer: 'Yes', where: at },
];
const ref = (t: string) => findKnown(t, known)?.ref ?? null;
assert.equal(ref('The customer confirmed conveyor M1 does not exist, so confirm it is removed from the motor list and panel.'), 'a');
assert.equal(ref('The unwinder motor is stated as 220 V 3-phase but the supply is 480 VAC 3-phase, so confirm how the motor and VFD are fed.'), 'b');
assert.equal(ref('Confirm the unwinder motor nameplate full-load current for the VFD overload setting.'), 'c');
assert.equal(ref('Unwinder FLA for the drive overload?'), 'c');
// Other equipment, other topic: still asked.
assert.equal(ref('Is motor M1 2 HP?'), null, 'M1 is not M2');
assert.equal(ref('Confirm the rewinder motor full-load current.'), null, 'rewinder is not unwinder');
assert.equal(ref('What enclosure rating is needed: NEMA 12 or NEMA 4X?'), null);
assert.equal(ref('Motor M3 power not given — assumed 1 HP; confirm the nameplate.'), null);

// ── The cycle: answer on the design review → regenerate the electrical design → no repeat ──
const P = 'cycle';
const io = [['E-Stop OK (safety relay)', 'input'], ['Start Button', 'input'], ['Unwinder run', 'output'], ['Conveyor motor contactor', 'output']]
  .map(([description, type], i) => ({ id: `p${i}`, description, type, category: 'Operator/HMI' })) as IOPoint[];
const profile = getProfile('click');
const cpu = getCpu(profile, 'C0-10DD1E-D');
const addresses = resolveAddresses(profile, cpu, io, moduleSlots([]));
const inputs: DesignInputs = { supply: '480VAC-3PH', enclosureRating: 'NEMA 12', notes: '', motors: [], requiredParts: [] };
const sections = { ...EMPTY_SECTIONS, overview: 'Web line: an unwinder (VFD) feeds a rewinder. Supply 480 VAC 3-phase.' };
const machine = (questions: string[]) => JSON.stringify({
  motors: [
    { tag: 'M2', description: 'Unwinder motor', power: 2, unit: 'hp', powerGiven: true, start: 'vfd', vertical: false, zone: 'Unwind' },
    { tag: 'M3', description: 'Rewinder motor', power: 2, unit: 'hp', powerGiven: true, start: 'vfd', vertical: false, zone: 'Rewind' },
  ],
  estops: 1, guardDoors: [], lightCurtains: [], zones: ['Unwind', 'Rewind'], interfaces: [], questions,
});
let prompt = '';
const electrical = async (questions: string[], spec: string) => {
  setClaudeInterceptor(async (o: ClaudeOptions) => {
    prompt = o.system + o.messages.map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('');
    return { reasoning: null, text: machine(questions) };
  });
  const r = await generateRuleBasedDesign({ spec, io, addresses, inputs, plc: { vendor: profile.vendor, name: profile.name, cpuPartNumber: cpu.id, cpuLabel: cpu.label }, modules: [], region: 'US', getPart, hmiPartNumber: 'CM5-T7W', now: '2026-01-01T00:00:00.000Z', apiKey: 'k', model: 'm', effort: 'low' });
  // What the Electrical page registers as "Assumptions to confirm".
  useQuestionStore.getState().sync(P, 'electrical', userNotes(r.design).map((n) => ({ text: n, assumption: n })));
};
const list = () => useQuestionStore.getState().byProject[P] ?? [];
const auto = (re: RegExp) => list().find((q) => re.test(q.text))!;
const open = () => list().filter((q) => q.status === 'open').map((q) => q.text);

// 1. First design: the AI asks.
await electrical([
  'Conveyor M1 is in the designer motor list but not in the specification: confirm it exists.',
  'Unwinder motor M2 full-load current is not stated: confirm the nameplate FLA.',
  'Is a recipe screen needed for different web widths?',
], specToText(sections));
assert.ok(open().some((t) => /Conveyor M1/.test(t)) && open().some((t) => /full-load current/.test(t)));

// 2. On the design review the user answers: a finding marked resolved, an info finding's question, an electrical question
//    in the review's "all stages" list, and "not applicable" for the recipe question.
const findings: Finding[] = [
  { id: 'chk:motor-voltage:M2', source: 'check', severity: 'major', area: 'electrical', title: 'Unwinder motor M2 is 220 V but the supply is 480 VAC 3-phase', detail: 'The motor voltage does not match the supply.', fix: 'Use a 480 V motor or a transformer.', page: 'electrical', item: 'M2' },
];
const marks: Record<string, FindingMark> = { 'chk:motor-voltage:M2': { status: 'resolved', reason: 'Motor replaced by a 480 V 3-phase motor fed from its VFD.', at: '2026-10-17T10:00:00Z' } };
setExternalKnowledge(() => reviewDecisions(findings, marks));
useQuestionStore.getState().sync(P, 'review', [{ text: 'Conveyor M1 not in the specification: does conveyor M1 exist?' }]);
const st = useQuestionStore.getState();
const byText = (re: RegExp) => list().find((q) => re.test(q.text) && q.status === 'open')!;
st.answer(P, byText(/does conveyor M1 exist/).id, 'No — there is no conveyor M1; remove it.', 'answered');
st.answer(P, byText(/full-load current/).id, '6.8 A', 'answered');
st.answer(P, byText(/recipe screen/).id, '', 'dismissed');
st.answer(P, byText(/Motor currents from NEC/).id, 'M3 nameplate 3.4 A.', 'answered');
// Answering on the review also answered the electrical question about the same thing.
assert.equal(list().find((q) => /Conveyor M1 is in the designer/.test(q.text))?.status, 'answered', 'same question on another page answered too');
assert.deepEqual(open(), []);

// 3. Regenerate the electrical design: every answer reaches the AI, with the rule not to ask again.
const qa = qaText(list(), reviewDecisions(findings, marks));
await electrical([
  'The customer confirmed conveyor M1 does not exist, so confirm it is removed from the motor list and panel.',
  'The unwinder motor is stated as 220 V 3-phase but the supply is 480 VAC 3-phase, so confirm how the motor and VFD are fed.',
  'Confirm the unwinder motor nameplate full-load current for the VFD overload setting.',
  'Confirm whether recipes are needed for the web widths.',
  'Confirm the rewinder motor M3 full-load current.',
  'What air pressure is available on site?',
], specToText({ ...sections, qa }));
for (const s of ['there is no conveyor M1', '6.8 A', 'fed from its VFD', 'Not applicable']) assert.ok(prompt.includes(s), `prompt has the answer "${s}"`);
assert.ok(prompt.includes(ANSWERED_RULE));

// 4. No repeat: the reworded questions are answered from where they were answered, with a link; only the new one is open.
assert.deepEqual(open(), ['What air pressure is available on site?']);
assert.equal(auto(/rewinder motor M3/).answer, 'M3 nameplate 3.4 A.', 'M3 current was answered with the motor currents');
assert.equal(auto(/removed from the motor list/).known?.where.label, 'Machine description', 'every question is answered on the Machine description page');
assert.match(auto(/removed from the motor list/).answer, /no conveyor M1/);
assert.equal(auto(/how the motor and VFD are fed/).known?.where.route, '/review');
assert.match(auto(/how the motor and VFD are fed/).answer, /^Resolved: Motor replaced/);
assert.equal(auto(/VFD overload setting/).answer, '6.8 A');
assert.match(auto(/VFD overload setting/).known?.where.route ?? '', /^\/spec\?q=/);
assert.equal(auto(/recipes are needed/).status, 'dismissed', "not applicable — don't ask again");
// Automatic answers do not change the spec's Q&A: a reworded question never makes a stage out of date.
assert.equal(qaText(list(), reviewDecisions(findings, marks)), qa);

// 5. Changing the original answer moves the copies with it; "not the same question" asks it for real.
st.answer(P, list().find((q) => q.text === 'Unwinder motor M2 full-load current is not stated: confirm the nameplate FLA.')!.id, '7.1 A', 'answered');
assert.equal(auto(/VFD overload setting/).answer, '7.1 A');
useQuestionStore.getState().reopen(P, auto(/VFD overload setting/).id);
assert.equal(auto(/VFD overload setting/).status, 'open');
useQuestionStore.getState().resolveKnown(P);
assert.equal(auto(/VFD overload setting/).status, 'open', 'a reopened automatic answer stays open');

console.log('knowledge tests passed');
