/// <reference types="node" />
/**
 * The CLICK calibration: three sample rungs entered through the keymap (all by the app, none left to the user,
 * nothing saved), printed, and read back: a printout with every sample rung fits; one with a rung wrong does not
 * and the report names it, with the version, the keymap and the steps.
 * Run with:  npx tsx src/plc/click/clickCalibrate.test.ts
 */
import assert from 'node:assert/strict';
import { saveSteps } from './clickPlan';
import { rungAddressesInOrder } from './clickVerify';
import { CALIBRATION_PDF, CALIBRATION_PROGRAM, calibrationPlan, calibrationReport, calibrationResult } from './clickCalibrate';

const plan = calibrationPlan('C:\\Users\\tech\\AppData\\Roaming\\ISA Auto Programmer\\click');
assert.equal(plan.entered, 3, 'the app enters all three');
assert.deepEqual(saveSteps([...plan.rungs, ...plan.print]), [], 'nothing saved');
assert.ok(!plan.rungs.some((s) => s.do === 'waitUser'), 'no rung left to the user');
assert.ok(plan.rungs.some((s) => s.do === 'keys' && s.keys === '+{UP}'), 'the seal-in joins its parallel row');
assert.ok(plan.rungs.some((s) => s.do === 'setText' && s.text === 'T50'), 'the timer');
assert.ok(plan.print.some((s) => s.do === 'setText' && s.text?.endsWith(`\\${CALIBRATION_PDF}`)));
assert.ok(plan.print.some((s) => s.do === 'waitGone' && /press Save/.test(s.say ?? '')), 'the user presses Save');

const rows = rungAddressesInOrder(CALIBRATION_PROGRAM);
const printed = (change?: [number, string]) => ['Calibration  Page 1', ...rows.map((r) => `${r.rung}  ${r.addresses.map((a, i) => (change && change[0] === r.rung && i === 0 ? change[1] : a)).join('  ')}`), 'END'].join('\n');
const good = calibrationResult(printed());
assert.equal(good.fits, true);
const bad = calibrationResult(printed([1, 'X009']));
assert.equal(bad.fits, false);
assert.deepEqual(bad.check.differences, [{ rung: 1, missing: ['X001'] }]);
assert.deepEqual(bad.check.extra, ['X009']);

const report = calibrationReport({ clickVersion: '3.60', when: '2026-10-22 09:00', result: bad, printedText: printed([1, 'X009']), steps: [...plan.rungs, ...plan.print] });
assert.match(report, /CLICK Programming Software: 3\.60/);
assert.match(report, /1 of 3 sample rungs|2 of 3 sample rungs/);
assert.match(report, /Rung 1: X001 not where it should be/);
assert.match(report, /In CLICK but not in the sample: X009/);
assert.match(report, /2\. Calibration 2: seal-in: NO X002 AND NC X003 OR NO C2001 AND NC X003 -> OUT C2001/);
assert.match(report, /The steps \(\d+\):/);
assert.match(calibrationReport({ clickVersion: '3.60', when: 'now', result: good, printedText: printed(), steps: [] }), /the keys fit this CLICK/);
assert.match(calibrationReport({ clickVersion: '', when: 'now', result: null, error: 'Stopped, as you asked.', printedText: '', steps: [] }), /Stopped: Stopped, as you asked\./);
console.log('clickCalibrate.test: all passed');
