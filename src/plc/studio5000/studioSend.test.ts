/// <reference types="node" />
/**
 * Send to Studio 5000: the parts of the app's L5X the SDK imports into the user's project: data types and Add-On
 * Instructions only when the program has them, then the controller tags and MainProgram (the controller, its I/O
 * configuration and its tasks stay the user's).
 * Run with:  npx tsx src/plc/studio5000/studioSend.test.ts
 */
import assert from 'node:assert/strict';
import { seedSampleProject } from '../../preview/sampleProject';
import { collectProject } from '../../deliverables/collect';
import { useProjectStore } from '../../store/useProjectStore';
import { l5xParts, MAIN_PROGRAM, studioImport } from './studioSend';

assert.deepEqual(l5xParts('<Controller><DataTypes/><Tags><Tag/></Tags><Programs><Program Name="MainProgram"/></Programs></Controller>'), ['Controller/Tags', MAIN_PROGRAM]);
assert.deepEqual(l5xParts('<Controller><DataTypes>\n<DataType Name="Station"/>\n</DataTypes><AddOnInstructionDefinitions><AddOnInstructionDefinition Name="Valve"/></AddOnInstructionDefinitions><Tags/></Controller>'),
  ['Controller/DataTypes', 'Controller/AddOnInstructionDefinitions', 'Controller/Tags', MAIN_PROGRAM]);

seedSampleProject();
useProjectStore.getState().setPlc('logix', '5069-L310ER');
const s = studioImport(collectProject());
assert.match(s.l5x, /^<\?xml[\s\S]*<RSLogix5000Content[\s\S]*<Program Name="MainProgram"/);
assert.equal(s.xpaths.at(-1), MAIN_PROGRAM);
assert.ok(s.xpaths.includes('Controller/Tags'));
assert.ok(!s.xpaths.some((x) => /Tasks|Modules/.test(x)), 'the tasks and the I/O configuration stay the user\'s');
console.log(`studioSend.test: all passed (${s.xpaths.join(', ')})`);
