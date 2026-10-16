/// <reference types="node" />
/**
 * A design built from another vendor's panel parts goes through every
 * derivation (BOM, wiring, terminals, layout, drilling, warnings, code rules)
 * and purchasing groups it by that vendor. Run with:
 *   npx tsx src/electrical/catalogs/multiVendor.test.ts
 */
import assert from 'node:assert/strict';
import { DESIGN } from '../../preview/sampleProject';
import { getPart } from '../catalog';
import { VENDORS, supplierOfPart } from './index';
import {
  backPanelDrilling, billOfMaterials, cableSchedule, designWarnings, doorDrilling, panelLayout, spareSpace, terminalPlan, wireNumbers,
  type DrawingContext,
} from '../derive';
import { makeEnv, runCodeRules } from '../../review/codeRules/rules';
import type { ElectricalDesign } from '../types';

/** Same machine as the sample project, panel parts swapped per vendor (tag -> part number; null drops the tag). */
const SWAPS: Record<string, Record<string, string | null>> = {
  'allen-bradley': {
    CB1: '1489-M3C100', CB2: '1489-M2C100', PS1: '1606-XLE120E', K1: '100-C09EJ10', OL1: '193-1EECB', 'K1-AUX': null,
    SR1: '440R-S12R2', ES1: '800FP-MT44PX02', ES1C: null, PB1: '800FP-F3PX10', PB2: '800FP-F4PX01', PB3: '800FP-F2PX10',
    TB1: '1492-J4', TBG: '1492-JG4', TBE: '1492-EBJ3',
  },
  siemens: {
    // No 3RU2 range contains this motor's 2.1 A FLA (1.4–2 / 2.8–4 A): the code rules must say so.
    CB1: '5SJ4316-7HG42', CB2: '5SJ4316-7HG42', PS1: '6EP3333-7SB00-0AX0', K1: '3RT2016-1BB41', OL1: '3RU2116-1BB0', 'K1-AUX': null,
    SR1: '3SK1111-1AB30', ES1: '3SU1150-1HB20-1CG0', ES1C: null, PB1: '3SU1100-0AB40-1BA0', PB2: '3SU1100-0AB20-1CA0', PB3: '3SU1100-0AB40-1BA0',
    TB1: '8WH1000-0AF00', TBG: '8WH1000-0CF07', TBE: '8WH9000-1PA00',
  },
  schneider: {
    CB1: 'M9F42310', CB2: 'M9F42210', PS1: 'ABLS1A24050', K1: 'LC1D09BD', OL1: 'LRD07', 'K1-AUX': null,
    SR1: 'XPSUAF13AP', ES1: 'XB5AS8444', ES1C: null, PB1: 'XB5AA31', PB2: 'XB5AA42', PB3: 'XB5AA31',
    TB1: 'NSYTRV22', TBG: 'NSYTRV22PE', TBE: 'NSYTRAC22',
  },
};
/** Vendors whose test overload deliberately does not fit the motor. */
const OVERLOAD_MISFIT = new Set(['siemens']);

for (const [vendor, swaps] of Object.entries(SWAPS)) {
  const v = VENDORS.find((x) => x.id === vendor);
  if (!v) continue;
  for (const pn of Object.values(swaps)) if (pn) assert.ok(getPart(pn)?.vendor === vendor, `${vendor}: ${pn} is in its catalog`);
  const design: ElectricalDesign = {
    ...DESIGN,
    components: DESIGN.components.filter((c) => swaps[c.tag] !== null).map((c) => (swaps[c.tag] ? { ...c, partNumber: swaps[c.tag]! } : c)),
  };
  const ctx: DrawingContext = {
    projectName: 'test', design, getPart, region: 'US',
    plc: { vendor: 'AutomationDirect', name: 'CLICK', cpuPartNumber: 'C0-10DD1E-D', cpuLabel: '' },
    io: design.ioWiring.map((w) => ({ address: w.address, description: w.description, type: w.address.startsWith('X') ? 'input' : 'output' })),
  };
  const bom = billOfMaterials(ctx).flatMap((g) => g.lines);
  const own = bom.filter((l) => getPart(l.partNumber)?.vendor === vendor);
  assert.ok(own.length >= Object.values(swaps).filter(Boolean).length - 3, `${vendor}: BOM holds its parts (${own.length})`);
  assert.ok(own.every((l) => l.manufacturer === getPart(l.partNumber)!.manufacturer), `${vendor}: BOM manufacturer`);
  assert.ok(wireNumbers(ctx).length > 0, `${vendor}: wires`);
  assert.ok(terminalPlan(ctx).length > 0, `${vendor}: terminals`);
  const lay = panelLayout(ctx);
  assert.ok(lay, `${vendor}: layout`);
  backPanelDrilling(ctx); doorDrilling(ctx); spareSpace(ctx); cableSchedule(ctx);
  const warnings = designWarnings(ctx);
  const hits = runCodeRules({ ctx, spec: undefined as never }, makeEnv(ctx));
  assert.equal(supplierOfPart(getPart(swaps.K1!)), v.supplier);
  assert.equal(hits.some((h) => h.rule === 'motor-overload'), OVERLOAD_MISFIT.has(vendor), `${vendor}: overload range check`);
  console.log(`  ${v.name}: ${own.length} BOM lines from ${v.name}, ${warnings.length} design warnings, ${hits.length} code-rule hits`);
  for (const w of warnings) console.log(`    warning: ${w}`);
  for (const h of hits) console.log(`    rule ${h.rule}: ${h.detail}`);
}
console.log('multi-vendor design tests passed');
