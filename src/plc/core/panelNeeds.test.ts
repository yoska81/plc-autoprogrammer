/// <reference types="node" />
/**
 * What a touch panel needs from the PLC beyond its driver, as the HMI picker and the Equipment page show it:
 * the interface module (CM 1243-5 for a PROFIBUS panel on an S7-1200), the Logix firmware (PanelView 5310 / 5510:
 * V27+), and the GT21 RS-422/485 panels that a CP2E-E / CP2E-S (RS-232 only) cannot reach.
 * Run with:  npx tsx src/plc/core/panelNeeds.test.ts
 */
import assert from 'node:assert/strict';
import { getPart } from '../../electrical/catalog';
import { catalogPanels } from '../../hmi/panels';
import { hmiFit, panelPlcNeeds, type Need } from './fit';
import { platformById } from './platforms';

const need: Need = { digitalInputs: 4, digitalOutputs: 2, analogInputs: 0, analogOutputs: 0, ethernetHmi: false, minHmiSizeIn: null };
const model = (pn: string) => catalogPanels().find((o) => o.part.partNumber === pn)!.model!;
const needs = (pn: string, platformId: string, cpuId: string) => panelPlcNeeds(getPart(pn)!, platformById(platformId)!, cpuId);

// PROFIBUS / serial panels: the module the PLC needs.
assert.equal(needs('6AV2123-2GA03-0AX0', 'siemens-s7-1200', '6ES7214-1AG40-0XB0').note, 'PLC needs: CM 1243-5 DP master (6GK7243-5DX30-0XE0)');
const s7 = hmiFit(model('PFXGP4116T2D'), need, '6ES7214-1AG40-0XB0');
assert.ok(s7.ok && /^PLC needs: CM 1243-5 DP master/.test(s7.note ?? ''), `GP4116T2D on an S7-1200: ${s7.reason ?? s7.note}`);

// GT21 RS-422/485 panels: not with a CP2E-E / S; a CP2E-N takes the CP1W-CIF11.
assert.deepEqual(needs('GT2104-PMBDS', 'omron-cp2e', 'CP2E-E30DR-A'), { reason: 'CP2E-E/S have RS-232 only; this panel is RS-422/485.', note: null });
assert.deepEqual(needs('GT2103-PMBLS', 'omron-cp2e', 'CP2E-S40DT-D'), { reason: 'CP2E-E/S have RS-232 only; this panel is RS-422/485.', note: null });
assert.deepEqual(needs('GT2104-PMBDS', 'omron-cp2e', 'CP2E-N30DT-D'), { reason: null, note: 'PLC needs: CP1W-CIF11' });
// The RS-232 GT21: a CP2E-E / S uses its built-in port (nothing needed); a CP2E-N takes the CP1W-CIF01.
assert.deepEqual(needs('GT2104-PMBDS2', 'omron-cp2e', 'CP2E-E30DR-A'), { reason: null, note: null });
assert.equal(needs('GT2104-PMBDS2', 'omron-cp2e', 'CP2E-N30DT-D').note, 'PLC needs: CP1W-CIF01');

// PanelView 5310 on a CompactLogix: firmware V27 or later.
const pv = hmiFit(model('2713P-T7WD1'), need, '1769-L33ER');
assert.ok(pv.ok && pv.note === 'Needs Logix controller firmware V27 or later', `PanelView 5310 on a 1769-L33ER: ${pv.reason ?? pv.note}`);

// An Ethernet panel on its own PLC needs nothing more.
assert.equal(hmiFit(model('6AV2123-2GB03-0AX0'), need, '6ES7214-1AG40-0XB0').note ?? null, null);
console.log('panel PLC needs tests passed');
