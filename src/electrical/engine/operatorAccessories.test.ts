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
import { getCpu, getProfile } from '../../plc/core/profiles';
import { resolveAddresses } from '../../plc/core/profile';
import { moduleSlots } from '../../plc/core/modules';

const accessoriesOf = (d: ReturnType<typeof generateDefaultDesign>['design']) => d.components
  .filter((c) => /^ES\d+$/.test(c.tag))
  .map((es) => ({ es, parts: d.components.filter((c) => new RegExp(`^${es.tag}[CDL]$`).test(c.tag)) }));

// Default brand: the AutomationDirect E-stop keeps its own NC block and legend.
const ad = generateDefaultDesign(exampleInput('480VAC-3PH')).design;
const adAcc = accessoriesOf(ad);
assert.ok(adAcc.length > 0);
for (const { es, parts } of adAcc) {
  // exactly as before the change: ES#C (and ES#D) ECX1030-2, ES#L ECX1651
  assert.equal(parts.find((p) => p.tag === `${es.tag}C`)?.partNumber, 'ECX1030-2', `${es.tag}C`);
  assert.equal(parts.find((p) => p.tag === `${es.tag}L`)?.partNumber, 'ECX1651', `${es.tag}L`);
  for (const p of parts.filter((x) => x.tag === `${es.tag}D`)) assert.equal(p.partNumber, 'ECX1030-2', `${es.tag}D`);
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
// the stack light too: the Siemens 8WD44 kit (bracket mount), not another brand's direct-mount light
const withStack = (pref?: Parameters<typeof normalizePreference>[0]) => {
  const base = exampleInput('480VAC-3PH');
  const io = [...base.io, ...['Stack light red', 'Stack light green', 'Stack light buzzer'].map((description, i) => ({ id: `stk${i}`, category: 'Operator/HMI', description, type: 'output' as const, deviceType: 'stack-light' as const }))] as typeof base.io;
  const profile = getProfile('click');
  const input = { ...base, io, addresses: resolveAddresses(profile, getCpu(profile, base.plc.cpuPartNumber), io, moduleSlots([])) };
  return generateDefaultDesign(pref ? { ...input, pref: normalizePreference(pref) } : input).design;
};
const stk = (d: typeof siemens) => d.components.filter((c) => getPart(c.partNumber)?.category === 'stackLight');
const sStk = stk(withStack({ panel: ['siemens'] })), aStk = stk(withStack());
assert.ok(sStk.length === 1 && getPart(sStk[0].partNumber)?.vendor === 'siemens' && /yes/.test(String(getPart(sStk[0].partNumber)?.ratings.buzzer)), `Siemens panel: the Siemens kit with a buzzer (${sStk.map((c) => c.partNumber).join(', ')})`);
assert.ok(aStk.length === 1 && (getPart(aStk[0].partNumber)?.vendor ?? 'automationdirect') !== 'siemens', `default brand: not Siemens (${aStk.map((c) => c.partNumber).join(', ')})`);
console.log(`operator accessory tests passed (Siemens: ${sAcc[0].parts.map((p) => p.partNumber).join(', ') || 'notes only'})`);
