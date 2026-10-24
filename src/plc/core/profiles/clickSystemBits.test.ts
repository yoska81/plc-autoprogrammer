/// <reference types="node" />
/**
 * CLICK system control relays, as AutomationDirect's CLICK help (topic 109) lists them: SC1 _Always_ON,
 * SC2 _1st_SCAN, SC7 _1sec_Clock (OFF/ON every 500 ms; SC4 is the 10 ms clock), SC10 _Mode_Switch,
 * SC11 _PLC_Mode, SC19 _PLC_Error. The simulator, the profile and the generated programs use these.
 * Run with:  npx tsx src/plc/core/profiles/clickSystemBits.test.ts
 */
import assert from 'node:assert/strict';
import { CLICK_SIM } from './click';
import { createSimulator } from '../../sim/engine';
import { clickModbus } from '../../../online/clickModbus';
import { defaultHmiContent } from '../../../hmi/engine';
import { programWithCycle } from '../../engine/sequence';
import { CONVEYOR_IO, CONVEYOR_WIRING } from '../../sim/__fixtures__/conveyor';
import { rungAddresses } from '../ladder';
import type { IOPoint } from '../../../types/io';

assert.deepEqual({ alwaysOn: CLICK_SIM.alwaysOn, firstScan: CLICK_SIM.firstScan, clock1s: CLICK_SIM.clock1s }, { alwaysOn: 'SC1', firstScan: 'SC2', clock1s: 'SC7' });

// SC7: OFF for 500 ms, ON for 500 ms (a 1 s period); SC2 only on the first scan; SC1 always.
const sim = createSimulator({ tags: [], rungs: [] });
const seen: [number, boolean, boolean, boolean][] = [];
for (let i = 0; i < 25; i++) { sim.step(50); seen.push([sim.state.timeMs, sim.readBit('SC7'), sim.readBit('SC2'), sim.readBit('SC1')]); }
for (const [t, sc7, , sc1] of seen) {
  assert.equal(sc1, true, `SC1 at ${t} ms`);
  assert.equal(sc7, Math.floor(t / 500) % 2 === 1, `SC7 at ${t} ms`);
}
assert.ok(seen.slice(1).every(([, , sc2]) => !sc2), 'SC2 only on the first scan');

// Online reads SC bits from CLICK's discrete inputs at 0xF000 (SC1 = 61440).
assert.equal(clickModbus('SC10')?.register, 61440 + 9);

// The rules' programs use only SC1, SC2 and SC7.
const io = CONVEYOR_IO.map((p, i) => ({ id: `c${i}`, description: p.description, type: p.type, category: p.category, deviceType: CONVEYOR_WIRING.find((w) => w.address === p.address)?.deviceType })) as IOPoint[];
const addresses = new Map(io.map((p, i) => [p.id, CONVEYOR_IO[i].address] as const));
const prog = programWithCycle({ content: defaultHmiContent({ io, addresses, machineName: 'Conveyor', spec: '' }), spec: '' }).program;
const sc = [...new Set(prog.rungs.flatMap((r) => rungAddresses(r)).filter((a) => /^SC\d+$/i.test(a)))].sort();
assert.ok(sc.every((a) => ['SC1', 'SC2', 'SC7'].includes(a)) && sc.includes('SC7'), `system bits used: ${sc.join(', ')}`);

console.log('CLICK system bits tests passed');
