/// <reference types="node" />
/** What-if compare. Run with:  npx tsx src/electrical/improve/whatIf.test.ts */
import assert from 'node:assert/strict';
import { differences, runDesign, whatIfOptions, withChange, type BaseInput } from './whatIf';
import { exampleInput } from './testDesign';
import { DEFAULT_PREFERENCE } from '../catalogs';

const base: BaseInput = { ...exampleInput(), plcId: 'click', pref: DEFAULT_PREFERENCE };
const opts = whatIfOptions(base);
const kinds = new Set(opts.map((o) => o.kind));
for (const k of ['supply', 'plc', 'brand', 'enclosure']) assert.ok(kinds.has(k as never), `options of kind ${k}`);
assert.ok(!opts.some((o) => o.id === 'supply:480VAC-3PH'), 'the current supply is not an option');
assert.ok(opts.some((o) => o.id === 'supply:240VAC-3PH'));
assert.ok(opts.some((o) => o.kind === 'plc' && o.change.plc!.plcId !== 'click'));

const now = runDesign(base, null);
assert.ok(now.facts.cost > 0 && now.facts.pieces > 0 && now.facts.heatW > 0);
assert.match(now.facts.enclosure.text, /^\d+ x \d+ x \d+ in$/);

// 480 V vs 240 V: the same 1 HP motor draws twice the current; the panel parts follow.
const v240 = runDesign(base, opts.find((o) => o.id === 'supply:240VAC-3PH')!);
assert.equal(v240.ctx.design.inputs.supply, '240VAC-3PH');
assert.ok(v240.ctx.design.inputs.motors.every((m) => m.voltage === '240VAC-3PH'), 'motors follow the supply');
assert.notDeepEqual(v240.ctx.design.components.map((c) => c.partNumber), now.ctx.design.components.map((c) => c.partNumber));

// NEMA 12 vs 4X: stainless enclosure.
const x4 = runDesign(base, opts.find((o) => o.id === 'enclosure:NEMA 4X')!);
const enc = x4.ctx.design.components.find((c) => c.tag === 'ENC1')!;
assert.match(String(base.getPart(enc.partNumber)?.ratings.material), /stainless/i);
assert.ok(differences(now.facts, x4.facts).some((t) => /Adds \$|price/.test(t) || /Enclosure/.test(t)), 'differences in plain words');

// Another PLC: the CPU changes, the CLICK CPU leaves, addresses are re-made for the new PLC.
const plcOpt = opts.find((o) => o.kind === 'plc')!;
const other = runDesign(base, plcOpt);
assert.equal(other.ctx.design.components.find((c) => c.tag === 'PLC')?.partNumber, plcOpt.change.plc!.cpuId);
assert.ok(!other.ctx.design.components.some((c) => c.partNumber === 'C0-10DD1E-D'));
assert.ok(withChange(base, plcOpt.change).addresses.size === base.io.length);

// Brand B panel parts: contactors from that brand.
const brand = opts.find((o) => o.id === 'brand:panel:siemens')!;
const sie = runDesign(base, brand);
assert.ok(sie.ctx.design.components.some((c) => c.tag === 'K1' && base.getPart(c.partNumber)?.vendor === 'siemens'), 'Siemens contactor');
assert.ok(sie.facts.unpriced >= now.facts.unpriced, 'parts without a verified price are counted, not priced');

// The base project is untouched.
assert.equal(base.inputs.supply, '480VAC-3PH');
console.log(`what-if tests passed (${opts.length} options)`);
