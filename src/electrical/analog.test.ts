/// <reference types="node" />
/**
 * Analog loop wiring tests. Run with:  npx tsx src/electrical/analog.test.ts
 */
import assert from 'node:assert/strict';
import { analogWiring } from './analog';
import type { AnalogSetupRow } from '../plc/core/analog';

const row = (over: Partial<AnalogSetupRow>): AnalogSetupRow => ({
  pointId: 'I001', description: 'Tank level', kind: 'input', channel: 'Slot 1 CH1', partNumber: 'C0-04AD-1',
  terminal: 'CH1', address: 'DF1', range: '4-20mA', scaleMin: 0, scaleMax: 100, units: '%', ...over,
});
const opts = { plcTag: 'PLC', moduleTag: (slot: number) => `AI${slot}`, groundBar: 'GB1', firstCable: 8, ioWiring: [] };

// No analog points: nothing added to the model.
const none = analogWiring([], opts);
assert.equal(none.strip, null);
assert.equal(none.wires.length + none.cables.length + none.circuits.length, 0);

const w = analogWiring([
  row({}),
  row({ pointId: 'I002', description: 'Oven temperature', terminal: 'AD1V', channel: 'CPU AD1', address: 'DF2', range: '0-10V', units: '°C' }),
  row({ pointId: 'Q001', description: 'Pump speed reference', kind: 'output', channel: 'Slot 2 CH1', partNumber: 'C0-04DA-1', address: 'DF5', units: 'Hz' }),
  row({ pointId: 'I003', description: 'Unassigned', address: '' }),
], opts);

// One circuit, one shielded cable and three TBA terminals (+, -, shield) per assigned signal.
assert.equal(w.circuits.length, 3);
assert.deepEqual(w.circuits.map((c) => c.loop), ['two-wire', 'voltage', 'output']);
assert.deepEqual(w.circuits.map((c) => c.deviceTag), ['LT1', 'TT1', 'SC1']);
assert.deepEqual(w.circuits.map((c) => c.moduleTag), ['AI1', 'PLC', 'AI2'], 'CPU channels belong to the PLC, slot channels to the module');
assert.equal(w.strip?.tag, 'TBA');
assert.equal(w.strip?.terminals.length, 9);
assert.deepEqual(w.strip?.terminals.filter((t) => t.kind === 'ground').map((t) => t.label), ['TBA-3', 'TBA-6', 'TBA-9']);
assert.deepEqual(w.cables.map((c) => c.tag), ['W008', 'W009', 'W010']);
for (const c of w.cables) {
  assert.match(c.type, /shielded twisted pair/i);
  assert.equal(c.cores.length, 3);
  assert.equal(c.cores[2].core, 'DRAIN');
}

// Loop power: a 2-wire transmitter takes +24 V on + and returns on - to the channel.
const lt = w.wires.filter((x) => x.wire.startsWith('DF1'));
assert.deepEqual(lt.map((x) => [x.wire, x.from, x.to]), [['DF1+', '24+', 'TBA-1'], ['DF1-', 'TBA-2', 'AI1:CH1'], ['DF1SH', 'TBA-3', 'GB1']]);
// Voltage input: + to the channel, - to 0V. Output: channel to +, - back to 0V.
assert.deepEqual(w.wires.filter((x) => x.wire.startsWith('DF2')).map((x) => x.to), ['PLC:AD1V', 'PLC:0V', 'GB1']);
assert.deepEqual(w.wires.filter((x) => x.wire.startsWith('DF5')).map((x) => [x.from, x.to]), [['AI2:CH1', 'TBA-7'], ['TBA-8', 'AI2:0V'], ['TBA-9', 'GB1']]);
// Shield grounded at the panel end only: one ground wire per signal, none at the device.
assert.equal(w.wires.filter((x) => x.to === 'GB1').length, 3);
// Wire numbers are unique.
assert.equal(new Set(w.wires.map((x) => x.wire)).size, w.wires.length);
// Drawing text stays in the PDF font's character set (no −, →, ≤, Ω).
assert.ok(!/[−→≤Ω]/.test(JSON.stringify(w)), 'ASCII-safe text');

console.log('analog wiring tests passed');

// A thermocouple on a thermocouple input module (CLICK C0-04THM): straight to CHn+ / CHn− in thermocouple
// extension wire — never a 24 V loop supply (that would put 24 V on the thermocouple input).
{
  const { analogSetup } = await import('../plc/core/analog');
  const { getCpu, getProfile } = await import('../plc/core/profiles');
  const { moduleSlots } = await import('../plc/core/modules');
  const profile = getProfile('click');
  const io = [{ id: 'I009', description: 'Seal bar temperature (thermocouple)', type: 'input', category: 'Analog/Process', signal: 'analog', analog: { range: '4-20mA', min: 0, max: 300, units: '°C' } }] as Parameters<typeof analogSetup>[3];
  const rows = analogSetup(profile, getCpu(profile, 'C0-11DD2E-D'), moduleSlots(['C0-08ND3', 'C0-04THM']), io);
  assert.equal(rows[0].range, 'thermocouple', 'a C0-04THM channel is a thermocouple input');
  assert.equal(rows[0].terminal, 'CH1+');
  const tc = analogWiring(rows, opts);
  assert.deepEqual(tc.circuits.map((c) => c.loop), ['thermocouple']);
  assert.ok(!tc.wires.some((x) => x.from === '24+' || x.to === '24+'), 'no loop supply on a thermocouple');
  assert.ok(tc.wires.some((x) => x.to.endsWith(':CH1+')) && tc.wires.some((x) => x.to.endsWith(':CH1-')), 'wired to CH1+ and CH1-');
  assert.match(tc.cables[0].type, /thermocouple extension/i);
  console.log('ok - thermocouple straight to the C0-04THM, no loop supply');
}
