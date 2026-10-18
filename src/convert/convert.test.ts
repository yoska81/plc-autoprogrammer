// npx tsx src/convert/convert.test.ts — reading DXF text, foreign part ratings, conversion to North America, function kept.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cadToText, cleanDxfText, dwgToEntities, dxfToText, hasDwgReader, parseDxfEntities, parseDxfTexts, setDwgReader, sheetFrames, sheetNumber, type CadEntity } from './dxf';
import { ROLL_FORMER } from './__fixtures__/rollFormer';
import { foreignRatings } from './foreignParts';
import { convertMachine, kwToHp, mm2ToAwg, naTags, NA_TARGET, retag, targetSupply } from './convert';
import { RELAY_CONVEYOR } from './__fixtures__/relayConveyor';
import { ioId } from './types';
import { scoreReading, scoreText } from './score';
import { CN_ROLLFORMER_01 } from './__fixtures__/cnRollformer01.facts';
import { CN_ROLLFORMER_01_READING } from './__fixtures__/cnRollformer01.reading';
import { normalizeMachine } from './derive';
import { applyExistingMachine, storedMachine } from './apply';
import { functionKept, functionKeptFindings, similarity } from './functionKept';
import { EMPTY_REVIEW, itemKey, reviewItems, reviewedMachine, unconfirmed } from './review';
import { CHINESE_CONVEYOR } from './__fixtures__/chineseConveyor';
import { seedSampleProject } from '../preview/sampleProject';
import { collectProject } from '../deliverables/collect';
import { useElectricalStore } from '../store/useElectricalStore';
import { useSpecStore } from '../store/useSpecStore';
import { useIOStore } from '../store/useIOStore';
import { useQuestionStore } from '../components/questions/useQuestionStore';
import { useProjectsStore } from '../store/useProjectsStore';
import { useProjectStore } from '../store/useProjectStore';
import { checksFor } from '../review/actions';

const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };

let passed = 0;
const test = async (name: string, fn: () => void | Promise<void>) => { await fn(); passed++; console.log('  ok ', name); };

await test('DXF: text, MTEXT and attributes in reading order; \\U+ escapes and MTEXT codes decoded', () => {
  const dxf = ['0', 'SECTION', '2', 'ENTITIES',
    '0', 'TEXT', '8', 'TEXT', '10', '50', '20', '200', '1', 'QF1',
    '0', 'MTEXT', '8', 'NOTE', '10', '10', '20', '200', '3', '{\\fSimSun|b0;\\U+542F\\U+52A8}', '1', '\\PStart',
    '0', 'ATTRIB', '8', 'DEV', '10', '10', '20', '100', '2', 'CAT', '1', 'CJX2-1210',
    '0', 'ATTDEF', '8', 'DEV', '10', '0', '20', '0', '2', 'CAT', '1', 'XXX',
    '0', 'ENDSEC', '0', 'EOF'].join('\n');
  const t = parseDxfTexts(dxf);
  assert.deepEqual(t.map((x) => x.text), ['QF1', '启动 Start', 'CJX2-1210']);
  assert.equal(t[2].attr, 'CAT');
  assert.equal(cleanDxfText('%%c20 \\A1;x'), 'Ø20 x');
  const text = dxfToText(dxf, 'E-01.dxf');
  assert.match(text, /^E-01\.dxf \(CAD drawing, 3 text items/);
  // same row: left to right; lower rows after
  assert.ok(text.indexOf('启动 Start') < text.indexOf('QF1') && text.indexOf('QF1') < text.indexOf('CAT=CJX2-1210'), text);
  assert.match(dxfToText('0\nEOF'), /no text found/);
});

await test('foreign part numbers state their ratings (only what the number says)', () => {
  assert.deepEqual(foreignRatings('CJX2-1210'), { amps: 12, poles: 3 });
  assert.deepEqual(foreignRatings('NXC-25'), { amps: 25, poles: 3 });
  assert.deepEqual(foreignRatings('DZ47-63 3P C16'), { curve: 'C', amps: 16, poles: 3 });
  assert.deepEqual(foreignRatings('DZ47-63 C6'), { curve: 'C', amps: 6 });
  assert.deepEqual(foreignRatings('NR2-25 9-13A'), { minAmps: 9, maxAmps: 13 });
  assert.deepEqual(foreignRatings('DR-60-24'), { outputVolts: 24, outputAmps: 2.5 });
  assert.equal(foreignRatings('E3Z-D61'), null);
});

await test('units: kW to standard HP, mm² to AWG, supply to 480 V 60 Hz', () => {
  assert.deepEqual([0.37, 0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5].map(kwToHp), [0.5, 1, 1.5, 2, 3, 5, 5, 7.5, 10]);
  assert.deepEqual([1, 1.5, 2.5, 4, 6].map(mm2ToAwg), ['16 AWG', '14 AWG', '12 AWG', '10 AWG', '8 AWG']);
  const s = targetSupply({ volts: 380, hz: 50, phases: 3, text: '3~380V 50Hz' }, { region: 'US', supply: '480VAC-3PH', controlVolts: '24VDC' });
  assert.equal(s.supply, '480VAC-3PH');
  assert.match(s.note, /20 % faster/);
  assert.ok(!s.question);
  assert.ok(targetSupply({ volts: null, hz: null, phases: null, text: '' }, { region: 'US', supply: '480VAC-3PH', controlVolts: '24VDC' }).question, 'asks when the supply is not drawn');
  assert.equal(targetSupply({ volts: 380, hz: 50, phases: 3, text: '' }, { region: 'Canada', supply: '600VAC-3PH', controlVolts: '24VDC' }).supply, '600VAC-3PH');
});

await test('GB / IEC tags become NFPA tags, numbered per kind', () => {
  const t = naTags(CHINESE_CONVEYOR.components);
  assert.equal(t.get('QS1'), 'DS1');
  assert.equal(t.get('QF2'), 'CB2');
  assert.equal(t.get('KM3'), 'K3');
  assert.equal(t.get('FR1'), 'OL1');
  assert.equal(t.get('SB1'), 'ES1');
  assert.equal(t.get('SB2'), 'PB1');
  assert.equal(t.get('HL2'), 'PL2');
  assert.equal(t.get('B1'), 'PE1');
  assert.equal(t.get('SP1'), 'PRS1');
  assert.equal(t.get('YV1'), 'SOL1');
  assert.equal(t.get('PLC'), 'PLC');
});

await test('the Chinese conveyor converted to North America: supply, motors, every part matched or handed to the design', () => {
  const c = convertMachine(CHINESE_CONVEYOR);
  assert.equal(c.supply, '480VAC-3PH');
  assert.deepEqual(c.motors.map((m) => [m.tag, m.hp, m.voltage, m.reversing]), [['M1', 1.5, '480VAC-3PH', true], ['M2', 1, '480VAC-3PH', false]]);
  const by = (tag: string) => c.parts.find((p) => p.oldTag === tag)!;
  // breakers: UL 489, same rating and curve
  for (const [tag, amps] of [['QF1', 16], ['QF2', 10]] as const) {
    const m = by(tag);
    assert.equal(m.status, 'matched', `${tag}: ${m.reason}`);
    assert.equal(Number(m.to!.ratings.amps), amps);
    assert.ok(/489/.test(String(m.to!.ratings.ul)) || m.to!.ratings.branchRated === 'yes', `${tag} → ${m.to!.partNumber} is branch rated`);
    assert.ok(m.differences.some((d) => /UL 489/.test(d)));
  }
  // contactors: at least 12 A, 24 VDC coil, coil change named
  const km1 = by('KM1');
  assert.equal(km1.status, 'matched');
  assert.ok(Number(km1.to!.ratings.amps) >= 12);
  assert.ok(km1.differences.some((d) => /Coil 220VAC → 24/.test(d)), km1.differences.join('; '));
  // overloads are set for the new motor current by the design; operator devices and the PLC too
  assert.equal(by('FR1').status, 'engine');
  assert.match(by('FR1').differences[0], /480 V/);
  for (const t of ['PLC', 'SB2', 'HL1', 'B1', 'YV1']) assert.equal(by(t).status, 'engine', t);
  assert.equal(by('V1').status, 'matched');
  assert.equal(Number(by('V1').to!.ratings.outputVolts), 24);
  // what the conversion can't decide is asked
  assert.ok(c.questions.some((q) => /50 Hz/.test(q.text) && q.section === 'motion'));
  assert.ok(c.questions.some((q) => /single-channel/.test(q.text) && q.section === 'safety'));
});

await test('review: left-out items drop, unconfirmed low-confidence readings become questions', () => {
  const m = { ...CHINESE_CONVEYOR, io: CHINESE_CONVEYOR.io.map((p) => (p.address === 'X7' ? { ...p, confidence: 'low' as const } : p)) };
  // FR2 is medium, X7 now low: only low-confidence readings are asked
  let r = reviewedMachine(m, EMPTY_REVIEW);
  assert.deepEqual(r.questions.map((q) => q.text.slice(0, 50)), ['Please check on the machine: X7 Conveyor overload ']);
  assert.match(r.questions[0].text, /sheet 4, column 7/);
  assert.equal(unconfirmed(m, EMPTY_REVIEW).length, 1);
  // confirmed: no question; left out: gone from the machine
  const x7 = m.io.findIndex((p) => p.address === 'X7');
  r = reviewedMachine(m, { confirmed: [itemKey('io', ioId(m.io[x7], x7))], excluded: [itemKey('part', 'KA1'), itemKey('motor', 'M2')] });
  assert.equal(r.questions.length, 0);
  assert.ok(!r.machine.components.some((c) => c.tag === 'KA1'));
  assert.deepEqual(r.machine.motors.map((x) => x.tag), ['M1']);
  assert.equal(reviewItems(m).length, m.io.length + m.components.length + m.motors.length);
  // a machine without a PLC repeats addresses ("KM1 coil" for start and stop): every point keeps its own key
  const rf = normalizeMachine(ROLL_FORMER);
  const keys = reviewItems(rf).filter((i) => i.kind === 'io').map((i) => i.key);
  assert.equal(new Set(keys).size, rf.io.length);
  const stop = rf.io.findIndex((p) => p.deviceTag === 'SB1');
  assert.deepEqual(reviewedMachine(rf, { confirmed: [], excluded: [itemKey('io', ioId(rf.io[stop], stop))] }).machine.io.map((p) => p.deviceTag).filter((t) => t === 'SB1' || t === 'SB2'), ['SB2'], 'leaving out the stop button keeps the start button at the same address');
});

await test('IEC target: tags and supply stay, safety parts are marked re-validate', () => {
  const c = convertMachine(CHINESE_CONVEYOR, { region: 'EU', supply: '400VAC-3PH', controlVolts: '24VDC' });
  assert.equal(c.supply, '400VAC-3PH');
  assert.equal(c.tags.get('QF1'), 'QF1');
  assert.equal(c.parts.find((p) => p.oldTag === 'KM1')!.newTag, 'KM1');
  assert.ok(!c.questions.some((q) => /50 Hz/.test(q.text)));
  const na = convertMachine(CHINESE_CONVEYOR);
  assert.ok(na.parts.find((p) => p.oldTag === 'SB1')!.differences.some((d) => /re-validate/.test(d)));
  assert.ok(na.parts.filter((p) => p.status === 'matched').every((p) => /maker's listing|listing: see/.test(p.reason)), 'never claims a listing of its own');
});

await test('a partial AI answer is filled to the full shape', () => {
  const m = normalizeMachine({ summary: 'x', components: [{ tag: 'KM1', partNumber: null, manufacturer: null, description: '', category: 'contactor', confidence: 'low', source: '', ratings: { amps: 9 } as never }] });
  assert.equal(m.components[0].ratings.amps, 9);
  assert.equal(m.components[0].ratings.poles, null);
  assert.equal(m.spec.overview, '');
  assert.deepEqual(m.safety.estops, []);
});

await test('applied to a project: description, questions, I/O and motors; every function kept once the design has them', () => {
  seedSampleProject();
  const conv = convertMachine(CHINESE_CONVEYOR);
  applyExistingMachine(CHINESE_CONVEYOR, conv);
  assert.equal(useProjectStore.getState().info.region, 'US');
  const spec = useSpecStore.getState().sections;
  assert.match(spec.overview, /Sorting conveyor/);
  assert.match(spec.utilities, /480 VAC 3-phase 60 Hz/);
  assert.match(spec.sequence, /cross-interlocked/);
  assert.match(spec.safety, /re-validated/);
  assert.match(spec.safety, /own UL 508A listing/);
  assert.match(spec.motion, /M1 1\.1 kW → 1\.5 HP/);
  const qs = useQuestionStore.getState().byProject[useProjectsStore.getState().activeId ?? 'default'] ?? [];
  assert.ok(qs.some((q) => q.source === 'drawings' && /pusher take to extend/.test(q.text)));
  assert.ok(qs.some((q) => q.source === 'drawings' && /50 Hz/.test(q.text)));
  assert.equal(useIOStore.getState().projectIO.length, CHINESE_CONVEYOR.io.length);
  assert.deepEqual(useElectricalStore.getState().inputs.motors.map((m) => m.tag), ['M1', 'M2']);
  assert.ok(storedMachine());
  // the regenerated design (stand-in: the design with the new motors) keeps every I/O and motor
  const el = useElectricalStore.getState();
  el.setDesign({ ...el.design!, inputs: el.inputs }, 'generated', null);
  const kept = functionKept(CHINESE_CONVEYOR, conv, collectProject());
  for (const k of kept.filter((x) => x.kind === 'io')) assert.equal(k.status, 'kept', `${k.original}: ${k.note}`);
  assert.equal(kept.find((x) => x.kind === 'motor' && /^M2/.test(x.original))!.status, 'kept');
  // the stand-in design still has the old one-contactor starter for M1: losing the reversing is caught
  const m1 = kept.find((x) => x.kind === 'motor' && /^M1/.test(x.original))!;
  assert.equal(m1.status, 'missing');
  assert.match(m1.note, /one contactor/);
  assert.equal(kept.filter((x) => x.kind === 'interlock').length, 3);
  assert.equal(kept.find((x) => /cross-interlocked/.test(x.original))!.status, 'kept');
  assert.ok(kept.filter((x) => x.kind === 'safety').every((x) => x.revalidate), 'safety functions marked re-validate');
  // a redesign that lost a motor and an I/O point is flagged, and the review shows it
  useIOStore.getState().deletePoint(useIOStore.getState().projectIO.find((p) => /Pusher valve/.test(p.description))!.id);
  el.setDesign({ ...useElectricalStore.getState().design!, inputs: { ...el.inputs, motors: el.inputs.motors.slice(0, 1) } }, 'generated', null);
  const lost = functionKept(CHINESE_CONVEYOR, conv, collectProject()).filter((x) => x.status === 'missing');
  assert.ok(lost.some((x) => x.kind === 'io' && /Pusher valve/.test(x.original)));
  assert.ok(lost.some((x) => x.kind === 'motor' && /M2/.test(x.original)));
  assert.equal(functionKeptFindings(lost).length, lost.length);
  assert.ok(checksFor(collectProject()).some((f) => f.id.startsWith('convert:kept:motor:')), 'the Design review lists it');
});

await test('roll former (the acceptance drawing): six sheets in model space split by their frames, titles, MTEXT codes, mm²', () => {
  const dxf = readFileSync(new URL('../../e2e/fixtures/convert/roll-former.dxf', import.meta.url), 'utf8');
  const ents = parseDxfEntities(dxf);
  assert.equal(sheetFrames(ents).length, 6, 'outer frames only (inner borders dropped)');
  const text = dxfToText(dxf, 'roll-former.dxf');
  assert.match(text, /6 sheets side by side/);
  assert.match(text, /--- Sheet 1 of 6: 主电路 Main circuit · 第1页 共6页 ---/);
  assert.match(text, /--- Sheet 3 of 6: 伺服切断 Servo shear/);
  assert.match(text, /--- Sheet 4 of 6: 控制回路 220V/);
  assert.ok(!/\\f|SimSun|\\P|[{}]/.test(text), 'no MTEXT codes left');
  assert.match(text, /QF1 4P 10平方 \(10 mm²\)/);
  // sheet 3's text stays on sheet 3
  const s3 = text.split('--- Sheet 3 of 6')[1].split('--- Sheet 4')[0];
  assert.match(s3, /CN1-19 使能/);
  assert.match(cleanDxfText('{\\fSimSun|b0|i0|c134|p2;SA1}'), /^SA1$/);
});

await test('CAD sheets: own numbers (2, 3, 5, 6 of 8), bilingual title labels skipped, notes never taken as the number', () => {
  const ents: CadEntity[] = [];
  const box = (x: number): CadEntity => ({ type: 'LWPOLYLINE', layer: 'FRAME', closed: true, points: [[x, 0], [x + 420, 0], [x + 420, 297], [x, 297]] });
  const T = (x: number, y: number, text: string): CadEntity => ({ type: 'TEXT', layer: 'TB', x, y, text });
  [[2, 'Power distribution 电源分配'], [3, 'Motor power 电机主回路'], [5, 'Relay control (1) 继电器控制'], [6, 'Relay control (2)']].forEach(([n, title], i) => {
    const x = i * 450;
    ents.push(box(x), T(x + 10, 290, `SHEET ${n}`), T(x + 20, 150, 'See sheet 7 for the terminals'), T(x + 20, 140, 'Sheet 4 of 8'.replace('4 of 8', 'ref /5.4')),
      T(x + 300, 20, '图名 Sheet title'), T(x + 300, 12, String(title)), T(x + 380, 20, '页 Sheet'), T(x + 380, 12, String(n)), T(x + 395, 20, '共8页'));
  });
  const text = cadToText(ents, 'HC-YX840-E01.dxf');
  assert.deepEqual(text.match(/^--- Sheet \d+ of \d+[^:]*/gm), ['--- Sheet 2 of 8 (frame 1 of 4 in this file)', '--- Sheet 3 of 8 (frame 2 of 4 in this file)', '--- Sheet 5 of 8 (frame 3 of 4 in this file)', '--- Sheet 6 of 8 (frame 4 of 4 in this file)']);
  assert.match(text, /--- Sheet 5 of 8 \(frame 3 of 4 in this file\): Relay control \(1\) 继电器控制 ---/);
  assert.ok(!/: Sheet title/.test(text), 'the bilingual label is not the name');
  // the 页 label with its value as a separate text, when there is no "SHEET n"
  assert.deepEqual(sheetNumber([{ type: 'TEXT', layer: '', x: 0, y: 10, text: '页 Sheet' }, { type: 'TEXT', layer: '', x: 2, y: 4, text: '7' }, { type: 'TEXT', layer: '', x: 50, y: 4, text: 'see Sheet 3' }]), { n: 7, of: null });
});

await test('DWG: a plugged-in reader is used; without one there is none', async () => {
  assert.equal(hasDwgReader(), false);
  assert.equal(await dwgToEntities(new ArrayBuffer(4)), null);
  setDwgReader(async () => parseDxfEntities(readFileSync(new URL('../../e2e/fixtures/convert/roll-former.dxf', import.meta.url), 'utf8')));
  const ents = await dwgToEntities(new ArrayBuffer(4));
  assert.match(cadToText(ents!, 'machine.dwg'), /^machine\.dwg \(CAD drawing, 6 sheets/);
  setDwgReader(null);
});

await test('roll former converted: VFD + STO, servo axis kept whole, E-stop "not a safety circuit" → safety relay, questions', () => {
  const c = convertMachine(ROLL_FORMER);
  assert.deepEqual(c.motors.map((m) => [m.tag, m.hp, m.starter]), [['M1', 7.5, 'vfd'], ['M2', 1, 'contactor-overload']], 'the servo motor belongs to its axis');
  const by = (t: string) => c.parts.find((p) => p.oldTag === t)!;
  assert.equal(by('VF1').status, 'matched');
  assert.ok(Number(by('VF1').to!.ratings.hp480) >= 7.5);
  assert.ok(by('VF1').differences.some((d) => /STO/.test(d)) && by('VF1').differences.some((d) => /re-validate/.test(d)));
  for (const t of ['SD1', 'R1', 'PG1']) { assert.equal(by(t).status, 'engine', t); assert.match(by(t).reason, /Servo axis/); }
  assert.ok(by('SD1').differences.some((d) => /STO/.test(d)));
  assert.equal(by('RP1').status, 'engine', 'the speed pot is an operator device');
  assert.equal(by('QF1').status, 'to-select', 'no rating printed: never guessed');
  const safety = c.recommendations.find((r) => r.section === 'safety')!.text;
  assert.match(safety, /not a safety circuit/);
  assert.match(safety, /safety relay/);
  assert.match(safety, /Safe Torque Off \(STO\) inputs of VF1, SD1/);
  assert.ok(c.recommendations.some((r) => r.section === 'motion' && /Servo axis A1/.test(r.text) && /braking resistor/.test(r.text) && /encoder/.test(r.text)));
  assert.ok(c.questions.some((q) => /not a safety circuit/.test(q.text)));
  assert.ok(c.questions.some((q) => /no PLC/.test(q.text)));
  assert.ok(!c.questions.some((q) => /power of M2/.test(q.text)), 'the drawings\' own question about the oil pump is not asked twice');
});

await test('roll former applied: recommendations in the description, axis and E-stop in function kept', () => {
  seedSampleProject();
  const conv = convertMachine(ROLL_FORMER);
  applyExistingMachine(ROLL_FORMER, conv);
  const spec = useSpecStore.getState().sections;
  assert.match(spec.safety, /Conversion: The E-stop \(SB3\) only signals/);
  assert.match(spec.motion, /Conversion: Servo axis A1/);
  // (the example was edited by the test before: seeding detached it, so this project may have no design yet)
  const el = useElectricalStore.getState();
  if (el.design) el.setDesign({ ...el.design, inputs: el.inputs }, 'generated', null);
  const kept = functionKept(ROLL_FORMER, conv, collectProject());
  const axis = kept.find((k) => k.kind === 'axis')!;
  assert.equal(axis.status, 'kept', axis.note);
  const estop = kept.find((k) => k.kind === 'safety')!;
  assert.match(estop.original, /not a safety circuit/);
  assert.ok(estop.revalidate);
  assert.equal(kept.filter((k) => k.kind === 'motor').length, 2, 'panel motors only (the servo is its axis)');
  // valves switched through relay outputs count as present (their I/O names them)
  assert.equal(kept.find((k) => /Cutter down and cutter up/.test(k.original))!.status, 'kept');
});

await test('description only (the program import wrote the I/O): the I/O list and motors are left alone', () => {
  seedSampleProject();
  const ioBefore = useIOStore.getState().projectIO.map((p) => p.description);
  const motorsBefore = useElectricalStore.getState().inputs.motors;
  applyExistingMachine(CHINESE_CONVEYOR, convertMachine(CHINESE_CONVEYOR), [], { descriptionOnly: true });
  assert.deepEqual(useIOStore.getState().projectIO.map((p) => p.description), ioBefore);
  assert.deepEqual(useElectricalStore.getState().inputs.motors, motorsBefore);
  assert.match(useSpecStore.getState().sections.overview, /Sorting conveyor/);
});

await test('relay logic moved into a new PLC: field devices become I/O, relays and timers program logic, each circuit kept', () => {
  const c = convertMachine(RELAY_CONVEYOR);
  assert.equal(c.logic, 'plc', 'a new PLC by default');
  const io = (t: string) => c.io.find((p) => p.deviceTag === t);
  assert.deepEqual(['SB1', 'SB2', 'SQ1'].map((t) => io(t)?.type), ['input', 'input', 'input']);
  assert.deepEqual(['KM1', 'KM2', 'HL1'].map((t) => io(t)?.type), ['output', 'output', 'output']);
  assert.equal(io('KT1'), undefined, 'the timer is program logic, not I/O');
  assert.equal(c.io.length, 6);
  assert.ok(c.circuits.every((x) => x.becomes === 'program'));
  const pump = c.circuits.find((x) => x.circuit.output === 'KM2')!.text;
  assert.match(pump, /^K2: Pump runs 5 s after/);
  assert.match(pump, /setting: CR1 on-delay 5 s/, 'timer setting kept with the new tag');
  assert.ok(c.questions.some((q) => /no PLC/.test(q.text) && /new PLC/.test(q.text)));
  seedSampleProject();
  applyExistingMachine(RELAY_CONVEYOR, c);
  assert.match(useSpecStore.getState().sections.sequence, /Program logic from the relay circuits[\s\S]*- K1: Conveyor runs/);
  assert.equal(useIOStore.getState().projectIO.length, 6);
  const kept = functionKept(RELAY_CONVEYOR, c, collectProject()).filter((k) => k.kind === 'circuit');
  assert.equal(kept.length, 4);
  assert.ok(kept.every((k) => k.status === 'kept' && /PLC program/.test(k.now)), kept.map((k) => `${k.original}: ${k.status} ${k.note}`).join('\n'));
  // a lost limit switch makes its circuit missing
  useIOStore.getState().deletePoint(useIOStore.getState().projectIO.find((p) => /limit switch/.test(p.description))!.id);
  const lost = functionKept(RELAY_CONVEYOR, c, collectProject()).find((k) => k.kind === 'circuit' && /^KM1/.test(k.original))!;
  assert.equal(lost.status, 'missing');
  assert.match(lost.note, /SQ1: no I\/O/);
  assert.ok(functionKeptFindings([lost])[0].page === 'spec');
});

await test('relay logic kept: no PLC I/O, circuits stay relays with the new tags and parts', () => {
  const c = convertMachine(RELAY_CONVEYOR, { ...NA_TARGET, logic: 'keep-relays' });
  assert.equal(c.logic, 'keep-relays');
  assert.ok(c.circuits.every((x) => x.becomes === 'relays'));
  assert.ok(c.questions.some((q) => /keeps the relay logic/.test(q.text)));
  seedSampleProject();
  applyExistingMachine(RELAY_CONVEYOR, c);
  assert.equal(useIOStore.getState().projectIO.length, 0, 'no PLC, so no I/O list');
  assert.match(useSpecStore.getState().sections.sequence, /Relay circuits kept as hardwired logic[\s\S]*- K2: Pump runs 5 s after/);
  const kept = functionKept(RELAY_CONVEYOR, c, collectProject());
  assert.ok(!kept.some((k) => k.kind === 'io'), 'the field devices are checked with their circuits');
  for (const k of kept.filter((x) => x.kind === 'circuit')) assert.ok(k.status !== 'missing' && /^Relay circuit/.test(k.now), `${k.original}: ${k.status} ${k.note}`);
});

await test('roll former: relay circuits move to the PLC, the drive logic stays in the drives', () => {
  const c = convertMachine(ROLL_FORMER);
  const by = (t: string) => c.circuits.find((x) => x.circuit.output === t)!.becomes;
  assert.deepEqual(['KM1', 'KM2', 'VF1', 'SD1', 'KA1'].map(by), ['program', 'program', 'drive', 'drive', 'drive']);
  assert.ok(!c.io.some((p) => p.deviceTag === 'KM1' && p.type === 'output'), 'the main contactor goes to the safety circuit, not to an output');
  assert.equal(c.io.length, ROLL_FORMER.io.length, 'its field devices are already in the drawings\' I/O list');
});

await test('STO: a safety relay is not enough when a drive stops only through a single run contact', () => {
  const m: typeof ROLL_FORMER = { ...ROLL_FORMER, safety: { ...ROLL_FORMER.safety, kind: 'safety-relay', safetyRelay: 'KA0', category: 'Cat 3 / PL d',
    drives: [{ tag: 'VF1', sto: 'none', stopsBy: 'single KA1 contact on MI1' }, { tag: 'SD1', sto: 'not-wired', stopsBy: 'single KA4 contact on SON' }] } };
  const c = convertMachine(m);
  const sto = c.recommendations.find((r) => /Safe Torque Off/.test(r.text))!.text;
  assert.match(sto, /claim Cat 3 \/ PL d/);
  assert.match(sto, /the claimed Cat 3 \/ PL d is not met/);
  assert.match(sto, /VF1 \(no STO; stops only by single KA1 contact on MI1\)/);
  assert.match(sto, /two monitored contactors/);
  assert.ok(c.parts.find((p) => p.oldTag === 'VF1')!.differences.includes('STO wired to the safety relay'));
  // every drive's STO wired: nothing to flag
  const wired = convertMachine({ ...m, safety: { ...m.safety, drives: m.safety.drives.map((d) => ({ ...d, sto: 'wired' as const })) } });
  assert.ok(!wired.recommendations.some((r) => /not met/.test(r.text)));
  assert.ok(!wired.parts.find((p) => p.oldTag === 'VF1')!.differences.includes('STO wired to the safety relay'));
  // not shown on the drawings: asked
  const unknown = convertMachine({ ...m, safety: { ...m.safety, drives: [] } });
  assert.ok(unknown.questions.some((q) => /Safe Torque Off of VF1, SD1/.test(q.text)));
});

await test('servo axis parts by tag only: a "servo enable" selector is an operator device', () => {
  const c = convertMachine(ROLL_FORMER);
  assert.equal(c.parts.find((p) => p.oldTag === 'SA2')!.reason.includes('Servo axis'), false);
  assert.match(c.parts.find((p) => p.oldTag === 'PG1')!.reason, /Servo axis/, 'the encoder named in the axis');
});

await test('cn-rollformer-01: a correct reading scores 100 % on the facts; a wrong one shows what is missing', () => {
  const good = scoreReading(normalizeMachine(CN_ROLLFORMER_01_READING), CN_ROLLFORMER_01);
  assert.equal(good.percent, 100, scoreText(good));
  // the same reading without the safety relay's STO finding, the counter circuit and two signals
  const bad = scoreReading(normalizeMachine({ ...CN_ROLLFORMER_01_READING,
    io: CN_ROLLFORMER_01_READING.io.filter((p) => p.deviceTag !== 'HL1' && p.deviceTag !== 'HL5'),
    circuits: CN_ROLLFORMER_01_READING.circuits.filter((c) => c.output !== 'H7CX'),
    safety: { ...CN_ROLLFORMER_01_READING.safety, drives: CN_ROLLFORMER_01_READING.safety.drives.map((d) => ({ ...d, sto: 'wired' as const })) } }), CN_ROLLFORMER_01);
  const by = (l: string) => bad.parts.find((p) => p.label === l)!;
  assert.deepEqual(by('Signals').misses, ['HL1', 'HL5']);
  assert.ok(by('Relay logic').misses.some((x) => x.startsWith('C9 H7CX')));
  assert.ok(by('Safety').misses.includes('no-STO finding'));
  assert.ok(bad.percent < 100);
  // the older self-written mock is far from the real set
  assert.ok(scoreReading(normalizeMachine(ROLL_FORMER), CN_ROLLFORMER_01).percent < 40);
});

await test('cn-rollformer-01 converted: claimed Cat 3 / PL d not met (no STO), relay logic C1–C11 into the PLC, each circuit kept', () => {
  const m = normalizeMachine(CN_ROLLFORMER_01_READING);
  const c = convertMachine(m);
  const sto = c.recommendations.find((r) => /Safe Torque Off/.test(r.text))!.text;
  assert.match(sto, /claim Cat 3 \/ PL d, but the safety relay KA0/);
  assert.match(sto, /U1 \(no STO[^)]*KA1[^)]*\)\), U2 \(STO not wired/);
  assert.match(sto, /the claimed Cat 3 \/ PL d is not met/);
  assert.deepEqual(c.motors.map((x) => [x.tag, x.hp]), [['M1', 7.5], ['M2', 3]]);
  assert.equal(c.supply, '480VAC-3PH');
  assert.ok(c.parts.find((p) => p.oldTag === 'U1')!.differences.includes('STO wired to the safety relay'));
  assert.equal(c.circuits.length, 18);
  assert.deepEqual(c.circuits.filter((x) => x.becomes === 'drive').map((x) => x.circuit.output), ['KA7', 'U2']);
  assert.match(c.circuits.find((x) => x.circuit.output === 'KT1')!.text, /on-delay 2 s/);
  seedSampleProject();
  applyExistingMachine(m, c);
  assert.match(useSpecStore.getState().sections.safety, /is not met/);
  const kept = functionKept(m, c, collectProject()).filter((k) => k.kind === 'circuit');
  assert.equal(kept.length, 18);
  assert.ok(kept.every((k) => k.status !== 'missing'), kept.filter((k) => k.status === 'missing').map((k) => `${k.original}: ${k.note}`).join('\n'));
});

await test('retag: whole tags only', () => {
  assert.equal(retag('KM1 and KM10, KM1.', new Map([['KM1', 'K1'], ['KM10', 'K10']])), 'K1 and K10, K1.');
  assert.equal(retag('SB2 start', new Map([['SB', 'PB']])), 'SB2 start');
});

await test('I/O descriptions match by function words', () => {
  assert.ok(similarity('Start (启动)', 'Start pushbutton') >= 0.5);
  assert.ok(similarity('Pusher extended limit (推出到位)', 'Pusher retracted limit') < 1);
  assert.equal(similarity('Conveyor forward contactor', 'Pump contactor'), 0);
});

console.log(`${passed} passed`);
