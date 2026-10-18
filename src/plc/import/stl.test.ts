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
import { el, not, toBranches } from './cond';
import { fileText, importProgramFiles, detectFormat } from './index';
import { programFindings } from './findings';
import { planUpgrade } from './upgrade';
import { getCpu, getProfile } from '../core/profiles';
import { resolveAddresses } from '../core/profile';
import { moduleSlots } from '../core/modules';
import { siemensAddress } from '../core/profiles/siemens';
import type { IOPoint } from '../../types/io';

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
// The accumulators (review #1): L MW10 / L MW12 / +I / L 2 / *I / T MW14 is MW14 := (MW10 + MW12) * 2.
{
  const out = net('L MW 10\nL MW 12\n+I\nL 2\n*I\nT MW 14')![0].out;
  assert.equal(out.type, 'MATH');
  const expr = out.type === 'MATH' ? out.expression : '';
  for (const [a, b] of [[0, 0], [1, 2], [7, -3], [100, 5]]) {
    const got = Function(`return ${expr.replace(/MW10/g, String(a)).replace(/MW12/g, String(b))}`)() as number;
    assert.equal(got, (a + b) * 2, `${expr} with MW10=${a} MW12=${b}`);
  }
  // A compare of a computed value ((MW10 + 5) > MW20) has no ladder form: kept whole, never the last two loads.
  assert.equal(net('L MW 10\nL 5\n+I\nL MW 20\n>I\n= q'), null);
  // ACCU2 after an arithmetic instruction is not relied on.
  assert.equal(net('L MW 10\nL MW 12\n+I\n+I\nT MW 14'), null);
  // L T 1 / L C 1 load the time / count value.
  assert.deepEqual(net('L C 1\nT MW 6')![0].out, { type: 'COPY', source: 'C1.ACC', dest: 'MW6' });
}
// A counter as a contact (review #2): A C1 is "count is not 0", AN C1 is "count is 0".
assert.deepEqual(paths('A C 1\n= q'), ['C1.ACC<>0']);
assert.deepEqual(net('AN C 1\n= q')![0].cond, not(el({ type: 'CMP', left: 'C1.ACC', op: '<>', right: '0' })));
// SET / CLR end the logic operation: the next A starts a new one.
{
  const d = net('A x\n= q1\nSET\nO a\nA b\n= q2')!;
  assert.deepEqual(toBranches(d[1].cond), [[{ type: 'NO', address: 'a' }, { type: 'NO', address: 'b' }]], 'O a after SET is a first check, not TRUE + a');
}
// FP with its edge memory: the edge is kept, and a note says the memory bit is no longer written.
{
  const notes: string[] = [];
  const d = convertStlNetwork(['A start', 'FP M 0.0', '= pulse'], notes)!;
  assert.deepEqual(toBranches(d[0].cond), [[{ type: 'RISE', address: 'start' }]]);
  assert.match(notes[0], /FP M0\.0: the edge of start is kept, but its edge memory bit is no longer written/);
}
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

// Review: MD is never narrowed to Int: DInt, or Real when the network does Real maths.
{
  const src = (body: string) => `ORGANIZATION_BLOCK OB1\nBEGIN\nNETWORK\nTITLE =\n${body}\nEND_ORGANIZATION_BLOCK\n`;
  const { program } = importProgramFiles([{ name: 'r.awl', text: src('L MD 20\nL 2.5\n*R\nT MD 24\nNETWORK\nTITLE =\nL MD 30\nT MD 34') }]);
  const at = (n: string) => program.program.tags.find((t) => t.nickname === n)?.address ?? '';
  assert.match(at('MD20'), /^DF\d+$/);
  assert.match(at('MD24'), /^DF\d+$/);
  assert.match(at('MD30'), /^DD\d+$/);
  assert.ok(program.report.notes.some((n) => /MD30: the source does not say its type; read as a DInt/.test(n)));
}

// Review: an S7 program going back on an S7 keeps its I/O bits (%Q0.2 stays %Q0.2, not the first free %Q0.0).
{
  const { program: imp } = importProgramFiles([{ name: 'q.awl', text: 'ORGANIZATION_BLOCK OB1\nBEGIN\nNETWORK\nTITLE =\nA I 0.5\n= Q 0.2\nEND_ORGANIZATION_BLOCK\n' }]);
  const plan = planUpgrade(imp, 'click');
  assert.equal(plan.plcId, 'siemens-s7');
  const profile = getProfile('siemens-s7');
  const cpu = getCpu(profile, plan.cpuId);
  let i = 0, q = 0;
  const io: IOPoint[] = plan.io.map((p) => ({ ...p, id: p.type === 'input' ? `I${String(++i).padStart(3, '0')}` : `Q${String(++q).padStart(3, '0')}` }));
  const addr = resolveAddresses(profile, cpu, io, moduleSlots(plan.modules));
  assert.deepEqual(io.map((p) => siemensAddress(addr.get(p.id)!, cpu, moduleSlots(plan.modules))?.address), ['%I0.5', '%Q0.2']);
}

console.log('stl.test: all passed');
