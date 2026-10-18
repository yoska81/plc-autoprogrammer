/// <reference types="node" />
/**
 * PLC platforms of the multi-vendor catalogs. Run with:
 *   npx tsx src/plc/core/platforms.test.ts
 */
import assert from 'node:assert/strict';
import { getPart } from '../../electrical/catalog';
import { PLATFORMS, hmiCompatible, moduleLimits, platformById, platformCapacity, platformFit, platformOfCpu, protocolsOf, suggestModules, driversOf } from './platforms';
import { cpuFit, hmiFit, modulesToFit, platformOf, type Need } from './fit';
import { PLC_PROFILES } from './profiles';
import { LOGIX_CPUS } from './profiles/logix';
import { HMI_MODELS } from '../../hmi/hmiCatalog';
import { CATALOG } from '../../electrical/catalog';

const ALL_HMIS = () => CATALOG.filter((p) => p.category === 'hmi' || (p.category === 'plc' && p.ratings.builtInPanel === 'yes'));

const need = (n: Partial<Need> = {}): Need => ({ digitalInputs: 0, digitalOutputs: 0, analogInputs: 0, analogOutputs: 0, ethernetHmi: false, minHmiSizeIn: null, ...n });

// Every part number is a catalog part of the right kind and brand.
const ids = new Set<string>();
for (const p of PLATFORMS) {
  assert.ok(!ids.has(p.id), `duplicate platform ${p.id}`);
  ids.add(p.id);
  // protocols may be empty (e.g. Omron CP1E: Ethernet only with an option board — said in the notes).
  assert.ok(p.cpus.length > 0 && p.notes.trim(), p.id);
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
// Rockwell 2713P-TD001: PanelView 5310 (View Designer) talks to Logix 5000 controllers only; Micro800 uses the PanelView 800.
assert.ok(!ok('ab-micro850', '2713P-T7WD1') && ok('ab-compactlogix-5380', '2713P-T7WD1'), 'PanelView 5310 with CompactLogix, not Micro850');
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

// Profiles with a platformId (multi-vendor profiles) use the platform fit; CLICK keeps its own.
for (const p of PLC_PROFILES) {
  for (const c of p.cpuModels) {
    const pid = (c as { platformId?: string }).platformId ?? (p as { platformId?: string }).platformId;
    if (!pid) { assert.equal(platformOf(c.id), undefined, `${c.id}: CLICK-style fit`); continue; }
    const pl = platformById(pid);
    assert.ok(pl, `${p.id}: platform ${pid} exists`);
    assert.ok(pl!.cpus.includes(c.id), `${p.id}: cpu ${c.id} is a ${pid} CPU (catalog part number)`);
    const n = need({ digitalInputs: 20, digitalOutputs: 10 });
    assert.deepEqual(cpuFit(c, [], n), platformFit(pl!, c.id, [], n), `${c.id}: cpuFit = platformFit`);
    assert.ok(!hmiFit(HMI_MODELS[0], n, c.id).ok, `${c.id}: C-more not offered for ${pid}`);
  }
}
console.log('profile platform wiring tests passed');

// Third-party panels: compatible only where their maker's driver list names the PLC family.
assert.ok(driversOf(getPart('cMT2078X')!).includes('ab-micro850'), 'Weintek driver list names Micro850');
assert.ok(ok('ab-micro850', 'cMT2078X') && ok('siemens-s7-1200', 'cMT2078X') && ok('omron-nx1p2', 'cMT2078X'), 'Weintek cMT X talks to AB, Siemens, Omron NX1P2');
assert.ok(!ok('siemens-s7-1200-g2', 'MT8072iP'), 'Weintek iP: no S7-1200 G2 driver');
assert.ok(!ok('omron-nx1p2', 'G07C0000') && ok('ab-compactlogix-5380', 'G07C0000'), 'Red Lion: Logix yes, NX1P2 not listed');
// CompactLogix 5370 (an L5X upgrade that keeps its 1769-L33ER): the makers' driver lists name it, so a panel can be chosen.
{
  const l33 = platformById(LOGIX_CPUS.find((c) => c.id === '1769-L33ER')!.platformId!)!;
  const fits = ALL_HMIS().filter((p) => hmiCompatible(l33, p).ok);
  assert.ok(fits.some((p) => p.vendor === 'allen-bradley') && fits.length >= 10, `1769-L33ER panels: ${fits.length}`);
  assert.ok(ok('ab-compactlogix-5370', '2713P-T7WD1') && ok('ab-compactlogix-5370-l1', '2711R-T7T'), 'PanelView 5310 with an L33ER, PanelView 800 with an L1');
  for (const p of fits.filter((x) => driversOf(x).includes('ab-compactlogix-5370'))) assert.ok(p.ratings.drivers5370Source, `${p.partNumber}: 5370 driver source`);
  assert.ok(ok('ab-compactlogix-5370-l1', 'cMT2078X') && ok('ab-compactlogix-5370-l1', 'G07C0000'), 'L1 on Weintek and Red Lion panels too');
  // CompactLogix speaks EtherNet/IP only: never on a serial-only panel (Pro-face GP4100 series).
  const LOGIX = ['ab-compactlogix-5380', 'ab-compactlogix-5370', 'ab-compactlogix-5370-l1'];
  for (const p of ALL_HMIS()) {
    const d = driversOf(p).filter((id) => LOGIX.includes(id));
    if (d.length) assert.ok(Number(p.ratings.ethernetPorts) > 0, `${p.partNumber}: Logix driver on a panel with no Ethernet port`);
    // 5370 and 5380 come from the same maker statements: the two sets stay in step.
    assert.ok(d.length === 0 || d.length === 3, `${p.partNumber}: Logix driver ids out of step (${d.join(', ')})`);
  }
  assert.ok(!ok('ab-compactlogix-5370', 'PFXGP4115T2D'), 'serial-only GP4100: no CompactLogix');
  // PanelView Plus 7 (FactoryTalk View ME): CompactLogix 5370 per 2711P-TD008J / TD009M, 5380 per 2711P-SP011L.
  for (const pn of ['2711P-T7C22D8S', '2711P-T10C22D9P']) assert.ok(ok('ab-compactlogix-5370', pn) && ok('ab-compactlogix-5380', pn) && !ok('ab-micro850', pn), `${pn}: Logix, not Micro800`);
  // PanelView 5310 / 5510 need Logix firmware V27 or later (Rockwell 2713P-TD001K / 2715P-TD001G).
  for (const p of ALL_HMIS().filter((x) => /^271[35]P-/.test(x.partNumber))) assert.equal(p.ratings.logixFirmwareMin, 27, `${p.partNumber}: firmware V27+`);
}
// Driver ids are platform ids (agreed list; every platform that exists must be on it).
const DRIVER_IDS = new Set(['click', 'ab-micro820', 'ab-micro850', 'ab-compactlogix-5380', 'ab-compactlogix-5370', 'ab-compactlogix-5370-l1', 'siemens-s7-1200', 'siemens-s7-1200-g2', 'siemens-s7-1500', 'schneider-m221', 'schneider-m241', 'omron-cp2e', 'omron-cp1e', 'omron-nx1p2', 'mitsubishi-fx5u', 'mitsubishi-fx5uc', 'delta-dvp', 'delta-as300', 'unitronics-unistream', 'unitronics-vision', 'unitronics-samba', 'unitronics-jazz']);
for (const pl of PLATFORMS) assert.ok(DRIVER_IDS.has(pl.id), `platform ${pl.id} is on the driver id list`);
for (const p of ALL_HMIS()) for (const id of driversOf(p)) assert.ok(DRIVER_IDS.has(id), `${p.partNumber}: driver id ${id} is a known platform id`);
console.log('driver list tests passed');

// Panel specs for the vendor-neutral HMI designer, from the maker's datasheet. A key is left out
// (never guessed) where the maker's page could not be read or contradicts itself; those are listed here.
const NO_RESOLUTION: Record<string, string> = {
  HMIG3U: 'box module without a display (pairs with the HMIDT732 display)',
  G09C1000: 'maker page not found; only the sibling G09C0000 was readable',
  CR10000400000210: 'maker spec table not reachable', CR10001000000210: 'maker spec table not reachable', CR30001500000420: 'maker spec table not reachable',
};
for (const p of ALL_HMIS().filter((h) => h.vendor && h.vendor !== 'automationdirect')) {
  const r = p.ratings;
  const headless = r.touch === 'none'; // gateways / servers without a display
  if (r.lifecycle === 'legacy') continue; // listed for existing machines only (greyed, never designed for)
  if (r.resolutionPx !== undefined) assert.match(String(r.resolutionPx), /^\d+x\d+$/, `${p.partNumber}: resolutionPx is WxH`);
  else assert.ok(headless || NO_RESOLUTION[p.partNumber], `${p.partNumber}: resolutionPx from the datasheet`);
  if (p.partNumber !== 'HMIG3U' && !headless) assert.equal(typeof r.displayIn, 'number', `${p.partNumber}: displayIn`);
  if (r.touch !== undefined) assert.match(String(r.touch), /^(resistive|capacitive|yes|none)$/, `${p.partNumber}: touch type`);
  for (const k of ['ethernetPorts', 'serialPorts', 'usbPorts']) if (r[k] !== undefined) assert.ok(Number.isInteger(r[k]) && Number(r[k]) >= 0, `${p.partNumber}: ${k}`);
}
assert.ok(String(getPart('HMIG3U')!.ratings.pairsWith).split(',').includes('HMIDT732'), 'GTU box pairs with its displays');
console.log('HMI panel spec tests passed');

// Update all: the CPU must hold the real I/O list; CLICK modules are added for the shortfall, or null (a bigger CPU).
{
  const n = need({ digitalInputs: 15, digitalOutputs: 6, analogInputs: 1 });
  const mods = modulesToFit('C0-12DD1E-D', [], n)!;
  assert.ok(mods.length >= 2 && cpuFit(PLC_PROFILES.flatMap((p) => p.cpuModels).find((c) => c.id === 'C0-12DD1E-D')!, mods, n).ok, `CLICK modules added: ${mods.join(', ')}`);
  assert.deepEqual(modulesToFit('C0-12DD1E-D', mods, n), mods, 'already fits: unchanged');
  assert.equal(modulesToFit('C0-12DD1E-D', [], need({ digitalInputs: 400 })), null, 'too much I/O for any module set');
  console.log('module fit tests passed');
}

// Signal families: a 4-20 mA point needs a channel that takes current, a thermocouple a thermocouple input — the
// S7-1200 CPU's own inputs are 0-10 V only, CLICK's C0-04THM takes thermocouples only.
{
  const cpuOf = (id: string) => PLC_PROFILES.flatMap((p) => p.cpuModels).find((c) => c.id === id)!;
  const ma = need({ analogInputs: 1, analogRanges: { input: ['4-20mA'], output: [] } });
  // Siemens 1212C: two onboard 0-10 V inputs are not enough for one 4-20 mA signal; an SM 1231 is added
  const s7 = '6ES7212-1AE40-0XB0';
  assert.ok(cpuFit(cpuOf(s7), [], need({ analogInputs: 1 })).ok, 'by count alone the onboard inputs would do');
  const f = cpuFit(cpuOf(s7), [], ma);
  assert.ok(!f.ok && /current \(mA\) analog input/.test(f.reason ?? ''), `1212C alone: ${f.reason}`);
  const mods = modulesToFit(s7, [], ma);
  assert.ok(mods?.includes('6ES7231-4HD32-0XB0'), `SM 1231 added: ${mods?.join(', ')}`);
  assert.ok(cpuFit(cpuOf(s7), mods!, ma).ok);
  assert.ok(cpuFit(cpuOf(s7), [], need({ analogInputs: 1, analogRanges: { input: ['0-10V'], output: [] } })).ok, '0-10 V: the onboard input takes it');
  // CLICK with only a thermocouple module: a 4-20 mA input adds the C0-04AD-1; a thermocouple adds the C0-04THM
  const click = 'C0-11DD2E-D';
  assert.ok(!cpuFit(cpuOf(click), ['C0-04THM'], ma).ok, '4-20 mA on a THM-only CLICK: no fit');
  const cm = modulesToFit(click, ['C0-04THM'], ma);
  assert.ok(cm?.includes('C0-04AD-1'), `C0-04AD-1 added: ${cm?.join(', ')}`);
  const tc = need({ analogInputs: 1, analogRanges: { input: ['thermocouple'], output: [] } });
  assert.ok(modulesToFit(click, [], tc)?.includes('C0-04THM'), 'a thermocouple adds the C0-04THM');
  assert.ok(!modulesToFit('C0-12DD1E-D', [], ma)?.length, 'analog CLICK CPU: its AD inputs take 4-20 mA, nothing added');
  console.log('signal family fit tests passed');
}
