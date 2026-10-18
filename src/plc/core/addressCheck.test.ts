// npx tsx src/plc/core/addressCheck.test.ts — one check for typed addresses: brand, point type, terminals the rack has.
import assert from 'node:assert/strict';
import { checkIOAddress, checkMemoryAddress, rackTerminals } from './addressCheck';
import { getCpu, getProfile } from './profiles';
import { moduleSlots } from './modules';

const rackOf = (plcId: string, cpuId: string, modules: string[] = []) => { const profile = getProfile(plcId); return { profile, cpu: getCpu(profile, cpuId), modules: moduleSlots(modules) }; };
const click = rackOf('click', 'C0-10DD1E-D');
const input = { type: 'input' as const };
const output = { type: 'output' as const };
const reason = (r: ReturnType<typeof checkIOAddress>) => (r.ok ? '' : r.reason);

assert.deepEqual(checkIOAddress(click, input, ' x001 '), { ok: true, address: 'X001' }, 'typed in lower case: fine');
assert.deepEqual(checkIOAddress(click, input, ''), { ok: true, address: '' }, 'empty = automatic');
assert.match(reason(checkIOAddress(click, input, 'zz99')), /"zz99" is not an address on CLICK/, 'not an address');
assert.match(reason(checkIOAddress(click, input, 'Y001')), /Y001 is an output, and this point is an input/, 'output address on an input');
assert.match(reason(checkIOAddress(click, output, 'X001')), /X001 is an input, and this point is an output/);
assert.match(reason(checkIOAddress(click, input, 'C5')), /internal bit/, 'internal memory is not a terminal');
assert.match(reason(checkIOAddress(click, input, 'X101')), /no module in slot 1/, 'a slot with no module');
const clickCpu = click.cpu.builtInInputs;
assert.match(reason(checkIOAddress(click, input, `X0${String(clickCpu + 1).padStart(2, '0')}`)), new RegExp(`CPU has ${clickCpu} built-in inputs`));
const clickRack = rackOf('click', 'C0-10DD1E-D', ['C0-16ND3']);
assert.equal(checkIOAddress(clickRack, input, 'X116').ok, true, 'a module in slot 1: its terminals are fine');
assert.deepEqual(rackTerminals(clickRack, 'input').slice(-1), ['X116']);

// The PLC's own form is accepted and stored as the app's address.
const s7 = rackOf('siemens-s7', getProfile('siemens-s7').defaultCpuId);
const firstIn = rackTerminals(s7, 'input')[0];
if (firstIn && s7.profile.ioTag) {
  const native = s7.profile.ioTag(firstIn, s7.modules, s7.cpu.id)!;
  assert.deepEqual(checkIOAddress(s7, input, native), { ok: true, address: firstIn }, `${native} is ${firstIn}`);
  assert.match(reason(checkIOAddress(s7, output, native)), /an input, and this point is an output/, 'an S7 input bit on an output');
}

// Analog points go on analog channels only.
assert.match(reason(checkIOAddress(click, { type: 'input', signal: 'analog' }, 'X001')), /no analog input channel|not one/);

// HMI tag fields: bit or number.
assert.deepEqual(checkMemoryAddress(click.profile, 'c12', 'bit'), { ok: true, address: 'C12' });
assert.match((checkMemoryAddress(click.profile, 'DS1', 'bit') as { reason: string }).reason, /needs a bit/);
assert.match((checkMemoryAddress(click.profile, 'C1', 'number') as { reason: string }).reason, /needs a number register/);
assert.match((checkMemoryAddress(click.profile, 'zz99', 'number') as { reason: string }).reason, /not an address/);
assert.equal(checkMemoryAddress(click.profile, 'DS1', 'number').ok, true);

console.log('address check tests passed');
