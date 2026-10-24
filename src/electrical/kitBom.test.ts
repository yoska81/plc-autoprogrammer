/// <reference types="node" />
/**
 * A kit (`ratings.kitParts`, e.g. a Siemens 8WD44 signal column ordered as its elements) is one device on the
 * drawings and one line per real part in the BOM, CSV and pricing. Run with:  npx tsx src/electrical/kitBom.test.ts
 */
import assert from 'node:assert/strict';
import { exampleInput, ctxFor } from './improve/testDesign';
import { getPart } from './catalog';
import { billOfMaterials, bomCsv, kitPartsOf } from './derive';
import type { CatalogPart } from './types';

const part = (partNumber: string, ratings: Record<string, unknown> = {}) =>
  ({ partNumber, category: 'other', manufacturer: 'Siemens', description: `element ${partNumber}`, ratings }) as unknown as CatalogPart;
assert.deepEqual(kitPartsOf(part('K', { kitParts: '8WD4408-0AB x1, 8WD4420-5AB x2,8WD4420-0FA' })),
  [{ partNumber: '8WD4408-0AB', each: 1 }, { partNumber: '8WD4420-5AB', each: 2 }, { partNumber: '8WD4420-0FA', each: 1 }]);
assert.equal(kitPartsOf(part('K')), null);
assert.equal(kitPartsOf(undefined), null);

// A design whose device is a kit of two catalog elements (one used twice) and one element not in the catalog.
const input = exampleInput('480VAC-3PH');
const base = ctxFor(input);
// (the example has no stack light: pushbutton PB3 stands in; the expansion reads only ratings.kitParts)
const sl = base.design.components.find((c) => c.tag === 'PB3')!;
assert.ok(sl, 'example design has PB3');
const KIT = 'EL-A + EL-B + EL-B + EL-X';
const kit = { ...getPart(sl.partNumber)!, partNumber: KIT, manufacturer: 'Siemens', description: 'signal column kit', ratings: { ...getPart(sl.partNumber)!.ratings, kitParts: 'EL-A x1, EL-B x2, EL-X x1' } } as CatalogPart;
const extra = new Map<string, CatalogPart>([[KIT, kit], ['EL-A', part('EL-A')], ['EL-B', part('EL-B')]]);
const design = { ...base.design, components: base.design.components.map((c) => (c === sl ? { ...c, partNumber: KIT, quantity: 2 } : c)) };
const ctx = { ...base, design, getPart: (pn: string) => extra.get(pn) ?? getPart(pn) };

const lines = billOfMaterials(ctx).flatMap((g) => g.lines);
assert.ok(!lines.some((l) => l.partNumber === KIT), 'the kit itself is not a BOM line');
const qty = (pn: string) => lines.find((l) => l.partNumber === pn)?.qty;
assert.equal(qty('EL-A'), 2, 'EL-A: 2 kits x 1');
assert.equal(qty('EL-B'), 4, 'EL-B: 2 kits x 2');
assert.equal(qty('EL-X'), 2, 'element not in the catalog still listed');
for (const pn of ['EL-A', 'EL-B', 'EL-X']) {
  const l = lines.find((x) => x.partNumber === pn)!;
  assert.deepEqual(l.tags, [sl.tag], `${pn} carries the device tag`);
  assert.equal(l.category, 'pushbutton', `${pn} listed with the device's category`);
  assert.match(l.description, new RegExp(`part of the ${sl.tag} kit`));
}
assert.equal(lines.find((l) => l.partNumber === 'EL-X')!.manufacturer, 'Siemens', 'maker from the kit when the element is unknown');
const csv = bomCsv(ctx);
assert.ok(!csv.includes(`,${KIT},`), 'CSV has no kit line');
assert.ok(/,4,EL-B,/.test(csv), 'CSV line EL-B x4');
// The drawings keep one device.
assert.equal(ctx.design.components.filter((c) => c.tag === sl.tag).length, 1);
console.log(`kit BOM tests passed (${sl.tag}: ${lines.filter((l) => l.tags.includes(sl.tag)).map((l) => `${l.qty}x ${l.partNumber}`).join(', ')})`);
