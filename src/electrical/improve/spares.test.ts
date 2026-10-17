/// <reference types="node" />
/** Spare-parts list. Run with:  npx tsx src/electrical/improve/spares.test.ts */
import assert from 'node:assert/strict';
import { recommendedQty, spareParts } from './spares';
import { exampleCtx } from './testDesign';

const s = spareParts(exampleCtx());
const by = (cat: string) => s.lines.filter((l) => l.category === cat);
for (const c of ['contactor', 'powerSupply', 'plc', 'hmi', 'safetyRelay']) assert.ok(by(c).length, `${c} in the spares`);
assert.ok(!s.lines.some((l) => l.category === 'enclosure' || l.category === 'terminal'), 'no enclosure or terminals');
assert.ok(s.lines.every((l) => l.qty > 0 && l.installed > 0));
assert.equal(s.lines[0].criticality, 'A', 'critical parts first');
assert.equal(by('hmi')[0].partNumber, 'CM5-T7W');
assert.equal(by('hmi')[0].unitPrice, 499);
assert.equal(by('powerSupply')[0].extended, 105);
assert.ok(s.total > 0);
assert.equal(s.unpriced, s.lines.filter((l) => l.unitPrice === undefined).length);

// Quantities by criticality and failure rate.
assert.equal(recommendedQty('fuse', 2, { crit: 'A', rate: 'high' }), 3, 'fuses: a full set, at least 3');
assert.equal(recommendedQty('fuse', 6, { crit: 'A', rate: 'high' }), 6);
assert.equal(recommendedQty('contactor', 1, { crit: 'A', rate: 'high' }), 1);
assert.equal(recommendedQty('contactor', 4, { crit: 'A', rate: 'high' }), 2, 'critical wear part in several places: two');
assert.equal(recommendedQty('relay', 12, { crit: 'B', rate: 'high' }), 3, '20% of a wear part');
assert.equal(recommendedQty('vfd', 4, { crit: 'A', rate: 'low' }), 1);
assert.equal(recommendedQty('pilotLight', 3, { crit: 'C', rate: 'low' }), 0, 'minor parts that rarely fail: none');
console.log(`spare-parts tests passed (${s.lines.length} lines)`);
