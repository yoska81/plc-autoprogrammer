/// <reference types="node" />
/**
 * Runs the example program (src/preview/sampleProject.ts LADDER) through the simulator against
 * the written sequence of operation. Run: npx tsx tools/sim_example.ts
 */
import assert from 'node:assert/strict';
import { createSimulator } from '../src/plc/sim/engine';
import { LADDER } from '../src/preview/sampleProject';

const sim = createSimulator(LADDER);
const st = () => ({ conv: sim.readBit('Y001'), push: sim.readBit('Y002'), air: sim.readBit('Y003'), fault: sim.readBit('C1101'), parts: sim.readWord('CTD1') });
const press = (x: string) => { sim.setInput(x, true); sim.run(100); sim.setInput(x, false); sim.run(200); };
const steps: [string, () => void, Partial<ReturnType<typeof st>>][] = [
  ['power-up, safety OK, stop not pressed, pusher retracted', () => { sim.setInput('X001', true); sim.setInput('X003', true); sim.setInput('X006', true); sim.run(200); }, { conv: false, push: false, air: true }],
  ['start runs the conveyor', () => press('X002'), { conv: true }],
  ['part at end: conveyor stops, pusher extends, counted', () => { sim.setInput('X004', true); sim.run(200); }, { conv: false, push: true, parts: 1 }],
  ['pusher extended: valve off, conveyor waits for retracted', () => { sim.setInput('X004', false); sim.setInput('X006', false); sim.run(500); sim.setInput('X005', true); sim.run(200); }, { conv: false, push: false }],
  ['pusher back at retracted: conveyor restarts', () => { sim.setInput('X005', false); sim.run(300); sim.setInput('X006', true); sim.run(200); }, { conv: true }],
  ['pusher not extended within 3 s: fault latches', () => { sim.setInput('X004', true); sim.run(200); sim.setInput('X004', false); sim.run(4000); }, { fault: true, push: false, parts: 2 }],
  ['HMI reset clears the fault (pusher back)', () => { sim.write('C1003', true); sim.run(100); sim.write('C1003', false); sim.run(200); }, { fault: false }],
  ['start again', () => press('X002'), { conv: true }],
  ['safety OK lost stops everything and dumps the air', () => { sim.setInput('X001', false); sim.run(200); }, { conv: false, push: false, air: false }],
  ['safety back: no automatic restart', () => { sim.setInput('X001', true); sim.run(300); }, { conv: false }],
  ['start, then Stop (NC) ends the cycle', () => { press('X002'); sim.setInput('X003', false); sim.run(200); sim.setInput('X003', true); sim.run(200); }, { conv: false }],
];
let failed = 0;
for (const [name, act, want] of steps) {
  act();
  const got = st();
  try { for (const [k, v] of Object.entries(want)) assert.equal(got[k as keyof typeof got], v, `${k}`); console.log(`  ok  ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}: ${(e as Error).message} — state ${JSON.stringify(got)}`); }
}
console.log(failed ? `${failed} step(s) failed` : 'example program follows the sequence of operation');
process.exit(failed ? 1 : 0);
