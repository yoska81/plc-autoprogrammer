// npx tsx src/lib/ai/equipmentAI.test.ts — the Equipment AI chooses from the brand the customer named or prefers.
import assert from 'node:assert/strict';
import { equipmentChoices, equipmentSystemPrompt } from './equipmentAI';
import { brandMismatch, choosableProfiles, plcPreferenceOf, requestedProfiles, unsupportedBrands, brandNote, brandPhrase } from '../../spec/brand';

const ids = (spec: string, pref: string[] = ['automationdirect']) => choosableProfiles(spec, pref).map((p) => p.id);

// Nothing named, default preference: the PLCs the tool picks on its own.
assert.deepEqual(ids('Pick and place cell with two conveyors.'), ['click']);

// "Siemens S7-1200 …": Siemens CPUs, Siemens modules, panels that talk to an S7 only.
{
  const c = equipmentChoices('Bottle capper. Controller: Siemens S7-1200, TIA Portal. 12 inputs, 8 outputs.', ['automationdirect']);
  assert.deepEqual(c.profiles.map((p) => p.id), ['siemens-s7']);
  assert.ok(c.cpus.length && c.cpus.every(({ cpu }) => /^6ES7/.test(cpu.id)), 'only 6ES7 CPUs');
  // a Yaskawa SLIO CPU named: the only CPU offered (TIA Portal programs it as an S7-300), its SLIO modules
  const y = equipmentChoices('Packer. PLC: Yaskawa System SLIO CPU 015PN, programmed in TIA Portal.', ['automationdirect']);
  assert.deepEqual(y.profiles.map((p) => p.id), ['siemens-s7']);
  assert.deepEqual(y.cpus.map(({ cpu }) => cpu.id), ['015-CEFPR01']);
  assert.ok(y.modules.some((m) => m.partNumber === '021-1BH00'), 'SLIO modules offered');
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

// The maker counts only right next to a PLC word.
assert.deepEqual(ids('The Siemens motor is started by the PLC.'), ['click'], 'a Siemens motor started by the PLC');
assert.deepEqual(ids('Siemens drive and Allen-Bradley PLC.'), ['logix', 'micro800'], 'only the PLC maker');
assert.deepEqual(ids('PLC: Siemens'), ['siemens-s7']);
assert.deepEqual(ids('Siemens S7 controller'), ['siemens-s7']);

// A PLC brand this tool cannot program: said, never silently CLICK.
assert.deepEqual(unsupportedBrands('Controller: Mitsubishi FX5U with GX Works3.'), ['Mitsubishi']);
assert.deepEqual(unsupportedBrands('Omron PLC'), ['Omron']);
assert.deepEqual(unsupportedBrands('Schneider Modicon M221'), ['Schneider Electric']);
assert.deepEqual(unsupportedBrands('Beckhoff CX9020 with TwinCAT 3'), ['Beckhoff']);
assert.deepEqual(unsupportedBrands('A Siemens LOGO! 8 runs it'), ['Siemens LOGO!']);
assert.deepEqual(unsupportedBrands('Omron photo-eyes and a Mitsubishi servo'), [], 'sensors and drives of a maker are not a PLC');
assert.equal(brandNote('Mitsubishi PLC', 'AutomationDirect CLICK (C0-12DD1E-D)'), "Mitsubishi PLC isn't supported yet — using AutomationDirect CLICK (C0-12DD1E-D).");
assert.equal(brandNote('Mitsubishi servo, Siemens S7-1200 PLC', 'Siemens S7-1200 / S7-1500 (6ES7214-1AG40-0XB0)'),
  `Using Siemens S7-1200 / S7-1500 (6ES7214-1AG40-0XB0) because the description says "Mitsubishi servo, Siemens S7-1200 PLC". Change it in Brand preference if that's wrong.`, 'a supported PLC named: quoted, no unsupported warning');
assert.equal(brandNote('Pick and place', 'CLICK'), null);
assert.deepEqual(unsupportedBrands('Productivity 2000 PLC'), ['AutomationDirect Productivity / BRX / Do-more']);
assert.deepEqual(unsupportedBrands('BRX controller'), ['AutomationDirect Productivity / BRX / Do-more']);

// The side manager's probe table: how the PLC is named in real descriptions.
const PROBES: [string, string[]][] = [
  ['Rockwell Automation PLC', ['logix', 'micro800']],
  ['Siemens 1214C PLC', ['siemens-s7']],
  ['Siemens based PLC', ['siemens-s7']],
  ['PLC hardware: Allen-Bradley', ['logix', 'micro800']],
  ['The PLC shall be Siemens', ['siemens-s7']],
  ['PLC (Siemens)', ['siemens-s7']],
  ['Siemens-PLC', ['siemens-s7']],
  ["Allen-Bradley's PLC", ['logix', 'micro800']],
  ['Die SPS ist eine Siemens', ['siemens-s7']],
  ["L'automate Siemens pilote la ligne", ['siemens-s7']],
  ['The PLC is CLICK', ['click']],
  ['PLC: CLICK', ['click']],
  // Devices and other controllers of a maker are not its PLC (side manager's probes).
  ['Allen-Bradley PowerFlex 525 PLC-controlled', ['click']],
  ['Allen-Bradley Guardmaster safety controller', ['click']],
  ['Allen-Bradley Kinetix 5700 PLC', ['click']],
  ['Allen-Bradley E-stop PLC', ['click']],
  ['Siemens temperature controller and a PLC', ['click']],
  ['Siemens fan speed controller', ['click']],
  ['Siemens light curtain PLC input', ['click']],
  ['Siemens 7 inch PLC panel', ['click']],
  ['We want to automate the Siemens packaging line', ['click']],
  ['Siemens 24 V SPS', ['click']],
  ['Die Anlage hat ein 24 V SPS Netzteil von Siemens', ['click']],
  ['Interfaces to the PLC: Siemens G120 drive via Profinet', ['click']],
  ['Siemens LOGO 8 PLC', ['click']],
  ['Siemens LOGO! controller', ['click']],
  ['Rockwell Automation controller', ['logix', 'micro800']],
  ['Steuerung: Siemens S7', ['siemens-s7']],
  ['Siemens S7-1200 controller', ['siemens-s7']],
  ['Siemens drive and Allen-Bradley PLC', ['logix', 'micro800']],
  ['The Siemens motor is started by the PLC.', ['click']],
  ['Siemens motor started by the PLC', ['click']],
  ['Omron photo-eyes and a Mitsubishi servo', ['click']],
];
for (const [text, want] of PROBES) assert.deepEqual(ids(text), want, text);
assert.deepEqual(unsupportedBrands('Omron photo-eyes and a Mitsubishi servo'), [], 'no unsupported warning for sensors and servos');
assert.deepEqual(unsupportedBrands('Omron temperature controller'), [], 'an Omron temperature controller is not a PLC');
assert.deepEqual(unsupportedBrands('Siemens LOGO 8 PLC'), ['Siemens LOGO!'], 'LOGO 8 (no "!") is the LOGO');
assert.match(brandNote('Siemens LOGO 8 PLC', 'AutomationDirect CLICK (C0-10DD1E-D)') ?? '', /^Siemens LOGO! PLC isn't supported yet — using AutomationDirect CLICK/);
// Read from the description: the phrase is quoted.
assert.match(brandNote('Bottle capper. The PLC shall be Siemens S7-1200. E-stop.', 'Siemens S7-1200 / S7-1500 (6ES7214-1AG40-0XB0)') ?? '', /Using Siemens .* because the description says "The PLC shall be Siemens S7-1200"/);
assert.equal(brandNote('PLC: CLICK. Siemens motors.', 'CLICK'), `Using CLICK because the description says "PLC: CLICK". Change it in Brand preference if that's wrong.`, 'CLICK named: no "mentions Siemens" note');
// Safety net: a maker with a PLC here, mentioned next to a PLC word without naming the PLC, is said.
assert.equal(brandNote('Siemens motor started by the PLC', 'AutomationDirect CLICK (C0-12DD1E-D)'),
  "The description mentions Siemens but doesn't say the PLC is Siemens — using AutomationDirect CLICK (C0-12DD1E-D). Set the PLC brand in Brand preference if that's wrong.");
assert.equal(brandNote('Siemens motors on a conveyor', 'CLICK'), null, 'no PLC word: nothing to say');
assert.match(brandNote('Replace the S7-300 with a new PLC', 'Siemens S7-1200 / S7-1500 (6ES7…)') ?? '', /S7-300 \/ S7-400 .* S7-1200 \/ S7-1500/);
assert.deepEqual(ids('Replace the S7-300'), ['siemens-s7'], 'an S7-300 maps to the S7 profile');
assert.match(equipmentSystemPrompt('Controller: Omron CP2E.'), /Omron PLC isn't supported yet/);

// The untouched default preference (saved by older projects on any card edit) is not a request.
assert.deepEqual(plcPreferenceOf(['automationdirect']), []);
assert.deepEqual(plcPreferenceOf(undefined), []);
assert.deepEqual(plcPreferenceOf(['siemens']), ['siemens']);
assert.deepEqual(plcPreferenceOf(['automationdirect'], true), ['automationdirect'], 'picked on the card: a request');
assert.equal(brandMismatch('Pick and place', plcPreferenceOf(['automationdirect']), 'logix'), null, 'a Logix project is not flagged by the default');

// The quoted phrase: whole sentences (a decimal point is not a full stop), cut at a word, single spaces.
assert.equal(brandPhrase('Conveyor speed 1.5 m/s and the PLC is an Allen-Bradley CompactLogix. E-stop.'), 'Conveyor speed 1.5 m/s and the PLC is an Allen-Bradley CompactLogix');
assert.equal(brandPhrase('Controller: Siemens S7-1200 (firmware v4.5) in the main panel.'), 'Controller: Siemens S7-1200 (firmware v4.5) in the main panel');
{
  const q = brandPhrase('The machine is a very long and complicated bottle capping and labelling line whose control is done by a Siemens   S7-1200 PLC mounted in the main cabinet next to the drives and the safety relays of the line.') ?? '';
  assert.ok(q.startsWith('…') && q.endsWith('…') && !/\s{2}/.test(q), q);
  assert.match(q, /Siemens S7-1200 PLC/);
  const words = (t: string) => t.replace(/…/g, '').trim().split(' ');
  const full = 'The machine is a very long and complicated bottle capping and labelling line whose control is done by a Siemens S7-1200 PLC mounted in the main cabinet next to the drives and the safety relays of the line'.split(' ');
  assert.ok(words(q).every((w) => full.includes(w)), `cut at whole words: ${q}`);
}

console.log('equipment AI tests passed');
