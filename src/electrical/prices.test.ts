/// <reference types="node" />
/**
 * Price data tests. Run with:  npx tsx src/electrical/prices.test.ts
 */
import assert from 'node:assert/strict';
import { PRICES } from './prices';
import { getPart } from './catalog';

for (const [pn, p] of Object.entries(PRICES)) {
  assert.ok(p.price > 0 && Number.isFinite(p.price), `${pn}: price`);
  assert.match(p.date, /^\d{4}-\d{2}-\d{2}$/, `${pn}: date`);
  assert.match(p.sourceUrl, /^https:\/\/www\.automationdirect\.com\//, `${pn}: source must be the supplier's own page`);
  assert.ok(p.sourceUrl.toLowerCase().endsWith(pn.toLowerCase()), `${pn}: source page is for this part`);
  // The selling unit agrees with the catalog pack size used to round order quantities.
  const pack = Number(getPart(pn)?.ratings?.packQty) || 1;
  const m = /pack of (\d+)/.exec(p.unit);
  assert.equal(m ? Number(m[1]) : 1, pack, `${pn}: price unit "${p.unit}" vs catalog pack of ${pack}`);
}
console.log(`price tests passed (${Object.keys(PRICES).length} prices)`);
