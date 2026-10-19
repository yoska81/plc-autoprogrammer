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

// A controller of the same family the app does not have (1769-L33ER): never swapped silently.
{
  const { importProgramText } = await import('./index');
  const { readFileSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const capper = importProgramText('capper.L5X', readFileSync(join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'capper.L5X'), 'utf8'));
  // The 1769-L33ER is in the app: the project keeps it, with 1769 Compact I/O modules.
  const plan = planUpgrade(capper, 'click');
  assert.equal(plan.plcId, 'logix');
  assert.equal(plan.cpuId, '1769-L33ER');
  assert.ok(plan.modules.length > 0 && plan.modules.every((m) => /^1769-/.test(m)), plan.modules.join(' '));
  assert.equal(plan.original.cpuNote, undefined);
  // A controller the app does not have (ControlLogix 1756-L83E): said plainly, never swapped silently.
  const other = planUpgrade({ ...capper, source: { ...capper.source, controller: '1756-L83E' } }, 'click');
  assert.match(other.original.cpuNote ?? '', /^Your machine's controller is a 1756-L83E\. The app does not have it yet, so this project shows a .*download into your original \.L5X keeps your controller/);
  assert.equal(other.questions[0], other.original.cpuNote, 'also asked on the Machine description page');
}

// ── Review (1769): the machine's own modules and module points are kept; what is to check is asked ──
{
  const { importProgramText } = await import('./index');
  const { logixTerminal } = await import('./convert');
  const { resolveAddresses } = await import('../core/profile');
  const { getCpu, getProfile } = await import('../core/profiles');
  const { moduleSlots } = await import('../core/modules');
  const { logixIoTag, LOGIX_CPUS, logixProfile } = await import('../core/profiles/logix');
  const { logixIoMapping } = await import('../core/profiles/l5x');
  const { readFileSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const text = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'capper.L5X'), 'utf8');
  const capper = importProgramText('capper.L5X', text);
  assert.deepEqual(capper.source.modules, [{ slot: 1, catalog: '1769-IQ16/A' }, { slot: 2, catalog: '1769-OB16/B' }, { slot: 3, catalog: '1769-IF4/B' }]);
  const plan = planUpgrade(capper, 'click');
  assert.deepEqual(plan.modules, ['1769-IQ16', '1769-OB16', '1769-IF4'], 'the machine\'s own modules, not IQ32 / OB32 / IF8');
  // Every module point exports as the bit it was: Local:2:O.Data.5 stays .5 (not the next free .4).
  let i = 0, q = 0;
  const io = plan.io.map((p) => ({ ...p, id: p.type === 'input' ? `I${++i}` : `Q${++q}` }));
  const profile = getProfile('logix'), cpu = getCpu(profile, plan.cpuId), slots = moduleSlots(plan.modules);
  const addr = resolveAddresses(profile, cpu, io, slots);
  assert.deepEqual(io.map((p) => logixIoTag(addr.get(p.id)!, slots, plan.cpuId)), capper.io.map((p) => p.original));
  // Round-trips on 16- and 32-point modules: O.Data.0 / .5 / .15, I.Data.31.
  const m32 = moduleSlots(['1769-IQ32', '1769-OB16']);
  const l33 = LOGIX_CPUS.find((c) => c.id === '1769-L33ER')!;
  for (const t of ['Local:2:O.Data.0', 'Local:2:O.Data.5', 'Local:2:O.Data.15', 'Local:1:I.Data.31', 'Local:1:I.Data.0']) {
    const base = logixTerminal(t, l33, m32);
    assert.ok(base, t);
    assert.equal(logixIoTag(base!, m32, l33.id), t);
  }
  // A module the app does not have: said plainly.
  const odd = planUpgrade(importProgramText('capper.L5X', text.replace('1769-IF4/B', '1769-IF4XOF2/A')), 'click');
  // Review: the modules the app does have stay (IQ16, OB16); only the analog input is added for the unknown one.
  assert.deepEqual(odd.modules.slice(0, 2), ['1769-IQ16', '1769-OB16'], odd.modules.join(' '));
  assert.ok(odd.modules.length === 3 && /^1769-IF/.test(odd.modules[2]), odd.modules.join(' '));
  assert.match(odd.original.cpuNote ?? '', /Your machine's I\/O modules are 1769-IQ16, 1769-OB16, 1769-IF4XOF2 \(slots 1–3\)\. The app does not have 1769-IF4XOF2, so this project uses .*Check them against the machine/);
  // Embedded I/O (L1 / L2): the slot numbers to check, on the PLC page (CPU notes) and as a question.
  const l2 = planUpgrade({ ...capper, source: { ...capper.source, controller: '1769-L24ER-QBFC1B', modules: [] } }, 'click');
  assert.equal(l2.cpuId, '1769-L24ER-QBFC1B');
  assert.ok(l2.questions.some((x) => /Check in Studio 5000 \(I\/O Configuration\) the I\/O addresses of the 1769-L24ER-QBFC1B: the app puts its embedded I\/O at Local:1 \(analog at Local:2, Ch<n>Data\) and the first expansion module at Local:4/.test(x)), l2.questions.join(' | '));
  assert.ok(LOGIX_CPUS.filter((c) => /^1769-L[12]/.test(c.id)).every((c) => /Check in Studio 5000/.test(c.notes ?? '')));
  // The AI's note and the I/O mapping file speak of the chosen platform.
  assert.match(logixProfile.promptKnowledge(l33), /raw counts unless the module is configured/);
  assert.match(logixProfile.promptKnowledge(LOGIX_CPUS[0]), /already hold engineering units/);
  const ctx = { io: [], addresses: new Map(), labels: new Map(), header: 't', extraTags: [], cpuId: '1769-L33ER', modules: slots, projectName: 'p' };
  const map = logixIoMapping(plan.program, ctx);
  assert.match(map, /CompactLogix 5370 1769-L33ER \+ 1769 Compact I\/O/);
  assert.match(map, /Add the 1769 modules/);
  assert.ok(!/5069|5380/.test(map));
}

console.log('upgrade.test: all passed');
