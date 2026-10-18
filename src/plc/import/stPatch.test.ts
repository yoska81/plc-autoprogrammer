/// <reference types="node" />
/**
 * Same-PLC upgrade written into the original Siemens SCL source / TIA Portal PLCopen XML: only the changed
 * block is rewritten (with the original names), every other block is byte-identical, and the patched file
 * reads back as the program that was exported.
 * Run with:  npx tsx src/plc/import/stPatch.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileText, importProgramFiles } from './index';
import { planUpgrade } from './upgrade';
import { exportUpgrade } from './exportUpgrade';
import { getCpu, getProfile } from '../core/profiles';
import { resolveAddresses, type ExportContext } from '../core/profile';
import { moduleSlots } from '../core/modules';
import type { LadderProgram, Rung } from '../core/ladder';
import type { IOPoint } from '../../types/io';

const here = dirname(fileURLToPath(import.meta.url));
const file = (n: string) => ({ name: n, text: fileText(n, new Uint8Array(readFileSync(join(here, '__fixtures__', n)))) });

function setup(files: { name: string; text: string }[]) {
  const { program: imp, main } = importProgramFiles(files);
  const plan = planUpgrade(imp, 'click', new Date(Date.UTC(2025, 0, 1)));
  let i = 0, q = 0;
  const io: IOPoint[] = plan.io.map((p) => ({ ...p, id: p.type === 'input' ? `I${String(++i).padStart(3, '0')}` : `Q${String(++q).padStart(3, '0')}` }));
  const profile = getProfile(plan.plcId);
  const addresses = resolveAddresses(profile, getCpu(profile, plan.cpuId), io, moduleSlots(plan.modules));
  const labels = new Map<string, string>();
  for (const p of io) labels.set(addresses.get(p.id)!, p.description);
  const ctx: ExportContext = { io, addresses, labels, header: 't', extraTags: [], cpuId: plan.cpuId, modules: moduleSlots(plan.modules), projectName: imp.source.projectName, now: new Date(Date.UTC(2025, 0, 1)) };
  const target = (plcId = plan.plcId) => ({ plcId, ctx, fullFiles: () => [{ name: 'full.scl', content: 'full' }] });
  return { text: main.text, plan, target };
}
const edit = (p: LadderProgram, pred: (r: Rung) => boolean, fn: (r: Rung) => Rung): LadderProgram => ({ ...p, rungs: p.rungs.map((r) => (pred(r) ? fn(r) : r)) });
const addr = (p: LadderProgram, nick: string) => p.tags.find((t) => t.nickname === nick)!.address;
/** Logic of a program by original names: what the file says, whatever the app's ids and addresses. */
const logic = (p: LadderProgram) => {
  const n = new Map(p.tags.map((t) => [t.address, t.nickname]));
  const name = (a: string) => n.get(a) ?? a;
  return p.rungs.map((r) => JSON.stringify({ b: r.branches.map((b) => b.map((e) => ('address' in e ? `${e.type}:${name(e.address)}` : e.type === 'CMP' ? `${name(e.left)}${e.op}${name(e.right)}` : e.type))), o: r.outputs.map((o) => ('address' in o ? `${o.type}:${name(o.address)}` : o.type === 'COPY' ? `COPY:${name(o.source)}>${name(o.dest)}` : o.type)) }));
};

// ── Mixer SCL source + tag table ──
{
  const files = [file('Mixer.scl'), file('PLC_Tags_Mixer.csv')];
  const { text, plan, target } = setup(files);
  assert.equal(plan.plcId, 'siemens-s7');

  // Nothing changed: the original file as it was.
  const same = exportUpgrade(plan.original, text, plan.program, target());
  assert.equal(same.mode, 'patch');
  assert.deepEqual(same.changed, []);
  assert.equal(same.files[0].content, text, 'byte for byte');
  assert.equal(same.files[0].name, 'Mixer_upgraded.scl');
  assert.match(same.howTo, /Generate blocks from source/);

  // Another PLC: a full export with what it will not have.
  assert.equal(exportUpgrade(plan.original, text, plan.program, target('click')).mode, 'full');

  // The fill step also waits for the tank not to be low: only Mixer_Control is rewritten.
  const fill = plan.program.rungs.find((r) => r.outputs.some((o) => o.type === 'SET' && o.address === addr(plan.program, 'Fill_Valve')))!;
  const now = edit(plan.program, (r) => r.id === fill.id, (r) => ({ ...r, branches: r.branches.map((b) => [...b, { type: 'NC', address: addr(plan.program, 'Tank_Low') }]) }));
  const ex = exportUpgrade(plan.original, text, now, target());
  assert.deepEqual(ex.changed, ['Mixer_Control']);
  const out = ex.files[0].content;
  // The declarations stay as they were, plus the copy of Step the CASE compares (taken at its start).
  const head = text.slice(0, text.indexOf('BEGIN'));
  assert.equal(out.slice(0, out.indexOf('BEGIN')), head.replace('Batches : Int;   // Batches made today\n', 'Batches : Int;   // Batches made today\n      Step_Case : DInt;   // added by the upgrade\n'));
  assert.match(out, /BEGIN\n {3}#Step_Case := #Step;\n/);
  assert.match(out, /IF \(#Step_Case = 10\) AND NOT "Tank_Low" THEN "Fill_Valve" := TRUE; END_IF;/, 'globals "quoted", the block\'s own variables #Name');
  assert.match(out, /#Mix_Timer\(IN := /, 'the timer instance keeps its name');
  assert.ok(ex.warnings.some((w) => /comments and layout are not kept \(Mixer_Control\)/.test(w)));
  // Read back: the program that was exported.
  const back = importProgramFiles([{ name: 'Mixer_upgraded.scl', text: out }, files[1]]).program;
  assert.deepEqual(logic(planUpgrade(back, 'click').program), logic(now), 'the patched file reads back as the changed program');

  // A new timer in the block: a static of the function block, declared in its VAR section.
  const t = 'T9';
  const timed = edit(now, (r) => r.id === fill.id, (r) => ({ ...r, outputs: [...r.outputs, { type: 'TMR', address: t, mode: 'ON_DELAY', preset: '5', unit: 'sec', accumulate: false, resetAddress: null }] }));
  const ex2 = exportUpgrade(plan.original, text, { ...timed, tags: [...timed.tags, { address: t, nickname: 'Fill_Watchdog', comment: 'Fill takes too long' }] }, target());
  assert.match(ex2.files[0].content, /Batches : Int;[^\n]*\n\s*Step_Case : DInt;[^\n]*\n\s*Fill_Watchdog : TON_TIME; {3}\/\/ Fill takes too long\n\s*END_VAR/);
  assert.match(ex2.files[0].content, /#Fill_Watchdog\(IN := /);
  assert.deepEqual(ex2.newTags, ['Mixer_Control.Step_Case', 'Mixer_Control.Fill_Watchdog']);

  // A block the app added: a new FB with its instance DB (no OB in this source: the call is to add).
  const added: LadderProgram = { ...now, blocks: [...(now.blocks ?? []), { id: 'b_new', name: 'Alarm Horn', description: '' }], rungs: [...now.rungs, { id: 'n1', block: 'b_new', comment: 'Horn while the lid is open', branches: [[{ type: 'NC', address: addr(now, 'Lid_Closed') }]], outputs: [{ type: 'OUT', address: addr(now, 'Agitator') }] }] };
  const ex3 = exportUpgrade(plan.original, text, added, target());
  assert.deepEqual(ex3.added, ['Alarm_Horn']);
  assert.match(ex3.files[0].content, /FUNCTION_BLOCK "Alarm_Horn"[\s\S]*"Agitator" := NOT "Lid_Closed";[\s\S]*END_FUNCTION_BLOCK\n\nDATA_BLOCK "Alarm_Horn_DB"[\s\S]*"Alarm_Horn"/);
  assert.ok(ex3.warnings.some((w) => /Call the new block from your main OB: "Alarm_Horn_DB"\(\);/.test(w)));

  // With an OB in the source, the call goes into it.
  const withOb = `${text}\nORGANIZATION_BLOCK "Main"\nBEGIN\n   "Mixer_Control_DB"();\nEND_ORGANIZATION_BLOCK\n`;
  const ex4 = exportUpgrade(plan.original, withOb, added, target());
  assert.match(ex4.files[0].content, /"Mixer_Control_DB"\(\);\n {3}"Alarm_Horn_DB"\(\); {3}\/\/ added by the upgrade\nEND_ORGANIZATION_BLOCK/);
  assert.ok(ex4.changed.includes('Main'));

  // A CRLF original stays CRLF.
  const crlf = text.replace(/\n/g, '\r\n');
  const ex5 = exportUpgrade(plan.original, crlf, now, target());
  assert.ok(!/(?<!\r)\n/.test(ex5.files[0].content), 'every line ends CRLF');
}

// ── TIA Portal PLCopen XML: an LD block that changes is written back as ST ──
{
  const files = [file('mixer_tia_plcopen.xml')];
  const { text, plan, target } = setup(files);
  assert.equal(plan.plcId, 'siemens-s7');
  assert.equal(exportUpgrade(plan.original, text, plan.program, target()).files[0].content, text, 'nothing changed: the original');
  const heater = plan.program.rungs.find((r) => r.outputs.some((o) => o.type === 'OUT' && o.address === addr(plan.program, 'Heater')))!;
  const now = edit(plan.program, (r) => r.id === heater.id, (r) => ({ ...r, comment: 'Heat only with the lid closed', branches: r.branches.map((b) => b.filter((e) => !('address' in e) || e.address !== addr(plan.program, 'Agitator_Running'))) }));
  const ex = exportUpgrade(plan.original, text, now, target());
  assert.deepEqual(ex.changed, ['FB_Mixer']);
  assert.ok(ex.warnings.some((w) => /FB_Mixer was ladder; it is written back as Structured Text/.test(w)));
  const out = ex.files[0].content;
  const fb = /<pou name="FB_Mixer"[\s\S]*?<\/pou>/.exec(out)![0];
  assert.match(fb, /<body>\n<ST>\n<xhtml xmlns="http:\/\/www.w3.org\/1999\/xhtml">[\s\S]*"Heater" := #S_Heat AND "Safety_Thermostat_OK";/);
  assert.ok(!/<LD>/.test(fb));
  // Every other POU byte for byte.
  const rest = (x: string) => x.replace(/<pou name="FB_Mixer"[\s\S]*?<\/pou>/, '');
  assert.equal(rest(out), rest(text));
  const back = importProgramFiles([{ name: 'mixer_upgraded.xml', text: out }]).program;
  // Read back: the block has an FC call the ladder can't draw, so it is kept whole, with the new code.
  const kept = back.program.rungs.flatMap((r) => r.outputs).find((o) => o.type === 'RAW' && /FUNCTION_BLOCK "FB_Mixer"/.test(o.text));
  assert.ok(kept && kept.type === 'RAW' && kept.text.includes('"Heater" := #S_Heat AND "Safety_Thermostat_OK";'), 'the patched file reads back with the change');
}

console.log('stPatch.test: all passed');
