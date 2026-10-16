/// <reference types="node" />
/**
 * Question helpers. Run with:  npx tsx src/components/questions/questions.test.ts
 */
import assert from 'node:assert/strict';
import { guessSection, quickChoices } from './parse';
import { appendAnswers, answerLine } from './merge';
import { EMPTY_SECTIONS } from '../../spec/types';
import { questionId, type Question } from './useQuestionStore';

// Quick choices
assert.deepEqual(quickChoices('How is the lift axis homed: home switch or hard stop?'), ['home switch', 'hard stop']);
assert.deepEqual(quickChoices('What stop category for the guard door: 0 or 1?'), ['0', '1']);
assert.deepEqual(quickChoices('Is the guard door stop category 0 or 1?'), ['0', '1']);
assert.deepEqual(quickChoices('Stack light colours: red, amber or green?'), ['red', 'amber', 'green']);
assert.deepEqual(quickChoices('Does the clamp need both open and closed sensors?'), ['Yes', 'No']);
assert.deepEqual(quickChoices('How many parts per minute at most?'), []);
assert.deepEqual(quickChoices('Assumed 480 VAC 3-phase supply with 65 kA available fault current.'), ['Correct as stated']);

// Sections
assert.equal(guessSection('How is the lift axis homed: home switch or hard stop?', 'spec'), 'homing');
assert.equal(guessSection('What stop category for the guard door?', 'spec'), 'guarding');
assert.equal(guessSection('How many parts per minute at most?', 'spec'), 'overview');
assert.equal(guessSection('Anything else we should know?', 'spec'), 'other');

// Plain merge: under a heading in the matching section, once.
const q = (text: string, answer: string, status: Question['status'] = 'answered'): Question =>
  ({ id: questionId('spec', text), source: 'spec', text, answer, status, date: '2026-10-16 12:00', merged: false });
const a = q('How is the lift axis homed: home switch or hard stop?', 'home switch');
const s1 = appendAnswers({ ...EMPTY_SECTIONS, homing: '- Z axis homes first.' }, [a]);
assert.equal(s1.homing, `- Z axis homes first.\n\nAnswers to open questions:\n${answerLine(a)}`);
const b = q('Which homing speed?', '', 'assumed');
const s2 = appendAnswers(appendAnswers(s1, [a]), [{ ...b, section: 'homing' }]);
assert.equal(s2.homing.split('Answers to open questions:').length, 2, 'one heading per section');
assert.ok(s2.homing.includes("A: no preference — use the engineer's assumption"));
assert.equal(questionId('spec', ' Same? '), questionId('spec', 'same?'));
console.log('question tests passed');
