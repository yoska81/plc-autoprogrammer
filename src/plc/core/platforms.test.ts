/// <reference types="node" />
/**
 * PLC platforms of the multi-vendor catalogs. Run with:
 *   npx tsx src/plc/core/platforms.test.ts
 */
import assert from 'node:assert/strict';
import { getPart } from '../../electrical/catalog';
import { PLATFORMS, hmiCompatible, moduleLimits, platformById, platformCapacity, platformFit, platformOfCpu, protocolsOf, suggestModules } from './platforms';
import type { Need } from './fit';

const need = (n: Partial<Need> = {}): Need => ({ digitalInputs: 0, digitalOutputs: 0, analogInputs: 0, analogOutputs: 0, ethernetHmi: false, minHmiSizeIn: null, ...n });

// Every part number is a catalog part of the right kind and brand.
const ids = new Set<string>();
for (const p of PLATFORMS) {
  assert.ok(!ids.has(p.id), `duplicate platform ${p.id}`);
  ids.add(p.id);
  assert.ok(p.cpus.length > 0 && p.protocols.length > 0 && p.notes.trim(), p.id);
  for (const c of p.cpus) {
    const part = getPart(c);
    assert.equal(part?.category, 'plc', `${p.id}: ${c} is a catalog CPU`);
    assert.equal(part?.vendor, p.vendor, `${p.id}: ${c} vendor`);
    assert.equal(platformOfCpu(c)?.id, p.id, `${c} belongs to one platform`);
  }
  for (const m of p.modules) {
    const part = getPart(m);
    assert.equal(part?.category, 'plcModule', `${p.id}: ${m} is a catalog module`);
    assert.equal(part?.vendor, p.vendor, `${p.id}: ${m} vendor`);
  }
  // Every CPU fits an empty machine with built-in I/O (S7-1500 has none and needs modules for any I/O).
  for (const c of p.cpus) assert.ok(platformFit(p, c, [], need()).ok, `${c} fits an empty machine`);
}

// Capacity = CPU built-in + modules (catalog ratings)
const m850 = platformById('ab-micro850')!;
const cap = platformCapacity(getPart('2080-L50E-24QBB')!, ['2085-IQ16', '2085-OB16']);
assert.deepEqual([cap.inputs, cap.outputs], [14 + 16, 10 + 16]);
assert.ok(platformFit(m850, '2080-L50E-24QBB', ['2085-IQ16'], need({ digitalInputs: 30, digitalOutputs: 10 })).ok);
assert.match(platformFit(m850, '2080-L50E-24QBB', [], need({ digitalInputs: 30 })).reason ?? '', /Only 14 inputs; 30 needed/);
assert.match(platformFit(m850, '2080-L50E-24QBB', [], need({ analogInputs: 2 })).reason ?? '', /analog inputs/);
assert.ok(platformFit(m850, '2080-L50E-24QBB', ['2085-IF4'], need({ analogInputs: 2 })).ok);
// Modules of another family, CPUs of another platform, and the module limit are refused.
assert.match(platformFit(m850, '2080-L50E-24QBB', ['5069-IB16'], need()).reason ?? '', /does not fit the Allen-Bradley Micro850/);
assert.match(platformFit(m850, '5069-L306ER', [], need()).reason ?? '', /not a Allen-Bradley Micro850 CPU/);
const m820 = platformById('ab-micro820')!;
assert.deepEqual(moduleLimits(m820, getPart('2080-L20E-20QBB')!), { expansion: 0, plugIn: 2 });
assert.match(platformFit(m820, '2080-L20E-20QBB', ['2080-IF4', '2080-OF2', '2080-OB4'], need()).reason ?? '', /Has 2 plug-in slots; 3 plug-in modules/);
assert.deepEqual(moduleLimits(m850, getPart('2080-L50E-24QBB')!), { expansion: 4, plugIn: 3 });
assert.ok(platformFit(m850, '2080-L50E-24QBB', ['2085-IQ16', '2085-IQ16', '2085-OB16', '2085-OB16', '2080-OB4', '2080-OB4', '2080-OB4'], need()).ok, '4 expansion + 3 plug-ins');
assert.match(platformFit(m850, '2080-L50E-24QBB', ['2085-IQ16', '2085-IQ16', '2085-OB16', '2085-OB16', '2085-IF4'], need()).reason ?? '', /at most 4 expansion modules; 5/);
assert.equal(moduleLimits(platformById('ab-compactlogix-5380')!, getPart('5069-L320ER')!).expansion, 16);
assert.equal(moduleLimits(platformById('schneider-m221')!, getPart('TM221CE24T')!).expansion, 7);
assert.equal(moduleLimits(platformById('siemens-s7-1200')!, getPart('6ES7212-1AE40-0XB0')!).expansion, 2);

// HMI ↔ PLC: same brand, or a shared Ethernet protocol stated for the panel.
const ok = (platform: string, hmi: string) => hmiCompatible(platformById(platform)!, getPart(hmi)!).ok;
assert.deepEqual(protocolsOf(getPart('2713P-T7WD1')!), ['EtherNet/IP']);
assert.ok(ok('ab-micro850', '2713P-T7WD1'), 'PanelView 5310 with Micro850');
assert.ok(ok('ab-micro850', '2711R-T7T'), 'PanelView 800 (protocol not stated) with its own brand');
assert.ok(!ok('ab-micro850', '6AV2123-2GB03-0AX0'), 'KTP700 (PROFINET) not with Micro850');
assert.ok(ok('siemens-s7-1200', '6AV2123-2GB03-0AX0'), 'KTP700 with S7-1200');
assert.ok(!ok('siemens-s7-1200', '2713P-T7WD1'), 'PanelView not with S7-1200');
assert.ok(ok('schneider-m221', 'HMIST6400'), 'Harmony ST6 with M221 (same brand)');
assert.ok(ok('schneider-m241', 'HMIG3U'), 'GTU (Modbus TCP) with M241');
assert.ok(!ok('siemens-s7-1500', 'HMIG3U'), 'GTU (Modbus TCP) not with S7-1500 (PROFINET)');
assert.match(hmiCompatible(platformById('ab-micro850')!, getPart('HMIST6400')!).reason ?? '', /Not confirmed to talk to/);

console.log(`platform tests passed (${PLATFORMS.length} platforms)`);

// Module suggestion: covers the I/O with the fewest modules, within the limit.
assert.deepEqual(suggestModules(m850, '2080-L50E-24QBB', need({ digitalInputs: 30, digitalOutputs: 12, analogInputs: 2 })), ['2085-IQ16', '2085-OB16', '2085-IF4']);
assert.deepEqual(suggestModules(m850, '2080-L50E-48QBB', need({ digitalInputs: 20 })), []);
assert.deepEqual(suggestModules(m820, '2080-L20E-20QBB', need({ digitalOutputs: 40 })), ['2080-OB4', '2080-OB4']);
const s1500 = platformById('siemens-s7-1500')!;
const mods = suggestModules(s1500, '6ES7511-1AL03-0AB0', need({ digitalInputs: 20, digitalOutputs: 8 }));
assert.deepEqual(mods, ['6ES7131-6BH01-0BA0', '6ES7131-6BH01-0BA0', '6ES7132-6BH01-0BA0']);
assert.ok(platformFit(s1500, '6ES7511-1AL03-0AB0', mods, need({ digitalInputs: 20, digitalOutputs: 8 })).ok);
console.log('module suggestion tests passed');
