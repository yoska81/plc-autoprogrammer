/// <reference types="node" />
/**
 * Back-panel layout with real footprints: the sample fits its enclosure, a too-small enclosure is
 * flagged with the smallest catalog enclosure that holds the parts with the spare-space rule, and a
 * tall part (the UL98 disconnect) goes into its own column instead of dropping parts off the panel.
 * Run with:  npx tsx src/electrical/enclosureFit.test.ts
 */
import assert from 'node:assert/strict';
import { DESIGN } from '../preview/sampleProject';
import { getPart } from './catalog';
import { designWarnings, panelLayout, smallestEnclosure, spareSpace, SPARE_RULE, type DrawingContext } from './derive';
import type { ElectricalDesign } from './types';

const ctxOf = (design: ElectricalDesign): DrawingContext => ({
  projectName: 'test', design, getPart,
  plc: { vendor: 'AutomationDirect', name: 'CLICK', cpuPartNumber: 'C0-10DD1E-D', cpuLabel: '' },
  io: design.ioWiring.map((w) => ({ address: w.address, description: w.description, type: w.address.startsWith('X') ? 'input' : 'output' })),
});
const withEnclosure = (enc: string, sub: string): ElectricalDesign => ({
  ...DESIGN,
  components: DESIGN.components.map((c) => (c.tag === 'ENC1' ? { ...c, partNumber: enc } : c.tag === 'SP1' ? { ...c, partNumber: sub } : c)),
});

// The sample fits its 30x24 enclosure with the spare-space rule, and nothing asks for a bigger one.
{
  const ctx = ctxOf(DESIGN);
  const L = panelLayout(ctx);
  assert.deepEqual(L.notFit.map((n) => n.tag), [], 'every back-panel part placed');
  assert.ok(spareSpace(ctx).panel >= SPARE_RULE, `spare ${spareSpace(ctx).panel}`);
  assert.equal(smallestEnclosure(ctx)?.enclosure, 'SCE-30EL2410LP', 'the sample enclosure is already the smallest that fits');
  assert.ok(!designWarnings(ctx).some((w) => /too small/.test(w)), 'no enclosure warning');
}

// The old 24x20 cannot hold the parts: the layout still places what it can, and the warning names the 30x24.
{
  const ctx = ctxOf(withEnclosure('SCE-24EL2008LP', 'SCE-24P20'));
  const fit = smallestEnclosure(ctx);
  assert.equal(fit?.enclosure, 'SCE-30EL2410LP');
  assert.equal(fit?.subpanel, 'SCE-30P24');
  assert.ok(fit!.spare >= SPARE_RULE);
  assert.ok(designWarnings(ctx).some((w) => /ENC1 .* too small .*SCE-30EL2410LP/.test(w)), 'too-small warning names the bigger enclosure');
}

// The tall disconnect never overlaps the parts packed beside it.
{
  const L = panelLayout(ctxOf(withEnclosure('SCE-24EL2008LP', 'SCE-24P20')));
  const parts = L.items.filter((i) => i.category !== 'groundBar');
  for (let a = 0; a < parts.length; a++) for (let b = a + 1; b < parts.length; b++) {
    const p = parts[a], q = parts[b];
    const overlap = p.x < q.x + q.w - 0.5 && q.x < p.x + p.w - 0.5 && p.y < q.y + q.h - 0.5 && q.y < p.y + p.h - 0.5;
    assert.ok(!overlap, `${p.label} overlaps ${q.label}`);
  }
}

console.log('enclosureFit: OK');
