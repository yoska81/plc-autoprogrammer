/// <reference types="node" />
/**
 * The PLC's own I/O names on the drawings: a Siemens S7 panel shows %I0.0 / %Q0.0 on its PLC rows and sheet titles
 * and numbers its I/O wires I0.0 / Q0.0 (wire list, terminal plan, cables); a CLICK panel keeps X001 / Y001.
 * Run with:  npx tsx src/electrical/ioNames.test.ts
 */
import assert from 'node:assert/strict';
import { ioNames, renameAddressText, renamePin, renameWire, wireOfNative } from './ioNames';
import { buildModel, nativeModel, wireListCsv, type DrawingContext } from './derive';
import { wiringPaths } from '../troubleshoot/wiringPath';
import { buildCircuit } from '../troubleshoot/circuit';
import { runCodeRules } from '../review/codeRules/rules';
import { parseRow, wireListCsvWithNotes, wireNoteKeys } from '../edits/lists';
import { planDrawings } from './drawings/plan';
import { getPart } from './catalog';
import { DESIGN } from '../preview/sampleProject';

// names
assert.equal(wireOfNative('%I0.0'), 'I0.0');
assert.equal(wireOfNative('_IO_EM_DI_00'), 'DI00');
assert.equal(wireOfNative('on-board I0'), 'I0');
const us = ioNames('US5-B10-TR22', [], []);
assert.deepEqual([us.native.get('X001'), us.wire.get('X001'), us.native.get('Y001'), us.wire.get('Y001')], ['I0', 'I0', 'O0', 'O0'], 'UniStream on-board I/O as marked on the CPU (I0 / O0)');
assert.equal(wireOfNative('Local:1:I.Pt00.Data'), null, 'a name that is no good as a wire number keeps the address');
const s7 = ioNames('6ES7214-1AG40-0XB0', [], ['X001', 'X002', 'Y001']);
assert.equal(s7.native.get('X001'), '%I0.0');
assert.equal(renameWire(s7, 'Y001A'), 'Q0.0A', 'a series suffix stays');
assert.equal(renameWire(s7, '24+S'), '24+S', 'other wires stay');
assert.equal(renamePin(s7, 'PLC:X002'), 'PLC:I0.1');
assert.equal(ioNames('C0-10DD1E-D', [], ['X001']).native.size, 0, 'CLICK keeps its addresses');

// one name per address: Unitronics Vision numbers its on-board I/O and expansion I/O apart (with the CPU known)
const oneEach = (n: ReturnType<typeof ioNames>) => new Set(n.wire.values()).size === n.wire.size && new Set(n.native.values()).size === n.native.size;
for (const [cpu, mods] of [['V350-35-TR34', []], ['V130-33-T38', []], ['SM43-J-T20', ['V200-18-E3XB']]] as [string, string[]][]) {
  const n = ioNames(cpu, mods, []);
  assert.ok(n.wire.size > 0 && oneEach(n), `${cpu}: one wire number per terminal`);
}
const sm = ioNames('SM43-J-T20', ['V200-18-E3XB'], []);
assert.notEqual(sm.wire.get('X001'), sm.wire.get('X101'), 'SM43 + V200-18-E3XB: X001 and X101 are different inputs');
// only terminals the hardware has: a CPU without on-board I/O (S7-1500 + ET 200SP) leaves a stale X001 / Y001 alone
const et = ioNames('6ES7511-1AL03-0AB0', ['6ES7131-6BH01-0BA0', '6ES7132-6BH01-0BA0', '6ES7131-6BH01-0BA0', '6ES7132-6BH01-0BA0'], ['X001', 'Y001', 'Y101']);
assert.ok(!et.native.has('X001') && !et.native.has('Y001') && !et.native.has('Y101'), 'no names for terminals the rack does not have');
assert.equal(et.native.get('X101'), '%I0.0');
assert.equal(et.native.get('Y201'), '%Q0.0');
assert.ok(oneEach(et), 'S7-1500 + ET 200SP: one name per terminal');
assert.equal(renameAddressText(et, 'Stale X001 on rung; Start (X101)'), 'Stale X001 on rung; Start (%I0.0)', 'a stale address in a document keeps its app address');

// a Siemens panel: drawings and lists in the PLC's naming
const io = DESIGN.ioWiring.map((w) => ({ address: w.address, description: w.description, type: (w.address.startsWith('X') ? 'input' : 'output') as 'input' | 'output' }));
const ctx = (cpu: string, vendor: string): DrawingContext => ({
  projectName: 'S7', getPart, io, design: { ...DESIGN, components: DESIGN.components.filter((c) => getPart(c.partNumber)?.category !== 'plcModule') },
  plc: { vendor, name: vendor, cpuPartNumber: cpu, cpuLabel: '' },
});
const sie = ctx('6ES7214-1AG40-0XB0', 'Siemens');
const m = nativeModel(sie);
assert.ok(m.wires.some((w) => /^I0\.\d$/.test(w.wire)) && m.wires.some((w) => /^Q0\.\d/.test(w.wire)), 'I/O wires numbered I0.x / Q0.x');
assert.ok(!m.wires.some((w) => /^[XY]\d{3}/.test(w.wire)), `no X001 / Y001 wire numbers: ${m.wires.filter((w) => /^[XY]\d{3}/.test(w.wire)).map((w) => w.wire).join(', ')}`);
assert.ok(!m.wires.some((w) => /PLC:[XY]\d{3}$/.test(`${w.from} ${w.to}`.split(' ').find((e) => e.startsWith('PLC:')) ?? '')), 'PLC pins in the PLC\'s naming');
assert.ok(m.strips.every((s) => s.terminals.every((t) => !/^[XY]\d{3}/.test(t.wire))), 'terminal plan in the PLC\'s naming');
const titles = planDrawings(sie).sheets.filter((s) => s.spec.kind === 'io').map((s) => s.title);
assert.ok(titles.some((t) => /PLC INPUTS .*\(%I0\.0/.test(t)) && titles.some((t) => /PLC OUTPUTS .*\(%Q0\.0/.test(t)), `I/O sheet titles in %I / %Q: ${titles.join(' | ')}`);

assert.ok(wireListCsv(sie).includes('\nI0.0,') && !/\n[XY]\d{3}/.test(wireListCsv(sie)), 'the wire list in the PLC\'s naming');

// the model itself keeps the app addresses: the I/O list, troubleshooting and the design rules match against them
const app = buildModel(sie);
assert.ok(app.wires.some((w) => w.wire === 'X001') && app.wires.some((w) => `${w.from} ${w.to}`.includes('PLC:X001')), 'buildModel: X001 / PLC:X001');
// fault finding on an S7 panel: every point has its wire on the PLC terminal, as on a CLICK panel
const paths = wiringPaths(sie);
assert.equal(paths.length, app.io.length);
assert.deepEqual(paths.filter((p) => p.noWire).map((p) => p.address), [], 'S7: no point without a wire on its PLC terminal');
const circ = buildCircuit(app);
const pinned = app.io.filter((p) => circ.links.some((l) => l.a === `${app.plcTag}:${p.address}` || l.b === `${app.plcTag}:${p.address}`));
assert.equal(pinned.length, app.io.length, `S7: every PLC terminal in the circuit (${pinned.length}/${app.io.length})`);

// the design rules too: an S7 output is not "cannot switch" because its wire is numbered Q0.0
const switching = (c: DrawingContext) => runCodeRules({ ctx: c }).filter((h) => /cannot switch/.test(h.title)).map((h) => h.subject);
assert.deepEqual(switching(sie), switching(ctx('C0-10DD1E-D', 'AutomationDirect')), 'S7: the same switching findings as on CLICK');

// a CLICK panel: unchanged
const clkCtx = ctx('C0-10DD1E-D', 'AutomationDirect');
const clk = buildModel(clkCtx);
assert.equal(nativeModel(clkCtx), clk, 'CLICK: the native model is the model');
assert.ok(clk.wires.some((w) => w.wire === 'X001') && clk.ioNames.native.size === 0, 'CLICK: X001');

// a wire-list note stays with its wire when the CPU changes (CLICK X001 → S7 I0.0): notes are keyed by app numbers
const clickWires = buildModel(clkCtx).wires, ck = wireNoteKeys(clkCtx);
const i = clickWires.findIndex((w) => w.wire === 'X001' && /PLC:X001/.test(`${w.from} ${w.to}`));
assert.ok(i >= 0);
const noted = wireListCsvWithNotes(sie, { [ck[i]]: 'Checked' }).split('\r\n').map(parseRow);
assert.ok(noted.some((c) => c[0] === 'I0.0' && /PLC:I0\.0/.test(`${c[1]} ${c[2]}`) && c.at(-1) === 'Checked'), 'the X001 note on the S7 I0.0 row');

console.log('ioNames.test: ok');
