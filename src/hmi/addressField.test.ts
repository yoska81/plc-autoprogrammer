/// <reference types="node" />
/**
 * The HMI address field: garbage, addresses this PLC does not have, a register where a bit is needed (and back),
 * an input / output not in the I/O list, a button writing an input, the PLC's own names, leading zeros, a bare
 * number, writes to what the PLC sets itself, and Generic ST. Run with:  npx tsx src/hmi/addressField.test.ts
 */
import assert from 'node:assert/strict';
import { getProfile } from '../plc/core/profiles';
import type { Rack } from '../plc/core/addressCheck';
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
assert.match(p('indicator', 'GARBAGE!!', logix)!, /not an address on CompactLogix.*the export gives them their/);

// Generic Structured Text: points are named by the project's own ids, so nothing is flagged.
for (const k of ['numeric', 'numeric-entry', 'bar', 'trend', 'button', 'indicator'] as const) assert.equal(p(k, 'Tank_Level', st), null, `generic ST ${k}`);

// The PLC's own names of its terminals: say which app address to type.
assert.match(p('indicator', '%I0.0', s7)!, /%I0\.0 is X001 on the screens: type X001/);
assert.match(p('indicator', '%q0.0', s7)!, /is Y001 on the screens/);
assert.match(p('indicator', 'Local:1:I.Data.0', logix)!, /is X001 on the screens/);
assert.match(p('indicator', '_IO_EM_DI_00', m800)!, /is X001 on the screens/);
assert.match(p('numeric', '%MW10', s7)!, /not an address on S7.*C1 for a bit, DS1 for a number/);

// Leading zeros.
assert.match(p('indicator', 'X1')!, /Type X001: inputs and outputs have three digits/);
assert.match(p('indicator', 'X01')!, /Type X001/);
assert.match(p('indicator', 'X9')!, /X9 is not in the I\/O list/, 'no hint when X009 is not listed either');
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
console.log('HMI address field tests passed');
