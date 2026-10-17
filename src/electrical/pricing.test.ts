/// <reference types="node" />
/**
 * One price source: on the example project the order list, the Sourcing page, Improve design → Compare
 * ("As it is now"), the cost-down savings and the spares all come to the same figures, to the cent —
 * with list prices only and with prices the user typed.  Run with:  npx tsx src/electrical/pricing.test.ts
 */
import assert from 'node:assert/strict';
import { DESIGN } from '../preview/sampleProject';
import { getPart } from './catalog';
import type { DrawingContext } from './derive';
import { bomCost, listPrice, piecePrice, priceLine, type BomEdits } from './pricing';
import { buildOrderList, PANEL_ORDER, SPARES_ORDER } from '../deliverables/purchasing';
import type { ProjectSnapshot } from '../deliverables/collect';
import { designFacts, usd } from './improve/facts';
import { applyProposal, costDownPass } from './improve/costDown';
import { spareParts } from './improve/spares';
import { useEditsStore } from '../edits/useEditsStore';

const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };

const ctx = (design = structuredClone(DESIGN)): DrawingContext => ({
  projectName: 'example', design, getPart, hmiPartNumber: 'CM5-T7W',
  plc: { vendor: 'AutomationDirect', name: 'CLICK', cpuPartNumber: 'C0-10DD1E-D', cpuLabel: '' },
  io: DESIGN.ioWiring.map((w) => ({ address: w.address, description: w.description, type: w.address.startsWith('X') ? 'input' : 'output' })),
});
const snap = (c: DrawingContext) => ({ drawingCtx: c, hmi: null }) as unknown as ProjectSnapshot;

function agree(edits: BomEdits, what: string) {
  useEditsStore.setState({ bom: edits });
  const c = ctx();
  const order = buildOrderList(snap(c), { ...PANEL_ORDER, labels: false, edits });
  const sourcing = bomCost(c, edits); // the Sourcing page total
  const compare = designFacts(c, edits); // Improve design → Compare, "As it is now"
  assert.equal(order.total, order.parts.total, `${what}: no label supplies in this order`);
  assert.equal(sourcing.total, order.parts.total, `${what}: Sourcing ${usd(sourcing.total)} = order list ${usd(order.parts.total)}`);
  assert.equal(sourcing.unpriced, order.parts.unpriced, `${what}: same lines to confirm`);
  assert.equal(compare.cost, order.parts.total, `${what}: Compare ${usd(compare.cost)} = order list`);
  assert.equal(compare.unpriced, order.parts.unpriced);
  // Spares: the Improve design list and the spares order.
  const sp = spareParts(c);
  const spOrder = buildOrderList(snap(c), { ...SPARES_ORDER, edits });
  assert.equal(sp.total, spOrder.total, `${what}: spares ${usd(sp.total)} = spares order ${usd(spOrder.total)}`);
  return { c, order, total: sourcing.total };
}

// The enclosure and its back panel are priced (the sourcing records), as on the Sourcing page.
assert.equal(listPrice('SCE-30EL2410LP')?.price, 472);
assert.equal(listPrice('SCE-30P24')?.price, 103);
// Packs: ordered in whole packs, a piece is the pack price / pack size.
assert.equal(priceLine('DN-T10-A', 30, {}).orderQty, 1);
assert.equal(piecePrice('DN-T10-A', {}), 0.87);

const a = agree({}, 'list prices');
console.log(`example: ${usd(a.total)} + ${a.order.parts.unpriced} to confirm`);

// A price the user typed counts everywhere, and fills a line that had none.
const unpriced = bomCost(a.c, {}).lines.find((l) => l.extended === undefined);
const edits: BomEdits = { 'SCE-30EL2410LP': { price: 400 }, ...(unpriced ? { [unpriced.generatedPartNumber]: { price: 10 } } : {}) };
const b = agree(edits, 'typed prices');
assert.equal(b.total, +(a.total - 72 + (unpriced ? 10 * unpriced.orderQty : 0)).toFixed(2), 'typed prices in the total');

// Cost-down: the saving shown is the order-list difference after accepting it.
useEditsStore.setState({ bom: {} });
const fat = ctx({ ...structuredClone(DESIGN), components: DESIGN.components.map((x) => (x.tag === 'PS1' ? { ...x, partNumber: 'PSR-24-240-3' } : x)) });
const p = costDownPass(fat).proposals.find((x) => x.tag === 'PS1')!;
const before = buildOrderList(snap(fat), { ...PANEL_ORDER, labels: false, edits: {} }).total;
const after = buildOrderList(snap({ ...fat, design: applyProposal(fat.design, p) }), { ...PANEL_ORDER, labels: false, edits: {} }).total;
assert.equal(p.saving, +(before - after).toFixed(2), `cost-down saving ${p.saving} = order list ${before} → ${after}`);

console.log('pricing tests passed: order list, Sourcing, Compare, cost-down and spares agree');
