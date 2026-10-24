/// <reference types="node" />
/**
 * The PLC-side communication module a touch panel needs: a design part (BOM, layout next to the CPU or inside
 * it), never an I/O slot, so no address moves. Run with:  npx tsx src/electrical/commModule.test.ts
 */
import assert from 'node:assert/strict';
import { generateDefaultDesign } from './engine';
import { exampleInput, ctxFor } from './improve/testDesign';
import { getPart } from './catalog';
import { billOfMaterials, buildModel, panelLayout, plcRack } from './derive';
import { commModulesFor } from './commModule';

const tags = () => { let n = 0; return (p: string) => `${p}${++n}`; };

// Pro-face GP4116T2D (serial) on an S7-1200: CM 1243-5 DP master, mounted on the CPU's left.
const cm = commModulesFor('PFXGP4116T2D', '6ES7214-1AG40-0XB0', getPart, tags());
assert.equal(cm.components[0]?.partNumber, '6GK7243-5DX30-0XE0');
assert.equal(getPart(cm.components[0].partNumber)?.category, 'commModule');
// Nothing for a panel that needs no module, or no panel.
assert.deepEqual(commModulesFor(null, '6ES7214-1AG40-0XB0', getPart, tags()).components, []);
assert.deepEqual(commModulesFor('CM5-T7W', 'C0-10DD1E-D', getPart, tags()).components, []);

// Through the engine: the module is a part of the design, and the I/O addresses, slot groups and rack stay put.
const base = exampleInput('480VAC-3PH');
const s7 = { ...base, plc: { ...base.plc, vendor: 'Siemens', name: 'S7-1200', cpuPartNumber: '6ES7214-1AG40-0XB0', cpuLabel: '' } };
const without = generateDefaultDesign({ ...s7, hmiPartNumber: null }).design;
const withCm = generateDefaultDesign({ ...s7, hmiPartNumber: 'PFXGP4116T2D' }).design;
const c = withCm.components.find((x) => x.partNumber === '6GK7243-5DX30-0XE0');
assert.ok(c && /^CM\d/.test(c.tag), `CM in the design (${withCm.components.map((x) => x.partNumber).join(', ')})`);
assert.ok(!without.components.some((x) => x.partNumber === '6GK7243-5DX30-0XE0'));
const ctxA = { ...ctxFor(s7, without), plc: s7.plc }, ctxB = { ...ctxFor(s7, withCm), plc: s7.plc, hmiPartNumber: 'PFXGP4116T2D' };
const mA = buildModel(ctxA), mB = buildModel(ctxB);
assert.deepEqual(mB.io.map((p) => `${p.address}:${p.group}`), mA.io.map((p) => `${p.address}:${p.group}`), 'I/O addresses and groups unchanged');
assert.deepEqual(plcRack(ctxB).map((r) => r.partNumber), plcRack(ctxA).map((r) => r.partNumber), 'PLC rack unchanged');
assert.ok(billOfMaterials(ctxB).some((g) => g.title === 'PLC communication modules' && g.lines.some((l) => l.partNumber === '6GK7243-5DX30-0XE0')), 'BOM group');
// Layout: on the PLC row, just left of the CPU.
const L = panelLayout(ctxB).items.filter((i) => !i.sub);
const cpu = L.find((i) => i.tag === 'PLC')!, cmi = L.find((i) => i.tag === c!.tag)!;
assert.ok(cmi && cpu && Math.abs(cmi.y - cpu.y) < 1 && cmi.x < cpu.x, `CM left of the CPU (CM x ${cmi?.x}, CPU x ${cpu?.x})`);

// An option board inside the CPU (GT2104-PMBDS2 on an FX5U: FX5-232-BD) takes no panel space.
const fx = commModulesFor('GT2104-PMBDS2', 'FX5U-32MT/ES', getPart, tags());
assert.equal(fx.components[0]?.partNumber, 'FX5-232-BD');
const fxIn = { ...base, plc: { ...base.plc, vendor: 'Mitsubishi', name: 'FX5U', cpuPartNumber: 'FX5U-32MT/ES', cpuLabel: '' }, hmiPartNumber: 'GT2104-PMBDS2' };
const dFx = generateDefaultDesign(fxIn).design;
const bd = dFx.components.find((x) => x.partNumber === 'FX5-232-BD')!;
assert.ok(bd, 'FX5-232-BD in the design');
const Lf = panelLayout({ ...ctxFor(fxIn, dFx), plc: fxIn.plc, hmiPartNumber: 'GT2104-PMBDS2' });
assert.ok(!Lf.items.some((i) => i.tag === bd.tag) && Lf.unplaced.some((u) => u.tag === bd.tag && /inside the PLC CPU/i.test(u.reason)), 'board inside the CPU: not on the back panel');
console.log('commModule tests passed');
