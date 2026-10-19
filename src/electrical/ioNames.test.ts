/// <reference types="node" />
/**
 * The PLC's own I/O names on the drawings: a Siemens S7 panel shows %I0.0 / %Q0.0 on its PLC rows and sheet titles
 * and numbers its I/O wires I0.0 / Q0.0 (wire list, terminal plan, cables); a CLICK panel keeps X001 / Y001.
 * Run with:  npx tsx src/electrical/ioNames.test.ts
 */
import assert from 'node:assert/strict';
import { ioNames, renamePin, renameWire, wireOfNative } from './ioNames';
import { buildModel, type DrawingContext } from './derive';
import { planDrawings } from './drawings/plan';
import { getPart } from './catalog';
import { DESIGN } from '../preview/sampleProject';

// names
assert.equal(wireOfNative('%I0.0'), 'I0.0');
assert.equal(wireOfNative('_IO_EM_DI_00'), 'DI00');
assert.equal(wireOfNative('on-board I0'), 'I0');
assert.equal(wireOfNative('Local:1:I.Pt00.Data'), null, 'a name that is no good as a wire number keeps the address');
const s7 = ioNames('6ES7214-1AG40-0XB0', [], ['X001', 'X002', 'Y001']);
assert.equal(s7.native.get('X001'), '%I0.0');
assert.equal(renameWire(s7, 'Y001A'), 'Q0.0A', 'a series suffix stays');
assert.equal(renameWire(s7, '24+S'), '24+S', 'other wires stay');
assert.equal(renamePin(s7, 'PLC:X002'), 'PLC:I0.1');
assert.equal(ioNames('C0-10DD1E-D', [], ['X001']).native.size, 0, 'CLICK keeps its addresses');

// a Siemens panel: drawings and lists in the PLC's naming
const io = DESIGN.ioWiring.map((w) => ({ address: w.address, description: w.description, type: (w.address.startsWith('X') ? 'input' : 'output') as 'input' | 'output' }));
const ctx = (cpu: string, vendor: string): DrawingContext => ({
  projectName: 'S7', getPart, io, design: { ...DESIGN, components: DESIGN.components.filter((c) => getPart(c.partNumber)?.category !== 'plcModule') },
  plc: { vendor, name: vendor, cpuPartNumber: cpu, cpuLabel: '' },
});
const sie = ctx('6ES7214-1AG40-0XB0', 'Siemens');
const m = buildModel(sie);
assert.ok(m.wires.some((w) => /^I0\.\d$/.test(w.wire)) && m.wires.some((w) => /^Q0\.\d/.test(w.wire)), 'I/O wires numbered I0.x / Q0.x');
assert.ok(!m.wires.some((w) => /^[XY]\d{3}/.test(w.wire)), `no X001 / Y001 wire numbers: ${m.wires.filter((w) => /^[XY]\d{3}/.test(w.wire)).map((w) => w.wire).join(', ')}`);
assert.ok(!m.wires.some((w) => /PLC:[XY]\d{3}$/.test(`${w.from} ${w.to}`.split(' ').find((e) => e.startsWith('PLC:')) ?? '')), 'PLC pins in the PLC\'s naming');
assert.ok(m.strips.every((s) => s.terminals.every((t) => !/^[XY]\d{3}/.test(t.wire))), 'terminal plan in the PLC\'s naming');
const titles = planDrawings(sie).sheets.filter((s) => s.spec.kind === 'io').map((s) => s.title);
assert.ok(titles.some((t) => /PLC INPUTS .*\(%I0\.0/.test(t)) && titles.some((t) => /PLC OUTPUTS .*\(%Q0\.0/.test(t)), `I/O sheet titles in %I / %Q: ${titles.join(' | ')}`);

// a CLICK panel: unchanged
const clk = buildModel(ctx('C0-10DD1E-D', 'AutomationDirect'));
assert.ok(clk.wires.some((w) => w.wire === 'X001') && clk.ioNames.native.size === 0, 'CLICK: X001');

console.log('ioNames.test: ok');
