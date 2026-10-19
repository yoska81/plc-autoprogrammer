/// <reference types="node" />
/**
 * The panel's supply disconnect must be UL 98 / UL 489 listed under UL 508A: a UL 508 manual motor controller
 * (Siemens 3LD) is a motor disconnect only. IEC regions keep it. Run with:  npx tsx src/electrical/engine/mainDisconnect.test.ts
 */
import assert from 'node:assert/strict';
import { generateDefaultDesign } from './index';
import { supplyDisconnectListed } from './power';
import { exampleInput } from '../improve/testDesign';
import { getPart } from '../catalog';
import { ALL_PARTS, normalizePreference } from '../catalogs';
import type { CatalogPart } from '../types';

const part = (ul?: string) => ({ partNumber: 'X', category: 'disconnect', description: '', ratings: ul === undefined ? {} : { ul } }) as unknown as CatalogPart;
assert.equal(supplyDisconnectListed(part('98')), true);
assert.equal(supplyDisconnectListed(part('UL 489')), true);
assert.equal(supplyDisconnectListed(part('508')), false, 'UL 508 motor disconnect');
assert.equal(supplyDisconnectListed(part()), true, 'no listing stated: as before');

// AutomationDirect default: unchanged.
const ad = generateDefaultDesign(exampleInput('480VAC-3PH')).design;
const ds = ad.components.find((c) => c.tag === 'DS1')!;
assert.ok(ds && supplyDisconnectListed(getPart(ds.partNumber)!), `DS1 ${ds?.partNumber} is UL 98`);

// Siemens panel parts in the US: never a UL 508-only disconnect as DS1 (when the catalog has one, a note says why).
const s = generateDefaultDesign({ ...exampleInput('480VAC-3PH'), pref: normalizePreference({ panel: ['siemens'] }) }).design;
const sds = getPart(s.components.find((c) => c.tag === 'DS1')!.partNumber)!;
assert.ok(supplyDisconnectListed(sds), `DS1 ${sds.partNumber} listed for a supply disconnect`);
// A back-panel UL 508 disconnect that would otherwise fit is refused with a note saying why (none in the catalog today:
// the Siemens 3LD is door-mounted, so the supply disconnect never picks it; the guard is for the next one).
const back508 = ALL_PARTS.filter((p) => p.category === 'disconnect' && p.mount === 'backplate' && !supplyDisconnectListed(p));
if (back508.some((p) => p.vendor === 'siemens')) assert.ok(s.notes.some((n) => /UL 508 as a motor disconnect only/.test(n)), 'said why the Siemens disconnect is not used');
console.log(`main disconnect tests passed (Siemens US: DS1 ${sds.partNumber}, back-panel UL 508 disconnects in the catalog: ${back508.length})`);
