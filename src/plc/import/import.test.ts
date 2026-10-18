/// <reference types="node" />
/**
 * "Upgrade existing program": reading real export formats into the app's program.
 * Fixtures in src/plc/import/__fixtures__ are realistic exports of running machines.
 * Run with:  npx tsx src/plc/import/import.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectFormat, importProgramText, materialize, unreadableReason } from './index';
import { convertLogixRung, parseRungText } from './logixText';
import { convertSt, timeMs } from './st';
import { and, el, or, toBranches } from './cond';
import { parseXml, kid, textOf } from './xml';
import type { LadderOutput, LadderProgram, Rung } from '../core/ladder';
import { logixProfile, LOGIX_CPUS } from '../core/profiles/logix';
import { clickProfile } from '../core/profiles/click';
import { buildL5x } from '../core/profiles/l5x';
import { validateProgram } from '../core/validate';
import type { ModuleSlot } from '../core/profile';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (f: string) => readFileSync(join(here, '__fixtures__', f), 'utf8');
const outs = (p: LadderProgram) => p.rungs.flatMap((r) => r.outputs);
const find = (p: LadderProgram, pred: (r: Rung) => boolean) => p.rungs.find(pred);
const writes = (r: Rung, a: string) => r.outputs.some((o) => 'address' in o && o.address === a || 'dest' in o && o.dest === a);

// ── Small pieces ──
{
  const x = parseXml('<a x="1&amp;2"><b><![CDATA[ <c> ]]></b><!-- no --><d/>t&lt;</a>');
  const a = kid(x, 'a')!;
  assert.equal(a.attrs.x, '1&2');
  assert.equal(textOf(kid(a, 'b')), ' <c> ');
  assert.equal(a.text, 't<');
  assert.equal(timeMs('T#1m30s500ms'), 90_500);
  assert.equal(timeMs('TIME#4S500MS'), 4500);
  // (a OR b) AND c → two branches; NOT of an edge cannot be drawn.
  const ab = and(or(el({ type: 'NO', address: 'a' }), el({ type: 'NO', address: 'b' })), el({ type: 'NC', address: 'c' }));
  assert.deepEqual(toBranches(ab), [[{ type: 'NO', address: 'a' }, { type: 'NC', address: 'c' }], [{ type: 'NO', address: 'b' }, { type: 'NC', address: 'c' }]]);
}

// ── Logix rung text ──
{
  assert.equal(parseRungText('XIC(a)[XIO(b),XIC(c)XIC(d)]OTE(e);').length, 3);
  // Outputs inside a branch, conditions after outputs, nested branches.
  const r = convertLogixRung('XIC(Run)[OTE(Lamp),XIC(Fast)OTE(Fan),[XIC(A),XIC(B)]TON(T1,2500,0)];');
  assert.deepEqual(r.driven.map((d) => d.out.type), ['OUT', 'OUT', 'TMR']);
  const tmr = r.driven[2].out as Extract<LadderOutput, { type: 'TMR' }>;
  assert.equal(tmr.preset, '2500'); assert.equal(tmr.unit, 'ms');
  assert.deepEqual(toBranches(r.driven[2].cond), [[{ type: 'NO', address: 'Run' }, { type: 'NO', address: 'A' }], [{ type: 'NO', address: 'Run' }, { type: 'NO', address: 'B' }]]);
  // ONS → rising edge; LIM → two compares; CMP expression; ADD → MATH; unknown → untranslated.
  const o = convertLogixRung('XIC(PB)ONS(Store)LIM(10,Lvl,90)CMP(Speed>=Max)ADD(Count,1,Count)MSG(M1);');
  assert.deepEqual(toBranches(o.driven[0].cond), [[{ type: 'RISE', address: 'PB' }, { type: 'CMP', left: 'Lvl', op: '>=', right: '10' }, { type: 'CMP', left: 'Lvl', op: '<=', right: '90' }, { type: 'CMP', left: 'Speed', op: '>=', right: 'Max' }]]);
  assert.deepEqual(o.driven[0].out, { type: 'MATH', dest: 'Count', expression: 'Count + 1' });
  assert.deepEqual(o.untranslated, ['MSG(M1)']);
  assert.throws(() => parseRungText('XIC(a OTE(b);'), /missing/);
}

// ── Structured Text ──
{
  const types = new Map([['t1', 'TON'], ['trig', 'R_TRIG'], ['step', 'INT'], ['lamp', 'BOOL']]);
  const st = convertSt(`
    Trig(CLK := Start);
    IF Trig.Q AND NOT Fault THEN Step := 10; END_IF;
    CASE Step OF
      10: Valve := TRUE;
          T1(IN := TRUE, PT := T#2S);
          IF T1.Q THEN Step := 20; END_IF;
      20, 30: Valve := FALSE;
      40..50: Lamp := Level > 80.5;
    ELSE Step := 0;
    END_CASE;
    WHILE x < 10 DO x := x + 1; END_WHILE;
  `, 'st', { types });
  const rs = st.rungs;
  assert.ok(rs.some((r) => r.branches[0]?.[0]?.type === 'RISE' && writes(r, 'Step')), 'R_TRIG.Q becomes a rising-edge contact');
  assert.ok(rs.some((r) => r.outputs.some((x) => x.type === 'TMR' && x.address === 'T1' && x.preset === '2' && x.unit === 'sec')), 'TON call → timer, T#2S = 2 sec');
  assert.ok(rs.some((r) => r.outputs.some((x) => x.type === 'SET' && x.address === 'Valve')) && rs.some((r) => r.outputs.some((x) => x.type === 'RST' && x.address === 'Valve')), 'TRUE / FALSE in CASE → SET / RST');
  const range = rs.find((r) => r.outputs.some((x) => x.type === 'SET' && x.address === 'Lamp'))!;
  assert.deepEqual(range.branches[0].slice(0, 2), [{ type: 'CMP', left: 'Step', op: '>=', right: '40' }, { type: 'CMP', left: 'Step', op: '<=', right: '50' }], 'CASE range label');
  assert.ok(rs.some((r) => r.outputs.some((x) => x.type === 'COPY' && x.dest === 'Step' && x.source === '0') && r.branches.length > 0 && r.branches.every((b) => b.some((e) => e.type === 'CMP' && e.left === 'Step' && e.op === '<>' && e.right === '10'))), 'CASE ELSE: none of the labels');
  assert.equal(st.untranslated.length, 1, 'the WHILE loop is reported, nothing else');
}

// ── Detection and native files ──
assert.equal(detectFormat('x.L5X', fixture('capper.L5X')), 'l5x');
assert.equal(detectFormat('x.L5K', fixture('palletizer.L5K')), 'l5k');
assert.equal(detectFormat('x.xml', fixture('filler_plcopen.xml')), 'plcopen');
assert.equal(detectFormat('Mixer.scl', fixture('Mixer.scl')), 'siemens-scl');
assert.equal(detectFormat('names.csv', fixture('click_nicknames.csv')), 'click-csv');
assert.match(unreadableReason('Line2.ACD', 'x')!, /L5X/);
assert.match(unreadableReason('machine.ckp', 'x')!, /Print/);
assert.match(unreadableReason('prog.bin', 'PK\u0003\u0004\u0000\u0000')!, /not a text export/);
assert.throws(() => importProgramText('notes.txt', 'hello world'), /not recognised/);

// ── L5X: CompactLogix bottle capper ──
const capper = importProgramText('capper.L5X', fixture('capper.L5X'));
{
  assert.equal(capper.source.controller, '1769-L33ER');
  assert.equal(capper.source.projectName, 'Bottle_Capper_L2');
  const ins = capper.io.filter((p) => p.type === 'input'), outsIo = capper.io.filter((p) => p.type === 'output');
  assert.equal(ins.length, 9, '8 digital inputs (7 aliases + 1 used directly) + 1 analog');
  assert.equal(outsIo.length, 5, '4 aliases + the stack light used directly');
  assert.equal(capper.io.find((p) => p.name === 'Start_PB')?.description, 'Start pushbutton (green, NO)', 'alias takes the module point comment');
  assert.equal(capper.io.find((p) => p.name === 'Bottle_PE')?.description, 'Bottle present under the capper', 'own description wins');
  assert.equal(capper.io.find((p) => p.original === 'Local:1:I.Data.7')?.description, 'Guard door closed (SW-205)', 'module point used directly in a rung');
  assert.ok(capper.io.find((p) => p.name === 'Torque_Raw')?.analog, 'analog channel');
  assert.equal(capper.report.converted, 19);
  assert.deepEqual(capper.report.notConverted.map((n) => n.text), ['Rung 10: MSG(Line_Msg)'], 'only the MSG instruction is not converted');
  assert.ok(capper.report.notes.some((n) => /JSR/.test(n)), 'subroutine calls explained');
  assert.deepEqual(capper.program.blocks!.map((b) => b.name), ['Modes', 'Sequence', 'Alarms', 'Scaling']);
  const nick = new Map(capper.program.tags.map((t) => [t.nickname, t.address]));
  assert.match(nick.get('Step')!, /^DD\d+$/, 'DINT → DD');
  assert.match(nick.get('Torque_Nm')!, /^DF\d+$/, 'REAL → DF');
  assert.match(nick.get('Capper.Torque_SP')!, /^DF\d+$/, 'UDT member keeps its type');
  assert.match(nick.get('Spin_Tmr')!, /^T\d+$/);
  assert.match(nick.get('Bottle_Count')!, /^CT\d+$/);
  // The seal-in rung: (Start rising OR Running) AND permissives.
  const run = nick.get('Machine_Running')!;
  const seal = find(capper.program, (r) => writes(r, run))!;
  assert.equal(seal.branches.length, 2);
  assert.equal(seal.branches[0][0].type, 'RISE', 'XIC + ONS → rising edge');
  assert.equal(seal.comment, 'Machine run: start with all permissives, seal in, stop on stop PB, E-stop or fault');
  // Timer done bits and the spin timer preset.
  const spin = nick.get('Spin_Tmr')!;
  assert.ok(outs(capper.program).some((o) => o.type === 'TMR' && o.address === spin && o.preset === '1500' && o.unit === 'ms'));
  assert.ok(capper.program.rungs.some((r) => r.branches.some((b) => b.some((e) => e.type === 'NO' && e.address === spin))), 'Spin_Tmr.DN → timer bit');
  // ST scaling routine.
  assert.ok(outs(capper.program).some((o) => o.type === 'MATH' && o.dest === nick.get('Torque_Nm') && /@IN:\d+ \* 10\.0/.test(o.expression)));
}

// ── For a chosen PLC: Logix (5069 modules) and CLICK ──
{
  const modules: ModuleSlot[] = [
    { partNumber: '5069-IB16', inputs: 16, outputs: 0 },
    { partNumber: '5069-OB16', inputs: 0, outputs: 16 },
    { partNumber: '5069-IF8', inputs: 0, outputs: 0, analogInputs: 8 },
  ];
  const m = materialize(capper, logixProfile, LOGIX_CPUS[1], modules);
  assert.equal(m.io.length, 14);
  const json = JSON.stringify(m.program);
  assert.ok(!json.includes('@IN') && !json.includes('@OUT'), 'every I/O placeholder replaced');
  assert.ok(json.includes('"X101"') && json.includes('"Y201"'), 'slot addresses');
  // The analog input takes DF1: the imported Torque_Nm (was DF1) moved out of its way.
  const torque = m.program.tags.find((t) => t.nickname === 'Torque_Nm')!;
  assert.notEqual(torque.address, 'DF1');
  assert.ok(outs(m.program).some((o) => o.type === 'MATH' && o.dest === torque.address && o.expression.startsWith('(DF1 *')), 'scaling reads the analog channel, writes the moved register');
  const issues = validateProgram(m.program, logixProfile, new Set(m.io.map((_, i) => i).length ? ['X101'] : []));
  assert.ok(issues.every((i) => !/Unknown operand|not a valid/i.test(i.message)), `program checks: ${issues.map((i) => i.message).join('; ')}`);

  // Round trip: export to Studio 5000 and read it back — same rungs, same names.
  const l5x = buildL5x(m.program, { io: m.io, addresses: new Map(m.io.map((p, i) => [p.id, i < 9 ? `X10${i + 1}` : `Y20${i - 8}`])), labels: new Map(), header: 'round trip', extraTags: [], cpuId: LOGIX_CPUS[1].id, modules, projectName: 'Capper_Upgraded', now: new Date(Date.UTC(2024, 0, 1)) });
  const back = importProgramText('Capper_Upgraded.L5X', l5x);
  assert.equal(back.report.notConverted.length, 0, back.report.notConverted.map((n) => n.text).join(' | '));
  assert.ok(back.program.rungs.length >= m.program.rungs.length, 'every rung comes back');
  for (const n of ['Machine_Running', 'Step', 'Spin_Tmr', 'Bottle_Count']) assert.ok(back.program.tags.some((t) => t.nickname === n), `${n} keeps its name through export and import`);

  const c = materialize(capper, clickProfile, clickProfile.cpuModels[0], []);
  assert.ok(JSON.stringify(c.program).includes('"X001"'), 'CLICK addresses');
}

// ── L5K: palletizer ──
{
  const p = importProgramText('palletizer.L5K', fixture('palletizer.L5K'));
  assert.equal(p.source.controller, '1769-L30ER');
  assert.equal(p.io.length, 13);
  assert.equal(p.io.find((x) => x.name === 'Box_PE')?.description, 'Box at stacker (PE-01)', 'module comment from the MODULE section');
  assert.equal(p.io.find((x) => x.name === 'Safety_OK')?.description, 'Safety relay output: light curtain clear and E-stop released');
  assert.equal(p.report.converted, 10);
  assert.equal(p.report.notConverted.length, 0);
  const push = p.program.tags.find((t) => t.nickname === 'Push_Tmr')!.address;
  assert.ok(outs(p.program).some((o) => o.type === 'TMR' && o.address === push && o.preset === '2' && o.unit === 'sec'), 'TON(Push_Tmr,?,?) takes the preset from the tag (2000 ms)');
  const layers = p.program.tags.find((t) => t.nickname === 'Layers')!.address;
  assert.ok(outs(p.program).some((o) => o.type === 'CNT' && o.address === layers && o.preset === '6'), 'counter preset from the tag');
  assert.ok(p.report.notes.some((n) => /Layers\.PRE/.test(n)), 'the preset register write is pointed out');
}

// ── PLCopen XML: CODESYS filler (LD + ST) ──
{
  const f = importProgramText('filler.xml', fixture('filler_plcopen.xml'));
  assert.equal(f.io.filter((x) => x.type === 'input').length, 5);
  assert.equal(f.io.filter((x) => x.type === 'output').length, 3);
  assert.ok(f.io.find((x) => x.name === 'Level_Raw')?.analog, '%IW → analog input');
  const running = f.program.tags.find((t) => t.nickname === 'Running')!.address;
  const seal = find(f.program, (r) => writes(r, running))!;
  assert.equal(seal.branches.length, 2, 'wired OR of Start and Running');
  assert.equal(seal.branches[0][1].type, 'NC', 'negated contact');
  assert.ok(f.program.rungs.some((r) => r.branches[0]?.[0]?.type === 'RISE'), 'rising-edge contact');
  const fillTmr = f.program.tags.find((t) => t.nickname === 'Fill_Tmr')!.address;
  assert.ok(outs(f.program).some((o) => o.type === 'TMR' && o.address === fillTmr && o.preset === '4500'), 'TON block with T#4S500MS');
  assert.ok(f.program.rungs.some((r) => r.branches[0]?.[0]?.type === 'NO' && r.branches[0][0].address === fillTmr && r.outputs.some((o) => o.type === 'RST')), 'reset coil driven by the timer Q');
  assert.ok(outs(f.program).some((o) => o.type === 'CNT' && o.preset === '1000'), 'CTU call in ST');
  assert.deepEqual(f.report.notConverted.map((n) => n.text.split('\n')[0]), ['FOR i := 0 TO 3 DO'], 'only the FOR loop is not converted');
}

// ── Siemens SCL source ──
{
  const s = importProgramText('Mixer.scl', fixture('Mixer.scl'));
  assert.equal(s.source.vendor, 'Siemens');
  assert.equal(s.report.notConverted.length, 0);
  const t = s.program.tags.find((x) => x.nickname === 'Mix_Timer')!.address;
  assert.ok(outs(s.program).some((o) => o.type === 'TMR' && o.address === t && o.preset === '3' && o.unit === 'min'), '#Mix_Timer(IN, PT := T#3M) → 3 min timer');
  assert.equal(s.io.find((x) => x.name === 'Start')?.description, 'Start from the HMI', 'comment on the declaration line');
  assert.ok(s.io.every((x) => x.confidence === 'low'), 'without the tag table the inputs are a guess');
  assert.ok(s.report.notes.some((n) => /tag table/.test(n)));
}

// ── CLICK address list ──
{
  const c = importProgramText('names.csv', fixture('click_nicknames.csv'));
  assert.equal(c.io.length, 6);
  assert.equal(c.io[0].description, 'Start pushbutton');
  assert.equal(c.program.rungs.length, 0);
  assert.ok(c.report.notes.some((n) => /PDF printout/.test(n)), 'tells how to get the rungs');
}

console.log('import.test: all passed');
