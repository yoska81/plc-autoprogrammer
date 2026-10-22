/**
 * The remake coverage (remake.ts) on the synthetic MPE720 demo project: per target PLC it is what the real
 * "Move it to another PLC" gives (choosePlcBrand, then the checker), and working it out changes nothing.
 * Run with:  npx tsx src/plc/import/remake.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readYmw7 } from './mpe720';
import { convertForeign } from './convert';
import { applyUpgrade } from './ui/applyUpgrade';
import { remakeCoverage, remakeCoverageAll, remakeCoverageText, withServoPlaceholders } from './remake';
import { TODO_VENDOR } from '../core/ladder';
import { explainProgram, explanationText } from '../tidy/explain';
import { validateProgram } from '../core/validate';
import { getProfile, PLC_PROFILES } from '../core/profiles';
import { choosePlcBrand } from '../core/choosePlc';
import { collectProject } from '../../deliverables/collect';
import { useProjectStore } from '../../store/useProjectStore';
import { useIOStore } from '../../store/useIOStore';
import { useProgramStore } from '../../store/useProgramStore';
import { useHmiStore } from '../../store/useHmiStore';
import '../../hmi/ioParticipant';

const bytes = new Uint8Array(readFileSync(new URL('./__fixtures__/demo_mp.YMW7', import.meta.url)));
const load = () => applyUpgrade(convertForeign(readYmw7(bytes, 'demo_mp.YMW7'), 'demo_mp.YMW7'));
const project = () => {
  const { plcId, cpuId, modules } = useProjectStore.getState();
  return { io: useIOStore.getState().projectIO, plcId, cpuId, modules, program: useProgramStore.getState().ladder, hmi: useHmiStore.getState().design };
};

load();
assert.equal(useProjectStore.getState().plcId, 'yaskawa-mp');
const before = JSON.stringify(project());
const all = remakeCoverageAll(project());
assert.equal(JSON.stringify(project()), before, 'working out the coverage changes nothing');
assert.ok(!all.some((c) => c.plcId === 'yaskawa-mp'), 'not the program\'s own read-only PLC');
assert.ok(all.some((c) => c.plcId === 'siemens-s7') && all.some((c) => c.plcId === 'click') && all.some((c) => c.plcId === 'generic-st'));

for (const c of all) {
  // The real move, on a fresh copy of the import.
  load();
  choosePlcBrand(c.plcId);
  const s = collectProject();
  assert.equal(s.profile.id, c.plcId);
  assert.equal(s.cpu.id, c.cpuId, `${c.plcId}: the same CPU as the move`);
  assert.equal(s.ladder.rungs.length, c.rungs);
  const bad = new Set(s.issues.filter((i) => i.severity === 'error' && i.rungId && !/cannot run on|not run, rewrite by hand|not converted/i.test(i.message)).map((i) => i.rungId));
  const raw = s.ladder.rungs.filter((r) => [...r.branches.flat(), ...r.outputs].some((x) => x.type === 'RAW'));
  assert.equal(c.converted, s.ladder.rungs.filter((r) => !raw.includes(r) && !bad.has(r.id)).length, `${c.plcId}: as many rungs convert as after the move`);
  // The demo: 11 rungs, one with an instruction the reader does not know (its drawing call is the drawing itself, mpe720.ts).
  assert.deepEqual([c.rungs, c.converted, c.percent], [11, 10, 90], `${c.plcId}: ${JSON.stringify(c)}`);
  assert.deepEqual(c.kept.map((k) => k.what).sort(), ['unknown instruction']);
  assert.deepEqual(c.errors, [], `${c.plcId}: no checker errors (generic ST reads the program's timers as timers)`);
}
load();
assert.equal(remakeCoverage(project(), 'generic-st').errors.length, 0);

// The text to share: counts and instruction kinds only. No tag, register, value or comment of the program, even
// when a kept instruction starts with a tag name or the checker names operands.
{
  load();
  const base = project();
  const tag = base.program.tags.find((t) => t.nickname)!;
  const odd = { ...base, program: { ...base.program, rungs: [...base.program.rungs,
    { id: 'r_x1', comment: 'secret comment', branches: [], outputs: [{ type: 'RAW' as const, vendor: 'yaskawa-mp', text: `${tag.nickname.toUpperCase()} := 42` }] },
    { id: 'r_x2', comment: '', branches: [], outputs: [{ type: 'RAW' as const, vendor: 'yaskawa-mp', text: 'MOVW MW00123, #77' }] },
  ] } };
  const text = remakeCoverageText(odd);
  assert.match(text, /^ISA Auto Programmer: remake coverage \(counts only/);
  assert.match(text, /Siemens S7-1200 \/ S7-1500: 10 of 13 rungs convert \(76%\); kept: unknown instruction \(codes 0xaf\) ×1; other instruction ×1; MOVW ×1\./);
  const secrets = [
    ...odd.program.tags.flatMap((t) => [t.address, t.nickname, t.comment]),
    ...odd.io.flatMap((x) => [x.description, x.plcAddress ?? '']),
    'secret comment', 'MW00123', '#77', '42',
  ].filter((x) => x && x.length > 2);
  for (const x of secrets) assert.ok(!text.toUpperCase().includes(x.toUpperCase()), `the shared text names "${x}"`);
  assert.doesNotMatch(text, /\b[IOM][BWLF][0-9A-F]{4,}/, 'no MPE720 register');
}

// Servo (motion) registers: the import keeps them as memory, but on another PLC they are the axis itself. Their
// rungs do not count as converted: they wait for the axis to be set up there (a synthetic two-rung program).
{
  const fp = {
    format: 'yaskawa-mpe720' as const, vendor: 'Yaskawa', controller: 'CPU-301', modules: [], projectName: 'servo', notes: [], outside: [],
    tags: [
      { name: 'IB00000', dataType: 'BOOL' as const, address: 'IB00000', comment: 'Start', io: 'input' as const },
      { name: 'OW8008', dataType: 'INT' as const, address: 'OW8008', comment: '' },
      { name: 'IL8016', dataType: 'DINT' as const, address: 'IL8016', comment: '' },
      { name: 'MW00010', dataType: 'INT' as const, address: 'MW00010', comment: '' },
      { name: 'MW00011', dataType: 'INT' as const, address: 'MW00011', comment: '' },
    ],
    routines: [{ name: 'H01', language: 'ladder' as const, untranslated: [], rungs: [
      { id: 'a', comment: '', branches: [[{ type: 'NO' as const, address: 'IB00000' }]], outputs: [{ type: 'COPY' as const, source: '1', dest: 'OW8008' }] },
      { id: 'b', comment: '', branches: [], outputs: [{ type: 'COPY' as const, source: 'IL8016', dest: 'MW00010' }] },
      { id: 'c', comment: '', branches: [], outputs: [{ type: 'COPY' as const, source: 'MW00010', dest: 'MW00011' }] },
    ] }],
  };
  applyUpgrade(convertForeign(fp, 'servo.YMW7'));
  const c = remakeCoverage(project(), 'siemens-s7');
  assert.deepEqual([c.rungs, c.converted], [3, 1], 'only the rung without a servo register converts');
  assert.deepEqual(c.kept, [{ what: 'servo register', count: 2 }]);
  assert.deepEqual(c.motion, [{ circuit: 1, axis: 1, rungs: 2 }]);
  assert.match(remakeCoverageText(project()), /Siemens S7-1200 \/ S7-1500: 1 of 3 rungs convert \(33%\); kept: servo register ×2; servo axes to set up: circuit 1 axis 1 \(2 rungs\)\./);

  // The remade program gets one placeholder block per axis: notes to complete, no logic, the axis's tags renamed.
  const before = project().program;
  const placed = withServoPlaceholders(before, 'siemens-s7', () => 'Feed roll');
  const block = placed.blocks!.find((b) => b.id === 'b_servo_c1_a1')!;
  assert.equal(block.name, 'SERVO AXIS 1 Feed roll — to set up on Siemens S7-1200 / S7-1500');
  const note = placed.rungs.find((r) => r.block === block.id)!;
  assert.equal(note.branches.length, 0);
  assert.ok(note.outputs.every((o) => o.type === 'RAW' && o.vendor === TODO_VENDOR), 'notes only');
  const text = note.outputs[0].type === 'RAW' ? note.outputs[0].text : '';
  assert.match(text, /^SERVO AXIS 1 Feed roll — to set up on Siemens S7-1200 \/ S7-1500: in TIA Portal add a technology object TO_PositioningAxis/);
  assert.match(text, /Axis1_motion_command \(was OW8008, motion command\); Axis1_actual_position \(was IL8016, actual position \(APOS\)\)/);
  assert.deepEqual(placed.tags.filter((t) => t.native).map((t) => [t.nickname, t.native]), [['Axis1_motion_command', 'OW8008'], ['Axis1_actual_position', 'IL8016']]);
  assert.equal(withServoPlaceholders(placed, 'siemens-s7').rungs.length, placed.rungs.length, 'once per axis');
  assert.match(withServoPlaceholders(before, 'logix').rungs.at(-1)!.outputs[0].type === 'RAW' ? (withServoPlaceholders(before, 'logix').rungs.at(-1)!.outputs[0] as { text: string }).text : '', /AXIS_CIP_DRIVE[\s\S]*MSO[\s\S]*MAM/);
  // Not counted as rungs of the original; the checker says "to complete", never "cannot run".
  const p2 = { ...project(), program: placed };
  assert.deepEqual([remakeCoverage(p2, 'siemens-s7').rungs, remakeCoverage(p2, 'siemens-s7').converted], [3, 1]);
  const issues = validateProgram(placed, getProfile('siemens-s7'), new Set(), undefined).filter((i) => i.rungId === note.id);
  assert.deepEqual(issues.map((i) => [i.severity, i.message.slice(0, 40)]), [['warning', 'To complete by hand: SERVO AXIS 1 Feed r']]);
  // Explain lists it apart: to complete by hand, not an instruction of the old PLC.
  choosePlcBrand('siemens-s7');
  useProgramStore.getState().editLadder(withServoPlaceholders(useProgramStore.getState().ladder, 'siemens-s7'));
  const explained = explanationText(explainProgram(collectProject()));
  assert.match(explained, /To complete by hand: SERVO AXIS 1 — to set up on Siemens S7-1200 \/ S7-1500\./);
  assert.match(explained, /To complete by hand:\n- SERVO AXIS 1 — to set up on Siemens/);
  assert.doesNotMatch(explained, /cannot read[\s\S]*SERVO AXIS/);
  // Every PLC's export writes the note as a comment / TODO, and nothing that runs.
  for (const profile of PLC_PROFILES.filter((x) => x.available && x.exporters?.length)) {
    const ctx = { io: [], addresses: new Map<string, string>(), labels: new Map<string, string>(), header: 'test', extraTags: [], cpuId: profile.defaultCpuId, modules: [], projectName: 'servo', now: new Date(0) };
    const just = { ...placed, rungs: placed.rungs.filter((r) => r.id === note.id) };
    for (const ex of profile.exporters!) {
      // The program files (not the tag, variable, operand and I/O lists).
      if (/nicknames|vars|tags|-io$|operands/.test(ex.id)) continue;
      const out = ex.files ? ex.files(just, ctx, 'servo').map((f) => f.content).join('\n') : ex.build(just, ctx);
      assert.ok(/SERVO AXIS 1/.test(out), `${profile.id} ${ex.id}: the note is in the export`);
    }
  }
}

console.log('remake coverage tests passed');
