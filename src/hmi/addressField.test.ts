/// <reference types="node" />
/**
 * The HMI address field: garbage, addresses this PLC does not have, a register where a bit is needed (and back),
 * an input / output not in the I/O list, a button writing an input, the PLC's own names, leading zeros, a bare
 * number, writes to what the PLC sets itself, and Generic ST. Run with:  npx tsx src/hmi/addressField.test.ts
 */
import assert from 'node:assert/strict';
import { getProfile } from '../plc/core/profiles';
import { nativeName, rackTerminals, type Rack } from '../plc/core/addressCheck';
import { SIEMENS_CPUS, siemensAddress } from '../plc/core/profiles/siemens';
import { hmiAddressProblem } from './addressField';

const rackOf = (id: string): Rack => { const profile = getProfile(id); return { profile, cpu: profile.cpuModels.find((c) => c.builtInInputs > 0) ?? profile.cpuModels[0], modules: [] }; };
const click = rackOf('click'), logix = rackOf('logix'), s7 = rackOf('siemens-s7'), m800 = rackOf('micro800'), st = rackOf('generic-st');
const io = new Set(['X001', 'X002', 'Y001']);
const p = (kind: Parameters<typeof hmiAddressProblem>[2], a: string, rack = click) => hmiAddressProblem(rack, io, kind, a);

assert.equal(p('indicator', ''), null);
assert.match(p('indicator', 'GARBAGE!!')!, /not an address on CLICK\.$/);
assert.match(p('numeric', 'DS9999')!, /not an address on CLICK/);
assert.match(p('indicator', 'X099')!, /X099 is not in the I\/O list/);
assert.equal(p('indicator', 'x001'), null, 'a lamp on a listed input');
assert.match(p('button', 'X001')!, /input: .*a button cannot write it/);
assert.equal(p('button', 'Y001'), null, 'a button may force an output (jog)');
assert.match(p('button', 'DS1')!, /number register; this needs a bit/);
assert.match(p('numeric-entry', 'C1001')!, /needs a number/);
assert.match(p('bar', 'Y001')!, /on\/off point; this shows a number/);
assert.equal(p('numeric', 'CTD2'), null);
assert.equal(p('multistate', 'DS1101'), null, 'state display: a register');
assert.equal(p('multistate', 'C1'), null, 'or a bit');
assert.match(p('indicator', 'GARBAGE!!', logix)!, /not an address on Allen-Bradley CompactLogix 5370 L1\..*the export gives them their/);

// Generic Structured Text: points are named by the project's own ids, so nothing is flagged.
for (const k of ['numeric', 'numeric-entry', 'bar', 'trend', 'button', 'indicator'] as const) assert.equal(p(k, 'Tank_Level', st), null, `generic ST ${k}`);

// The PLC's own names of its terminals: say which app address to type.
assert.match(p('indicator', '%I0.0', s7)!, /%I0\.0 is X001 on the screens: type X001/);
assert.match(p('indicator', '%q0.0', s7)!, /is Y001 on the screens/);
assert.match(p('indicator', 'Local:1:I.Data.0', logix)!, /is X001 on the screens/);
assert.match(p('indicator', '_IO_EM_DI_00', m800)!, /is X001 on the screens/);
assert.match(p('numeric', '%MW10', s7)!, /not an address on Siemens S7-1200\..*C1 for a bit, DS1 for a number/);

// Leading zeros.
assert.match(p('indicator', 'X1')!, /Type X001: inputs and outputs have three digits/);
assert.match(p('indicator', 'X01')!, /Type X001/);
assert.match(p('indicator', 'X9')!, /Inputs and outputs have three digits \(X009\), and X009 is not in the I\/O list/);
assert.match(p('indicator', 'C01')!, /Type C1: memory addresses have no leading zeros/);

// A bare number.
assert.match(p('numeric', '123')!, /123 is a number, not an address/);

// Writes to what the PLC sets itself.
assert.match(p('button', 'SC1')!, /SC1 is system memory the PLC sets itself; a button cannot write it/);
assert.match(p('numeric-entry', 'SD1')!, /system memory .*an entry cannot write it/);
assert.equal(p('indicator', 'SC1'), null, 'a lamp may show a system bit');
assert.match(p('button', 'T1')!, /timer's done bit/);
assert.match(p('button', 'CT1')!, /counter's done bit/);
assert.match(p('numeric-entry', 'TD1')!, /timer's running value; .*DS register/);
assert.equal(p('numeric', 'TD1'), null, 'a value display may show it');

// S7-1500 with ET 200SP modules: the PLC's names are the export's (buildScl places module I/O by the project's CPU),
// not a 1214C's. Two 16-point input modules: X101 is %I0.0, X201 is %I2.0.
const s7Profile = getProfile('siemens-s7');
const cpu1511 = SIEMENS_CPUS.find((c) => c.platformId === 'siemens-s7-1500')!;
const et200 = [{ partNumber: 'DI16', inputs: 16, outputs: 0 }, { partNumber: 'DI16', inputs: 16, outputs: 0 }, { partNumber: 'DQ16', inputs: 0, outputs: 16 }];
const s1500: Rack = { profile: s7Profile, cpu: cpu1511, modules: et200 };
for (const t of [...rackTerminals(s1500, 'input'), ...rackTerminals(s1500, 'output')]) {
  assert.equal(nativeName(s1500, t), siemensAddress(t, cpu1511, et200)?.address, `S7-1500 ${t}`);
}
assert.equal(nativeName(s1500, 'X101'), '%I0.0');
assert.equal(nativeName(s1500, 'X201'), '%I2.0');
assert.match(hmiAddressProblem(s1500, io, 'indicator', '%I2.0')!, /is X201 on the screens/);
assert.match(hmiAddressProblem(s1500, io, 'indicator', '%I8.0')!, /not an address on/, 'a 1214C module address is not this PLC\'s');
// Analog: the PLC's word address of a channel names its DF register.
assert.match(p('numeric', '%IW64', s7)!, /%IW64 is DF1 on the screens: type DF1/);

// Unitronics: I0, "I 0" and "on-board I0" on both profiles.
const vision = rackOf('unitronics-vision'), uni = rackOf('unitronics-unistream');
for (const r of [vision, uni]) for (const typed of ['I0', 'I 0', 'i0']) assert.match(hmiAddressProblem(r, io, 'indicator', typed)!, /is X001 on the screens/, `${r.profile.id} ${typed}`);

// The CPU's own family in the message: a 1769 CompactLogix 5370 on the Logix profile.
const l33: Rack = { profile: getProfile('logix'), cpu: getProfile('logix').cpuModels.find((c) => c.id === '1769-L33ER')!, modules: [] };
assert.match(hmiAddressProblem(l33, io, 'indicator', 'GARBAGE')!, /not an address on Allen-Bradley CompactLogix 5370/);
console.log('HMI address field tests passed');
