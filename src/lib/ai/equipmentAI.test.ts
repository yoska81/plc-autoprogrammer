// npx tsx src/lib/ai/equipmentAI.test.ts — the Equipment AI chooses from the brand the customer named or prefers.
import assert from 'node:assert/strict';
import { equipmentChoices } from './equipmentAI';
import { brandMismatch, choosableProfiles, requestedProfiles } from '../../spec/brand';

const ids = (spec: string, pref: string[] = ['automationdirect']) => choosableProfiles(spec, pref).map((p) => p.id);

// Nothing named, default preference: the PLCs the tool picks on its own.
assert.deepEqual(ids('Pick and place cell with two conveyors.'), ['click']);

// "Siemens S7-1200 …": Siemens CPUs, Siemens modules, panels that talk to an S7 only.
{
  const c = equipmentChoices('Bottle capper. Controller: Siemens S7-1200, TIA Portal. 12 inputs, 8 outputs.', ['automationdirect']);
  assert.deepEqual(c.profiles.map((p) => p.id), ['siemens-s7']);
  assert.ok(c.cpus.length && c.cpus.every(({ cpu }) => /^6ES7/.test(cpu.id)), 'only 6ES7 CPUs');
  assert.ok(c.modules.length && c.modules.every((m) => /^6ES7/.test(m.partNumber)), `only Siemens modules (${c.modules.filter((m) => !/^6ES7/.test(m.partNumber)).map((m) => m.partNumber).join(', ')})`);
  assert.ok(!c.modules.some((m) => /^C0-/.test(m.partNumber)), 'no CLICK modules');
  assert.ok(c.hmis.length > 0, 'panels for an S7');
  assert.ok(!c.hmis.some((h) => !h.catalog), 'no C-more panel (set up for CLICK only)');
}

// A Siemens vendor preference with nothing named in the description.
assert.deepEqual(ids('Pick and place cell.', ['siemens']), ['siemens-s7']);
// A preference with no PLC here falls back to the default choice.
assert.deepEqual(ids('Pick and place cell.', ['pilz']), ['click']);

// Families and brands.
assert.deepEqual(ids('Use an Allen-Bradley PLC'), ['logix', 'micro800']);
assert.deepEqual(ids('Siemens PLC please'), ['siemens-s7']);
assert.deepEqual(ids('CompactLogix 5380 with Studio 5000'), ['logix']);
assert.deepEqual(ids('a Micro850 controller'), ['micro800']);
assert.deepEqual(ids('Unitronics UniStream with built-in screen'), ['unitronics-unistream', 'unitronics-vision']);
// "vision" alone is a camera, not a Unitronics Vision; "click" alone is not a brand.
assert.deepEqual(ids('Vision camera checks labels; operator clicks Start.'), ['click']);
// A maker's motor or drive is not a PLC request.
assert.deepEqual(ids('Spindle: Siemens 1LE1 motor on a PowerFlex 525 drive from Allen-Bradley.'), ['click']);
assert.deepEqual(ids('The PLC is a Siemens; motors are WEG.'), ['siemens-s7']);
assert.deepEqual(ids('Customer standard: Allen-Bradley controllers.'), ['logix', 'micro800']);
// Named beats preference.
assert.deepEqual(ids('Siemens S7-1200', ['allen-bradley']), ['siemens-s7']);

// CLICK keeps CLICK modules and C-more panels.
{
  const c = equipmentChoices('Conveyor', ['automationdirect']);
  assert.ok(c.modules.every((m) => /^C0-/.test(m.partNumber)) && c.modules.length > 0);
  assert.ok(c.hmis.some((h) => !h.catalog), 'C-more panels for CLICK');
}

// Nothing asked: no request (the default preference is not one).
assert.deepEqual(requestedProfiles('Pick and place cell.', []).map((p) => p.id), []);
// The project's PLC is another brand than the one asked for: said, with where it was asked.
assert.equal(brandMismatch('Siemens S7-1200', [], 'click'), "The description asks for Siemens S7-1200 / S7-1500; the project's PLC is AutomationDirect CLICK.");
assert.match(brandMismatch('Pick and place', ['siemens'], 'click') ?? '', /^The Brand preference asks for Siemens/);
assert.equal(brandMismatch('Siemens S7-1200', [], 'siemens-s7'), null, 'the brand asked for');
assert.equal(brandMismatch('Pick and place', [], 'logix'), null, 'nothing asked: any PLC');

console.log('equipment AI tests passed');
