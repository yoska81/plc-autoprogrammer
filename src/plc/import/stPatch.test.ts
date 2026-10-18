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
import { buildScl, siemensAddress } from '../core/profiles/siemens';

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

// ── Review: globals are never written as the block's own variables; a block kept whole is never nested ──
{
  // SCL: a VAR_EXTERNAL section names PLC tags ("Lid_Closed"), not statics (#Lid_Closed).
  const files = [file('Mixer.scl'), file('PLC_Tags_Mixer.csv')];
  const ext = files[0].text.replace('   VAR\n', '   VAR_EXTERNAL\n      Lid_Closed : Bool;\n   END_VAR\n   VAR\n');
  const { text, plan, target } = setup([{ name: 'Mixer.scl', text: ext }, files[1]]);
  const fill = plan.program.rungs.find((r) => r.outputs.some((o) => o.type === 'SET' && o.address === addr(plan.program, 'Fill_Valve')))!;
  const now = edit(plan.program, (r) => r.id === fill.id, (r) => ({ ...r, comment: 'changed' }));
  const out = exportUpgrade(plan.original, text, now, target()).files[0].content;
  assert.match(out, /"Lid_Closed"/);
  assert.ok(!/#Lid_Closed/.test(out), 'an external variable is a PLC tag');
}
{
  // SCL: a FUNCTION kept as written that changes (here its comment) replaces the block, not nested in it.
  const files = [file('Mixer.scl'), file('PLC_Tags_Mixer.csv')];
  const fn = '\nFUNCTION "Scale" : Real\n   VAR_INPUT\n      Raw : Int;\n   END_VAR\nBEGIN\n   #Scale := INT_TO_REAL(#Raw) / 276.48;\nEND_FUNCTION\n';
  const { text, plan, target } = setup([{ name: 'Mixer.scl', text: files[0].text + fn }, files[1]]);
  const kept = plan.program.rungs.find((r) => r.outputs.some((o) => o.type === 'RAW' && /FUNCTION "Scale"/.test(o.text)))!;
  const now = edit(plan.program, (r) => r.id === kept.id, (r) => ({ ...r, comment: 'Scale: checked' }));
  const ex = exportUpgrade(plan.original, text, now, target());
  assert.deepEqual(ex.changed, ['Scale']);
  assert.equal((ex.files[0].content.match(/FUNCTION "Scale"/g) ?? []).length, 1, 'one FUNCTION "Scale", not nested');
  assert.equal(ex.files[0].content, text, 'the kept block is written as it was');
}
{
  // PLCopen: externalVars are PLC tags; the kept FC's code goes into its <body> without its header.
  const files = [file('mixer_tia_plcopen.xml')];
  const ext = files[0].text.replace('<pou name="FB_Mixer" pouType="functionBlock">\n        <interface>', '<pou name="FB_Mixer" pouType="functionBlock">\n        <interface>\n          <externalVars><variable name="Heater"><type><BOOL /></type></variable></externalVars>');
  const { text, plan, target } = setup([{ name: 'mixer.xml', text: ext }]);
  const heater = plan.program.rungs.find((r) => r.outputs.some((o) => o.type === 'OUT' && o.address === addr(plan.program, 'Heater')))!;
  const fc = plan.program.rungs.find((r) => r.outputs.some((o) => o.type === 'RAW' && /FUNCTION "FC_ScaleAnalog"/.test(o.text)))!;
  const now = edit(edit(plan.program, (r) => r.id === heater.id, (r) => ({ ...r, comment: 'changed' })), (r) => r.id === fc.id, (r) => ({ ...r, comment: 'FC: checked' }));
  const out = exportUpgrade(plan.original, text, now, target()).files[0].content;
  assert.match(out, /"Heater" := /);
  assert.ok(!/#Heater/.test(out), 'an external variable is a PLC tag');
  const fcBody = /<pou name="FC_ScaleAnalog"[\s\S]*?<\/pou>/.exec(out)![0];
  assert.ok(!/FUNCTION|END_VAR|BEGIN/.test(/<body>[\s\S]*<\/body>/.exec(fcBody)![0]), 'only the code in the body, no nested FUNCTION');
}

// ── Review: S7 → S7 keeps the CPU the file names; an address it can't keep is asked, never changed silently ──
{
  const { plan } = setup([file('mixer_tia_plcopen.xml')]);
  assert.equal(plan.cpuId, '6ES7214-1AG40-0XB0', 'the CPU 1214C named in the file');
  // The 4–20 mA transmitters at %IW96 / %IW98 sit on an SM 1231 current module, not the CPU's 0–10 V inputs.
  assert.deepEqual(plan.modules, ['6ES7231-4HD32-0XB0']);
  assert.ok(!plan.questions.some((q) => /Address changed/.test(q)), plan.questions.join(' | '));
  // The file says "4-20 mA" for both transmitters: nothing assumed, nothing asked.
  assert.deepEqual(plan.io.filter((p) => p.signal === 'analog').map((p) => [p.analog?.range, p.analog?.assumed]), [['4-20mA', undefined], ['4-20mA', undefined]]);
  assert.ok(!plan.questions.some((q) => /^Analog signal of/.test(q)));
  {
    // Without the range in the file: 4–20 mA assumed, shown "to check" and asked for each point.
    const bare = file('mixer_tia_plcopen.xml').text.replace(/(Tank level|Product temperature)[^<]*4-20 mA/g, '$1');
    const bp = setup([{ name: 'mixer.xml', text: bare }]).plan;
    assert.deepEqual(bp.io.filter((p) => p.signal === 'analog').map((p) => [p.analog?.range, p.analog?.assumed]), [['4-20mA', true], ['4-20mA', true]]);
    assert.equal(bp.questions.filter((q) => /^Analog signal of (Level_Raw|Temp_Raw) \(%IW9[68]\): the original program does not say whether it is 4–20 mA or 0–10 V/.test(q)).length, 2, bp.questions.join(' | '));
  }
  {
    // The range the description states is used, never the guess.
    const { importedRange } = await import('./convert');
    assert.deepEqual(importedRange('%IW96', 'Tank level 0-10 V'), { range: '0-10V', assumed: false });
    assert.deepEqual(importedRange('%IW96', 'Pressure transmitter 4…20 mA'), { range: '4-20mA', assumed: false });
    assert.deepEqual(importedRange('%IW96', 'Flow 0 to 20 mA'), { range: '0-20mA', assumed: false });
    assert.deepEqual(importedRange('%IW96', 'Oven type K'), { range: 'thermocouple', assumed: false });
    assert.deepEqual(importedRange('%IW64', ''), { range: '0-10V', assumed: false });
    assert.deepEqual(importedRange('%IW96', 'Level 1.0-10 bar'), { range: '4-20mA', assumed: true }, '"1.0-10 bar" is not 0-10 V');
    const volts = file('mixer_tia_plcopen.xml').text.replace('Tank level 4-20 mA', 'Tank level 0-10 V');
    const vp = setup([{ name: 'mixer.xml', text: volts }]).plan;
    const lv = vp.io.find((p) => p.signal === 'analog' && /level/i.test(p.description))!;
    assert.deepEqual([lv.analog?.range, lv.analog?.assumed], ['0-10V', undefined], lv.description);
    assert.ok(!vp.questions.some((q) => /^Analog signal of Level_Raw/.test(q)));
  }
  {
    const profile = getProfile('siemens-s7');
    const cpu = getCpu(profile, plan.cpuId);
    let i = 0, q = 0;
    const io: IOPoint[] = plan.io.map((p) => ({ ...p, id: p.type === 'input' ? `I${String(++i).padStart(3, '0')}` : `Q${String(++q).padStart(3, '0')}` }));
    const slots = moduleSlots(plan.modules);
    const addr = resolveAddresses(profile, cpu, io, slots);
    assert.deepEqual(io.filter((p) => p.signal === 'analog').map((p) => siemensAddress(addr.get(p.id)!, cpu, slots)?.address), ['%IW96', '%IW98'], 'the original addresses');
  }
  // The real export: resource "PLC_1"; the CPU and the module only in the hardware data and the header comment.
  const real = file('mixer_tia_plcopen.xml').text
    .replace('<resource name="CPU_1214C">', '<resource name="PLC_1">')
    .replace('<contentHeader name="MixTank_MT01"', '<contentHeader name="MixTank_MT01" comment="PLC_1: SM 1231 AI4 6ES7231-4HD32-0XB0"')
    .replace('</project>', '<addData><data name="http://www.siemens.com/tia/hardware" handleUnknown="discard"><Hardware Cpu="CPU 1214C DC/DC/DC" OrderNumber="6ES7 214-1AG40-0XB0" /></data></addData>\n</project>');
  const fromHw = setup([{ name: 'mixer.xml', text: real }]).plan;
  assert.equal(fromHw.cpuId, '6ES7214-1AG40-0XB0', 'the CPU from the hardware data, not a guess');
  assert.deepEqual(fromHw.modules, ['6ES7231-4HD32-0XB0'], 'the module from the file');
  const stl = setup([{ name: 'q.awl', text: 'ORGANIZATION_BLOCK OB1\nBEGIN\nNETWORK\nTITLE =\nA I 1.0\n= Q 0.7\nEND_ORGANIZATION_BLOCK\n' }]);
  assert.equal(stl.plan.cpuId, '6ES7214-1AG40-0XB0', '%I1.0 needs more than 8 onboard inputs: a 1214C, not a 1212C + module');
  assert.ok(!stl.plan.questions.some((q) => /Address changed/.test(q)), stl.plan.questions.join(' | '));
}

// ── Review: a Time-typed preset (#Mix_Time) is the PT as it is: DINT_TO_TIME(#Mix_Time * 1) does not compile ──
{
  const files = [file('Mixer.scl'), file('PLC_Tags_Mixer.csv')];
  const timed = files[0].text.replace('      Step : Int;', '      Mix_Time : Time;   // Mixing time\n      Step : Int;').replace(/PT := T#3M\)/, 'PT := #Mix_Time)');
  assert.ok(timed.includes('PT := #Mix_Time)'));
  const { text, plan, target } = setup([{ name: 'Mixer.scl', text: timed }, files[1]]);
  const fill = plan.program.rungs.find((r) => r.outputs.some((o) => o.type === 'SET' && o.address === addr(plan.program, 'Fill_Valve')))!;
  const now = edit(plan.program, (r) => r.id === fill.id, (r) => ({ ...r, comment: 'changed' }));
  const out = exportUpgrade(plan.original, text, now, target()).files[0].content;
  assert.match(out, /#Mix_Timer\(IN := [^;]*, PT := #Mix_Time\);/);
  assert.ok(!/DINT_TO_TIME/.test(out), out.slice(out.indexOf('BEGIN')));
  // The full S7 export: the preset is a DInt of milliseconds there, converted once, without "* 1".
  const scl = buildScl(now, target().ctx).scl;
  assert.match(scl, /PT := DINT_TO_TIME\(#Mix_Time\)/);
  assert.ok(!/\* 1\)/.test(scl));
}

console.log('stPatch.test: all passed');
