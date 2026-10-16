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
