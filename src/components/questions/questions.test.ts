/// <reference types="node" />
/**
 * Question helpers. Run with:  npx tsx src/components/questions/questions.test.ts
 */
import assert from 'node:assert/strict';
import { guessSection, quickChoices } from './parse';
import { qaText, answerText } from './qa';
import { EMPTY_SECTIONS, fingerprint, specToText, changedSections } from '../../spec/types';
import { questionId, type Question } from './useQuestionStore';

// Quick choices
assert.deepEqual(quickChoices('How is the lift axis homed: home switch or hard stop?'), ['home switch', 'hard stop']);
assert.deepEqual(quickChoices('What stop category for the guard door: 0 or 1?'), ['0', '1']);
assert.deepEqual(quickChoices('Is the guard door stop category 0 or 1?'), ['0', '1']);
assert.deepEqual(quickChoices('Stack light colours: red, amber or green?'), ['red', 'amber', 'green']);
assert.deepEqual(quickChoices('Does the clamp need both open and closed sensors?'), ['Yes', 'No']);
assert.deepEqual(quickChoices('How many parts per minute at most?'), []);
assert.deepEqual(quickChoices('Assumed 480 VAC 3-phase supply with 65 kA available fault current.'), ['Correct as stated']);

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
console.log('question tests passed');
