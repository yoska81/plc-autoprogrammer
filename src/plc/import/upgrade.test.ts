/// <reference types="node" />
/**
 * "Upgrade existing program": an imported L5X becomes the project (PLC, I/O, program, description),
 * is changed, and is exported again under its original names with a diff against the original.
 * Run with:  npx tsx src/plc/import/upgrade.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importProgramText } from './index';
import { clickNicknames, planUpgrade, programSummary } from './upgrade';
import { getProfile, getCpu } from '../core/profiles';
import { resolveAddresses } from '../core/profile';
import { moduleSlots } from '../core/modules';
import { diffPrograms, summarizeDiff } from '../core/diff';
import { buildL5x } from '../core/profiles/l5x';
import { validateProgram } from '../core/validate';
import type { IOPoint } from '../../types/io';

const here = dirname(fileURLToPath(import.meta.url));
const capper = importProgramText('capper.L5X', readFileSync(join(here, '__fixtures__', 'capper.L5X'), 'utf8'));

{
  const plan = planUpgrade(capper, 'click', new Date(Date.UTC(2024, 0, 1)));
  assert.equal(plan.plcId, 'logix', 'an L5X stays on Logix');
  const profile = getProfile(plan.plcId);
  const cpu = getCpu(profile, plan.cpuId);
  assert.ok(plan.modules.length > 0, 'modules chosen to hold the I/O');
  const io: IOPoint[] = plan.io.map((p, k) => ({ ...p, id: p.type === 'input' ? `I${String(plan.io.slice(0, k + 1).filter((x) => x.type === 'input').length).padStart(3, '0')}` : `Q${String(plan.io.slice(0, k + 1).filter((x) => x.type === 'output').length).padStart(3, '0')}` }));
  const addresses = resolveAddresses(profile, cpu, io, moduleSlots(plan.modules));
  assert.equal(io.length, capper.io.length);
  assert.ok(io.every((p) => addresses.get(p.id)), 'every I/O point has an address on the chosen PLC');

  // I/O keeps its original names as nicknames.
  const startAddr = addresses.get(io[capper.io.findIndex((p) => p.name === 'Start_PB')].id)!;
  assert.ok(plan.program.tags.some((t) => t.address === startAddr && t.nickname === 'Start_PB'), 'Start_PB keeps its name');
  const issues = validateProgram(plan.program, profile, new Set(addresses.values())).filter((i) => i.severity === 'error');
  assert.equal(issues.length, 0, issues.map((i) => i.message).join(' | '));

  // Description and questions from the program.
  assert.match(plan.spec.overview ?? '', /1769-L33ER/);
  assert.match(plan.spec.sequence ?? '', /Spin_Tmr/);
  assert.match(plan.spec.operator ?? '', /Start_PB/);
  assert.ok(plan.questions.some((q) => /MSG/.test(q)), 'the instruction that was not converted becomes a question');
  assert.match(programSummary(capper), /19 of 20 converted/);

  // The user changes one rung; the diff shows it and the export keeps the original names.
  const upgraded = { ...plan.program, rungs: plan.program.rungs.map((r, i) => (i === 0 ? { ...r, comment: `${r.comment} (upgraded)` } : r)) };
  const d = diffPrograms(plan.original.program, upgraded);
  assert.equal(summarizeDiff(d), '1 changed');
  const labels = new Map<string, string>();
  for (const p of io) labels.set(addresses.get(p.id)!, p.description);
  const l5x = buildL5x(upgraded, { io, addresses, labels, header: 'test', extraTags: [], cpuId: plan.cpuId, modules: moduleSlots(plan.modules), projectName: capper.source.projectName, now: new Date(Date.UTC(2024, 0, 1)) });
  for (const n of ['Start_PB', 'Machine_Running', 'Spin_Tmr', 'Step']) assert.ok(l5x.includes(`Name="${n}"`), `${n} in the exported L5X`);
  const back = importProgramText('again.L5X', l5x);
  assert.ok(back.report.notConverted.every((n) => n.kept), 'nothing lost: the MSG comes back as it was');
  assert.ok(back.io.some((p) => p.name === 'Start_PB'), 'imports back with the same I/O names');
}

// A CLICK nickname list goes on CLICK; formats the app has no PLC for go on the current ladder PLC.
{
  const click = importProgramText('n.csv', readFileSync(join(here, '__fixtures__', 'click_nicknames.csv'), 'utf8'));
  assert.equal(planUpgrade(click, 'logix').plcId, 'click');
  const st = importProgramText('filler.xml', readFileSync(join(here, '__fixtures__', 'filler_plcopen.xml'), 'utf8'));
  assert.equal(planUpgrade(st, 'logix').plcId, 'logix');
  assert.equal(planUpgrade(st, 'generic-st').plcId, 'click');
}

// CLICK nicknames only for a CLICK target: 24 characters of [A-Za-z0-9_], unique, full name in the comment.
{
  const t = clickNicknames([
    { address: 'DF1', nickname: 'Capper.Torque_SP', comment: 'REAL' },
    { address: 'C1', nickname: 'Conveyor_Infeed_Running_Fwd', comment: '' },
    { address: 'C2', nickname: 'Conveyor_Infeed_Running_Rev', comment: '' },
    { address: 'C3', nickname: 'Start_PB', comment: 'x' },
  ]);
  assert.deepEqual(t.map((x) => x.nickname), ['Capper_Torque_SP', 'Conveyor_Infeed_Running', 'Conveyor_Infeed_Runnin_2', 'Start_PB']);
  assert.equal(t[0].comment, 'Original: Capper.Torque_SP — REAL');
  assert.equal(t[3].comment, 'x', 'unchanged names keep their comment');
  // Address-like names (a Mitsubishi device left as the name) are misleading on a CLICK: from the description, else Orig_….
  const a = clickNicknames([
    { address: 'CT1', nickname: 'C1', comment: 'Good bottles' },
    { address: 'T1', nickname: 'T5', comment: '' },
    { address: 'C3', nickname: 'M100', comment: 'Step 0: wait for a bottle' },
  ]);
  assert.deepEqual(a.map((x) => x.nickname), ['Good_bottles', 'Orig_T5', 'Step_0_wait_for_a_bottle']);
  assert.ok(clickNicknames([{ address: 'C9', nickname: 'D7', comment: 'Rejected bottles preset for the batch' }])[0].nickname === 'Rejected_bottles_preset', 'whole words, no trailing _');
  const dup = clickNicknames([{ address: 'C1', nickname: 'Conveyor_Infeed_Long_Name_A', comment: '' }, { address: 'C2', nickname: 'Conveyor_Infeed_Long_Name_B', comment: '' }]).map((x) => x.nickname);
  assert.ok(dup.every((x) => !/__/.test(x) && x.length <= 24) && dup[0] !== dup[1], dup.join(' '));
  assert.equal(a[1].comment, 'Original: T5');
  assert.equal(planUpgrade(capper, 'click').program.tags.find((x) => x.nickname === 'Capper.Torque_SP')?.address.startsWith('DF'), true, 'Logix target: original names');
}

console.log('upgrade.test: all passed');
