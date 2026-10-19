/// <reference types="node" />
/** The 24 VDC supply's feed voltage for the part picker. Run with:  npx tsx src/electrical/psFeed.test.ts */
import assert from 'node:assert/strict';
import { generateDefaultDesign } from './engine';
import { exampleInput } from './improve/testDesign';
import { getPart } from './catalog';
import { psFeedVolts } from './psFeed';
import { compareStrength } from './strength';

const d480 = generateDefaultDesign(exampleInput('480VAC-3PH')).design;
assert.equal(psFeedVolts(d480, getPart), 480, '480 V line feed');
const d600 = generateDefaultDesign(exampleInput('600VAC-3PH')).design;
assert.equal(psFeedVolts(d600, getPart), 120, '600 V: the control transformer secondary');
// The picker refuses the 1-phase supply behind the 600 V transformer for the 480 V-fed PS1, and keeps it at 120 V.
const ps480 = getPart(d480.components.find((c) => c.tag === 'PS1')!.partNumber)!;
const ps600 = getPart(d600.components.find((c) => getPart(c.partNumber)?.category === 'powerSupply')!.partNumber)!;
assert.equal(compareStrength(ps480, ps600, { feedVolts: psFeedVolts(d480, getPart) }).ok, false, `${ps600.partNumber} not offered at 480 V`);
assert.equal(compareStrength(ps600, ps600, { feedVolts: psFeedVolts(d600, getPart) }).ok, true);
console.log(`psFeed tests passed (${ps480.partNumber} at 480 V, ${ps600.partNumber} on the 120 V secondary)`);
