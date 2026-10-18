/// <reference types="node" />
/**
 * Siemens STL / AWL source: the RLO the way the CPU evaluates it, timers, compares, copies; networks with
 * jumps, calls or counter loads kept whole; the PLC tag table gives the I/O.
 * Run with:  npx tsx src/plc/import/stl.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { convertStlNetwork, stlOperand } from './stl';
import { toBranches } from './cond';
import { fileText, importProgramFiles, detectFormat } from './index';
import { programFindings } from './findings';
import { planUpgrade } from './upgrade';

const here = dirname(fileURLToPath(import.meta.url));
const file = (n: string) => ({ name: n, text: fileText(n, new Uint8Array(readFileSync(join(here, '__fixtures__', n)))) });
const net = (s: string) => convertStlNetwork(s.split('\n').map((l) => l.trim()).filter(Boolean));
const paths = (s: string) => toBranches(net(s)![0].cond)!.map((b) => b.map((e) => ('address' in e ? `${e.type === 'NC' ? '!' : ''}${e.address}` : e.type === 'CMP' ? `${e.left}${e.op}${e.right}` : e.type)).join('·'));

assert.equal(stlOperand('I 0.0'), '%IX0.0');
assert.equal(stlOperand('E 1.3'), '%IX1.3', 'German E = input');
assert.equal(stlOperand('A 4.1'), '%QX4.1', 'German A = output');
assert.equal(stlOperand('"Start_PB"'), 'Start_PB');
assert.equal(stlOperand('M 10.0'), 'M10.0');
assert.equal(stlOperand('IW 96'), '%IW96');

// AND binds before O: A a A b O c A d = a·b + c·d
assert.deepEqual(paths('A a\nA b\nO c\nA d\n= q'), ['a·b', 'c·d']);
// O on its own line between AND chains
assert.deepEqual(paths('A a\nA b\nO\nA c\n= q'), ['a·b', 'c']);
// Brackets: A( O s O r ) A t = (s + r)·t ; AN( … ) negates the bracket
assert.deepEqual(paths('A(\nO s\nO r\n)\nA t\n= q'), ['s·t', 'r·t']);
assert.deepEqual(paths('A x\nAN(\nA s\nA r\n)\n= q'), ['x·!s', 'x·!r']);
// U / UN (German) and several assignments from one RLO
const two = net('U a\nUN b\n= q1\n= q2')!;
assert.equal(two.length, 2);
assert.deepEqual(toBranches(two[1].cond), [[{ type: 'NO', address: 'a' }, { type: 'NC', address: 'b' }]]);
// After an assignment the next A starts a new logic operation.
const seq = net('A a\n= q1\nA b\n= q2')!;
assert.deepEqual(toBranches(seq[1].cond), [[{ type: 'NO', address: 'b' }]]);
// Timers, compares, copies, math
assert.deepEqual(net('A pe\nL S5T#2S500MS\nSD T 3')![0].out, { type: 'TMR', address: 'T3', mode: 'ON_DELAY', preset: '2500', unit: 'ms', accumulate: false, resetAddress: null });
assert.deepEqual(net('A x\nL S5T#3M\nSF T 1')![0].out, { type: 'TMR', address: 'T1', mode: 'OFF_DELAY', preset: '3', unit: 'min', accumulate: false, resetAddress: null });
assert.deepEqual(paths('L MW 4\nL 100\n>=I\n= q'), ['MW4>=100']);
assert.deepEqual(net('L MW 4\nT MW 6')![0].out, { type: 'COPY', source: 'MW4', dest: 'MW6' });
assert.deepEqual(net('L MW 4\nL 10\n+I\nT MW 8')![0].out, { type: 'MATH', dest: 'MW8', expression: 'MW4 + 10' });
// Kept whole: jumps, calls, counter loads
assert.equal(net('AN a\nJC SKIP\nCALL "FB1", "DB1"\nSKIP: NOP 0'), null);
assert.equal(net('A b\nL C#50\nS C 1'), null);

// ── Fixture: STEP 7 generated source + the PLC tag table (.sdf) ──
{
  assert.equal(detectFormat('Conveyor_OB1.awl', file('Conveyor_OB1.awl').text), 'siemens-stl');
  const { program } = importProgramFiles([file('Conveyor_OB1.awl'), file('PLC_Tags_Conveyor.sdf')]);
  assert.equal(program.source.format, 'siemens-stl');
  assert.deepEqual(program.io.filter((p) => p.type === 'input').map((p) => p.name), ['Start_PB', 'Stop_PB', 'EStop_OK', 'Product_PE', 'Reset_PB', 'Box_Change', 'Auto_Mode']);
  assert.ok(program.io.some((p) => p.name === 'Drive_Speed_Ref' && p.type === 'output' && p.analog));
  assert.equal(program.report.converted, 7);
  assert.deepEqual(program.report.notConverted.map((n) => [n.kept, n.text.split('\n')[0]]), [[true, 'Rung 5: A     "Product_PE";'], [true, 'Rung 8: AN    "Auto_Mode";']], 'the counter load and the jump network are kept as written');
  const seal = program.program.rungs[0];
  assert.equal(seal.comment, 'Run latch: start, stop (NC) and E-stop');
  assert.equal(seal.branches.length, 2, '(Start + Running) · Stop · E-stop');
  assert.deepEqual(programFindings(planUpgrade(program, 'click').program), [], 'the seal-in is there: nothing to say');
}

console.log('stl.test: all passed');
