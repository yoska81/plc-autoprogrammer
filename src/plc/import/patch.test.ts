/// <reference types="node" />
/**
 * Same-PLC upgrade written into the original .L5X: only the changed routine and the tags it needs
 * change; everything else (modules, add-on instructions, other routines, FBD, tasks, message and
 * produced tags) is byte-identical. Other exports list what they will not have.
 * Run with:  npx tsx src/plc/import/patch.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importProgramText } from './index';
import { planUpgrade, type UpgradePlan } from './upgrade';
import { exportUpgrade, upgradeChanges } from './exportUpgrade';
import { gunzipText, gzipText } from './gz';
import { getCpu, getProfile } from '../core/profiles';
import { resolveAddresses, type ExportContext } from '../core/profile';
import { moduleSlots } from '../core/modules';
import type { LadderProgram, Rung } from '../core/ladder';
import type { IOPoint } from '../../types/io';

const here = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => readFileSync(join(here, '__fixtures__', f), 'utf8');

function setup(file: string) {
  const text = read(file);
  const imp = importProgramText(file, text);
  const plan = planUpgrade(imp, 'logix', new Date(Date.UTC(2025, 0, 1)));
  let i = 0, q = 0;
  const io: IOPoint[] = plan.io.map((p) => ({ ...p, id: p.type === 'input' ? `I${String(++i).padStart(3, '0')}` : `Q${String(++q).padStart(3, '0')}` }));
  const profile = getProfile(plan.plcId);
  const addresses = resolveAddresses(profile, getCpu(profile, plan.cpuId), io, moduleSlots(plan.modules));
  const labels = new Map<string, string>();
  for (const p of io) labels.set(addresses.get(p.id)!, p.description);
  const ctx: ExportContext = { io, addresses, labels, header: 't', extraTags: [], cpuId: plan.cpuId, modules: moduleSlots(plan.modules), projectName: imp.source.projectName, now: new Date(Date.UTC(2025, 0, 1)) };
  const target = (plcId = 'logix') => ({ plcId, ctx, fullFiles: () => [{ name: 'full.L5X', content: 'full' }] });
  return { text, imp, plan, io, ctx, target };
}

const editRung = (p: LadderProgram, pred: (r: Rung) => boolean, fn: (r: Rung) => Rung): LadderProgram => ({ ...p, rungs: p.rungs.map((r) => (pred(r) ? fn(r) : r)) });
/** The file with the [start, end) range of one routine cut out. */
function routineRange(xml: string, name: string): [number, number] {
  const s = xml.search(new RegExp(`<Routine\\s[^>]*Name="${name}"`));
  return [s, xml.indexOf('</Routine>', s) + '</Routine>'.length];
}

// ── Capper: one rung of the Sequence routine changed ──
{
  const { text, plan, target } = setup('capper.L5X');
  const seqId = plan.program.blocks!.find((b) => b.name === 'Sequence')!.id;
  const first = plan.program.rungs.find((r) => r.block === seqId)!;
  const now = editRung(plan.program, (r) => r.id === first.id, (r) => ({ ...r, comment: 'Upgraded: wait for the guard', branches: r.branches.map((b) => [...b, { type: 'NO', address: plan.program.tags.find((t) => t.nickname === 'Machine_Running')!.address }]) }));
  const ex = exportUpgrade(plan.original, text, now, target());
  assert.equal(ex.mode, 'patch');
  assert.deepEqual(ex.changed, ['MainProgram / Sequence']);
  assert.equal(ex.missing.length, 0, ex.missing.join(' | '));
  assert.equal(ex.files[0].name, 'capper_upgraded.L5X');
  const out = ex.files[0].content;
  const [a0, a1] = routineRange(text, 'Sequence'), [b0, b1] = routineRange(out, 'Sequence');
  assert.equal(out.slice(0, b0), text.slice(0, a0), 'everything before the Sequence routine is byte-identical');
  assert.equal(out.slice(b1), text.slice(a1), 'everything after it is byte-identical');
  const seq = out.slice(b0, b1);
  assert.match(seq, /Upgraded: wait for the guard/);
  assert.match(seq, /XIC\(Machine_Running\)/, 'original tag names in the new rung');
  assert.match(seq, /MSG\(Line_Msg\)/, 'the MSG the app could not draw is written back in place');
  assert.match(seq, /TON\(Spin_Tmr,/);
  // Re-import: same rungs as the app has now.
  const back = importProgramText('capper_upgraded.L5X', out);
  assert.equal(back.program.rungs.length, now.rungs.length, 'same rung count after the round trip');
  assert.ok(back.program.rungs.some((r) => r.comment === 'Upgraded: wait for the guard'));
}

// ── Capper: only a rung comment changed → only that comment changes in the file ──
{
  const { text, plan, target } = setup('capper.L5X');
  const seal = plan.program.rungs.find((r) => r.comment.startsWith('Machine run:'))!;
  const now = editRung(plan.program, (r) => r.id === seal.id, (r) => ({ ...r, comment: 'Machine run (checked 2025)' }));
  const out = exportUpgrade(plan.original, text, now, target()).files[0].content;
  assert.equal(out, text.replace(seal.comment, 'Machine run (checked 2025)'), 'the original file with one comment changed, nothing else');
}

// ── Box line with an add-on instruction, JSRs, an FBD routine, a MESSAGE and a produced tag ──
{
  const { text, imp, plan, target } = setup('conveyor_aoi.L5X');
  assert.ok(imp.report.outside.some((x) => /Add-on instruction Motor_Start/.test(x)));
  assert.ok(imp.report.outside.some((x) => /FBD routine Speed_FBD/.test(x)));
  assert.ok(imp.report.outside.some((x) => /MESSAGE tag Line_Msg/.test(x)) && imp.report.outside.some((x) => /Produced tag Line_Status/.test(x)));
  assert.ok(plan.program.rungs.some((r) => r.outputs.some((o) => o.type === 'RAW' && o.text === 'Motor_Start(Conv_Motor,Start_PB,Stop_PB)')), 'the AOI call is kept as written');

  // Unchanged: the download is the original file.
  const same = exportUpgrade(plan.original, text, plan.program, target());
  assert.equal(same.files[0].content, text, 'nothing changed: byte-identical');
  assert.equal(same.changed.length, 0);

  // A new rung in Auto_Seq using a new timer: only Auto_Seq and the new tag change.
  const autoId = plan.program.blocks!.find((b) => b.name === 'Auto_Seq')!.id;
  const running = plan.program.tags.find((t) => t.nickname === 'Running')!.address;
  const added: Rung = { id: 'r_new', block: autoId, comment: 'Upgraded: stop diverting 10 s after the last box', branches: [[{ type: 'NO', address: running }]], outputs: [{ type: 'TMR', address: 'T9', mode: 'OFF_DELAY', preset: '10', unit: 'sec', accumulate: false, resetAddress: null }] };
  const now: LadderProgram = { ...plan.program, rungs: [...plan.program.rungs, added], tags: [...plan.program.tags, { address: 'T9', nickname: 'Divert_Off_Tmr', comment: 'added' }] };
  const ex = exportUpgrade(plan.original, text, now, target());
  assert.deepEqual(ex.changed, ['MainProgram / Auto_Seq']);
  assert.deepEqual(ex.newTags, ['Divert_Off_Tmr']);
  const out = ex.files[0].content;
  const [a0, a1] = routineRange(text, 'Auto_Seq'), [b0, b1] = routineRange(out, 'Auto_Seq');
  const tagAt = out.indexOf('<Tag Name="Divert_Off_Tmr"');
  assert.ok(tagAt > 0 && tagAt < b0);
  const tagEnd = out.indexOf('</Tag>', tagAt) + '</Tag>\n'.length;
  assert.equal(out.slice(0, tagAt) + out.slice(tagEnd, b0), text.slice(0, a0), 'before Auto_Seq: identical except the one added tag');
  assert.equal(out.slice(b1), text.slice(a1), 'after Auto_Seq (FBD routine, tasks): identical');
  for (const keep of ['<AddOnInstructionDefinition Name="Motor_Start"', 'Motor_Start(Conv_Motor,Start_PB,Stop_PB)', 'XIC(Auto_Sel)JSR(Auto_Seq,0)', '<FBDContent', 'TagType="Produced"', 'DataType="MESSAGE"']) assert.ok(out.includes(keep), `${keep} kept`);
  assert.match(out.slice(b0, b1), /TOF\(Divert_Off_Tmr,10000,0\)/);
  const back = importProgramText('again.L5X', out);
  assert.equal(back.program.rungs.length, now.rungs.length, 'same rung count after the round trip');

  // Another PLC: the download says what it will not have, before the user downloads.
  const other = exportUpgrade(plan.original, text, now, target('micro800'));
  assert.equal(other.mode, 'full');
  for (const m of [/Motor_Start\(Conv_Motor.*TODO comment/, /MSG\(Line_Msg\).*TODO comment/, /Add-on instruction Motor_Start/, /FBD routine Speed_FBD/, /module configuration/]) assert.ok(other.missing.some((x) => m.test(x)), `missing lists ${m}`);
  // Same PLC without the original file: a new project, and it says so.
  const noFile = exportUpgrade(plan.original, null, now, target());
  assert.equal(noFile.mode, 'full');
  assert.ok(noFile.missing.some((x) => /new project file/.test(x)) && noFile.missing.some((x) => /not declared/.test(x)));
}

// ── "Original vs now" beyond the rungs ──
{
  const { plan, io } = setup('capper.L5X');
  const p: UpgradePlan = plan;
  const ioNow: IOPoint[] = [...io.map((x) => (x.id === 'I001' ? { ...x, description: 'Start pushbutton (new)' } : x)).filter((x) => x.id !== 'Q002'), { id: 'Q009', description: 'Reject gate', type: 'output', category: 'Spare' }];
  const progNow: LadderProgram = { ...p.program, tags: [...p.program.tags.filter((t) => t.nickname !== 'Fault_Latch'), { address: 'C99', nickname: 'Guard_Latch', comment: '' }], blocks: [...p.program.blocks!, { id: 'b_new', name: 'Reject', description: '' }], rungs: [...p.program.rungs, { id: 'rx', block: 'b_new', comment: '', branches: [], outputs: [{ type: 'OUT', address: 'C99' }] }] };
  const ch = upgradeChanges(p.original, ioNow, progNow);
  assert.deepEqual(ch.io.renamed.map((r) => r.to), ['I001 Start pushbutton (new)']);
  assert.equal(ch.io.removed.length, 1);
  assert.deepEqual(ch.io.added, ['Q009 Reject gate']);
  assert.deepEqual(ch.tags.added, ['Guard_Latch (C99)']);
  assert.ok(ch.tags.removed.some((t) => t.startsWith('Fault_Latch')));
  assert.deepEqual(ch.blocksAdded, ['Reject']);
}

// ── The original file is kept compressed ──
await (async () => {
  const text = read('capper.L5X');
  const gz = await gzipText(text);
  assert.ok(gz.length < text.length / 3, `compressed ${text.length} → ${gz.length}`);
  assert.equal(await gunzipText(gz), text);
})();

console.log('patch.test: all passed');
