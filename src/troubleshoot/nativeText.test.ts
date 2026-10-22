/// <reference types="node" />
/**
 * Fault finding on an S7 panel speaks the PLC's own wire numbers and terminals: every step and verdict of every
 * session says "wire I0.0" / "PLC terminal %I0.0" / "PLC:%I0.0", never "wire X001"; CLICK text is unchanged.
 * Run with:  npx tsx src/troubleshoot/nativeText.test.ts
 */
import assert from 'node:assert/strict';
import { nativeStepText } from './nativeText';
import { wiringPaths } from './wiringPath';
import { answer, currentStep, startSession, symptomsFor, type Session } from './steps';
import { nativeModel, type DrawingContext } from '../electrical/derive';
import { ioNames } from '../electrical/ioNames';
import { getPart } from '../electrical/catalog';
import { DESIGN } from '../preview/sampleProject';

const s7 = ioNames('6ES7214-1AG40-0XB0', [], ['X001', 'Y001']);
assert.equal(nativeStepText(s7, 'Open connection on wire X001 between PLC terminal X001 and PB1.'), 'Open connection on wire I0.0 between PLC terminal %I0.0 and PB1.');
assert.equal(nativeStepText(s7, 'Measure between PLC:X001 and TB1 0V. Wire Y001A is shorted.'), 'Measure between PLC:%I0.0 and TB1 0V. Wire Q0.0A is shorted.');
assert.equal(nativeStepText(s7, 'Does X001 still show ON?'), 'Does X001 still show ON?', 'a point keeps its address');
assert.equal(nativeStepText(ioNames('C0-10DD1E-D', [], ['X001']), 'wire X001 at PLC terminal X001'), 'wire X001 at PLC terminal X001', 'CLICK unchanged');

// every step and verdict of every session, every branch
const io = DESIGN.ioWiring.map((w) => ({ address: w.address, description: w.description, type: (w.address.startsWith('X') ? 'input' : 'output') as 'input' | 'output' }));
const ctx = (cpu: string, vendor: string): DrawingContext => ({
  projectName: 'T', getPart, io, design: { ...DESIGN, components: DESIGN.components.filter((c) => getPart(c.partNumber)?.category !== 'plcModule') },
  plc: { vendor, name: vendor, cpuPartNumber: cpu, cpuLabel: '' },
});
const texts = (c: DrawingContext) => {
  const out = new Set<string>();
  const walk = (s: Session, d: number) => {
    if (s.verdict) { out.add(s.verdict.text); out.add(s.verdict.fix); return; }
    const st = currentStep(s);
    if (!st || d > 25) return;
    out.add(st.say);
    for (const a of ['yes', 'no'] as const) walk(answer(s, a), d + 1);
  };
  for (const p of wiringPaths(c)) for (const sym of symptomsFor(p)) walk(startSession(p, sym), 0);
  return [...out];
};
const sie = ctx('6ES7214-1AG40-0XB0', 'Siemens');
const shown = texts(sie).map((t) => nativeStepText(nativeModel(sie).ioNames, t));
const appWire = shown.filter((t) => /\b[Ww]ires? [XY]\d{3}|PLC(?: module \S+)? terminal [XY]\d{3}|:[XY]\d{3}\b/.test(t));
assert.deepEqual(appWire, [], `S7 steps with an app wire / terminal: ${appWire.slice(0, 3).join(' | ')}`);
assert.ok(shown.some((t) => /wire I0\.\d/.test(t)) && shown.some((t) => /PLC terminal %I0\.\d/.test(t)), 'S7 steps name wire I0.x on terminal %I0.x');
const clk = ctx('C0-10DD1E-D', 'AutomationDirect');
assert.ok(texts(clk).every((t) => nativeStepText(nativeModel(clk).ioNames, t) === t), 'CLICK steps unchanged');

console.log(`nativeText.test: ok (${shown.length} S7 texts)`);
