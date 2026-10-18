/// <reference types="node" />
/**
 * "No touch panel" applied to a project: the door devices are added to the I/O list before the modules are
 * fitted, so the CPU is never overfilled and the 20% spare the choice had is kept.
 * Run with:  npx tsx src/spec/operatorIo.test.ts
 */
import assert from 'node:assert/strict';
import { applyEquipment } from './equipment';
import { needFromIo } from './equipmentRules';
import { addedOperatorPoints, missingOperatorIo } from './operatorIo';
import { cpuFit, findCpu } from '../plc/core/fit';
import { useIOStore } from '../store/useIOStore';
import { useProjectStore } from '../store/useProjectStore';
import type { IOPoint } from '../types/io';

// A C0-10DD1E-D (6 inputs / 4 outputs) holding 4 sensors and 2 outputs: fits with its spare; the 7 door devices would overflow it.
const io: IOPoint[] = [
  ...['Part present photo-eye', 'Clamp closed', 'Clamp open', 'Air pressure OK'].map((d, i) => ({ id: `i${i}`, description: d, type: 'input' as const, category: 'Product Detection' as const, deviceType: 'sensor-pnp' })),
  ...['Clamp close solenoid', 'Clamp open solenoid'].map((d, i) => ({ id: `o${i}`, description: d, type: 'output' as const, category: 'Pneumatic' as const, deviceType: 'solenoid' })),
];
useIOStore.setState({ projectIO: io });
const cpu = findCpu('C0-10DD1E-D')!;
assert.ok(cpuFit(cpu, [], needFromIo(io, false)).ok, 'fits with the spare before');
applyEquipment({ cpuId: 'C0-10DD1E-D', modules: [], hmiPartNumber: null }, null);
const after = useIOStore.getState().projectIO;
assert.equal(after.length, io.length + missingOperatorIo(io).length, 'door devices added');
assert.deepEqual(missingOperatorIo(after), []);
assert.deepEqual(addedOperatorPoints(after).map((p) => p.description), ['Start pushbutton', 'Stop pushbutton (NC)', 'Reset pushbutton', 'Auto/Manual selector (ON = Manual)', 'Running lamp (green)', 'Fault lamp (red)'], 'offered for removal when a panel is chosen again (E-stop stays)');
assert.deepEqual(addedOperatorPoints(io), [], 'the machine\'s own points are never offered');
const mods = useProjectStore.getState().modules;
assert.ok(mods.length >= 1, `modules added for the door devices: ${mods.join(', ')}`);
assert.ok(cpuFit(cpu, mods, needFromIo(after, false)).ok, `the CPU + ${mods.join(', ')} hold the list with its 20% spare`);

// With a touch panel nothing is added and the choice stays as it is.
useIOStore.setState({ projectIO: io });
applyEquipment({ cpuId: 'C0-10DD1E-D', modules: [], hmiPartNumber: 'CM5-T7W' }, null);
assert.equal(useIOStore.getState().projectIO.length, io.length);
assert.deepEqual(useProjectStore.getState().modules, []);

console.log('operatorIo tests passed');
