/// <reference types="node" />
/** Cost-down pass. Run with:  npx tsx src/electrical/improve/costDown.test.ts */
import assert from 'node:assert/strict';
import { applyProposal, costDownPass } from './costDown';
import { exampleCtx } from './testDesign';
import { designWarnings, type DrawingContext } from '../derive';

const base = exampleCtx();
const pn = (ctx: DrawingContext, tag: string) => ctx.design.components.find((c) => c.tag === tag)?.partNumber;

// The engine's own design is already right-sized: nothing to propose, every check listed.
{
  const r = costDownPass(base);
  assert.deepEqual(r.proposals.map((p) => p.id), [], 'engine design has nothing oversized');
  for (const t of ['CB1', 'K1', 'PS1', 'DS1', 'ENC1']) assert.ok(r.checked.some((c) => c.tag === t), `${t} checked`);
}

// Oversize parts by hand (as an imported or edited design would): each comes back with the calculation and the saving.
const fat: DrawingContext = {
  ...base,
  design: {
    ...base.design,
    components: base.design.components.map((c) => ({
      ...c,
      partNumber: ({ CB1: 'GMCBU-3C-15', K1: 'SC-E04PG-24VDC', PS1: 'PSR-24-240-3', ENC1: 'SCE-36EL3012LP', SP1: 'SCE-36P30' } as Record<string, string>)[c.tag] ?? c.partNumber,
    })),
  },
};
const r = costDownPass(fat);
const by = (tag: string) => r.proposals.find((p) => p.tag === tag);
assert.equal(by('CB1')?.to, pn(base, 'CB1'), 'motor breaker back to the engine size');
assert.match(by('CB1')!.calc.join(' '), /2 x 2\.1 A = 4\.2 A/);
assert.equal(by('CB1')?.saving, 0, 'same list price: no saving, but proposed — 15 A is above 250% of FLA');
assert.match(by('CB1')!.calc.join(' '), /NEC 430.52/);
assert.equal(by('K1')?.to, pn(base, 'K1'), 'contactor back to the 1 HP size');
assert.equal(by('K1')?.saving, 65 - 33.5);
assert.equal(by('PS1')?.to, pn(base, 'PS1'));
assert.equal(by('PS1')?.saving, 156 - 105);
assert.match(by('PS1')!.calc[0], /24 VDC load: \d+\.\d\d A/);
assert.equal(by('ENC1')?.to, pn(base, 'ENC1'), 'smallest enclosure that keeps 25% spare');
assert.ok(by('ENC1')!.swaps.some((s) => s.tag === 'SP1'), 'back panel follows the enclosure');
assert.ok(r.total > 0, 'total saving');

// Accept every line: the checks re-run on the changed design and find nothing left; no new design gaps.
let d = fat.design;
for (let round = 0; round < 4; round++) {
  const left = costDownPass({ ...fat, design: d }).proposals;
  if (!left.length) break;
  for (const p of left) d = applyProposal(d, p);
}
const after: DrawingContext = { ...fat, design: d };
assert.deepEqual(costDownPass(after).proposals, [], 'nothing left after accepting all');
for (const t of ['K1', 'PS1', 'ENC1', 'SP1']) assert.equal(pn(after, t), pn(base, t), `${t} as the engine picked it`);
assert.match(after.design.components.find((c) => c.tag === 'K1')!.function, /right-sized \(cost-down\)/);
const gaps = (c: DrawingContext) => designWarnings(c).filter((w) => /does not fit|overflow|below the motor|over capacity/i.test(w));
assert.deepEqual(gaps(after), gaps(base));

console.log(`cost-down tests passed (${r.proposals.length} proposals, ${r.checked.length} checks)`);
