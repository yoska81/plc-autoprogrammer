/// <reference types="node" />
/**
 * Question helpers. Run with:  npx tsx src/components/questions/questions.test.ts
 */
import assert from 'node:assert/strict';
import { guessSection, quickChoices } from './parse';
import { NEEDS } from '../../spec/needs';
import { qaText, answerText } from './qa';
import { EMPTY_SECTIONS, fingerprint, specToText, changedSections } from '../../spec/types';
import { questionId, useQuestionStore, type Question } from './useQuestionStore';
import { isIssueNote, isTechnicalIssue, normalizeNotes, userNotes } from './classify';

// Quick choices
assert.deepEqual(quickChoices('How is the lift axis homed: home switch or hard stop?'), ['home switch', 'hard stop']);
assert.deepEqual(quickChoices('What stop category for the guard door: 0 or 1?'), ['0', '1']);
assert.deepEqual(quickChoices('Is the guard door stop category 0 or 1?'), ['0', '1']);
assert.deepEqual(quickChoices('Stack light colours: red, amber or green?'), ['red', 'amber', 'green']);
assert.deepEqual(quickChoices('Does the clamp need both open and closed sensors?'), ['Yes', 'No']);
assert.deepEqual(quickChoices('How many parts per minute at most?'), []);
assert.deepEqual(quickChoices('Assumed 480 VAC 3-phase supply with 65 kA available fault current.'), ['Correct as stated']);
// Never cut inside parentheses or standard names; unsure → no buttons (the questions from the Machine description checklist).
assert.deepEqual(quickChoices('Which PLC and HMI brand should be used (e.g. Allen-Bradley, Siemens, AutomationDirect), or is any brand fine?'), []);
assert.deepEqual(quickChoices('Which standards must the machine meet (e.g. NFPA 79 and UL 508A, CSA, or CE / IEC 60204-1)?'), []);
assert.deepEqual(quickChoices('Which HMI screen size (e.g. 7", 10" or 15"), or no HMI (pushbuttons only)?'), []);
assert.deepEqual(quickChoices('Describe the automatic cycle step by step: what moves, in which order, and what each step waits for.'), [], 'a request, not an assumption');
assert.deepEqual(quickChoices('Is a VFD or soft starter needed for the unwinder motor?'), [], 'options that cannot be cut cleanly: no buttons, not Yes / No');
assert.deepEqual(quickChoices('Guard door stop category (per the risk assessment): 0 or 1?'), ['0', '1'], 'a note in parentheses is dropped, the options stay');
assert.deepEqual(quickChoices('Which 24 VDC sensor outputs are used: PNP (sourcing) or NPN (sinking)?'), ['PNP', 'NPN']);
for (const n of NEEDS) {
  const c = quickChoices(n.question);
  assert.ok(c.every((o) => !/[()]/.test(o) && !/\be\.g\./i.test(o) && o.split(' ').length <= 5), `${n.id}: whole options only (${JSON.stringify(c)})`);
}

// Sections (still used to group answers in documents)
assert.equal(guessSection('How is the lift axis homed: home switch or hard stop?', 'spec'), 'homing');
assert.equal(guessSection('What stop category for the guard door?', 'spec'), 'guarding');
assert.equal(guessSection('How many parts per minute at most?', 'spec'), 'overview');
assert.equal(guessSection('Anything else we should know?', 'spec'), 'other');

// Q&A text: answered and assumed questions in the order asked; open ones are not part of the spec yet.
const q = (text: string, answer: string, status: Question['status'], source: Question['source'] = 'spec', assumption?: string): Question =>
  ({ id: questionId(source, text), source, text, answer, status, date: '2026-10-16 12:00', merged: false, assumption });
const list = [
  q('How many parts per minute at most?', '60 parts per minute', 'answered'),
  q('Which homing speed?', '', 'open'),
  q('Assumed 480 VAC supply.', '', 'assumed', 'electrical', 'Assumed 480 VAC supply.'),
  q('Air dump valve on E-stop?', '', 'assumed', 'review', 'Add a dump valve'),
];
assert.equal(qaText(list), [
  'Q (Machine description): How many parts per minute at most?\nA: 60 parts per minute',
  "Q (Electrical design): Assumed 480 VAC supply.\nA: (AI's assumption: use the engineer's judgement)",
  "Q (Design review): Air dump valve on E-stop?\nA: (AI's assumption: Add a dump valve)",
].join('\n'));
assert.equal(answerText(list[0]), '60 parts per minute');

// The Q&A is part of the spec text and fingerprint, but not copied into the sections.
const base = { ...EMPTY_SECTIONS, overview: 'Conveyor with a pusher.' };
const withQa = { ...base, qa: qaText(list) };
assert.ok(specToText(withQa).includes('## Questions and answers\nQ (Machine description): How many parts per minute at most?\nA: 60 parts per minute'));
assert.equal(withQa.overview, 'Conveyor with a pusher.');
assert.notEqual(fingerprint(base), fingerprint(withQa), 'answering changes the spec fingerprint');
assert.deepEqual(changedSections(base, withQa), ['Questions and answers']);
assert.equal(specToText(base).includes('Questions and answers'), false);
assert.equal(questionId('spec', ' Same? '), questionId('spec', 'same?'));

// Only real questions / assumptions reach the Q&A; technical issues go to the design review.
for (const t of [
  'I/O Status: no header bar and the top band is in use; add one on the HMI page.',
  'Layout check: No header bar (title, alarm banner, time) on this screen.',
  'Main: “Start” overlaps “Stop” and could not be moved automatically; adjust it on the HMI page.',
  'Main: 2 touch target(s) enlarged to at least 60×40 px.',
  'A safety controller is needed but not in the catalog.',
]) assert.ok(isTechnicalIssue(t), t);
for (const t of ['How many parts per minute at most?', 'Motor M1 assumed 2 HP; confirm the nameplate.', 'Which operator password levels are needed?']) assert.ok(!isTechnicalIssue(t), t);
const notes = normalizeNotes([
  { kind: 'question', text: 'Which operator password levels are needed?' },
  { kind: 'assumption', text: 'Motor M1 assumed 2 HP; confirm the nameplate.' },
  { kind: 'issue', text: 'Interposing relay K5 sized for 10 A.' },
  'Main: header bar added.',
  'Recipe screen assumed not needed.',
]);
assert.deepEqual(notes.map((n) => n.kind), ['question', 'assumption', 'issue', 'issue', 'assumption']);
const design = { notes: [...notes.map((n) => n.text), 'Layout check: No header bar.'], askUser: notes.filter((n) => n.kind !== 'issue').map((n) => n.text) };
assert.deepEqual(userNotes(design), ['Which operator password levels are needed?', 'Motor M1 assumed 2 HP; confirm the nameplate.', 'Recipe screen assumed not needed.']);
assert.ok(isIssueNote(design, 'Interposing relay K5 sized for 10 A.') && isIssueNote(design, 'Layout check: No header bar.'));
assert.ok(!isIssueNote(design, 'Recipe screen assumed not needed.'));
// Older designs without askUser: everything that is not a technical issue.
assert.deepEqual(userNotes({ notes: ['Example HMI design.', 'I/O Status: no header bar and the top band is in use; add one on the HMI page.'] }), ['Example HMI design.']);
// The store never takes a technical issue as a question.
useQuestionStore.getState().sync('t', 'hmi', [{ text: 'Main: header bar added.' }, { text: 'Which operator password levels are needed?' }]);
assert.deepEqual(useQuestionStore.getState().byProject.t.map((x) => x.text), ['Which operator password levels are needed?']);
// Revisiting a page re-registers its questions: the list order and the Q&A text in the spec must not change
// (otherwise every stage turns "out of date: the spec changed" by itself).
{
  const st = useQuestionStore.getState();
  st.sync('r', 'io', [{ text: 'How many parts per minute at most?' }]);
  st.sync('r', 'electrical', [{ text: 'Which supply voltage is on site?' }, { text: 'Motor M1 assumed 2 HP; confirm the nameplate.' }]);
  for (const q of useQuestionStore.getState().byProject.r) useQuestionStore.getState().answer('r', q.id, 'yes', 'answered');
  const before = qaText(useQuestionStore.getState().byProject.r);
  const order = useQuestionStore.getState().byProject.r.map((q) => q.id).join();
  useQuestionStore.getState().sync('r', 'io', [{ text: 'How many parts per minute at most?' }]);
  useQuestionStore.getState().sync('r', 'electrical', [{ text: 'Motor M1 assumed 2 HP; confirm the nameplate.' }, { text: 'Which supply voltage is on site?' }]);
  assert.equal(useQuestionStore.getState().byProject.r.map((q) => q.id).join(), order, 'list order kept');
  assert.equal(qaText(useQuestionStore.getState().byProject.r), before, 'Q&A text unchanged');
  assert.equal(qaText([...useQuestionStore.getState().byProject.r].reverse()), before, 'Q&A text does not depend on list order');
}
console.log('question tests passed');
