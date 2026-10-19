/// <reference types="node" />
/**
 * A new design for another machine keeps none of the earlier design's notes. The Electrical page writes a design's
 * inputs back (motors included), so design B starts from design A's motor list: a motor the engine read from A's
 * machine is dropped without a note, while a motor the designer typed is still asked about.
 * Run with:  npx tsx src/electrical/engine/redesign.test.ts
 */
import assert from 'node:assert/strict';
import { generateRuleBasedDesign } from '../../lib/ai/machineModelAI';
import { getPart } from '../catalog';
import { DEFAULT_PREFERENCE } from '../catalogs';
import { getCpu, getProfile } from '../../plc/core/profiles';
import { resolveAddresses } from '../../plc/core/profile';
import { moduleSlots } from '../../plc/core/modules';
import type { IOPoint } from '../../types/io';
import type { DesignInputs } from '../types';

const profile = getProfile('click');
const cpu = getCpu(profile, 'C0-10DD1E-D');
const plc = { vendor: profile.vendor, name: profile.name, cpuPartNumber: cpu.id, cpuLabel: '' };
const points = (ds: [string, 'input' | 'output'][]) => ds.map(([description, type], i) => ({ id: `p${i}`, description, type, category: 'Process' })) as unknown as IOPoint[];
const design = (spec: string, io: IOPoint[], inputs: DesignInputs) => generateRuleBasedDesign({
  spec, io, addresses: resolveAddresses(profile, cpu, io, moduleSlots([])), inputs, region: 'US', pref: DEFAULT_PREFERENCE, getPart,
  hmiPartNumber: null, analog: [], modules: [], projectName: 'Redesign', plc,
});

const empty: DesignInputs = { supply: '480VAC-3PH', enclosureRating: 'NEMA 12', notes: '', motors: [], requiredParts: [] };
const A = await design('Conveyor with a 2 HP belt motor and a pusher cylinder.', points([['Start', 'input'], ['Stop', 'input'], ['Belt conveyor motor run', 'output'], ['Pusher extend solenoid', 'output']]), empty);
assert.ok(A.design.inputs.motors.every((m) => m.fromDesign), 'design A: motors read from the machine are marked as the design\'s');

// design B, for another machine, from the inputs the page wrote back after A
const pumpSpec = 'Pump skid: one 5 HP pump on a contactor, a tank level switch.';
const pumpIo = points([['Start', 'input'], ['Stop', 'input'], ['Tank low level switch', 'input'], ['Pump motor contactor', 'output']]);
const B = await design(pumpSpec, pumpIo, A.design.inputs);
const aWords = /belt|conveyor|pusher/i;
assert.deepEqual(B.design.notes.filter((n) => aWords.test(n)), [], 'design B keeps none of design A\'s notes');
assert.ok(!B.design.inputs.motors.some((m) => aWords.test(m.description)), 'nor its motors');

// a motor the designer typed (or edited) that this machine never mentions is still asked about
const typed = { ...A.design.inputs, motors: A.design.inputs.motors.map((m) => ({ ...m, fromDesign: undefined })) };
const C = await design(pumpSpec, pumpIo, typed);
assert.ok(C.design.notes.some((n) => /Belt conveyor motor .* left out of the design/.test(n)), 'a typed motor that is not in this machine is asked about');

console.log('redesign.test: ok');
