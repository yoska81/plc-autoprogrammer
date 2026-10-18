// npx tsx src/convert/convert.test.ts — reading DXF text, foreign part ratings, conversion to North America, function kept.
import assert from 'node:assert/strict';
import { cleanDxfText, dxfToText, parseDxfTexts } from './dxf';
import { foreignRatings } from './foreignParts';
import { convertMachine, kwToHp, mm2ToAwg, naTags, targetSupply } from './convert';
import { normalizeMachine } from './derive';
import { applyExistingMachine, storedMachine } from './apply';
import { functionKept, functionKeptFindings, similarity } from './functionKept';
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
const test = (name: string, fn: () => void) => { fn(); passed++; console.log('  ok ', name); };

test('DXF: text, MTEXT and attributes in reading order; \\U+ escapes and MTEXT codes decoded', () => {
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
  assert.match(text, /^E-01\.dxf \(DXF export, 3 text items/);
  // same row: left to right; lower rows after
  assert.ok(text.indexOf('启动 Start') < text.indexOf('QF1') && text.indexOf('QF1') < text.indexOf('CAT=CJX2-1210'), text);
  assert.match(dxfToText('0\nEOF'), /no text found/);
});

test('foreign part numbers state their ratings (only what the number says)', () => {
  assert.deepEqual(foreignRatings('CJX2-1210'), { amps: 12, poles: 3 });
  assert.deepEqual(foreignRatings('NXC-25'), { amps: 25, poles: 3 });
  assert.deepEqual(foreignRatings('DZ47-63 3P C16'), { curve: 'C', amps: 16, poles: 3 });
  assert.deepEqual(foreignRatings('DZ47-63 C6'), { curve: 'C', amps: 6 });
  assert.deepEqual(foreignRatings('NR2-25 9-13A'), { minAmps: 9, maxAmps: 13 });
  assert.deepEqual(foreignRatings('DR-60-24'), { outputVolts: 24, outputAmps: 2.5 });
  assert.equal(foreignRatings('E3Z-D61'), null);
});

test('units: kW to standard HP, mm² to AWG, supply to 480 V 60 Hz', () => {
  assert.deepEqual([0.37, 0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5].map(kwToHp), [0.5, 1, 1.5, 2, 3, 5, 5, 7.5, 10]);
  assert.deepEqual([1, 1.5, 2.5, 4, 6].map(mm2ToAwg), ['16 AWG', '14 AWG', '12 AWG', '10 AWG', '8 AWG']);
  const s = targetSupply({ volts: 380, hz: 50, phases: 3, text: '3~380V 50Hz' }, { region: 'US', supply: '480VAC-3PH', controlVolts: '24VDC' });
  assert.equal(s.supply, '480VAC-3PH');
  assert.match(s.note, /20 % faster/);
  assert.ok(!s.question);
  assert.ok(targetSupply({ volts: null, hz: null, phases: null, text: '' }, { region: 'US', supply: '480VAC-3PH', controlVolts: '24VDC' }).question, 'asks when the supply is not drawn');
  assert.equal(targetSupply({ volts: 380, hz: 50, phases: 3, text: '' }, { region: 'Canada', supply: '600VAC-3PH', controlVolts: '24VDC' }).supply, '600VAC-3PH');
});

test('GB / IEC tags become NFPA tags, numbered per kind', () => {
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

test('the Chinese conveyor converted to North America: supply, motors, every part matched or handed to the design', () => {
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

test('a partial AI answer is filled to the full shape', () => {
  const m = normalizeMachine({ summary: 'x', components: [{ tag: 'KM1', partNumber: null, manufacturer: null, description: '', category: 'contactor', confidence: 'low', ratings: { amps: 9 } as never }] });
  assert.equal(m.components[0].ratings.amps, 9);
  assert.equal(m.components[0].ratings.poles, null);
  assert.equal(m.spec.overview, '');
  assert.deepEqual(m.safety.estops, []);
});

test('applied to a project: description, questions, I/O and motors; every function kept once the design has them', () => {
  seedSampleProject();
  const conv = convertMachine(CHINESE_CONVEYOR);
  applyExistingMachine(CHINESE_CONVEYOR, conv);
  assert.equal(useProjectStore.getState().info.region, 'US');
  const spec = useSpecStore.getState().sections;
  assert.match(spec.overview, /Sorting conveyor/);
  assert.match(spec.utilities, /480 VAC 3-phase 60 Hz/);
  assert.match(spec.sequence, /cross-interlocked/);
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
  // a redesign that lost a motor and an I/O point is flagged, and the review shows it
  useIOStore.getState().deletePoint(useIOStore.getState().projectIO.find((p) => /Pusher valve/.test(p.description))!.id);
  el.setDesign({ ...useElectricalStore.getState().design!, inputs: { ...el.inputs, motors: el.inputs.motors.slice(0, 1) } }, 'generated', null);
  const lost = functionKept(CHINESE_CONVEYOR, conv, collectProject()).filter((x) => x.status === 'missing');
  assert.ok(lost.some((x) => x.kind === 'io' && /Pusher valve/.test(x.original)));
  assert.ok(lost.some((x) => x.kind === 'motor' && /M2/.test(x.original)));
  assert.equal(functionKeptFindings(lost).length, lost.length);
  assert.ok(checksFor(collectProject()).some((f) => f.id.startsWith('convert:kept:motor:')), 'the Design review lists it');
});

test('I/O descriptions match by function words', () => {
  assert.ok(similarity('Start (启动)', 'Start pushbutton') >= 0.5);
  assert.ok(similarity('Pusher extended limit (推出到位)', 'Pusher retracted limit') < 1);
  assert.equal(similarity('Conveyor forward contactor', 'Pump contactor'), 0);
});

console.log(`${passed} passed`);
