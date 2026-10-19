/// <reference types="node" />
/**
 * The power sheet draws only the bus phases something taps: a 3-phase supply with no motors and a 2-pole power-supply
 * tap ends L3 at the disconnect as an unnumbered spare stub (the wire list has no 1L3), not as a numbered 1L3 to nothing.
 * Run with:  npx tsx src/electrical/drawings/powerSheet.test.ts
 */
import assert from 'node:assert/strict';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { planDrawings } from './plan';
import { PowerSheet } from './sheets/SchematicSheets';
import { getPart } from '../catalog';
import { designWarnings, type DrawingContext } from '../derive';
import { DESIGN } from '../../preview/sampleProject';

// tsx compiles the sheet's JSX with the classic runtime: React in scope.
(globalThis as { React?: unknown }).React = React;
const io = DESIGN.ioWiring.map((w) => ({ address: w.address, description: w.description, type: (w.address.startsWith('X') ? 'input' : 'output') as 'input' | 'output' }));
const MOTOR = ['vfd', 'contactor', 'overload', 'motorProtector'];
const components = DESIGN.components
  .filter((c) => !c.motorTag && !MOTOR.includes(getPart(c.partNumber)?.category ?? ''))
  .map((c) => (getPart(c.partNumber)?.category === 'powerSupply' ? { ...c, partNumber: 'C0-01AC' } : c)); // 1-phase supply
const ctx: DrawingContext = {
  projectName: 'Spare phase', getPart, io,
  plc: { vendor: 'AutomationDirect', name: 'CLICK', cpuPartNumber: 'C0-10DD1E-D', cpuLabel: '' },
  design: { ...DESIGN, inputs: { ...DESIGN.inputs, motors: [] }, components },
};
const plan = planDrawings(ctx);
assert.equal(plan.model.phases, 3);
assert.equal(plan.model.motors.length, 0);
assert.ok(!plan.model.wires.some((w) => w.wire === '1L3'), 'no 1L3 in the wire list');
const sheet = plan.sheets.find((s) => s.spec.kind === 'power')!;
const svg = renderToStaticMarkup(createElement('svg', null, createElement(PowerSheet, { plan, sheet })));
assert.ok(!svg.includes('>1L3<'), 'the untapped phase is not numbered 1L3');
assert.ok(svg.includes('>SPARE<') && svg.includes('>1L1<') && svg.includes('>1L2<'), 'L3 is a spare stub; L1 / L2 numbered');

// review: a 1-phase supply fed L1-L2 must take the bus voltage in one of its input ranges, and the branch breaker's
// highest (phase-to-phase) rating counts
const withParts = (supply: DrawingContext['design']['inputs']['supply'], ps: string, cb?: string): DrawingContext => ({
  ...ctx, design: { ...ctx.design, inputs: { ...ctx.design.inputs, supply }, components: components.map((c) => (getPart(c.partNumber)?.category === 'powerSupply' ? { ...c, partNumber: ps } : cb && c.tag === 'CB2' ? { ...c, partNumber: cb } : c)) },
});
const destroyed = (c: DrawingContext) => designWarnings(c).filter((w) => /destroyed at power-up/.test(w));
const lowBreaker = (c: DrawingContext) => designWarnings(c).filter((w) => /V bus: choose a breaker/.test(w));
assert.equal(destroyed(withParts('480VAC-3PH', 'C0-01AC')).length, 1, 'a 100-240 VAC supply fed L1-L2 at 480 V');
assert.deepEqual(destroyed(withParts('480VAC-3PH', 'ABL8RPS24050')), [], '"100-120VAC L-N or 200-500VAC L-L" takes 480 V L-L');
assert.deepEqual(lowBreaker(withParts('400VAC-3PH', 'ABL8RPS24050', '5SY4106-7')), [], 'a 230/400 VAC breaker on a 400 V bus');
assert.equal(lowBreaker(withParts('480VAC-3PH', 'ABL8RPS24050', '5SY4106-7')).length, 1, 'a 230/400 VAC breaker on a 480 V bus');

console.log('powerSheet.test: ok');
