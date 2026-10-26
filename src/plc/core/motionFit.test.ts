/// <reference types="node" />
/**
 * Motion limits from the PLC's part ratings: a CLICK C0 counts encoders but has no pulse outputs; a CLICK PLUS
 * gives up to 3 pulse axes on its slot-0 module; too many axes / encoders, too high a rate or coordinated motion
 * is reported with what would fit — never generated silently.
 * Run with:  npx tsx src/plc/core/motionFit.test.ts
 */
import assert from 'node:assert/strict';
import { motionFit, motionNeed, rateKHz } from './motionFit';
import { getPart } from '../../electrical/catalog';

const P = (description: string, type: 'input' | 'output', category = 'Servo/Axis') => ({ description, type, category });
const AXIS1 = [P('Axis 1 servo pulse', 'output'), P('Axis 1 servo direction', 'output'), P('Axis 1 servo enable', 'output'), P('Axis 1 servo ready', 'input'), P('Axis 1 servo fault', 'input'), P('Axis 1 home sensor', 'input')];
const ENC1 = [P('Encoder 1 A (1000 PPR, 600 rpm)', 'input', 'Product Detection'), P('Encoder 1 B', 'input', 'Product Detection')];

assert.equal(rateKHz('1000 PPR at 3000 rpm'), 50);
assert.equal(rateKHz('Encoder 2500 pulses/rev, 3000 rpm, quadrature x4'), 500);
assert.equal(rateKHz('step input 200 kHz max'), 200);
assert.equal(rateKHz('Encoder A'), undefined);

const need = motionNeed([...AXIS1, ...ENC1]);
assert.deepEqual(need.ptoAxes.map((a) => a.name), ['Axis 1']);
assert.deepEqual(need.encoders.map((e) => `${e.name} ${e.withZ} ${e.maxKHz}`), ['Encoder 1 false 10']);
assert.equal(need.coordinated, null);

// CLICK C0: the encoder fits (HSC on X1-X4), the pulse axis does not → CLICK PLUS recommended.
const c0 = motionFit([...AXIS1, ...ENC1], getPart('C0-11DD2E-D'));
assert.equal(c0.ok, false);
assert.deepEqual(c0.problems, ['1 pulse-train axis needed; C0-11DD2E-D has no pulse-train (PTO) outputs.']);
assert.match(c0.recommend[0], /CLICK PLUS .* in option slot 0/);
assert.ok(c0.recommend.some((x) => /own indexer/.test(x)));
assert.ok(motionFit(ENC1, getPart('C0-11DD2E-D')).ok, 'an encoder alone fits a CLICK C0');

// CLICK PLUS: one axis + one encoder fit, with the slot-0 note; four axes do not.
const plus = motionFit([...AXIS1, ...ENC1], getPart('C2-03CPU'));
assert.ok(plus.ok, plus.problems.join(' '));
assert.ok(plus.notes.some((x) => /option-slot module in Slot 0/.test(x)), plus.notes.join(' '));
const four = ['1', '2', '3', '4'].flatMap((k) => [P(`Axis ${k} pulse`, 'output'), P(`Axis ${k} direction`, 'output')]);
assert.deepEqual(motionFit(four, getPart('C2-03CPU')).problems, ['4 pulse-train axes needed; C2-03CPU gives 3.']);
assert.ok(motionFit(four, getPart('C2-03CPU')).recommend.some((x) => /Productivity|BRX/.test(x)));

// Too fast an encoder, too many Z channels, coordinated motion.
assert.match(motionFit([P('Encoder 1 A (2500 PPR, 3000 rpm, x4)', 'input'), P('Encoder 1 B', 'input')], getPart('C2-03CPU')).problems[0], /Encoder 1 gives 500\.0 kHz; .* up to 100 kHz/);
const z = ['1', '2', '3'].flatMap((k) => [P(`Encoder ${k} A`, 'input'), P(`Encoder ${k} B`, 'input'), P(`Encoder ${k} Z index`, 'input')]);
assert.match(motionFit(z, getPart('C2-03CPU')).problems[0], /3 encoders with a Z \(index\) channel needed; C2-03CPU counts up to 2 with Z/);
// CLICK PLUS interpolates up to 3 axes on a straight line (help 296); circular moves / camming do not fit; a CLICK C0 has none.
const AXIS2 = [P('Axis 2 servo pulse', 'output'), P('Axis 2 servo direction', 'output')];
assert.ok(motionFit([...AXIS1, ...AXIS2], getPart('C2-03CPU'), 'Two-axis gantry with linear interpolation').ok, 'linear interpolation of 2 axes fits CLICK PLUS');
const circ = motionFit([...AXIS1, ...AXIS2], getPart('C2-03CPU'), 'XY table cutting arcs with circular interpolation');
assert.equal(circ.ok, false);
assert.match(circ.problems[0], /circular moves, electronic gearing or camming: C2-03CPU only moves axes on straight-line vectors/);
assert.ok(circ.recommend.some((x) => /Productivity|BRX/.test(x)));
assert.match(motionFit(AXIS1, getPart('C0-11DD2E-D'), 'gantry').problems.join(' '), /no coordinated motion/);

// No motion: nothing to say.
assert.deepEqual(motionFit([P('Start pushbutton', 'input', 'Operator/HMI')], getPart('C0-10DD1E-D')), { ok: true, need: { ptoAxes: [], encoders: [], coordinated: null }, problems: [], recommend: [], notes: [] });

console.log('motionFit tests passed');
