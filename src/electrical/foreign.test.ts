/// <reference types="node" />
/**
 * Imported (IEC / Chinese) part → UL catalog part matching, for "Convert existing drawings".
 * Run with:  npx tsx src/electrical/foreign.test.ts
 */
import assert from 'node:assert/strict';
import { CATALOG } from './catalog';
import { FOREIGN_PART_DATA, foreignPart } from './catalogs/foreignParts';
import { foreignEquivalents } from './foreign';

const catalogPns = new Set(CATALOG.map((p) => p.partNumber));
const n = (v: unknown) => Number(v);

// The converter's record: drawn ratings in its units, found by the printed part number (case / spacing ignored).
assert.deepEqual(foreignPart('nxc-09  220v 50/60hz')?.drawn, { amps: 9, poles: 3, coilVoltage: '220VAC' });

// Contactor: same poles, at least the AC-3 current, smallest first; the coil change is listed.
const k = foreignEquivalents('NXC-09 220V 50/60Hz');
assert.ok(k.length && k.every((e) => catalogPns.has(e.part.partNumber) && n(e.part.ratings.poles) === 3 && n(e.part.ratings.amps) >= 9));
assert.ok(k[0].differences.some((d) => /^Coil voltage: 220VAC → /.test(d)), k[0].differences.join(' | '));
assert.ok(k[0].differences.some((d) => /^Imported part UL status: .*no UL/i.test(d)));

// Miniature breaker 16 A C: no US 16 A twin needed; within 20 %, same curve and poles, UL 489 first.
const b = foreignEquivalents('NXB-63 1P C16 6kA');
assert.ok(b.length && b.every((e) => e.part.ratings.curve === 'C' && n(e.part.ratings.poles) === 1 && Math.abs(n(e.part.ratings.amps) - 16) <= 3.2));
const firstSupp = b.findIndex((e) => e.differences.some((d) => /Not branch rated/.test(d)));
assert.ok(firstSupp === -1 || b.slice(firstSupp).every((e) => e.differences.some((d) => /Not branch rated/.test(d))), 'branch-rated breakers first');

// Overload: a catalog range that contains the drawn range's middle.
for (const e of foreignEquivalents('JRS1Dsp 25 1P6')) assert.ok(n(e.part.ratings.minAmps) <= 1.3 && 1.3 <= n(e.part.ratings.maxAmps), e.part.partNumber);

// Relay 2CO 24 VDC → DPDT, 24 VDC coil first; 22 mm green N.O. pushbutton → green 22 mm.
const r = foreignEquivalents('RJ2S-CL-D24');
assert.ok(r.length && r.every((e) => e.part.ratings.contacts === 'DPDT') && /24VDC/.test(String(r[0].part.ratings.coilVoltage)));
assert.ok(foreignEquivalents('XB2BA31C').every((e) => /green/i.test(String(e.part.ratings.color))));

// Power supply: same voltage, at least the current.
assert.ok(foreignEquivalents('NDR-120-24').every((e) => n(e.part.ratings.outputVolts) === 24 && n(e.part.ratings.outputAmps) >= 5));

// Every CHINT / Delixi contactor, overload and motor protector has a UL equivalent.
const unmatched = Object.entries(FOREIGN_PART_DATA)
  .filter(([, f]) => /chint|delixi/i.test(f.maker) && ['contactor', 'overload', 'motorProtector'].includes(f.category))
  .filter(([pn]) => !foreignEquivalents(pn).length).map(([pn]) => pn);
assert.deepEqual(unmatched, []);

// Automation: an FX3U-32MR CPU → at least 16 in / 16 relay out; a PNP prox → PNP of the same type.
const plc = foreignEquivalents('FX3U-32MR/ES');
assert.ok(plc.length && plc.every((e) => Number(e.part.ratings.discreteInputs) >= 16 && /relay/i.test(String(e.part.ratings.outputType))));
const pnpProx = Object.entries(FOREIGN_PART_DATA).find(([, f]) => f.category === 'sensor' && f.part.ratings.output === 'PNP' && f.part.ratings.type === 'inductive')!;
assert.ok(foreignEquivalents(pnpProx[0]).every((e) => e.part.ratings.output === 'PNP' && e.part.ratings.type === 'inductive'), pnpProx[0]);
// A 1.5 kW imported servo motor → catalog servo motors of 1.5-2.25 kW, smallest first.
const sm = foreignEquivalents('MS1H2-15C30CB-A331Z');
assert.ok(sm.length && sm.every((e) => Number(e.part.ratings.ratedWatts) >= 1500 && Number(e.part.ratings.ratedWatts) <= 2250), sm.map((e) => e.part.partNumber).join());
assert.equal(foreignPart('4WE 6 E6X/EG24N9K4')?.part.partNumber, '4WE6E6X/EG24N9K4', 'Rexroth spaced type code found');
assert.deepEqual(foreignEquivalents('NOT-A-PART'), []);
console.log('foreign part matching tests passed');
