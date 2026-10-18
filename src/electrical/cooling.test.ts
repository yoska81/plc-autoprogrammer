/// <reference types="node" />
/**
 * Enclosure cooling picks: smallest catalog part that carries the heat, with its exhaust filter.
 * Run with:  npx tsx src/electrical/cooling.test.ts
 */
import assert from 'node:assert/strict';
import { CATALOG, getPart } from './catalog';
import { coolingWatts, fanAirflowM3h, pickAirConditioner, pickFilterFan, pickHeatExchanger } from './cooling';

// Every filter fan has an airflow, a cutout and an exhaust filter that is in the catalog.
for (const p of CATALOG.filter((x) => x.category === 'fan' && x.ratings.kind === 'filter fan')) {
  assert.ok(fanAirflowM3h(p)! > 0, `${p.partNumber} airflow`);
  assert.ok(Number(p.ratings.cutoutWidthMm) > 0 && Number(p.ratings.cutoutHeightMm) > 0, `${p.partNumber} cutout`);
  assert.ok(getPart(String(p.ratings.pairsWith).split(/,\s*/)[0]), `${p.partNumber} exhaust filter ${p.ratings.pairsWith}`);
}

// 100 m³/h: the smallest AD AC fan that does it with filters, and its grille.
const f = pickFilterFan(100, { vendors: ['automationdirect'] })!;
assert.ok(f.airflowM3h >= 100 && f.exhaust?.ratings.kind === 'exhaust filter', JSON.stringify(f.fan.partNumber));
assert.ok(CATALOG.filter((p) => p.vendor === undefined && p.category === 'fan' && p.ratings.kind === 'filter fan' && !/dc/i.test(String(p.ratings.volts)))
  .every((p) => fanAirflowM3h(p)! < 100 || fanAirflowM3h(p)! >= f.airflowM3h), 'smallest that fits');
assert.match(String(pickFilterFan(100, { supply: '24VDC' })!.fan.ratings.volts), /dc/i);
assert.equal(pickFilterFan(100, { vendors: ['rittal'] })!.fan.vendor, 'rittal');
assert.match(String(pickFilterFan(100, { nema: '12' })!.fan.ratings.nema), /12/);
assert.match(pickHeatExchanger(300, 10, { nema: '4X' })!.partNumber, /-4X$/, '4X cabinet: a 4X heat exchanger');
assert.doesNotMatch(String(pickAirConditioner(500, { nema: '4' })!.ratings.nema), /4X/i, "'4' is not '4X'");
assert.equal(pickFilterFan(50, { nema: '4X' }), null, 'a fan that is 4X only with an accessory hood does not count');
assert.equal(pickFilterFan(1e6), null, 'nothing that big');

// Air conditioners and heat exchangers by capacity.
const ac = pickAirConditioner(1000)!;
assert.ok(coolingWatts(ac)! >= 1000);
assert.ok(Number(pickHeatExchanger(300, 10)!.ratings.wPerK) * 10 >= 300);
assert.equal(pickHeatExchanger(300, 0), null, 'a heat exchanger cannot cool to or below ambient');
console.log('cooling tests passed');
