/// <reference types="node" />
/**
 * TIA Portal Openness block XML: LAD networks walked from the coils and boxes back to the power rail.
 * Run with:  npx tsx src/plc/import/tia.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectFormat, importProgramText } from './index';

const here = dirname(fileURLToPath(import.meta.url));
const text = readFileSync(join(here, '__fixtures__', 'FB_Filler_tia.xml'), 'utf8');
assert.equal(detectFormat('FB_Filler.xml', text), 'siemens-xml');
const p = importProgramText('FB_Filler.xml', text);
const nick = new Map(p.program.tags.map((t) => [t.nickname, t.address]));
const r = p.program.rungs;

// Network 1: (Start_PB OR Running) AND Stop_PB → Running (parallel contacts on one wire).
assert.equal(r[0].comment, 'Run latch');
assert.equal(r[0].branches.length, 2);
assert.deepEqual(r[0].outputs, [{ type: 'OUT', address: nick.get('Running') }]);
assert.ok(r[0].branches.every((b) => b[b.length - 1].type === 'NO'), 'Stop_PB in series after the branch');
// Network 2: TON with its instance and T#4S500MS; the negated coil after Q.
assert.deepEqual(r[1].outputs[0], { type: 'TMR', address: nick.get('Fill_Tmr'), mode: 'ON_DELAY', preset: '4500', unit: 'ms', accumulate: false, resetAddress: null });
assert.deepEqual(r[2].branches, [[{ type: 'NC', address: nick.get('Fill_Tmr') }]]);
// Network 3: Ge compare box → set coil.
assert.deepEqual(r[3].branches, [[{ type: 'CMP', left: nick.get('Fill_Count'), op: '>=', right: '500' }]]);
assert.equal(r[3].outputs[0].type, 'SET');
// Network 4: an instruction the ladder has no form for → kept as a pointer to the original network.
assert.deepEqual(r[4].outputs, [{ type: 'RAW', vendor: 'siemens-lad', text: 'FB_Filler network 4 (Calculate): edit it in TIA Portal' }]);
// Network 5: SCL → listed.
assert.ok(p.report.notConverted.some((n) => !n.kept && /Network 5: SCL network/.test(n.text)));
// Interface members give names and comments.
assert.equal(p.program.tags.find((t) => t.nickname === 'Fill_Count')?.comment, 'Bottles filled');

console.log('tia.test: all passed');
