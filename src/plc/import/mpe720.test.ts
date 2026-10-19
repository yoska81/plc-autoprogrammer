/// <reference types="node" />
/**
 * Yaskawa MPE720 (.YMW7) and Weintek EasyBuilder Pro (.emtp): the 7z / LZMA reader, the compiled ladder
 * decoded into rungs (branches, timers, compares, IF blocks, math, pulses, calls, unknown codes kept as
 * boxes), the project's I/O and the touch panel's screens and addresses. The project is the synthetic
 * one tools/fixtures/make_ymw7_fixture.py builds.
 * Run with:  npx tsx src/plc/import/mpe720.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSevenZip, readSevenZip } from './sevenZip';
import { decodeDrawing, isYmw7, readComments, readYmw7, register, steps } from './mpe720';
import { readEmtp } from './emtp';
import { importProgramFiles } from './index';
import { runParse } from '../../workers/parseOps';
import type { LadderElement, LadderOutput, Rung } from '../core/ladder';

const here = dirname(fileURLToPath(import.meta.url));
const ymw = new Uint8Array(readFileSync(join(here, '__fixtures__', 'demo_mp.YMW7')));

const fe = (e: LadderElement) => (e.type === 'CMP' ? `[${e.left}${e.op}${e.right}]` : e.type === 'RAW' ? `{${e.text}}` : `${e.type === 'NO' ? '' : `${e.type}:`}${e.address}`);
const fo = (o: LadderOutput) => (o.type === 'RAW' ? `{${o.text}}` : o.type === 'COPY' ? `${o.dest}:=${o.source}` : o.type === 'MATH' ? `${o.dest}:=${o.expression}` : o.type === 'TMR' ? `TMR ${o.address} ${o.preset}${o.unit}` : `${o.type} ${o.address}`);
const show = (r: Rung) => `${r.branches.map((b) => b.map(fe).join(' ')).join(' | ')} => ${r.outputs.map(fo).join(', ')}`;

// 7z with LZMA, behind the MPE720 header
{
  assert.ok(isYmw7('demo.YMW7', ymw));
  const at = findSevenZip(ymw);
  assert.equal(at, 38);
  const files = readSevenZip(ymw, at).map((f) => f.name);
  assert.ok(files.includes('PLC_0001/PRG/DWGH/$GH01'));
  assert.ok(files.includes('PLC_0001/CMT/CIREG/IB$$$00.CMT'));
  const ib = readSevenZip(ymw, at).find((f) => f.name.endsWith('IB$$$00.CMT'))!;
  assert.match(new TextDecoder().decode(ib.data), /^IB00000 \.Start button/);
  console.log('7z / LZMA: ok');
}

// register operands: I/O in hex words, M and D in decimal words, bit in hex, local D carries the drawing
{
  assert.equal(register(Uint8Array.from([1, 0xa, 0x10, 0x00]), 1, 'H01').name, 'IB0010A');
  assert.equal(register(Uint8Array.from([3, 0, 0xd2, 0x04]), 1, 'H01').name, 'MB012340');
  assert.equal(register(Uint8Array.from([3, 0x20, 0xf4, 0x01]), 1, 'H01').name, 'ML00500');
  assert.equal(register(Uint8Array.from([5, 0x10, 2, 0]), 1, 'H01_02').name, 'H01_02_DW00002');
  assert.equal(register(Uint8Array.from([3, 0x10, 0x2c, 0x01]), 0x11, 'H01').name, 'MW00300i');
  assert.deepEqual([...readComments('IB00000 .Start\r\nIB00001 .\r\nnoise\r\nMW00010 .Count\r\n')], [['IB00000', 'Start'], ['MW00010', 'Count']]);
  console.log('registers / comments: ok');
}

// the drawings
const fp = readYmw7(ymw, 'demo_mp.YMW7');
{
  assert.equal(fp.vendor, 'Yaskawa');
  assert.equal(fp.controller, 'CPU-DEMO(4axes)');
  assert.deepEqual(fp.modules, [{ slot: 0, catalog: 'DEMOCPU' }, { slot: 2, catalog: 'DEMOIO' }]);
  assert.equal(fp.summary.drawings, 2);
  assert.ok(fp.notes.some((n) => /SGDEMO-AMP01 with motor SGMDEMO-MOT01/.test(n)));
  assert.match(fp.notes[0], /2 ladder drawings, \d+ steps; \d+ read into rungs .*0xaf ×1/);
  assert.ok(fp.routines.some((r) => r.name === 'MPM001 motion program' && /MOV \[A1\]1000/.test(r.untranslated[0])));

  const h01 = fp.routines.find((r) => r.origin?.routine === 'H01')!;
  assert.equal(h01.name, 'H01 Demo conveyor');
  assert.deepEqual(h01.rungs.map(show), [
    'IB00000 NC:IB00001 | MB001000 NC:IB00001 => OUT MB001000',
    'MB001000 => TMR H01_DW00001 5000ms',
    'H01_DW00001.DN => OUT OB00000',
    '[MW00010>100] => OUT OB00001',
    'IB00002 => MW00010:=0',
    ' => MW00011:=MW00010 + 1',
    'IB00003 => OUT H01_DB000000',
    'RISE:H01_DB000000 => SET MB002000',
    ' => {SEE H01.01}, {Unknown instruction (step 25, code 0xaf) MW00020, MW00030, #5}',
  ]);
  const sub = fp.routines.find((r) => r.origin?.routine === 'H01.01')!;
  // two rungs that share the branch point after "Run"
  assert.deepEqual(sub.rungs.map(show), ['MB001000 MB002000 => OUT OB00002', 'MB001000 NC:MB002000 => OUT OB00003']);
  console.log('drawings: ok');
}

// rows that join (OR) and a 3-row parallel block: Run & (A | !B | C)
{
  const code = Uint8Array.from([
    0x24, 1, 3, 0, 100, 0, // Run (starts the rung)
    0x26, 1, 1, 0, 0, 0, // A: first row of a block
    0x2f, 1, 1, 1, 0, 0, // !B: middle row (joins the row above, another row follows)
    0x21, 1, 1, 2, 0, 0, // C: last row
    0x50, 1, 2, 0, 0, 0, // OUT
    0x07, 0,
  ]);
  const r = decodeDrawing('H02', '', steps(code));
  assert.deepEqual(r.routine.rungs.map(show), ['MB001000 IB00000 | MB001000 NC:IB00001 | MB001000 IB00002 => OUT OB00000']);
  assert.equal(r.unknown.length, 0);
  console.log('branches: ok');
}

// the whole import: I/O from the comments, with the program
{
  const { program, main } = importProgramFiles([{ name: 'demo_mp.YMW7', text: '', bytes: ymw }]);
  assert.equal(main.text, '');
  assert.equal(program.source.format, 'yaskawa-mpe720');
  const io = program.io.map((p) => `${p.type} ${p.original} ${p.description}`).sort();
  assert.deepEqual(io, [
    'input IB00000 Start button', 'input IB00001 Stop button', 'input IB00002 Reset button', 'input IB00003 Count sensor',
    'output OB00000 Run lamp', 'output OB00001 Horn', 'output OB00002 Done lamp', 'output OB00003 Busy lamp',
  ]);
  assert.ok(program.program.rungs.length >= 10);
  // the parse worker takes the bytes as they are
  const viaWorker = runParse({ op: 'program', files: [{ name: 'demo_mp.YMW7', text: '', bytes: ymw }] });
  assert.equal(viaWorker.program.io.length, 8);
  console.log('import: ok');
}

// Weintek EasyBuilder Pro: screens and Memobus addresses
{
  const MEMO = 'Memobus (Yaskawa MP Series Controllers)';
  const cs = (s: string) => [0xff, 0xfe, 0xff, s.length, ...[...s].flatMap((ch) => [ch.charCodeAt(0), 0])];
  const u32 = (v: number) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, v >>> 24];
  const bytes = Uint8Array.from([
    0xa9, 0, 0, 0, ...cs('5.07.01'), 0, 0, 0, 0,
    ...cs('Main'), ...u32(800), ...u32(480), ...u32(0), ...u32(0),
    ...cs('Alarms'), ...u32(800), ...u32(480), ...u32(0), ...u32(0),
    ...cs('Local HMI'), ...cs(MEMO), 0, 0, 0, 0, 0x00, 0x05, ...cs('0'), ...cs('237'),
    ...cs('Local HMI'), ...cs(MEMO), 0, 0, 0x00, 0x0b, ...cs('0'), ...cs('10'),
    ...cs(MEMO), 0, 0, 0x0c, ...cs('500'),
  ]);
  const hmi = readEmtp(bytes);
  assert.equal(hmi.version, '5.07.01');
  assert.deepEqual(hmi.drivers, [MEMO]);
  assert.deepEqual(hmi.screens, ['Main', 'Alarms']);
  assert.deepEqual([...hmi.addresses.keys()], ['MB000237', 'MW00010', 'ML00500']);
  const { program } = importProgramFiles([{ name: 'demo_mp.YMW7', text: '', bytes: ymw }, { name: 'panel.emtp', text: '', bytes }]);
  assert.ok(program.report.notes.some((n) => /Touch panel .*2 screens \(Main, Alarms\)/.test(n)));
  assert.ok(program.report.notes.some((n) => /3 PLC addresses: 1 of them appear in the ladder/.test(n)));
  assert.throws(() => importProgramFiles([{ name: 'panel.emtp', text: '', bytes }]), /touch-panel project/);
  console.log('emtp: ok');
}

console.log('mpe720: all ok');
