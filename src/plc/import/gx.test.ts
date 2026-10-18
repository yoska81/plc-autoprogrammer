/// <reference types="node" />
/**
 * Mitsubishi GX Works CSV (instruction list + device comments): decoding, the LD / AND / OR / ANB / ORB /
 * MPS stack machine, timers and counters, and the double-coil finding on the capper fixture.
 * Run with:  npx tsx src/plc/import/gx.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileText, importProgramFiles } from './index';
import { decodeCsv, gxComments, gxRows, ilBrand, isIlText, readGxCsv, readIlText } from './gxCsv';
import { toBranches } from './cond';
import { planUpgrade, questionsFor } from './upgrade';
import { validateProgram } from '../core/validate';
import { getProfile } from '../core/profiles';
import type { LadderProgram } from '../core/ladder';

const here = dirname(fileURLToPath(import.meta.url));
const file = (n: string) => ({ name: n, text: fileText(n, new Uint8Array(readFileSync(join(here, '__fixtures__', n)))) });

// ── Decoding and rows ──
{
  const utf16 = new Uint8Array([0xff, 0xfe, ...[...'"A"\t"B"'].flatMap((c) => [c.charCodeAt(0), 0])]);
  assert.equal(decodeCsv(utf16), '"A"\t"B"');
  assert.deepEqual(gxRows('"1"\t"x ""q"""\t""\r\n'), [['1', 'x "q"', '']]);
  const c = gxComments('"Device Name"\t"Comment"\n"X7"\t"Warning: cap chute low"\n"M3"\t"Run: machine running"');
  assert.deepEqual(c.get('X7'), { tag: '', comment: 'Warning: cap chute low' }, 'a plain comment does not give a tag name');
  assert.deepEqual(c.get('M3'), { tag: 'Run', comment: 'machine running' });
  assert.deepEqual(gxComments('"Global Device Comment"\n"Device Name"\t"Comment"\n"X0"\t"Start_PB: Start pushbutton"\n"M5"\t"plain text"').get('X0'), { tag: 'Start_PB', comment: 'Start pushbutton' });
}

/** A one-program CSV from instruction rows [step, statement, instruction, device…]. */
const csv = (rows: string[][]) => ['"MAIN"', '"Module Type:FX5UCPU"', '"Step No."\t"Line Statement"\t"Instruction"\t"I/O(Device)"\t"Blank"\t"PI Statement"\t"Note"', ...rows.map((r) => r.map((c) => `"${c}"`).join('\t'))].join('\n');
const rungsOf = (text: string) => readGxCsv(text).routines[0].rungs;

// ── Stack machine ──
{
  // (X0 OR X1) AND (X2 OR X3) → Y0 (ANB); then X4 AND X5 OR (X6 AND X7) → Y1 (ORB).
  const r = rungsOf(csv([
    ['0', '', 'LD', 'X0'], ['1', '', 'OR', 'X1'], ['2', '', 'LD', 'X2'], ['3', '', 'OR', 'X3'], ['4', '', 'ANB', ''], ['5', '', 'OUT', 'Y0'],
    ['6', '', 'LD', 'X4'], ['7', '', 'AND', 'X5'], ['8', '', 'LD', 'X6'], ['9', '', 'AND', 'X7'], ['10', '', 'ORB', ''], ['11', '', 'OUT', 'Y1'],
    ['12', '', 'LD<>', 'D0'], ['', '', '', 'K3'], ['15', '', 'INV', ''], ['16', '', 'OUT', 'Y2'],
    ['17', '', 'END', ''],
  ]));
  assert.equal(r[0].branches.length, 4, '(X0+X1)(X2+X3) = 4 paths');
  assert.deepEqual(r[1].branches, [[{ type: 'NO', address: 'X4' }, { type: 'NO', address: 'X5' }], [{ type: 'NO', address: 'X6' }, { type: 'NO', address: 'X7' }]]);
  assert.deepEqual(r[2].branches, [[{ type: 'CMP', left: 'D0', op: '==', right: '3' }]], 'INV of <> is =');
}
{
  // MPS / MRD / MPP: X0 then three branches; OUT T0 K5 = 0.5 s; MOV with its second operand on the next row; PLS.
  const r = rungsOf(csv([
    ['0', 'Branches', 'LD', 'X0'], ['1', '', 'MPS', ''], ['2', '', 'AND', 'X1'], ['3', '', 'OUT', 'Y0'], ['4', '', 'MRD', ''], ['5', '', 'AND', 'X2'], ['6', '', 'OUT', 'T0'], ['', '', '', 'K5'],
    ['9', '', 'MPP', ''], ['10', '', 'ANI', 'X3'], ['11', '', 'MOV', 'K500'], ['', '', '', 'D0'],
    ['14', '', 'LD', 'X4'], ['15', '', 'PLS', 'M1'], ['16', '', 'END', ''],
  ]));
  const outs = r.flatMap((g) => g.outputs.map((o) => ({ o, b: g.branches })));
  assert.deepEqual(outs[0].b, [[{ type: 'NO', address: 'X0' }, { type: 'NO', address: 'X1' }]]);
  assert.deepEqual(outs[1].o, { type: 'TMR', address: 'T0', mode: 'ON_DELAY', preset: '500', unit: 'ms', accumulate: false, resetAddress: null });
  assert.deepEqual(outs[2], { o: { type: 'COPY', source: '500', dest: 'D0' }, b: [[{ type: 'NO', address: 'X0' }, { type: 'NC', address: 'X3' }]] });
  assert.equal(r[0].comment, 'Branches');
  assert.ok(outs.some((x) => x.o.type === 'OUT' && x.o.address === 'M1' && x.b[0][0].type === 'RISE'), 'PLS = one scan on the rising edge');
  assert.deepEqual(toBranches({ k: 'true' }), [[]]);
}
{
  // Unknown instruction: kept as written.
  const r = rungsOf(csv([['0', '', 'LD', 'X0'], ['1', '', 'DSZR', 'D0'], ['', '', '', 'Y0'], ['5', '', 'END', '']]));
  assert.deepEqual(r[0].outputs, [{ type: 'RAW', vendor: 'mitsubishi-fx', text: 'LD X0\nDSZR D0 Y0' }], 'the whole rung is kept as written');
  assert.deepEqual(r[0].branches, []);
}

// ── Side manager's counter-examples: truth tables ──
{
  /** Value of each output of the rungs for every combination of X0…X3. */
  const table = (rows: string[][]) => {
    const rungs = rungsOf(csv(rows));
    const outs = new Map<string, boolean[]>();
    for (let m = 0; m < 16; m++) {
      const v = (a: string) => (/^X(\d)$/.test(a) ? Boolean(m & (1 << Number(a.slice(1)))) : false);
      for (const r of rungs) for (const o of r.outputs) {
        if (o.type !== 'OUT') continue;
        const on = r.branches.length === 0 || r.branches.some((b) => b.every((e) => ('address' in e ? (e.type === 'NC' ? !v(e.address) : v(e.address)) : false)));
        outs.set(o.address, [...(outs.get(o.address) ?? []), on]);
      }
    }
    return outs;
  };
  const expect = (f: (x: boolean[]) => boolean) => Array.from({ length: 16 }, (_, m) => f([0, 1, 2, 3].map((i) => Boolean(m & (1 << i)))));
  // #6: MPP then LD … ANB: Y1 = X0 · (X2 + X3), not X2 + X3.
  const t6 = table([['0', '', 'LD', 'X0'], ['1', '', 'MPS', ''], ['2', '', 'AND', 'X1'], ['3', '', 'OUT', 'Y0'], ['4', '', 'MPP', ''], ['5', '', 'LD', 'X2'], ['6', '', 'OR', 'X3'], ['7', '', 'ANB', ''], ['8', '', 'OUT', 'Y1'], ['9', '', 'END', '']]);
  assert.deepEqual(t6.get('Y0'), expect(([a, b]) => a && b));
  assert.deepEqual(t6.get('Y1'), expect(([a, , c, d]) => a && (c || d)), 'MPP … LD … ANB keeps the stacked condition');
  // #7: an instruction the reader doesn't know: never Y0 = X0; the rung is kept whole.
  for (const unknown of [['DAND>', 'D0'], ['LD&', 'D0'], ['LD|', 'D0'], ['DLD>', 'D0']]) {
    const r = rungsOf(csv([['0', '', 'LD', 'X0'], ['1', '', unknown[0], unknown[1]], ['', '', '', 'K5'], ['4', '', 'OUT', 'Y0'], ['5', '', 'END', '']]));
    const kept = r.every((g) => g.outputs.every((o) => o.type === 'RAW'));
    const compared = r.some((g) => g.branches.flat().some((e) => e.type === 'CMP'));
    assert.ok(kept || compared, `${unknown[0]}: kept as written or read as a compare, never dropped (${JSON.stringify(r)})`);
  }
  assert.ok(rungsOf(csv([['0', '', 'LD', 'X0'], ['1', '', 'LD&', 'D0'], ['', '', '', 'K5'], ['4', '', 'ANB', ''], ['5', '', 'OUT', 'Y0'], ['6', '', 'END', '']]))[0].outputs[0].type === 'RAW');
  // A 32-bit compare is read: DAND> D0 K5.
  const dand = rungsOf(csv([['0', '', 'LD', 'X0'], ['1', '', 'DAND>', 'D0'], ['', '', '', 'K5'], ['4', '', 'OUT', 'Y0'], ['5', '', 'END', '']]));
  assert.deepEqual(dand[0].branches, [[{ type: 'NO', address: 'X0' }, { type: 'CMP', left: 'D0', op: '>', right: '5' }]]);
}

// ── #8: timer bases per brand and number ──
{
  const tmr = (text: string) => readIlText(text).routines[0].rungs.flatMap((r) => r.outputs).filter((o) => o.type === 'TMR');
  assert.deepEqual(tmr('; ISPSoft DVP\nLD X0\nTMR T200 K50\nLD X1\nTMR T0 K50\nEND').map((o) => o.type === 'TMR' ? `${o.preset} ${o.unit}` : ''), ['500 ms', '5 sec'], 'Delta T200 = 10 ms');
  const xin = tmr('; XDPPro XD5\nLD X0\nOUT T200 K50\nLD X1\nOUT T150 K50\nEND');
  assert.deepEqual(xin.map((o) => o.type === 'TMR' ? `${o.preset} ${o.unit} ${o.accumulate}` : ''), ['500 ms false', '5 sec true'], 'Xinje: T200 10 ms, T100–T199 retentive');
  assert.deepEqual(tmr('; AutoShop H3U\nLD X0\nOUT T246 K50\nEND').map((o) => o.type === 'TMR' ? `${o.preset} ${o.unit}` : ''), ['50 ms'], 'Inovance T246 = 1 ms');
  assert.match(readIlText('; ISPSoft DVP\nLD X0\nTMR T200 K50\nEND').notes.join(' '), /T200 10 ms/);
}

// ── Octal I/O: X8 is not a terminal ──
{
  const p = readIlText('; ISPSoft DVP\nLD X8\nOUT Y0\nEND');
  assert.ok(!p.tags.find((t) => t.address === 'X8')?.io);
  assert.ok(p.notes.some((n) => /X8 is not a valid input address/.test(n)));
}

// ── The capper (GX Works3: UTF-16 LE, tabs, quotes) with its device comments ──
{
  const { program: imp } = importProgramFiles([file('CAPPER_MAIN.csv'), file('CAPPER_DeviceComment.csv')]);
  assert.equal(imp.source.format, 'mitsubishi-csv');
  assert.equal(imp.source.controller, 'FX5UCPU');
  assert.equal(imp.io.length, 24, '16 inputs and 8 outputs');
  assert.deepEqual(imp.io.find((p) => p.original === 'X1'), { name: 'Stop_PB', description: 'Stop pushbutton (NC, ON = not pressed)', type: 'input', original: 'X1', analog: false, confidence: 'high' });
  assert.equal(imp.report.notConverted.length, 0);
  assert.equal(imp.report.converted, imp.report.rungs);
  // The planted double coil, with the steps of both rungs.
  const dc = imp.report.notes.find((n) => /^Double coil: Spindle \(Y4\)/.test(n));
  assert.ok(dc, 'double coil on Y4 found');
  assert.match(dc!, /steps 117 and 121/);
  assert.ok(questionsFor(imp).some((q) => /Double coil: Spindle/.test(q)), 'asked on the Machine description page');
  const plan = planUpgrade(imp, 'click');
  const issues = validateProgram(plan.program as LadderProgram, getProfile(plan.plcId), new Set());
  assert.ok(issues.some((i) => /double coil/.test(i.message)), 'and the program checker reports it');
  // RST C0 / RST C1 rungs become the counters' reset inputs (no false "no reset").
  const good = plan.program.tags.find((t) => t.nickname === 'Good_Count')!.address;
  const cnt = plan.program.rungs.flatMap((r) => r.outputs).find((o) => o.type === 'CNT' && o.address === good);
  assert.ok(cnt && cnt.type === 'CNT' && cnt.resetAddress, 'RST C0 is the counter\'s reset input');
  assert.ok(!issues.some((i) => new RegExp(`Counter ${good} has no reset`).test(i.message)), 'no false "no reset"');
  assert.ok(!plan.program.rungs.some((r) => r.outputs.some((o) => o.type === 'RST' && o.address === good)), 'the RST is not kept as well');
  // On a CLICK no nickname reads like an address.
  const bad = plan.program.tags.filter((t) => /^(X|Y|C|T|CT|SC|DS|DD|DF|M|D|SM)\d+$/i.test(t.nickname));
  assert.deepEqual(bad, [], 'no address-like CLICK nicknames');
  // Timer and counter names from the comments; the batch compare uses the counter's value.
  const nick = new Map(imp.program.tags.map((t) => [t.nickname, t.address]));
  assert.match(nick.get('Bottle_Tmr')!, /^T\d+$/);
  assert.match(nick.get('Good_Count')!, /^CT\d+$/);
  assert.ok(imp.program.rungs.some((r) => r.branches[0]?.[0]?.type === 'CMP' && /^CTD\d+$/.test((r.branches[0][0] as { left: string }).left)), 'LD>= C0 D0 compares the count');
}

// Siemens: the PLC tag table gives the SCL source its inputs and outputs.
{
  const { program } = importProgramFiles([file('Mixer.scl'), file('PLC_Tags_Mixer.csv')]);
  assert.deepEqual(program.io.map((p) => `${p.name}:${p.type}:${p.original}`), ['Lid_Closed:input:%IX0.2', 'Tank_Low:input:%IX0.3', 'Level_High:input:%IX0.4', 'Level_Low:input:%IX0.5', 'Fill_Valve:output:%QX0.0', 'Agitator:output:%QX0.1', 'Drain_Valve:output:%QX0.2']);
  assert.equal(program.io[0].description, 'Mixer lid closed (safety switch)');
  assert.ok(!program.report.notes.some((n) => /add the PLC tag table/.test(n)));
  assert.throws(() => importProgramFiles([file('PLC_Tags_Mixer.csv')]), /PLC tag table: add the program/);
}

// ── Delta / Inovance / Xinje: instruction list as text, with the device comment list ──
{
  const { program } = importProgramFiles([file('delta_conveyor_il.txt'), file('delta_conveyor_comments.csv')]);
  assert.equal(program.source.format, 'il-text');
  assert.equal(program.source.vendor, 'Delta');
  assert.equal(program.source.controller, 'DVP-14SS2');
  assert.deepEqual(program.io.map((p) => `${p.name}:${p.type}`), ['Start_PB:input', 'Stop_PB:input', 'Case_PE:input', 'Reset_PB:input', 'Conveyor:output', 'Seal_Head:output', 'Batch_Lamp:output']);
  assert.equal(program.report.converted, program.report.rungs);
  const nick = new Map(program.program.tags.map((t) => [t.nickname, t.address]));
  const outs = program.program.rungs.flatMap((r) => r.outputs);
  assert.ok(outs.some((o) => o.type === 'TMR' && o.address === nick.get('Seal_Delay') && o.preset === '1500' && o.unit === 'ms'), 'TMR T0 K15 = 1.5 s');
  assert.ok(outs.some((o) => o.type === 'CNT' && o.address === nick.get('Case_Count') && o.preset === '200' && o.resetAddress), 'CNT with its reset rung linked');
  assert.equal(program.program.rungs[0].comment, 'Network 1: run latch');
  // Brands and detection.
  assert.equal(ilBrand('; AutoShop V4 H3U\nLD X0\nOUT Y0').vendor, 'Inovance');
  assert.equal(ilBrand('; XDPPro XD5-32T\nLD X0\nOUT Y0').vendor, 'Xinje');
  assert.ok(isIlText(file('delta_conveyor_il.txt').text));
  assert.ok(!isIlText(file('Mixer.scl').text) && !isIlText(file('CAPPER_DeviceComment.csv').text));
  const inv = readIlText('; AutoShop H5U\nLD X0\nANI X1\nOUT T5 K30\nLD T5\nDSZR D0 Y0\nEND');
  assert.deepEqual(inv.routines[0].rungs.flatMap((r) => r.outputs).map((o) => o.type), ['TMR', 'RAW']);
  assert.ok(inv.routines[0].rungs.flatMap((r) => r.outputs).some((o) => o.type === 'RAW' && o.vendor === 'inovance'));
}

// A device comment file alone is explained.
assert.throws(() => importProgramFiles([file('CAPPER_DeviceComment.csv')]), /add the program CSV/);

console.log('gx.test: all passed');
