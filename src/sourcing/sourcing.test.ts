// npx tsx src/sourcing/sourcing.test.ts — sourcing data, cross-brand equivalents, swap impact, optimise, live-check verification.
import assert from 'node:assert/strict';
import { equivalentsOf, sourcingFlags, sourcingOf } from './data';
import { optimise, DEFAULT_GOALS } from './optimise';
import { swapInDesign, impactOf } from './swap';
import { verifyResults } from './liveCheck';
import { realCatalogContext } from '../electrical/drawings/__fixtures__/realCatalog';
import { billOfMaterials } from '../electrical/derive';

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log('  ok ', name); };

test('price comes from the verified price list with its date', () => {
  const s = sourcingOf('GMCBU-3C-10');
  assert.equal(s.price?.price, 60);
  assert.match(s.price?.date ?? '', /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(sourcingOf('NO-SUCH-PART').lead, 'unknown');
});

test('flags: back-order and obsolete are red, long lead and end of life orange', () => {
  assert.deepEqual(sourcingFlags({ lead: 'backorder', lifecycle: 'obsolete', successor: 'X2' }).map((f) => f.level), ['red', 'red']);
  assert.deepEqual(sourcingFlags({ lead: 'long', lifecycle: 'eol' }).map((f) => f.level), ['orange', 'orange']);
  assert.deepEqual(sourcingFlags({ lead: 'stock', lifecycle: 'active' }), []);
});

test('cross-brand equivalents keep the function and ratings', () => {
  const eq = equivalentsOf('GMCBU-3C-10');
  for (const e of eq) {
    assert.equal(e.part.category, 'breaker');
    assert.equal(String(e.part.ratings.amps), '10');
    assert.equal(String(e.part.ratings.poles), '3');
    assert.notEqual(e.part.manufacturer, 'AutomationDirect');
  }
  console.log(`     ${eq.length} equivalents of GMCBU-3C-10: ${eq.slice(0, 4).map((e) => `${e.part.manufacturer} ${e.part.partNumber}`).join(', ')}`);
});

test('swap: every component with the part takes the replacement; the impact is reported', () => {
  const ctx = realCatalogContext();
  const line = billOfMaterials(ctx).flatMap((g) => g.lines).find((l) => equivalentsOf(l.partNumber).length);
  assert.ok(line, 'a BOM line with an equivalent');
  const to = equivalentsOf(line!.partNumber)[0].part.partNumber;
  const design = swapInDesign(ctx.design, line!.partNumber, to);
  assert.ok(!design.components.some((c) => c.partNumber === line!.partNumber));
  assert.ok(design.components.some((c) => c.partNumber === to));
  const impact = impactOf(ctx, { ...ctx, design });
  assert.ok(impact.some((i) => i.what === 'Bill of materials'), JSON.stringify(impact));
  console.log(`     ${line!.partNumber} → ${to}: ${impact.map((i) => `${i.what}: ${i.before} → ${i.after}`).join(' | ').slice(0, 200)}`);
});

test('an accessory that mounts on the swapped part is reported (overload on its contactor)', () => {
  const ctx = realCatalogContext();
  const k = ctx.design.components.find((c) => ctx.getPart(c.partNumber)?.category === 'contactor')!;
  const to = equivalentsOf(k.partNumber)[0].part.partNumber;
  const impact = impactOf(ctx, { ...ctx, design: swapInDesign(ctx.design, k.partNumber, to) });
  assert.ok(impact.some((i) => /no longer fits/.test(i.what) && i.level === 'bad'), JSON.stringify(impact));
  // and an overload made for one maker's contactors has no cross-brand "equivalent"
  const ol = ctx.design.components.find((c) => ctx.getPart(c.partNumber)?.category === 'overload')!;
  assert.deepEqual(equivalentsOf(ol.partNumber).filter((e) => String(e.part.ratings.forUse) !== String(ctx.getPart(ol.partNumber)!.ratings.forUse)), []);
});

test('optimise: a cheaper equivalent is proposed when price matters; nothing when no goal is set', () => {
  const lines = billOfMaterials(realCatalogContext()).flatMap((g) => g.lines).filter((l) => l.partNumber).map((l) => ({ partNumber: l.partNumber, qty: l.qty }));
  const p = optimise(lines, { lead: 0, price: 3, quality: 0, oneBrand: 0 });
  for (const x of p) if (x.saving !== null) assert.ok(x.saving > 0, `${x.from} → ${x.to} saves`);
  assert.deepEqual(optimise(lines, { lead: 0, price: 0, quality: 0, oneBrand: 0 }), []);
  console.log(`     ${p.length} proposal(s) for price; default goals: ${optimise(lines, DEFAULT_GOALS).length}`);
});

test('live check: a value whose page the search did not return is dropped', () => {
  const sources = [{ url: 'https://www.automationdirect.com/adc/shopping/catalog/x/gmcbu-3c-10?ref=1', title: 'GMCBU' }];
  const r = verifyResults([
    { partNumber: 'GMCBU-3C-10', stock: 'In stock: 37', price: '$60.00', url: 'https://automationdirect.com/adc/shopping/catalog/x/gmcbu-3c-10/' },
    { partNumber: 'K1', stock: 'In stock: 5', url: 'https://www.mouser.com/made-up' },
  ], ['GMCBU-3C-10', 'K1', 'MISSING'], sources, '2026-10-17');
  assert.equal(r[0].stock, 'In stock: 37');
  assert.equal(r[0].checkedOn, '2026-10-17');
  assert.equal(r[1].stock, null);
  assert.match(r[1].note, /not among the pages/);
  assert.equal(r[2].stock, null);
});

console.log(`\n${passed} passed`);
