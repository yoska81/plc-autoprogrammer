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
// A 24 VAC transformer (lamps, coils) never counts as the supply's feed; a 120/240 V secondary reads as 120 V.
const fake = (secondaryVolts: string) => ({ partNumber: `T-${secondaryVolts}`, category: 'other', description: 'transformer', ratings: { kind: 'transformer', secondaryVolts } }) as unknown as ReturnType<typeof getPart>;
const withT = (sv: string) => ({ ...d480, components: [...d480.components, { tag: 'T9', partNumber: `T-${sv}`, quantity: 1, function: 'transformer', motorTag: null }] });
const gp = (pn: string) => (pn.startsWith('T-') ? fake(pn.slice(2)) : getPart(pn));
assert.equal(psFeedVolts(withT('24 VAC'), gp), 480, 'a 24 VAC transformer is not the supply feed');
assert.equal(psFeedVolts(withT('120/240'), gp), 120, '120/240 V secondary: 120 V');
console.log(`psFeed tests passed (${ps480.partNumber} at 480 V, ${ps600.partNumber} on the 120 V secondary)`);
