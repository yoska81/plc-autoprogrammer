/// <reference types="node" />
/**
 * Enclosure wall machining: a gland / cord grip for every cable leaving the cabinet (sized from the
 * estimated cable OD), filter fan + outlet filter when the heat calculation needs ventilation, the
 * stack light on the top and the air inlet of a pneumatic panel; sizes not in the catalog are
 * template marks (not cut).
 * Run with:  npx tsx src/electrical/enclosureFaces.test.ts
 */
import assert from 'node:assert/strict';
import { DESIGN } from '../preview/sampleProject';
import { getPart } from './catalog';
import { buildModel, type DrawingContext } from './derive';
import { drillingDxf } from './dxf';
import { cableEntries, enclosureFaceDrilling, estimateCableOd } from './enclosureFaces';
import { cabinetHeat } from './thermal';
import type { CatalogPart, ElectricalDesign } from './types';

const ctxOf = (design: ElectricalDesign, region?: DrawingContext['region'], gp: DrawingContext['getPart'] = getPart): DrawingContext => ({
  projectName: 'test', design, getPart: gp, region,
  plc: { vendor: 'AutomationDirect', name: 'CLICK', cpuPartNumber: 'C0-10DD1E-D', cpuLabel: '' },
  io: design.ioWiring.map((w) => ({ address: w.address, description: w.description, type: w.address.startsWith('X') ? 'input' : 'output' })),
});
const add = (...cs: ElectricalDesign['components']): ElectricalDesign => ({ ...DESIGN, components: [...DESIGN.components, ...cs] });

// Cable OD estimates are in the range of real cables (25 x 18 AWG control ~15 mm, 4 x 14 AWG ~10-11 mm).
assert.ok(Math.abs(estimateCableOd(25, '18 AWG', false) - 15.5) < 1.5, `25c 18 AWG: ${estimateCableOd(25, '18 AWG', false)}`);
assert.ok(Math.abs(estimateCableOd(4, '14 AWG', false) - 10.5) < 1.5, `4c 14 AWG: ${estimateCableOd(4, '14 AWG', false)}`);
assert.ok(estimateCableOd(4, '14 AWG', true) > estimateCableOd(4, '14 AWG', false), 'shield adds to the OD');

// The sample: every field cable leaving the cabinet plus the supply gets a cord grip on the bottom; nothing else.
{
  const ctx = ctxOf(DESIGN);
  const jbs = new Set(buildModel(ctx).machine.jbs.map((j) => j.tag));
  const leaving = buildModel(ctx).machine.cables.filter((c) => !jbs.has(c.from)).map((c) => c.tag);
  const faces = enclosureFaceDrilling(ctx);
  assert.deepEqual(faces.map((f) => f.kind), ['bottom'], 'only the bottom has cutouts (natural cooling, no stack light)');
  const bottom = faces[0];
  assert.deepEqual(bottom.cutouts.map((c) => c.tag).sort(), [...leaving, 'SUPPLY'].sort(), 'one entry per cable + supply');
  assert.ok(bottom.cutouts.every((c) => c.code === 'H' && !c.template && [22.2, 28.2, 34.9, 44, 50.4, 62.7].includes(c.w)), 'NPT knockout sizes (US)');
  assert.ok(bottom.cutouts.every((c) => c.x - c.w / 2 >= 40 && c.x + c.w / 2 <= bottom.w - 40 && c.y >= 60 && c.y <= bottom.h - 40), 'clear of the side walls, door return and back wall');
  const supply = bottom.cutouts.find((c) => c.tag === 'SUPPLY')!;
  assert.ok(bottom.cutouts.every((c) => c.x <= supply.x), 'supply at the disconnect (right) side');
  assert.equal(bottom.w, 609.6, 'bottom = enclosure width x depth (24 x 10 in)');
  assert.equal(bottom.h, 254);
}

// IEC: metric gland holes.
{
  const entries = cableEntries(ctxOf(DESIGN, 'EU'));
  assert.ok(entries.every((e) => e.gland && /^M\d+$/.test(e.gland.size)), 'metric glands in IEC regions');
}

// Hot cabinet: filter fan low on the left, outlet filter high on the right, sized from the heat calculation; stack light on top.
{
  const design = add({ tag: 'VFD9', partNumber: 'GS23-43P0', quantity: 8, function: 'heat test', motorTag: null }, { tag: 'STK1', partNumber: 'LR4-302WJNW-RYG', quantity: 1, function: 'Stack light', motorTag: null });
  const ctx = ctxOf(design);
  const heat = cabinetHeat(design.components, getPart);
  assert.ok(heat.ventilation && heat.ventilation.airflowM3h > 0, 'needs ventilation');
  const faces = enclosureFaceDrilling(ctx);
  const left = faces.find((f) => f.kind === 'left')!, right = faces.find((f) => f.kind === 'right')!, top = faces.find((f) => f.kind === 'top');
  assert.ok(left && right, 'fan and outlet filter walls');
  const fan = left.cutouts[0], out = right.cutouts[0];
  assert.ok(fan.code === 'J' && fan.template && out.template, 'fan cutouts are templates (size per the chosen fan)');
  assert.ok(fan.y < left.h / 2 && out.y > right.h / 2, 'inlet low, outlet high');
  assert.ok(left.notes.some((n) => n.includes(`${Math.ceil(heat.ventilation!.airflowM3h)} m³/h`)), 'air flow stated');
  assert.ok(top?.cutouts.some((c) => c.tag === 'STK1' && c.code === 'K' && c.template && c.w === 40), 'stack light base on the top (Ø from the catalog)');
  // template features are never cut: only outline + gland holes on the cut layers
  const dxf = drillingDxf(left, 'test', { units: 'mm', cutOnly: true });
  assert.ok(!/(^|\n)8\r?\nCUTOUTS\r?\n/.test(dxf) && /(^|\n)8\r?\nOUTLINE\r?\n/.test(dxf), 'fan cutout: no entity on the CUTOUTS layer');
}

// Pneumatic panel (valves inside the cabinet): air inlet on the bottom with the valve's port size.
{
  const valve = getPart('100222015324006');
  const gp = (pn: string): CatalogPart | undefined => (pn === valve?.partNumber ? { ...valve, mount: 'backplate' } : getPart(pn));
  const ctx = ctxOf(add({ tag: 'YV1', partNumber: valve!.partNumber, quantity: 1, function: 'valve in the panel', motorTag: null }), undefined, gp);
  const air = enclosureFaceDrilling(ctx).find((f) => f.kind === 'bottom')!.cutouts.find((c) => c.code === 'L');
  assert.ok(air && air.template?.includes('1/4" NPT'), `air inlet with the valve port size: ${air?.template}`);
}

console.log('enclosureFaces: OK');
