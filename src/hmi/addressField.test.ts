/// <reference types="node" />
/**
 * The HMI address field: garbage, addresses this PLC does not have, a register where a bit is needed (and back),
 * an input / output not in the I/O list, a button writing an input. Run with:  npx tsx src/hmi/addressField.test.ts
 */
import assert from 'node:assert/strict';
import { getProfile } from '../plc/core/profiles';
import { hmiAddressProblem } from './addressField';

const click = getProfile('click'), logix = getProfile('logix');
const io = new Set(['X001', 'X002', 'Y001']);
const p = (kind: Parameters<typeof hmiAddressProblem>[2], a: string, prof = click) => hmiAddressProblem(prof, io, kind, a);

assert.equal(p('indicator', ''), null);
assert.match(p('indicator', 'GARBAGE!!')!, /not an address on CLICK/);
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
assert.match(p('indicator', 'GARBAGE!!', logix)!, /not an address on CompactLogix/);
console.log('HMI address field tests passed');
