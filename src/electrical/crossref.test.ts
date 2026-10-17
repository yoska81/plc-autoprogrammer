/// <reference types="node" />
/**
 * Cross-reference tests. Run with:  npx tsx src/electrical/crossref.test.ts
 */
import assert from 'node:assert/strict';
import { getPart } from './catalog';
import { crossReference, differences, equivalents, functionKey } from './crossref';

// Same function and rating across brands, from the catalog ratings.
assert.deepEqual(functionKey(getPart('SC-E02PG-24VDC')!), ['contactor', '3P 9 A']);
assert.deepEqual(functionKey(getPart('LC1D09BD')!), ['contactor', '3P 9 A']);
const c9 = crossReference().find((g) => g.fn === 'contactor' && g.key === '3P 9 A')!;
assert.ok(c9.parts['allen-bradley']?.includes('100-C09EJ10') && c9.parts.siemens?.includes('3RT2016-1BB41'), 'AB / Siemens 9 A contactors');

// A swap says what changes: footprint, coil voltage, SCCR.
const d = differences(getPart('SC-E02PG-24VDC')!, getPart('SC-E02P-110VAC')!);
assert.ok(d.some((x) => /^Coil voltage: 24VDC → 120VAC/.test(x)), d.join(' | '));
assert.ok(equivalents(getPart('SC-E02PG-24VDC')!).every((e) => e.part.vendor !== 'automationdirect'), 'equivalents are other brands');
const drive = equivalents(getPart('GS23-45P0')!);
assert.ok(drive.length >= 3 && drive.every((e) => functionKey(e.part)?.[1] === '5 HP 480 V'), 'same HP and voltage class');
assert.ok(differences(getPart('GS23-45P0')!, getPart('ATV320U40N4B')!).some((x) => /^SCCR \(kA\): 100 → 5/.test(x)), 'SCCR drop is flagged');

// Breakers: branch (UL 489) and supplementary protectors are never cross-referenced to each other.
for (const g of crossReference().filter((x) => x.fn === 'breaker')) {
  const kinds = new Set(Object.values(g.parts).flat().map((pn) => /UL 489/.test(functionKey(getPart(pn!)!)![1])));
  assert.equal(kinds.size, 1, g.key);
}
console.log(`cross-reference tests passed (${crossReference().length} groups)`);
