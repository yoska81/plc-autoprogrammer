/// <reference types="node" />
/**
 * Operator accessories (E-stop contact blocks, legend plates) come from the operator's own maker: an AutomationDirect
 * block never goes on a Siemens 3SU1. None of that maker in the catalog = a note, not another brand.
 * Run with:  npx tsx src/electrical/engine/operatorAccessories.test.ts
 */
import assert from 'node:assert/strict';
import { generateDefaultDesign } from './index';
import { exampleInput } from '../improve/testDesign';
import { getPart } from '../catalog';
import { normalizePreference } from '../catalogs';

const accessoriesOf = (d: ReturnType<typeof generateDefaultDesign>['design']) => d.components
  .filter((c) => /^ES\d+$/.test(c.tag))
  .map((es) => ({ es, parts: d.components.filter((c) => new RegExp(`^${es.tag}[CDL]$`).test(c.tag)) }));

// Default brand: the AutomationDirect E-stop keeps its own NC block and legend.
const ad = generateDefaultDesign(exampleInput('480VAC-3PH')).design;
const adAcc = accessoriesOf(ad);
assert.ok(adAcc.length > 0);
for (const { es, parts } of adAcc) {
  assert.ok(parts.some((p) => p.partNumber === 'ECX1030-2'), `${es.tag}: ECX1030-2 NC block`);
  assert.ok(parts.some((p) => p.partNumber === 'ECX1651'), `${es.tag}: ECX1651 legend`);
}

// Siemens panel parts: every accessory is Siemens, or there is a note instead.
const siemens = generateDefaultDesign({ ...exampleInput('480VAC-3PH'), pref: normalizePreference({ panel: ['siemens'] }) }).design;
const sAcc = accessoriesOf(siemens);
assert.ok(sAcc.length > 0);
for (const { es, parts } of sAcc) {
  const op = getPart(es.partNumber)!;
  assert.equal(op.vendor, 'siemens', `${es.tag} is a Siemens E-stop (${es.partNumber})`);
  for (const a of parts) assert.equal(getPart(a.partNumber)?.vendor, op.vendor, `${a.tag} ${a.partNumber}: same maker as ${es.partNumber}`);
  const hasNc = parts.some((p) => /C$/.test(p.tag)), hasLegend = parts.some((p) => /L$/.test(p.tag));
  if (!hasNc) assert.ok(siemens.notes.some((n) => n.includes(op.partNumber) && /N\.C\. contact block/.test(n)), 'no Siemens NC block: a note');
  if (!hasLegend) assert.ok(siemens.notes.some((n) => n.includes(op.partNumber) && /legend plate/.test(n)), 'no Siemens legend: a note');
}
console.log(`operator accessory tests passed (Siemens: ${sAcc[0].parts.map((p) => p.partNumber).join(', ') || 'notes only'})`);
