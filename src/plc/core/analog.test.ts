/// <reference types="node" />
/** Analog channel mapping tests.  npx tsx src/plc/core/analog.test.ts */
import assert from 'node:assert/strict';
import { getCpu, getProfile } from './profiles';
import { resolveAddresses } from './profile';
import { moduleSlots } from './modules';
import { analogMap, analogNeed } from './analog';
import { channelTerminal } from './profiles/clickAnalog';
import type { IOPoint } from '../../types/io';

let passed = 0;
const failures: string[] = [];
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { failures.push(name); console.log(`  FAIL ${name}\n       ${(e as Error).message.split('\n').join('\n       ')}`); }
}
const click = getProfile('click');
const pt = (id: string, type: 'input' | 'output', description: string, analog?: IOPoint['analog']): IOPoint =>
  ({ id, type, description, category: analog ? 'Analog/Process' : 'Spare', ...(analog ? { signal: 'analog' as const, analog } : {}) });

console.log('analog I/O');

test('CLICK analog CPU: AD1/AD2 then DA1/DA2 on DF1..DF4, modules continue', () => {
  const ch = click.analogChannels!(getCpu(click, 'C0-12DD1E-D'), moduleSlots(['C0-04AD-1']));
  assert.deepEqual(ch.map((c) => `${c.label}=${c.address}`), ['CPU AD1=DF1', 'CPU AD2=DF2', 'CPU DA1=DF3', 'CPU DA2=DF4', 'Slot 1 CH1=DF5', 'Slot 1 CH2=DF6', 'Slot 1 CH3=DF7', 'Slot 1 CH4=DF8']);
  assert.deepEqual(ch[0].ranges, ['4-20mA', '0-5V']);
  assert.equal(channelTerminal(ch[0], '4-20mA'), 'AD1I');
  assert.equal(channelTerminal(ch[0], '0-5V'), 'AD1V');
  assert.deepEqual(ch[4].ranges, ['4-20mA', '0-20mA'], 'C0-04AD-1 is a 0-20 mA current input');
  assert.deepEqual(ch[4].terminals, ['CH1', '0V']);
});

test('discrete CPU has no analog channels', () => {
  assert.deepEqual(click.analogChannels!(getCpu(click, 'C0-10DD1E-D'), []), []);
});

test('addresses: analog points get DF of their channel, X/Y sequence skips them', () => {
  const cpu = getCpu(click, 'C0-10DD1E-D');
  const slots = moduleSlots(['C0-04AD-1', 'C0-04DA-1']);
  const io = [
    pt('I001', 'input', 'Start'),
    pt('I002', 'input', 'Tank level', { range: '4-20mA', min: 0, max: 500, units: 'gal' }),
    pt('I003', 'input', 'Stop'),
    pt('I004', 'input', 'Tank temperature', { range: '4-20mA', min: 0, max: 100, units: '°C' }),
    pt('Q001', 'output', 'Steam valve', { range: '4-20mA', min: 0, max: 100, units: '%' }),
    pt('Q002', 'output', 'Agitator'),
  ];
  const a = resolveAddresses(click, cpu, io, slots);
  assert.deepEqual(io.map((p) => a.get(p.id)), ['X001', 'DF1', 'X002', 'DF2', 'DF5', 'Y001']);
  const m = analogMap(click, cpu, slots, io);
  assert.equal(m.byPoint.get('Q001')!.label, 'Slot 2 CH1');
  assert.deepEqual(analogNeed(io, m.channels), { need: { input: 2, output: 1 }, have: { input: 4, output: 4 } });
});

test('a voltage signal prefers a channel that takes voltage; manual DF pins the channel', () => {
  const cpu = getCpu(click, 'C0-12DD1E-D');
  const slots = moduleSlots(['C0-04AD-1']);
  const io = [
    pt('I001', 'input', 'Flow', { range: '4-20mA', min: 0, max: 50, units: 'gpm' }),
    pt('I002', 'input', 'Pot', { range: '0-5V', min: 0, max: 100, units: '%' }),
    { ...pt('I003', 'input', 'Pressure', { range: '4-20mA', min: 0, max: 150, units: 'psi' }), plcAddress: 'DF8' },
  ];
  const a = resolveAddresses(click, cpu, io, slots);
  assert.deepEqual(io.map((p) => a.get(p.id)), ['DF1', 'DF2', 'DF8']);
});

test('a voltage / current signal never lands on a thermocouple-only channel (C0-04THM), nor a thermocouple on a current channel', () => {
  const cpu = getCpu(click, 'C0-11DD2E-D');
  const tc = pt('I001', 'input', 'Seal bar temperature', { range: 'thermocouple', min: 0, max: 300, units: '°C' });
  const v = pt('I002', 'input', 'Film tension', { range: '0-10V', min: 0, max: 100, units: '%' });
  const thm = analogMap(click, cpu, moduleSlots(['C0-08ND3', 'C0-04THM']), [tc, v]);
  assert.equal(thm.byPoint.get('I001')?.partNumber, 'C0-04THM');
  assert.equal(thm.byPoint.get('I002'), undefined, '0-10 V: no THM channel, unassigned');
  assert.ok(!resolveAddresses(click, cpu, [tc, v], moduleSlots(['C0-08ND3', 'C0-04THM'])).get('I002'), 'no DF register');
  // with a current module beside it the voltage signal goes there (a scaling question, not a wrong module)
  const both = analogMap(click, cpu, moduleSlots(['C0-04THM', 'C0-04AD-1']), [tc, v]);
  assert.equal(both.byPoint.get('I002')?.partNumber, 'C0-04AD-1');
  assert.equal(analogMap(click, cpu, moduleSlots(['C0-04AD-1']), [tc]).byPoint.get('I001'), undefined, 'thermocouple: not on a current input');
  // only an explicit 'thermocouple' range uses the THM: 4-20 mA inputs never do, whatever their description says
  const mA = (id: string, d: string) => pt(id, 'input', d, { range: '4-20mA', min: 0, max: 100, units: '%' });
  const three = [mA('I003', 'Hopper level'), mA('I004', 'Coil diameter ultrasonic'), mA('I005', 'Oven temperature'), mA('I006', 'Seal bar temperature (thermocouple)')];
  const onThm = analogMap(click, cpu, moduleSlots(['C0-08ND3', 'C0-04THM']), three);
  for (const q of three) assert.equal(onThm.byPoint.get(q.id), undefined, `${q.description} (4-20 mA): not on the C0-04THM`);
  const withAd = analogMap(click, cpu, moduleSlots(['C0-04THM', 'C0-04AD-1']), three);
  for (const q of three) assert.equal(withAd.byPoint.get(q.id)?.partNumber, 'C0-04AD-1', `${q.description}: on the current module`);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
