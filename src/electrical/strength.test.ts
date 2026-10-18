/// <reference types="node" />
/**
 * Part strength comparison tests. Run with:  npx tsx src/electrical/strength.test.ts
 */
import assert from 'node:assert/strict';
import { CATALOG, partsIn } from './catalog';
import { compareStrength } from './strength';

// The current part is always selectable.
for (const p of CATALOG) assert.equal(compareStrength(p, p).ok, true, p.partNumber);

// Smaller breakers are greyed, bigger ones are allowed.
const breakers = partsIn('breaker').filter((p) => typeof p.ratings.amps === 'number' && p.ratings.poles === 3)
  .sort((a, b) => Number(a.ratings.amps) - Number(b.ratings.amps));
const mid = breakers[Math.floor(breakers.length / 2)];
const small = breakers.find((p) => Number(p.ratings.amps) < Number(mid.ratings.amps) && p.ratings.curve === mid.ratings.curve);
const big = breakers.find((p) => Number(p.ratings.amps) > Number(mid.ratings.amps) && p.ratings.curve === mid.ratings.curve);
if (small) assert.equal(compareStrength(mid, small).ok, false);
if (big) assert.equal(compareStrength(mid, big).ok, true);

console.log('strength tests passed');

// Voltage ratings written as text are compared (AC with AC).
import { keyRatings, parseVolts } from './strength';
import { getPart } from './catalog';
assert.deepEqual(parseVolts('480Y/277 VAC/125 VDC'), { ac: 480, dc: 125 });
assert.deepEqual(parseVolts('240 VAC/125 VDC'), { ac: 240, dc: 125 });
assert.deepEqual(parseVolts('10-36VDC'), { dc: 36 });
assert.deepEqual(parseVolts('24VAC/VDC'), { ac: 24, dc: 24 });
assert.deepEqual(parseVolts(600), { ac: 600 });
assert.deepEqual(parseVolts('600'), { ac: 600 });
const b480 = CATALOG.find((p) => p.category === 'breaker' && parseVolts(p.ratings.volts).ac === 480 && p.ratings.poles === 3)!;
const b240 = getPart('GMCBU-3C-30');
assert.ok(b240);
assert.match(compareStrength(b480, b240!).reason, /Lower voltage rating: 240 V vs 480 V/, `${b480.partNumber} -> GMCBU-3C-30`);

// Motor branch: a breaker above 250 % of the motor FLA (next standard size) is too big (NEC 430.52).
const b15 = getPart('GMCBU-3C-15')!;
const bigger = breakers.find((p) => Number(p.ratings.amps) > 15 && p.ratings.volts === b15.ratings.volts && p.ratings.curve === b15.ratings.curve)!;
assert.ok(bigger, 'a bigger 480 V breaker of the same family');
const motor = { tag: 'M1', fla: 2.1, iec: false };
assert.match(compareStrength(b15, bigger, { motor }).reason, /Too big for M1: max 15 A/);
assert.equal(compareStrength(b15, bigger, { motor: { ...motor, iec: true } }).ok, true, 'IEC: no NEC 430.52 limit');
assert.equal(compareStrength(b15, bigger).ok, true, 'no motor: bigger is fine');

// Units are not doubled, and bare voltages get theirs.
for (const p of CATALOG) {
  const k = keyRatings(p);
  assert.ok(!/V(AC|DC)?\s+V\b/.test(k) && !/VDC V|VAC V/.test(k), `${p.partNumber}: doubled unit in "${k}"`);
}
assert.ok(!/· 24$/.test(keyRatings(CATALOG.find((p) => p.ratings.outputVolts === 24)!)), 'output voltage has its unit');
console.log('voltage and motor branch tests passed');

// SCCR (UL 508A SB4): a drive or power supply rating always says which upstream protection it depends on and where it is published.
for (const p of CATALOG.filter((x) => (x.category === 'vfd' || x.category === 'powerSupply') && x.ratings.sccrKA !== undefined)) {
  assert.ok(String(p.ratings.sccrCondition ?? '').length > 20, `${p.partNumber}: sccrCondition`);
  assert.match(String(p.ratings.sccrSource ?? ''), /^https:\/\//, `${p.partNumber}: sccrSource`);
}
assert.equal(getPart('GS23-45P0')!.ratings.sccrKA, 100);
assert.equal(getPart('ATV320U07N4B')!.ratings.sccrKA, 5, 'ATV320 without the line reactor');
console.log('SCCR rating tests passed');

// Power supplies: the swap must take the same feed. A 480 V 3-phase PS is never offered a 90-264 VAC one.
assert.match(compareStrength(getPart('PSR-24-240-3')!, getPart('PSR-24-240')!).reason, /^Different input/);
assert.match(compareStrength(getPart('PSR-24-240')!, getPart('PSR-24-240-3')!).reason, /^Different input/, 'and not the other way');
assert.ok(compareStrength(getPart('PSR-24-240-3')!, getPart('ABL8RPS24100')!).ok, '200-500 V L-L takes a 480 V feed');
assert.ok(compareStrength(getPart('PSR-24-240')!, getPart('ABL8RPS24100')!).ok, 'and a 120 / 240 V one');
assert.ok(!compareStrength(getPart('ABL8RPS24100')!, getPart('PSR-24-240-3')!).ok, 'a 3-phase supply needs all three lines');
console.log('power supply input tests passed');
