// npx tsx src/plc/core/addressCheck.test.ts — one check for typed addresses: brand, point type, terminals the rack has.
import assert from 'node:assert/strict';
import { checkIOAddress, checkMemoryAddress, rackTerminals } from './addressCheck';
import { getCpu, getProfile } from './profiles';
import { moduleSlots } from './modules';
import { PLC_PROFILES } from './profiles';
import { resolveAddresses } from './profile';
import { analogRangesOf, modulesToFit } from './fit';
import type { IOPoint } from '../../types/io';

const rackOf = (plcId: string, cpuId: string, modules: string[] = []) => { const profile = getProfile(plcId); return { profile, cpu: getCpu(profile, cpuId), modules: moduleSlots(modules) }; };
const click = rackOf('click', 'C0-10DD1E-D');
const input = { type: 'input' as const };
const output = { type: 'output' as const };
const reason = (r: ReturnType<typeof checkIOAddress>) => (r.ok ? '' : r.reason);

assert.deepEqual(checkIOAddress(click, input, ' x001 '), { ok: true, address: 'X001' }, 'typed in lower case: fine');
assert.deepEqual(checkIOAddress(click, input, ''), { ok: true, address: '' }, 'empty = automatic');
assert.match(reason(checkIOAddress(click, input, 'zz99')), /"zz99" is not an address on AutomationDirect CLICK/, 'not an address');
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

// Sweep: every address the app gives out (resolveAddresses) on every PLC, CPU and a rack that fits passes the check.
{
  let checked = 0;
  const refused: string[] = [];
  const sizes = [{ di: 8, dq: 6, ai: 0, ao: 0 }, { di: 40, dq: 24, ai: 0, ao: 0 }, { di: 20, dq: 12, ai: 2, ao: 1 }];
  for (const profile of PLC_PROFILES.filter((p) => p.available)) {
    for (const cpu of profile.cpuModels) {
      for (const z of sizes) {
        const io: IOPoint[] = [
          ...Array.from({ length: z.di }, (_, i) => ({ id: `I${i + 1}`, description: `In ${i + 1}`, type: 'input', category: 'Station 1' }) as IOPoint),
          ...Array.from({ length: z.dq }, (_, i) => ({ id: `Q${i + 1}`, description: `Out ${i + 1}`, type: 'output', category: 'Station 1' }) as IOPoint),
          ...Array.from({ length: z.ai }, (_, i) => ({ id: `AI${i + 1}`, description: `Level ${i + 1}`, type: 'input', category: 'Analog/Process', signal: 'analog', analog: { range: '4-20mA', min: 0, max: 100, units: '%' } }) as IOPoint),
          ...Array.from({ length: z.ao }, (_, i) => ({ id: `AO${i + 1}`, description: `Speed ${i + 1}`, type: 'output', category: 'Analog/Process', signal: 'analog', analog: { range: '0-10V', min: 0, max: 60, units: 'Hz' } }) as IOPoint),
        ];
        const need = { digitalInputs: z.di, digitalOutputs: z.dq, analogInputs: z.ai, analogOutputs: z.ao, ethernetHmi: false, minHmiSizeIn: null, analogRanges: analogRangesOf(io) };
        const mods = modulesToFit(cpu.id, [], need);
        if (mods === null) continue;
        const rack = { profile, cpu, modules: moduleSlots(mods) };
        for (const [id, a] of resolveAddresses(profile, cpu, io, rack.modules)) {
          if (!a) continue;
          const p = io.find((x) => x.id === id)!;
          const r = checkIOAddress(rack, p, a);
          checked++;
          if (!r.ok || r.address.toUpperCase() !== a.toUpperCase()) refused.push(`${profile.id} ${cpu.id} [${mods.join(' ')}] ${id}=${a}: ${r.ok ? r.address : r.reason}`);
        }
      }
    }
  }
  assert.deepEqual(refused.slice(0, 10), [], `${refused.length} of ${checked} addresses refused`);
  assert.ok(checked > 3000, `${checked} addresses checked`);
  console.log(`  sweep: ${checked} addresses, 0 refused`);
}

// 32-point modules and large CPUs: every point counts (X117…X132; a Micro850 48-point's X017…X028).
{
  const lx = rackOf('logix', '1769-L33ER', ['1769-IQ32', '1769-OB32']);
  if (lx.cpu.id === '1769-L33ER') assert.equal(checkIOAddress(lx, input, 'X120').ok, true, 'X120 on a 1769-IQ32');
  const m8 = rackOf('micro800', '2080-L50E-48QBB');
  if (m8.cpu.id === '2080-L50E-48QBB') assert.equal(checkIOAddress(m8, input, 'X020').ok, true, 'X020 on a Micro850 48-point');
  assert.equal(checkIOAddress(rackOf('generic-st', 'generic'), input, '%IX0.3').ok, true, 'generic Structured Text: the user\'s address');
}

console.log('address check tests passed');
