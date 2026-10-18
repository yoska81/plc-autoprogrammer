// npx tsx src/convert/convert.test.ts — reading DXF text, foreign part ratings, conversion to North America, function kept.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cadToText, cleanDxfText, dwgToEntities, dxfToText, hasDwgReader, parseDxfEntities, parseDxfTexts, setDwgReader, sheetFrames, sheetNumber, type CadEntity } from './dxf';
import { ROLL_FORMER } from './__fixtures__/rollFormer';
import { foreignRatings } from './foreignParts';
import { convertMachine, kwToHp, mm2ToAwg, naTags, NA_TARGET, retag, safetyOutputCount, safetyOutputsNeeded, sizeSafetyRelay, targetSupply } from './convert';
import type { CatalogPart } from '../electrical/types';
import { ALL_PARTS } from '../electrical/catalogs';
import { RELAY_CONVEYOR } from './__fixtures__/relayConveyor';
import { ioId, type ExistingMachine } from './types';
import { factsFromExpected, scoreReading, scoreText, type ExpectedJson } from './score';
import { columnCrop, dxfSheetSvg, parseSource } from './thumbs';
import { toRelayLogic, type RelayEl } from './relayLogic';
import { CN_ROLLFORMER_01 } from './__fixtures__/cnRollformer01.facts';
import { CN_ROLLFORMER_01_READING } from './__fixtures__/cnRollformer01.reading';
import { DERIVE_PARTS, deriveFromUpload, EXISTING_SCHEMA, mergeParts, normalizeMachine, partSchema } from './derive';
import { setClaudeInterceptor, type ClaudeOptions } from '../lib/ai/anthropic';
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

await test('GB / IEC tags become NFPA 79 / JIC tags (numbers kept where a group has them)', () => {
  const t = naTags(CHINESE_CONVEYOR.components, CHINESE_CONVEYOR);
  assert.equal(t.get('QS1'), 'DISC1');
  assert.equal(t.get('QF2'), 'CB2');
  assert.equal(t.get('KM3'), 'K3');
  assert.equal(t.get('SB1'), 'ESTOP1');
  assert.equal(t.get('SB2'), 'PB2', 'the push buttons keep their numbers');
  assert.equal(t.get('HL2'), 'LT2');
  assert.equal(t.get('B1'), 'PE1');
  assert.equal(t.get('SP1'), 'PSW1');
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
  // the original I/O, and the Safety OK input of the monitored safety relay that replaces the single-channel E-stop (gates every output)
  assert.equal(useIOStore.getState().projectIO.length, CHINESE_CONVEYOR.io.length + 1);
  assert.ok(useIOStore.getState().projectIO.some((p) => p.type === 'input' && p.deviceType === 'safety-relay-output' && /^Safety OK/.test(p.description)));
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
  // the cn-rollformer-01 title block: "图名 Sheet title" with "版本 Rev." on its row (a label, not the value); the name sits below and right
  const tb: CadEntity[] = [{ type: 'LWPOLYLINE', layer: 'FRAME', closed: true, points: [[0, 0], [420, 0], [420, 297], [0, 297]] },
    T(300, 30, '图名 Sheet title'), T(360, 29, '版本 Rev.'), T(395, 29, 'B'), T(310, 24, '主电源分配 / Power distribution'), T(300, 18, '设计 Designed'), T(330, 18, 'Li'),
    T(300, 12, '图号 Dwg No.'), T(330, 12, 'HC-YX840-E01'), T(380, 12, '页 Sheet'), T(400, 12, '2'), T(400, 6, '共8页'),
    { type: 'LWPOLYLINE', layer: 'FRAME', closed: true, points: [[450, 0], [870, 0], [870, 297], [450, 297]] }, T(750, 30, '图名 Sheet title'), T(810, 29, '版本 Rev.'), T(760, 24, '电机主回路 / Motor power'), T(830, 12, '页 Sheet'), T(850, 12, '3')];
  // the same with the English title as its own line under the Chinese one
  tb.push({ type: 'LWPOLYLINE', layer: 'FRAME', closed: true, points: [[900, 0], [1320, 0], [1320, 297], [900, 297]] }, T(1200, 30, '图名 Sheet title'), T(1260, 29, '版本 Rev.'), T(1290, 29, 'B'),
    T(1210, 24, '继电器控制(1)'), T(1210, 19, 'Relay control (1)'), T(1200, 12, '设计 Designed'), T(1280, 12, '页 Sheet'), T(1300, 12, '5'));
  const tbText = cadToText(tb, 'HC-YX840-E01.dxf');
  assert.match(tbText, /--- Sheet 5 [^\n]*: 继电器控制\(1\) \/ Relay control \(1\) ---/);
  assert.match(tbText, /--- Sheet 2 of 8[^\n]*: 主电源分配 \/ Power distribution ---/);
  assert.match(tbText, /--- Sheet 3 \(frame 2 of 3[^\n]*: 电机主回路 \/ Motor power ---/);
  assert.ok(!/Rev\. ---|Designed ---/.test(tbText), 'a neighbouring label is never the name');
  // the 页 label with its value as a separate text, when there is no "SHEET n"
  assert.deepEqual(sheetNumber([{ type: 'TEXT', layer: '', x: 0, y: 10, text: '页 Sheet' }, { type: 'TEXT', layer: '', x: 2, y: 4, text: '7' }, { type: 'TEXT', layer: '', x: 50, y: 4, text: 'see Sheet 3' }]), { n: 7, of: null });
});

await test('DXF written by LibreDWG (dwg2dxf): blocks placed by INSERT, old POLYLINE, DIMENSION text, MTEXT codes', () => {
  // e2e/fixtures/convert/dwg-sample.dwg → LibreDWG 0.14 dwg2dxf (our own drawing; make-dwg-sample.py)
  const ents = parseDxfEntities(readFileSync(new URL('../../e2e/fixtures/convert/dwg-sample.libredwg.dxf', import.meta.url), 'utf8'));
  const texts = ents.filter((e): e is Extract<CadEntity, { text: string }> => 'text' in e);
  const at = (text: string) => texts.filter((t) => t.text === text).map((t) => [Math.round(t.x), Math.round(t.y)]);
  // the coil block placed three times: as drawn, scaled ×2, rotated 90°; its tag attribute where the INSERT put it
  assert.deepEqual(at('A1'), [[54, 204], [108, 208], [176, 194]]);
  assert.deepEqual(texts.filter((t) => t.attr === 'TAG').map((t) => t.text), ['KA1', 'KA2', 'KT1']);
  // a block definition by itself is not drawing text (no "A1" at the block's own origin, no attribute placeholders)
  assert.ok(!texts.some((t) => t.text === 'A1' && Math.abs(t.x) < 10), 'block definitions are not read as drawing content');
  assert.equal(texts.filter((t) => t.attr).length, 5, 'each attribute once (LibreDWG repeats "stale" ones)');
  // the title block (a block too) with its attributes
  assert.ok(texts.some((t) => t.text === '图名 Sheet title' && Math.round(t.x) === 240));
  assert.ok(texts.some((t) => t.attr === 'NAME' && t.text === '继电器控制 Relay control'));
  // the wire drawn as an old-style POLYLINE with VERTEX entities
  assert.ok(ents.some((e) => e.type === 'LWPOLYLINE' && JSON.stringify(e.points) === '[[40,150],[100,150],[100,120]]'));
  // dimension text, overridden ("Cut length <> mm") and measured
  assert.ok(texts.some((t) => /^Cut length \d+ mm$/.test(t.text)));
  assert.ok(texts.filter((t) => /^\d+$/.test(t.text)).length >= 1);
  // MTEXT codes stripped
  assert.ok(texts.some((t) => t.text === '急停 E-stop SB0 2NC Ø20'));
  // MTEXT paragraph codes and non-breaking spaces
  assert.equal(cleanDxfText('\\pxi-3,l3;KA1\\~11-14'), 'KA1 11-14');
  // MINSERT: a 3 × 2 grid of the coil block; a polyface mesh is a surface, not a path
  const grid = ['0', 'SECTION', '2', 'BLOCKS', '0', 'BLOCK', '2', 'T', '10', '0', '20', '0', '0', 'TEXT', '8', '0', '10', '0', '20', '0', '1', 'X', '0', 'ENDBLK', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES', '0', 'INSERT', '8', 'L', '2', 'T', '10', '100', '20', '50', '70', '3', '71', '2', '44', '10', '45', '20',
    '0', 'POLYLINE', '8', 'M', '70', '64', '0', 'VERTEX', '10', '1', '20', '1', '0', 'VERTEX', '10', '2', '20', '2', '0', 'SEQEND', '0', 'ENDSEC', '0', 'EOF'].join('\n');
  const g = parseDxfEntities(grid);
  assert.deepEqual(g.filter((e) => 'text' in e).map((e) => 'text' in e ? [e.x, e.y] : []), [[100, 50], [110, 50], [120, 50], [100, 70], [110, 70], [120, 70]]);
  assert.ok(!g.some((e) => e.type === 'LWPOLYLINE'), 'a mesh is not drawn as a wire');
  // and without blocks or sections at all (a bare entity list) it still reads
  assert.deepEqual(parseDxfTexts(['0', 'TEXT', '8', 'L', '10', '1', '20', '2', '1', 'QF1'].join('\n')).map((t) => t.text), ['QF1']);
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
  assert.match(pump, /setting: TR1 on-delay 5 s/, 'timer setting kept with the new tag (KT1 → TR1)');
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
  assert.equal(c.io.filter((p) => p.deviceType !== 'safety-relay-output').length, ROLL_FORMER.io.length, 'its field devices are already in the drawings\' I/O list');
  assert.equal(c.io.filter((p) => p.deviceType === 'safety-relay-output').length, 1, 'and the Safety OK input of the safety relay the conversion adds');
});

await test('STO: a safety relay is not enough when a drive stops only through a single run contact', () => {
  const m: typeof ROLL_FORMER = { ...ROLL_FORMER, safety: { ...ROLL_FORMER.safety, kind: 'safety-relay', safetyRelay: 'KA0', category: 'Cat 3 / PL d',
    drives: [{ tag: 'VF1', sto: 'none', stopsBy: 'single KA1 contact on MI1' }, { tag: 'SD1', sto: 'not-wired', stopsBy: 'single KA4 contact on SON' }] } };
  const c = convertMachine(m);
  const sto = c.recommendations.find((r) => /Safe Torque Off/.test(r.text))!.text;
  assert.match(sto, /claim Cat 3 \/ PL d/);
  assert.match(sto, /the claimed Cat 3 \/ PL d is not met/);
  assert.match(sto, /VFD1 \(no STO; stops only by single CR1 contact on MI1\)/, 'written with the new tags');
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
    io: CN_ROLLFORMER_01_READING.io.filter((p) => p.deviceTag !== 'SB0' && p.deviceTag !== 'SQ5'),
    circuits: CN_ROLLFORMER_01_READING.circuits.filter((c) => c.output !== 'H7CX'),
    safety: { ...CN_ROLLFORMER_01_READING.safety, drives: CN_ROLLFORMER_01_READING.safety.drives.map((d) => ({ ...d, sto: 'wired' as const })) } }), CN_ROLLFORMER_01);
  const by = (l: string) => bad.parts.find((p) => p.label === l)!;
  assert.deepEqual(by('Signals').misses, ['SB0', 'SQ5']);
  // a missing timer, or one contact missing from a coil path, is never rounded away
  const noKt1 = (cs: typeof CN_ROLLFORMER_01_READING.circuits) => cs.filter((c) => c.output !== 'KT1').map((c) => ({ ...c, devices: c.devices.filter((d) => d !== 'KT1'), conditions: c.conditions.filter((t) => !/KT1/.test(t)),
    path: c.path?.filter((e) => !(e.t === 'contact' && e.tag === 'KT1')) }));
  const kt = scoreReading(normalizeMachine({ ...CN_ROLLFORMER_01_READING, circuits: noKt1(CN_ROLLFORMER_01_READING.circuits) }), CN_ROLLFORMER_01);
  assert.ok(kt.percent < 100);
  assert.deepEqual(kt.parts.find((p) => p.label === 'Relay logic')!.misses.filter((x) => /KT1/.test(x)), ['C2 KA1 ← KT1', 'C7t KT1 circuit', 'C7t KT1 ← KA7', 'C7t KT1 ← SB7', 'C7t KT1 ← KA1', 'C7t KT1 ← KA8']);
  assert.ok(by('Relay logic').misses.includes('C9 H7CX circuit'));
  assert.ok(by('Safety').misses.includes('no-STO finding'));
  assert.ok(bad.percent < 100);
  // one contact short (79 of 80 in the relay logic) is never 100 %
  const one = scoreReading(normalizeMachine({ ...CN_ROLLFORMER_01_READING, circuits: CN_ROLLFORMER_01_READING.circuits.map((c) => (c.output === 'KA2'
    ? { ...c, devices: c.devices.filter((d) => d !== 'KA3'), conditions: c.conditions.filter((t) => !/KA3/.test(t)), path: c.path?.filter((e) => !(e.t === 'contact' && e.tag === 'KA3')) } : c)) }), CN_ROLLFORMER_01);
  assert.equal(one.percent, 99, scoreText(one));
  assert.match(scoreText(one), /Relay logic 79\/80 \(98 %\) — missing: C3a KA2 ← KA3/);
  // the tags count in the overall score, not only in the cap
  const withTags = scoreReading(normalizeMachine(CN_ROLLFORMER_01_READING), { ...CN_ROLLFORMER_01, tags: [['KM1', 'M2'], ['QF1', 'CB1']] });
  assert.equal(withTags.percent, Math.floor((6 + 0.5) / 7 * 100), scoreText(withTags));
  // the older self-written mock is far from the real set
  assert.ok(scoreReading(normalizeMachine(ROLL_FORMER), CN_ROLLFORMER_01).percent < 40);
});

await test('cn-rollformer-01 fixture (fixtures/import): facts from its expected.json, the real DXF sheets', () => {
  const expected = JSON.parse(readFileSync(new URL('../../fixtures/import/cn-rollformer-01/expected.json', import.meta.url), 'utf8')) as ExpectedJson;
  const facts = factsFromExpected(expected);
  const path = (coil: string) => facts.relayLogic.find((l) => l.coil === coil);
  assert.deepEqual(path('KM1'), { id: 'C1', coil: 'KM1', contacts: ['KA0', 'SB2', 'SB1', 'FR1', 'KM1'], sealIn: 'KM1' });
  assert.deepEqual(path('KA1')!.contacts, ['SB4', 'KM1', 'KA5', 'KA6', 'U1', 'KT1', 'H7CX', 'KA9', 'KA10', 'SB3', 'KA1']);
  assert.deepEqual(path('KA2')!.contacts, ['SB5', 'KA3', 'KA1'], 'the jog runs only with the line stopped (the heading)');
  assert.deepEqual(path('YV1')!.contacts, ['KA7', 'SB7', 'KA1', 'KA8']);
  assert.deepEqual(path('KT1')!.contacts, path('YV1')!.contacts, 'the watchdog in parallel with the valve has its contacts');
  assert.deepEqual(path('KA8')!.contacts, ['SQ1', 'SQ2', 'KA8']);
  assert.deepEqual(path('H7CX')!.contacts, ['KA8', 'SB8']);
  assert.deepEqual(path('U1 MI3')!.contacts, ['KA2', 'KA3']);
  assert.equal(facts.signals.length, 28);
  assert.ok(facts.safety.stoFinding && facts.safety.claimed.test('Cat 3 / PL d'));
  // the reading written from these facts scores 100 % on the fixture's own expected.json, but for the tags
  const s = scoreReading(normalizeMachine(CN_ROLLFORMER_01_READING), facts);
  assert.ok(s.parts.filter((p) => p.label !== 'Tags').every((p) => p.found === p.total), scoreText(s));
  // NFPA 79 / JIC tags as the fixture expects them, except the motor names: the design engine calls motors M1…
  // (JIC: motors MTR1…, their starters M1…), so KM1 stays K1 and the motors M1–M3
  assert.deepEqual(s.parts.find((p) => p.label === 'Tags')!.misses, ['KM1 → M2 (got K1)', 'M1 → MTR1', 'M2 → MTR2', 'M3 → MTR3']);
  // the real DXF (sheets 2, 3, 5, 6 of 8): numbered and named from the title blocks
  const text = dxfToText(readFileSync(new URL('../../fixtures/import/cn-rollformer-01/drawings.dxf', import.meta.url), 'utf8'), 'drawings.dxf');
  const heads = text.split('\n').filter((l) => /^--- Sheet/.test(l));
  assert.deepEqual(heads.map((h) => h.match(/Sheet (\d+) of 8/)?.[1]), ['2', '3', '5', '6']);
  for (const [h, t] of heads.map((h, i) => [h, expected.sheets.filter((x) => x.inDxf)[i]] as const)) {
    assert.ok(h.includes(t.titleCn.split(/\s/)[0]) && h.includes(t.title.split(/\s/)[0]), `${h} ↔ ${t.titleCn} / ${t.title}`);
  }
});

await test('cn-rollformer-01 converted: claimed Cat 3 / PL d not met (no STO), relay logic C1–C11 into the PLC, each circuit kept', () => {
  const m = normalizeMachine(CN_ROLLFORMER_01_READING);
  const c = convertMachine(m);
  const sto = c.recommendations.find((r) => /Safe Torque Off/.test(r.text))!.text;
  assert.match(sto, /claim Cat 3 \/ PL d, but the safety relay MSR1 Pilz PNOZ s3/);
  assert.match(sto, /VFD1 \(no STO[^)]*CR1[^)]*\)\), SD1 \(STO not wired; stops only by single CR4 contact/);
  assert.match(sto, /the claimed Cat 3 \/ PL d is not met/);
  assert.deepEqual(c.motors.map((x) => [x.tag, x.hp]), [['M1', 7.5], ['M2', 3]]);
  assert.equal(c.supply, '480VAC-3PH');
  assert.ok(c.parts.find((p) => p.oldTag === 'U1')!.differences.includes('STO wired to the safety relay'));
  assert.equal(c.circuits.length, 24);
  assert.deepEqual(c.circuits.filter((x) => x.becomes === 'drive').map((x) => x.circuit.output), ['KA7', 'U2']);
  assert.match(c.circuits.find((x) => x.circuit.output === 'KT1')!.text, /on-delay 2 s/);
  // the PLC drives the drives itself: VFD forward / reverse / jog, servo ON and CAM engage are outputs; the servo's DOs are separate inputs
  const out = c.io.filter((p) => p.type === 'output').map((p) => p.address);
  for (const a of ['U1 MI1', 'U1 MI2', 'U1 MI3', 'U2 DI1', 'U2 DI7']) assert.ok(out.includes(a), `output ${a}`);
  assert.ok(!out.includes('U2 DI5'), 'the reset button stays wired to the drive');
  const ins = c.io.filter((p) => p.type === 'input').map((p) => p.address);
  for (const a of ['U2 DO1', 'U2 DO3', 'U2 DO5', 'U1 RB-RC', 'U1 RA-RC']) assert.ok(ins.includes(a), `input ${a}`);
  assert.ok(!ins.includes('U2 DO1 / DO3 / DO5'));
  assert.match(c.io.find((p) => p.address === 'U2 DO3')!.description, /cut/);
  // the safety relay contact in the pump circuit stays hardwired; the safety circuit as drawn goes into the description
  const pump = c.circuits.find((x) => x.circuit.output === 'KM1')!;
  assert.deepEqual(pump.hardwired, ['MSR1 13-14']);
  assert.match(pump.text, /stays hardwired in the coil circuit, not through the PLC: MSR1 13-14/);
  assert.ok(c.recommendations.some((r) => r.section === 'safety' && /stay hardwired, not through the PLC/.test(r.text) && /MSR1 23-24 removes 24VS/.test(r.text)));
  seedSampleProject();
  applyExistingMachine(m, c);
  const safety = useSpecStore.getState().sections.safety;
  assert.match(safety, /is not met/);
  assert.match(safety, /Safety circuit as drawn \(kept, new tags\): ESTOP1, ESTOP2 and LS-GD1 in both channels of MSR1/);
  const kept = functionKept(m, c, collectProject()).filter((k) => k.kind === 'circuit');
  assert.equal(kept.length, 24);
  assert.ok(kept.every((k) => k.status !== 'missing'), kept.filter((k) => k.status === 'missing').map((k) => `${k.original}: ${k.note}`).join('\n'));
  assert.ok(kept.find((k) => /^KM1/.test(k.original))!.revalidate);
  // a PLC that can't drive the VFD: the circuits that need it fail
  useIOStore.getState().deletePoint(useIOStore.getState().projectIO.find((p) => /U1 MI2/.test(p.description))!.id);
  const lost = functionKept(m, c, collectProject()).find((k) => k.kind === 'circuit' && /^U1 MI2/.test(k.original))!;
  assert.equal(lost.status, 'missing');
  assert.match(lost.note, /No PLC output for U1 MI2/);
  // only the circuit that uses MI2 fails, not every circuit of the VFD
  const after = functionKept(m, c, collectProject()).filter((k) => k.kind === 'circuit' && k.status === 'missing').map((k) => k.original.split(':')[0]);
  assert.deepEqual(after, ['U1 MI2']);
  // a lost shear-down valve is blamed on itself, not on the shear-up valve with the similar name
  useIOStore.getState().deletePoint(useIOStore.getState().projectIO.find((p) => p.description === 'Shear down valve (剪切下)')!.id);
  const io = functionKept(m, c, collectProject()).filter((k) => k.kind === 'io' && k.status === 'missing').map((k) => k.original);
  assert.ok(io.some((x) => /Shear down valve/.test(x)) && !io.some((x) => /Shear up valve/.test(x)), io.join(' | '));
  assert.equal(m.interlocks.length, 9);
  assert.ok(functionKept(m, c, collectProject()).filter((k) => k.kind === 'interlock').length === 9);
});

await test('thumbnails: the sheet and column a source names, a DXF sheet drawn from its frame', () => {
  assert.deepEqual(parseSource('sheet 3, column 4'), { sheet: 3, column: 4 });
  assert.deepEqual(parseSource('第2页'), { sheet: 2, column: null });
  assert.deepEqual(parseSource('cross-reference /5.4'), { sheet: 5, column: 4 });
  assert.equal(parseSource('parts list, row 5'), null);
  assert.deepEqual(columnCrop(4), { left: 2.5 / 8, right: 4.5 / 8 });
  const ents = parseDxfEntities(readFileSync(new URL('../../e2e/fixtures/convert/roll-former.dxf', import.meta.url), 'utf8'));
  const svg = dxfSheetSvg(ents, sheetFrames(ents)[2]);
  assert.match(svg, /^<svg[^>]+viewBox/);
  assert.match(svg, /CN1-19/, 'sheet 3 text is drawn');
  assert.ok(!/主电路 Main circuit/.test(svg), 'sheet 1 text is not');
});

await test('relay logic kept: C1–C11 as ladder rungs with the new tags, every device with its part', () => {
  const m = normalizeMachine(CN_ROLLFORMER_01_READING);
  assert.equal(toRelayLogic(m, convertMachine(m)).logic, null, 'moved into a PLC: no rungs');
  const c = convertMachine(m, { ...NA_TARGET, logic: 'keep-relays' });
  const { logic, devices, notDrawn } = toRelayLogic(m, c);
  assert.deepEqual(notDrawn, []);
  assert.equal(logic!.supply, '24VDC');
  assert.equal(logic!.rungs.length, 22, 'every relay circuit (the cut command and the E-CAM stay in the servo drive)');
  const rung = (coil: string) => logic!.rungs.find((r) => r.path.some((e) => e.t === 'coil' && e.tag === coil))!;
  // C1: safety relay contact, stop, start ∥ seal-in, the overload of the pump M2 (OL2), contactor coil
  assert.deepEqual(rung('K1').path, [
    { t: 'contact', tag: 'MSR1', nc: false, terms: '13-14', kind: 'safety' }, { t: 'contact', tag: 'PB2', nc: true, kind: 'pb' },
    { t: 'branch', paths: [[{ t: 'contact', tag: 'PB1', nc: false, kind: 'pb' }], [{ t: 'contact', tag: 'K1', nc: false, terms: '13-14', kind: 'relay' }]] },
    { t: 'contact', tag: 'OL2', nc: true, terms: '95-96', kind: 'ol' }, { t: 'coil', tag: 'K1', kind: 'contactor' }]);
  assert.equal(rung('K1').id, 'C1');
  assert.equal(rung('K1').description, 'HYDRAULIC PUMP');
  assert.deepEqual(rung('TR1').path.at(-1), { t: 'coil', tag: 'TR1', kind: 'timer-on', preset: '2 s' }, 'the cut watchdog keeps its preset');
  assert.deepEqual(rung('VFD1').path.at(-1), { t: 'coil', tag: 'VFD1', kind: 'drive-input', terms: 'MI1' });
  assert.ok(rung('CTR1').path.some((e) => e.t === 'coil' && e.kind === 'counter'), 'the batch counter H7CX → CTR1');
  // every tag in the rungs is a device with its new tag (buttons and switches read only from the I/O list included)
  const tags = new Set(devices.map((d) => d.tag));
  for (const r of logic!.rungs) for (const e of r.path.flatMap((x) => (x.t === 'branch' ? x.paths.flat() : [x])) as Exclude<RelayEl, { t: 'branch' }>[]) assert.ok(tags.has(e.tag), `${r.id}: ${e.tag} has no device`);
  assert.equal(devices.find((d) => d.tag === 'K1')!.oldTag, 'KM1');
  assert.ok(devices.find((d) => d.tag === 'K1')!.partNumber, 'the contactor carries its North-America equivalent');
  // applied: the rungs go to the electrical design inputs for the ladder sheets
  seedSampleProject();
  applyExistingMachine(m, c);
  assert.deepEqual(useElectricalStore.getState().inputs.relayLogic, logic);
  applyExistingMachine(m, convertMachine(m));
  assert.equal(useElectricalStore.getState().inputs.relayLogic, undefined, 'moved into a PLC: no relay logic');
  assert.equal(c.circuits.find((x) => x.id === 'C1')!.circuit.output, 'KM1');
  // the shared fixture for the ladder-sheet drawings stays what the converter produces
  assert.deepEqual(JSON.parse(readFileSync(new URL('../../e2e/fixtures/convert/cn-rollformer-01.relayLogic.json', import.meta.url), 'utf8')), JSON.parse(JSON.stringify({ ...logic, devices })),
    'e2e/fixtures/convert/cn-rollformer-01.relayLogic.json is stale: regenerate it from toRelayLogic');
});

await test('the reading as three parts at once: every field in exactly one part; merged = one request (same score)', async () => {
  const all = Object.keys((EXISTING_SCHEMA as { properties: Record<string, unknown> }).properties).filter((k) => k !== 'uncertainties').sort();
  assert.deepEqual(DERIVE_PARTS.flatMap((p) => [...p.fields]).sort(), all, 'each field is read by one part');
  // one schema for every part (a format per part would break the shared prompt cache); the instruction names the fields
  for (const p of DERIVE_PARTS) {
    assert.equal(partSchema(), EXISTING_SCHEMA);
    for (const f of p.fields) assert.ok(p.instruction.includes(f), `${p.id}: instruction names ${f}`);
  }
  // three answers built from the one-request reading give back the same machine
  const full = { ...CN_ROLLFORMER_01_READING, uncertainties: ['Sheet 7 partly legible'] };
  const answers = DERIVE_PARTS.map((p, i) => ({ ...Object.fromEntries(p.fields.map((k) => [k, full[k as keyof typeof full]])), uncertainties: i === 1 ? ['Sheet 7 partly legible', 'KA9 contact unclear'] : ['Sheet 7 partly legible'] }));
  const merged = normalizeMachine(mergeParts(answers as Partial<ExistingMachine>[]));
  assert.deepEqual({ ...merged, uncertainties: [] }, { ...normalizeMachine(full), uncertainties: [] });
  assert.deepEqual(merged.uncertainties, ['Sheet 7 partly legible', 'KA9 contact unclear'], 'uncertainties from all parts, once each');
  assert.equal(scoreReading(merged, CN_ROLLFORMER_01).percent, scoreReading(normalizeMachine(full), CN_ROLLFORMER_01).percent);
  // the requests: the same system and file prefix (cached at its last block), then the part's instruction and schema
  const seen: ClaudeOptions[] = [];
  setClaudeInterceptor(async (o) => {
    seen.push(o);
    const content = o.messages[0].content as { type: string; text?: string }[];
    const part = DERIVE_PARTS.find((p) => content.some((b) => b.text?.includes(p.instruction)));
    const fields = part ? [...part.fields, 'uncertainties'] : Object.keys(full);
    return { reasoning: null, text: JSON.stringify(Object.fromEntries(fields.map((k) => [k, (full as Record<string, unknown>)[k]]))) };
  });
  try {
    const file = new File([readFileSync(new URL('../../e2e/fixtures/convert/roll-former.dxf', import.meta.url), 'utf8')], 'roll-former.dxf');
    const three = await deriveFromUpload({ apiKey: 'k', model: 'm', effort: 'low', split: true }, [file], 'note');
    assert.equal(seen.length, 3);
    assert.ok(seen.every((o) => o.system === seen[0].system), 'one system prompt');
    const prefixes = seen.map((o) => JSON.stringify((o.messages[0].content as unknown[]).slice(0, -1)));
    assert.ok(prefixes.every((x) => x === prefixes[0]), 'the same file prefix for every part');
    assert.deepEqual((seen[0].messages[0].content as { cache_control?: unknown }[]).slice(-2, -1)[0].cache_control, { type: 'ephemeral' }, 'the prefix is cached at its last block');
    assert.ok(seen.every((o) => JSON.stringify(o.schema) === JSON.stringify(EXISTING_SCHEMA)), 'the same output format for every part (the prompt cache keys on it)');
    seen.length = 0;
    const one = await deriveFromUpload({ apiKey: 'k', model: 'm', effort: 'low' }, [file], 'note');
    assert.equal(seen.length, 1, 'one request unless split is asked for');
    assert.deepEqual(three.machine, one.machine);

    // warm-up: the other two parts start when the first one's answer begins (its prompt, files included, is cached by then)
    const order: string[] = [];
    setClaudeInterceptor(async (o) => {
      const i = DERIVE_PARTS.findIndex((p) => (o.messages[0].content as { text?: string }[]).some((b) => b.text?.includes(p.instruction)));
      order.push(`start ${i}`);
      if (i === 0) { await new Promise((r) => setTimeout(r, 20)); order.push('answer 0 begins'); o.onStarted?.(); await new Promise((r) => setTimeout(r, 30)); }
      order.push(`end ${i}`);
      return { reasoning: null, text: JSON.stringify(Object.fromEntries([...DERIVE_PARTS[i].fields, 'uncertainties'].map((k) => [k, (full as Record<string, unknown>)[k]]))) };
    });
    await deriveFromUpload({ apiKey: 'k', model: 'm', effort: 'low', split: true }, [file], 'warm');
    assert.deepEqual(order.slice(0, 2), ['start 0', 'answer 0 begins'], `the first part starts alone, the others wait for its answer to begin: ${order.join(', ')}`);
    assert.ok(order.indexOf('start 1') < order.indexOf('end 0') && order.indexOf('start 2') < order.indexOf('end 0'), `parts 2 and 3 start while part 1 is answering: ${order.join(', ')}`);

    // one part failing stops the others and the reading fails
    const signals: AbortSignal[] = [];
    setClaudeInterceptor(async (o) => {
      const i = DERIVE_PARTS.findIndex((p) => (o.messages[0].content as { text?: string }[]).some((b) => b.text?.includes(p.instruction)));
      signals[i] = o.signal!;
      if (i === 0) { o.onStarted?.(); await new Promise((r) => setTimeout(r, 50)); return { reasoning: null, text: '{}' }; }
      if (i === 1) throw new Error('bad request');
      await new Promise((r) => setTimeout(r, 50));
      return { reasoning: null, text: '{}' };
    });
    await assert.rejects(deriveFromUpload({ apiKey: 'k', model: 'm', effort: 'low', split: true }, [file], 'fail'), /bad request/);
    assert.ok(signals.every((x) => x.aborted), 'the other parts are stopped');
  } finally {
    setClaudeInterceptor(null);
  }
});

await test('merging the parts cross-checks them: unknown tags, a tag listed twice, PLC vs logic', () => {
  const answers = [
    { components: [...CN_ROLLFORMER_01_READING.components, CN_ROLLFORMER_01_READING.components.find((c) => c.tag === 'KA1')!], motors: CN_ROLLFORMER_01_READING.motors, plc: { vendor: 'Mitsubishi', model: 'FX3U', cpuPartNumber: null } },
    { io: CN_ROLLFORMER_01_READING.io, circuits: [...CN_ROLLFORMER_01_READING.circuits, { ...CN_ROLLFORMER_01_READING.circuits[0], output: 'KA99', devices: ['SB2', 'KA99', 'XS7'] }], controller: 'relays' as const },
    { safety: { ...CN_ROLLFORMER_01_READING.safety, estops: ['SB0', 'SB11'] } },
  ] as Partial<ExistingMachine>[];
  const u = mergeParts(answers).uncertainties!;
  assert.ok(u.some((x) => /Not in the parts list or the I\/O.*KA99 \(circuit KA99\).*XS7 \(circuit KA99\).*SB11 \(the safety circuit\)/.test(x)), u.join(' | '));
  assert.ok(u.some((x) => /Listed twice in the parts: KA1\./.test(x)));
  assert.ok(u.some((x) => /A PLC \(Mitsubishi FX3U\) was read, but the logic was read as run by relays/.test(x)));
  // PLC addresses and terminals are not tags to check (Y0, X1:3 in a circuit; an address read from the I/O)
  const plc = mergeParts([{ components: [] }, { io: [{ address: 'Y0', description: 'Pump', type: 'output', category: 'Conveyor', deviceTag: 'KM1', deviceType: 'contactor-coil', confidence: 'high', source: '' }],
    circuits: [{ output: 'KM1', function: 'Pump', kind: 'other', conditions: [], devices: ['Y0', 'X1:3', 'KM1'], setting: null, logicIn: 'relays', confidence: 'high', source: '' }] }, {}] as Partial<ExistingMachine>[]);
  assert.ok(!plc.uncertainties!.some((x) => /Y0|X1/.test(x)), plc.uncertainties!.join(' | '));
  // the reading of cn-rollformer-01 split into its parts raises none of these
  const clean = mergeParts(DERIVE_PARTS.map((p) => Object.fromEntries(p.fields.map((k) => [k, (CN_ROLLFORMER_01_READING as unknown as Record<string, unknown>)[k]]))) as Partial<ExistingMachine>[]);
  assert.deepEqual(clean.uncertainties, []);
});

await test('cn-rollformer-01: the safety relay is sized for its outputs (as drawn + 2 STO channels per drive)', () => {
  const m = normalizeMachine(CN_ROLLFORMER_01_READING);
  assert.deepEqual(safetyOutputsNeeded(m, ['VFD1', 'SD1']), { need: 6, drawn: ['13-14', '23-24'], why: '2 as drawn (13-14, 23-24) + 2 for the STO of each of VFD1, SD1' });
  const sr = () => convertMachine(m).parts.find((p) => p.oldTag === 'KA0')!;
  const now = sr();
  assert.equal(now.status, 'matched');
  assert.ok(safetyOutputCount(now.to!) >= 2);
  assert.ok(now.differences.some((d) => /^Needs 6 safety outputs \(2 as drawn \(13-14, 23-24\) \+ 2 for the STO of each of VFD1, SD1\)/.test(d)), now.differences.join(' | '));
  // with an expansion module its maker lists for that base (forUse) in the catalog, the conversion names it
  const stem = now.to!.partNumber.split(/[-\s.]/)[0];
  const exp = { ...now.to!, partNumber: 'EXP-TEST', family: undefined, description: 'Contact expansion module, 4 N.O. safety outputs', ratings: { safetyOutputs: '(4) N.O.', safetyOutputCount: 4, forUse: `Contact expansion for ${stem} base units` } };
  ALL_PARTS.push(exp);
  try {
    const withExp = sr();
    assert.ok(withExp.differences.some((d) => /here \+ expansion .* EXP-TEST \(4\)/.test(d)), withExp.differences.join(' | '));
    assert.ok(withExp.to!.partNumber.startsWith(stem), 'the base it expands is the choice');
  } finally {
    ALL_PARTS.splice(ALL_PARTS.indexOf(exp), 1);
  }
  // all STO already wired: only the outputs as drawn
  const wired = { ...m, safety: { ...m.safety, drives: m.safety.drives.map((d) => ({ ...d, sto: 'wired' as const })) } };
  assert.ok(convertMachine(wired).parts.find((p) => p.oldTag === 'KA0')!.differences.some((d) => /safety outputs for the 2 needed \(2 as drawn/.test(d)));
});

await test('safety relay sizing: one unit with enough outputs first, else a base + an expansion its maker lists (forUse)', () => {
  const part = (manufacturer: string, partNumber: string, description: string, ratings: Record<string, string | number>, family?: string): CatalogPart =>
    ({ id: partNumber, category: 'safetyRelay', manufacturer, partNumber, description, family, ratings, verified: true } as unknown as CatalogPart);
  const s3 = part('Pilz', '750103', 'PNOZ s3 24VDC 2 n/o: safety relay', { typeName: 'PNOZ s3 24VDC 2 n/o', series: 'PNOZsigma', safetyOutputs: '(2) N.O.', safetyOutputCount: 2 });
  const s7 = part('Pilz', '750107', 'PNOZ s7 24VDC 4 n/o 1 n/c: PNOZsigma contact expansion module', { safetyOutputs: '(4) N.O.', safetyOutputCount: 4, forUse: 'Contact expansion for PNOZsigma base units (e.g. PNOZ s3) via the PNOZsigma connector' }, 'PNOZ s7');
  const lg5925 = part('Dold', 'LG5925-48-61-24', 'Dold safety relay, 3 N.O.', { safetyOutputs: '(3) N.O.', safetyOutputCount: 3 });
  const lg5929 = part('Dold', 'LG5929-60-100-61', 'Dold safety relay extension module, 5 N.O.', { safetyOutputs: '(5) N.O.', safetyOutputCount: 5, forUse: 'Contact extension for Dold E-stop / safety-gate base units with feedback loop (AD spec application drawings: LG5925, LG5924.48)' }, 'LG5929');
  const ug6929 = part('Dold', 'UG6929-60PS-100-24', 'Dold safety relay extension module, 5 N.O.', { safetyOutputs: '(5) N.O.', safetyOutputCount: 5, forUse: 'Contact extension for Dold emergency-stop modules and safety gate monitors (AD spec application example: UG6970)' });
  const scr73 = part('IDEM', 'SCR73-280005', 'Safety relay 7 N.O.', { safetyOutputs: '(7) N.O.', safetyOutputCount: 7 });
  const need = { need: 6, why: 'test' };
  // the count from safetyOutputCount (the text only when it is missing)
  assert.equal(safetyOutputCount(s7), 4);
  assert.equal(safetyOutputCount({ ...s3, ratings: { safetyOutputs: '3 NO (relay)' } }), 3);
  // PNOZ s3 (2) + PNOZ s7 (4): s7 names PNOZsigma / PNOZ s3
  assert.match(sizeSafetyRelay([s3], need, [s7]).note, /2 here \+ expansion Pilz 750107 \(4\)/);
  // LG5925 (3) + LG5929 (5) is listed; UG6929 (for UG6970) is not, even with the same maker and enough outputs
  assert.match(sizeSafetyRelay([lg5925], need, [ug6929, lg5929]).note, /3 here \+ expansion Dold LG5929-60-100-61 \(5\)/);
  assert.match(sizeSafetyRelay([lg5925], need, [ug6929]).note, /this one has 3: add a contact expansion module its maker lists for it/);
  // a single unit with all the outputs is preferred over a pair
  const one = sizeSafetyRelay([s3, lg5925, scr73], need, [s7, lg5929]);
  assert.equal(one.list[0].partNumber, 'SCR73-280005');
  assert.match(one.note, /^7 safety outputs for the 6 needed/);
  // no single unit: the base that has a listed expansion is chosen, even with fewer outputs of its own
  const pair = sizeSafetyRelay([lg5925, s3], need, [s7, ug6929]);
  assert.equal(pair.list[0].partNumber, '750103');
  assert.match(pair.note, /2 here \+ expansion Pilz 750107/);
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
