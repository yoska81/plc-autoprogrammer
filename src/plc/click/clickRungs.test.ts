/// <reference types="node" />
/**
 * Send to CLICK, the rungs: each rung as steps for CLICK's ladder editor (the keymap's keys and dialogs), the
 * cursor followed from cell to cell, parallel rows joined, outputs at the right rail, the comment; a rung the app
 * cannot enter is the user's turn (the run waits), so the rungs stay in order; nothing saves.
 * Run with:  npx tsx src/plc/click/clickRungs.test.ts
 */
import assert from 'node:assert/strict';
import type { LadderProgram, Rung } from '../core/ladder';
import { DEFAULT_KEYMAP, endRung, rungsPlan, value, type ClickKeymap } from './clickRungs';
import type { ClickStep } from './clickPlan';
import { saveSteps } from './clickPlan';
import { seedSampleProject } from '../../preview/sampleProject';
import { collectProject } from '../../deliverables/collect';

const km: ClickKeymap = DEFAULT_KEYMAP;
const prog = (rungs: Rung[]): LadderProgram => ({ rungs, tags: [] });
const labels = new Map([['X001', 'Start'], ['X002', 'Stop'], ['Y001', 'Motor']]);
// the plan's rungs without the END rung it ends with
const rungsOnly = (steps: ClickStep[]) => steps.slice(0, steps.length - endRung(km).length);

// A seal-in: X001 OR Y001 (row 2), AND NOT X002, → OUT Y001; with a comment.
const sealIn: Rung = { id: 'r1', comment: 'Motor run', branches: [[{ type: 'NO', address: 'X001' }, { type: 'NC', address: 'X002' }], [{ type: 'NO', address: 'Y001' }]], outputs: [{ type: 'OUT', address: 'Y001' }] };
const p1 = rungsPlan(prog([sealIn]), labels, km);
assert.equal(p1.entered, 1);
assert.deepEqual(p1.leftForYou, []);
const s = rungsOnly(p1.steps);
assert.deepEqual(p1.steps.slice(s.length), endRung(km), 'the program ends with the END rung (CLICK\'s Syntax Check wants one)');
assert.ok(endRung(km).some((x) => x.do === 'doubleClick' && x.find?.name === '^End$'));
assert.equal(s[1].keys, km.newRung);
assert.match(s[1].say!, /^Rung 1: Motor run$/);
const opened = s.filter((x) => x.do === 'doubleClick').map((x) => x.find!.name!);
assert.deepEqual(opened.map((x) => ['Contact (NO)', 'Contact (NC)', 'Out', 'NO Contact', 'NC Contact'].filter((n) => new RegExp(x).test(n)).join('|')), ['Contact (NO)|NO Contact', 'Contact (NC)|NC Contact', 'Contact (NO)|NO Contact', 'Out'], 'the instructions in order: row 1, row 2, the output (CLICK 4 and CLICK 3 names)');
const texts = s.filter((x) => x.do === 'setText').map((x) => x.text);
assert.deepEqual(texts, ['X001', 'X002', 'Y001', 'Y001'], 'addresses without their nickname');
assert.equal(s.filter((x) => x.do === 'keys').at(-1)!.keys, 'Motor run', 'the comment typed last (Edit Rung Comment has the cursor in its text)');
// cursor: row 1 col 1 → (a dialog leaves it one to the right) col 2, already there; row 2 col 1; back on that row's
// last cell to join it up; the output at the rail (column 32) of row 1; the comment
const keys = s.filter((x) => x.do === 'keys').map((x) => x.keys);
// (row 2 is added to the rung first: CLICK's Insert dialog, a row after the cursor's)
// (the Insert dialog leaves the cursor on the new row, same column: only the column moves after it)
// the join from the cell after the row's last instruction (the wire is drawn on the cursor cell's left edge); the
// output column by End
// (the wire up takes the cursor to row 1 with it: the output is on that row already)
assert.deepEqual(keys, [km.newRung, '{INSERT}', km.move(0, -2), km.joinUp, '{END}', km.comment!.keys, 'Motor run'], keys.join(' | '));
assert.ok(s.some((x) => x.do === 'click' && x.find?.name === '^Row$') && s.some((x) => x.do === 'click' && x.find?.name === '^After Cursor$'), 'a row, after the cursor');
assert.equal(km.move(1, -2), '{DOWN 1}{LEFT 2}');
assert.equal(km.move(0, 0), '');
assert.ok(s.filter((x) => x.optional).length === 3, 'the comment dialog is optional');
assert.deepEqual(saveSteps(s), []);

// Timer (on-delay, constant preset, unit picked), compare contact (operator picked).
const timer: Rung = { id: 'r2', comment: '', branches: [[{ type: 'CMP', left: 'DS1', op: '>=', right: '10' }]], outputs: [{ type: 'TMR', address: 'T1', mode: 'ON_DELAY', preset: '500', unit: 'ms', accumulate: false, resetAddress: null }] };
const p2 = rungsPlan(prog([timer]), labels, km).steps;
assert.ok(p2.some((x) => x.do === 'click' && x.mouse && x.find?.id === '5010'), 'compare operator: its >= button (CLICK 4.00\'s symbol buttons)');
assert.ok(p2.some((x) => x.do === 'setText' && x.text === '500') && p2.some((x) => x.do === 'select' && x.item === '^msec'), 'timer setpoint and unit');
assert.ok(!p2.some((x) => x.do === 'keys' && x.keys === km.comment!.keys), 'no comment, no comment step');

// Two outputs: the second on row 2 of the output column, joined up to the first on that column's left edge
const two: Rung = { id: 'r5', comment: '', branches: [[{ type: 'NO', address: 'X001' }]], outputs: [{ type: 'OUT', address: 'Y001' }, { type: 'OUT', address: 'Y002' }] };
const k5 = rungsOnly(rungsPlan(prog([two]), labels, km).steps).filter((x) => x.do === 'keys').map((x) => x.keys);
assert.deepEqual(k5, [km.newRung, '{END}', '{INSERT}', km.joinUp], k5.join(' | '));

// What the app cannot enter: the user's turn, in its place (the next rung is entered after it).
const retentive: Rung = { id: 'r3', comment: 'Run hours', branches: [[{ type: 'NO', address: 'Y001' }]], outputs: [{ type: 'TMR', address: 'T2', mode: 'ON_DELAY', preset: '3600', unit: 'sec', accumulate: true, resetAddress: 'C5' }] };
const raw: Rung = { id: 'r4', comment: '', branches: [[{ type: 'RAW', vendor: 'click', text: 'SHIFT' }]], outputs: [{ type: 'OUT', address: 'C9' }] };
const p3 = rungsPlan(prog([sealIn, retentive, raw, timer]), labels, km);
assert.equal(p3.entered, 2);
assert.deepEqual(p3.leftForYou.map((x) => x.number), [2, 3]);
assert.match(p3.leftForYou[0].why, /Timer with a reset input/);
const turns = p3.steps.filter((x) => x.do === 'waitUser');
assert.equal(turns.length, 2);
assert.match(turns[0].text!, /^Type rung 2 \(Run hours\) in CLICK from the entry sheet/);
assert.ok(p3.steps.indexOf(turns[1]) < p3.steps.findIndex((x) => x.say === 'Rung 4'), 'the rungs stay in order');
// one click: the user's rungs are left out of the run and listed, each with the rung it goes after
const p4 = rungsPlan(prog([sealIn, retentive, raw, timer]), labels, km, 'list');
assert.equal(p4.entered, 2);
assert.ok(!p4.steps.some((x) => x.do === 'waitUser'), 'nothing waits for the user');
assert.deepEqual(p4.leftForYou.map((x) => [x.number, x.after]), [[2, 1], [3, 1]]);
assert.ok(p4.steps.some((x) => x.say === 'Rung 4') && !p4.steps.some((x) => /^Rung [23]\b/.test(x.say ?? '')));

assert.equal(value('X001 (Start)'), 'X001');
assert.equal(value('500'), '500');

// The example program: every rung entered or handed over, in order, nothing saved.
seedSampleProject();
const p = collectProject();
const all = rungsPlan(p.ladder, p.labels);
assert.equal(all.entered + all.leftForYou.length, p.ladder.rungs.length);
assert.ok(all.entered > p.ladder.rungs.length / 2, `${all.entered} of ${p.ladder.rungs.length} entered`);
const order = all.steps.filter((x) => x.say && /^Rung \d+/.test(x.say)).map((x) => Number(/^Rung (\d+)/.exec(x.say!)![1]));
assert.deepEqual(order, order.slice().sort((a, b) => a - b));
assert.deepEqual(saveSteps(all.steps), []);
console.log(`clickRungs.test: all passed (${all.entered} of ${p.ladder.rungs.length} example rungs entered, ${all.leftForYou.length} handed over)`);
