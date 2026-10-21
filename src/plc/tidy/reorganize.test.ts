/// <reference types="node" />
/**
 * "Reorganize program": each transform found and applied on its own, the defaults main asked for (internal bits on;
 * registers, retentive memory and never-true rungs off), the same behaviour in the simulator, a read-only Yaskawa
 * program kept in its blocks, and the exports still valid afterwards.
 * Run with:  npx tsx src/plc/tidy/reorganize.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedSampleProject, LADDER } from '../../preview/sampleProject';
import { collectProject } from '../../deliverables/collect';
import { exportContext } from '../../deliverables/exportContext';
import { useProgramStore } from '../../store/useProgramStore';
import { applyEquipment } from '../../spec/equipment';
import { importProgramFiles, importProgramText } from '../import';
import { applyUpgrade } from '../import/ui/applyUpgrade';
import { buildScl } from '../core/profiles/siemens';
import { buildL5x } from '../core/profiles/l5x';
import { clickRungListing } from '../core/clickExport';
import { validateProgram } from '../core/validate';
import type { LadderProgram } from '../core/ladder';
import { applyReorganize, planReorganize, plcBaseline, type SectionId } from './reorganize';
import { checkEquivalence, equivalenceSummary } from './equivalence';

const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };
const here = dirname(fileURLToPath(import.meta.url));
const defaults = (plan: ReturnType<typeof planReorganize>) => new Set(plan.sections.filter((s) => s.defaultOn).map((s) => s.id));
const plantOf = (p: ReturnType<typeof collectProject>) => p.io.map((x) => ({ address: p.addresses.get(x.id) ?? '', description: x.description, type: x.type, category: x.category }));

// The example: the default transforms keep the behaviour, every rung commented, blocks by function.
{
  seedSampleProject();
  useProgramStore.getState().setGeneratedLadder(structuredClone(LADDER), 'x', null);
  const p = collectProject();
  const plan = planReorganize(p);
  const after = applyReorganize(p, plan, defaults(plan));
  const r = checkEquivalence(p.ladder, after, { random: 40, steps: 40, plant: plantOf(p), plantSequences: 30, observe: (p.hmi?.tags ?? []).map((t) => t.address) });
  assert.deepEqual(r.differences, [], equivalenceSummary(r));
  assert.ok(after.rungs.every((x) => x.comment.trim()));
  assert.ok((after.blocks ?? []).length >= 3, (after.blocks ?? []).map((b) => b.name).join(', '));
  assert.ok(after.rungs.every((x) => (after.blocks ?? []).some((b) => b.id === x.block)), 'every rung in a block');
  console.log(`  example: ${plan.sections.map((s) => `${s.id}${s.defaultOn ? '' : ' (off)'}: ${s.items.length}`).join(' · ')} → ${equivalenceSummary(r).split('.')[0]}`);
}

// Each transform on a small program made for it.
{
  seedSampleProject();
  const l: LadderProgram = { tags: [{ address: 'C10', nickname: 'Used_Flag', comment: '' }], rungs: [
    { id: 'a', comment: '', branches: [[{ type: 'NO', address: 'X001' }]], outputs: [{ type: 'OUT', address: 'Y001' }] },
    { id: 'b', comment: '', branches: [[{ type: 'NO', address: 'X001' }]], outputs: [{ type: 'OUT', address: 'Y002' }] },
    { id: 'dead', comment: '', branches: [[{ type: 'NO', address: 'X002' }]], outputs: [{ type: 'OUT', address: 'C20' }] },
    { id: 'reg', comment: '', branches: [[{ type: 'NO', address: 'X002' }]], outputs: [{ type: 'COPY', source: '5', dest: 'DS200' }] },
    { id: 'never', comment: '', branches: [[{ type: 'NO', address: 'C99' }]], outputs: [{ type: 'OUT', address: 'Y003' }] },
    { id: 'name', comment: 'Start seal', branches: [[{ type: 'NO', address: 'X003' }], [{ type: 'NO', address: 'C30' }]], outputs: [{ type: 'OUT', address: 'C30' }] },
    { id: 'set10', comment: '', branches: [[{ type: 'NO', address: 'X004' }]], outputs: [{ type: 'OUT', address: 'C10' }] },
    { id: 'use', comment: '', branches: [[{ type: 'NO', address: 'C30' }, { type: 'NO', address: 'C10' }]], outputs: [{ type: 'OUT', address: 'Y004' }] },
  ] };
  useProgramStore.getState().setGeneratedLadder(l, 'x', null);
  const p = collectProject();
  const plan = planReorganize(p);
  const sec = (id: SectionId) => plan.sections.find((s) => s.id === id)!;
  assert.deepEqual([...plan.removals['remove-internal']!], ['dead']);
  assert.deepEqual([...plan.removals['remove-registers']!], ['reg'], 'a register nothing reads: its own group');
  assert.deepEqual([...plan.removals['remove-never']!], ['never']);
  assert.deepEqual([sec('remove-internal').defaultOn, sec('remove-registers').defaultOn, sec('remove-never').defaultOn], [true, false, false]);
  assert.deepEqual(plan.merges, [['a', 'b']]);
  assert.ok(plan.names.get('C30')?.startsWith('Start_seal'), JSON.stringify([...plan.names]));
  const after = applyReorganize(p, plan, defaults(plan));
  assert.deepEqual(after.rungs.map((x) => x.id).sort(), ['a', 'name', 'never', 'reg', 'set10', 'use'].sort(), 'internal dead code removed; register and never-true kept');
  assert.equal(after.rungs.find((x) => x.id === 'a')!.outputs.length, 2, 'merged');
  assert.ok(after.tags.some((t) => t.address === 'C30' && t.nickname.startsWith('Start_seal')));
  const r = checkEquivalence(p.ladder, after, { random: 60, steps: 30 });
  assert.deepEqual(r.differences, [], equivalenceSummary(r));
  // Only some: the comments and names, no merge or removal.
  const some = applyReorganize(p, plan, new Set<SectionId>(['rename', 'comment']));
  assert.equal(some.rungs.length, l.rungs.length);
  assert.deepEqual(some.rungs.map((x) => x.id), l.rungs.map((x) => x.id), 'nothing moved without reorder');
}

// Removal across groups: a timer read only by a counter (registers group, off) stays when only internal bits go.
{
  seedSampleProject();
  const l: LadderProgram = { tags: [], rungs: [
    { id: 'tmr', comment: '', branches: [[{ type: 'NO', address: 'X001' }]], outputs: [{ type: 'TMR', address: 'T5', mode: 'ON_DELAY', preset: '1', unit: 'sec', accumulate: false, resetAddress: null }] },
    { id: 'cnt', comment: '', branches: [[{ type: 'NO', address: 'T5' }]], outputs: [{ type: 'CNT', address: 'CT5', direction: 'UP', preset: '3', resetAddress: null }] },
    { id: 'done', comment: '', branches: [[{ type: 'NO', address: 'CT5' }]], outputs: [{ type: 'OUT', address: 'C40' }] },
    { id: 'out', comment: '', branches: [[{ type: 'NO', address: 'X002' }]], outputs: [{ type: 'OUT', address: 'Y001' }] },
  ] };
  useProgramStore.getState().setGeneratedLadder(l, 'x', null);
  const p = collectProject();
  const plan = planReorganize(p);
  assert.deepEqual([[...plan.removals['remove-internal']!].sort(), [...plan.removals['remove-registers']!]], [['done', 'tmr'], ['cnt']], 'the counter is retentive: its own group');
  const ids = (s: SectionId[]) => applyReorganize(p, plan, new Set(s)).rungs.map((x) => x.id);
  assert.deepEqual(ids(['remove-internal']), ['tmr', 'cnt', 'out'], 'the timer the kept counter reads stays');
  assert.deepEqual(ids(['remove-internal', 'remove-registers']), ['out']);
  const r = checkEquivalence(p.ladder, applyReorganize(p, plan, new Set<SectionId>(['remove-internal'])), { random: 30, steps: 30 });
  assert.deepEqual(r.differences, [], equivalenceSummary(r));
}

// Code the original PLC never runs: a routine no JSR calls (L5X, synthetic fixture with one call taken out), rungs an
// unconditional JMP skips; a label no jump goes to is a finding. Off by default; checked against what the PLC runs.
{
  const text = readFileSync(join(here, '..', 'import', '__fixtures__', 'capper.L5X'), 'utf8').replace('JSR(Scaling,0)', 'NOP()');
  applyUpgrade(importProgramText('capper.L5X', text));
  const p = collectProject();
  const plan = planReorganize(p);
  const sec = plan.sections.find((x) => x.id === 'remove-uncalled');
  assert.ok(sec && !sec.defaultOn && sec.items.every((i) => /routine "Scaling" is never called/.test(i)), JSON.stringify(sec));
  const chosen = new Set<SectionId>(['remove-uncalled']);
  const after = applyReorganize(p, plan, chosen);
  const scaling = p.ladder.blocks!.find((b) => b.name === 'Scaling')!.id;
  assert.ok(!after.rungs.some((r) => r.block === scaling) && p.ladder.rungs.some((r) => r.block === scaling));
  const r = checkEquivalence(plcBaseline(p, plan, chosen), after, { random: 20, steps: 20 });
  assert.deepEqual(r.differences, [], equivalenceSummary(r));
}
{
  seedSampleProject();
  const raw = (text: string) => ({ type: 'RAW' as const, text, vendor: 'logix' });
  const l: LadderProgram = { tags: [{ address: 'C77', nickname: 'Old_Flag', comment: '' }, { address: 'DS300', nickname: 'Old_Word', comment: '' }], rungs: [
    { id: 'j', comment: '', branches: [], outputs: [raw('JMP(L1)') as never] },
    { id: 's1', comment: '', branches: [[{ type: 'NO', address: 'X001' }]], outputs: [{ type: 'OUT', address: 'Y001' }] },
    { id: 's2', comment: '', branches: [[{ type: 'NO', address: 'X002' }]], outputs: [{ type: 'OUT', address: 'Y002' }] },
    { id: 'lbl', comment: '', branches: [[raw('LBL(L1)') as never, { type: 'NO', address: 'X003' }]], outputs: [{ type: 'OUT', address: 'Y003' }] },
    { id: 'orphan', comment: '', branches: [[raw('LBL(L9)') as never, { type: 'NO', address: 'X004' }]], outputs: [{ type: 'OUT', address: 'Y004' }] },
  ] };
  useProgramStore.getState().setGeneratedLadder(l, 'x', null);
  const p = collectProject();
  const plan = planReorganize(p);
  assert.deepEqual([...plan.removals['remove-jumped']!], ['s1', 's2']);
  assert.match(plan.sections.find((x) => x.id === 'remove-jumped')!.items[0], /skipped by the unconditional JMP L1 in rung 1 \(its label is in rung 4\)/);
  assert.ok(plan.findings.some((f) => /label L9 — no JMP goes to it/.test(f)), plan.findings.join(' | '));
  assert.deepEqual([...plan.unusedTags], ['C77'], 'a register is kept');
  const tagsSec = plan.sections.find((x) => x.id === 'remove-tags')!;
  assert.ok(tagsSec.defaultOn && /C77 Old_Flag: no rung reads or writes it/.test(tagsSec.items[0]));
  const chosen = new Set<SectionId>(['remove-jumped', 'remove-tags']);
  const after = applyReorganize(p, plan, chosen);
  assert.deepEqual(after.rungs.map((x) => x.id), ['j', 'lbl', 'orphan']);
  assert.deepEqual(after.tags.map((t) => t.address), ['DS300']);
  const r = checkEquivalence(plcBaseline(p, plan, chosen), after, { random: 20, steps: 20 });
  assert.deepEqual(r.differences, [], equivalenceSummary(r));
  // Against the program as the app simulates it (every rung run), the removal would show: hence the baseline.
  assert.ok(checkEquivalence(p.ladder, after, { random: 20, steps: 20 }).differences.length > 0);
}

// Read-only Yaskawa program (synthetic fixture): its blocks (drawings) and their order kept, kept boxes in place.
{
  const bytes = new Uint8Array(readFileSync(join(here, '..', 'import', '__fixtures__', 'demo_mp.YMW7')));
  const { program: imp } = importProgramFiles([{ name: 'demo_mp.YMW7', text: '', bytes }]);
  applyUpgrade(imp);
  const p = collectProject();
  const plan = planReorganize(p);
  assert.ok(plan.keepBlocks);
  const after = applyReorganize(p, plan, defaults(plan));
  const order = (l: LadderProgram) => [...new Set(l.rungs.map((x) => x.block ?? ''))];
  assert.deepEqual(order(after), order(p.ladder), 'the drawings in their order');
  assert.deepEqual(after.blocks, p.ladder.blocks?.map((b) => ({ ...b, description: after.blocks!.find((x) => x.id === b.id)!.description })), 'the same blocks');
  const raw = (l: LadderProgram) => l.rungs.map((x, i) => (x.outputs.some((o) => o.type === 'RAW') || x.branches.some((b) => b.some((e) => e.type === 'RAW')) ? `${i}:${x.id}` : '')).filter(Boolean);
  assert.deepEqual(raw(after).map((s) => s.split(':')[1]), raw(p.ladder).map((s) => s.split(':')[1]), 'kept boxes kept');
}

// Exports after Reorganize: Siemens SCL, Logix L5X (read back), CLICK listing; the checker has no new error.
{
  seedSampleProject();
  useProgramStore.getState().setGeneratedLadder(structuredClone(LADDER), 'x', null);
  const p0 = collectProject();
  const plan = planReorganize(p0);
  const after = applyReorganize(p0, plan, defaults(plan));
  const errs = (l: LadderProgram) => validateProgram(l, p0.profile, new Set([...p0.addresses.values()])).filter((i) => i.severity === 'error').length;
  assert.ok(errs(after) <= errs(p0.ladder), 'no new checker error');
  useProgramStore.getState().setGeneratedLadder(after, 'reorganized', null);
  assert.ok(clickRungListing(after, p0.labels, 'h').length > 0);
  applyEquipment({ cpuId: '6ES7214-1AG40-0XB0', modules: [], hmiPartNumber: null }, null);
  const s7 = collectProject();
  assert.match(buildScl(s7.ladder, exportContext(s7)).scl, /FUNCTION_BLOCK "Machine"/);
  applyEquipment({ cpuId: '5069-L310ER', modules: ['5069-IB16', '5069-OB16'], hmiPartNumber: null }, null);
  const lx = collectProject();
  const back = importProgramText('back.L5X', buildL5x(lx.ladder, exportContext(lx)));
  // The export adds its own rungs (I/O mapping, clock): as many as for the program before Reorganize.
  const before = importProgramText('before.L5X', buildL5x(p0.ladder, exportContext({ ...lx, ladder: p0.ladder })));
  assert.equal(back.program.rungs.length - lx.ladder.rungs.length, before.program.rungs.length - p0.ladder.rungs.length, 'the L5X reads back with every rung');
}

console.log('tidy reorganize tests passed');
