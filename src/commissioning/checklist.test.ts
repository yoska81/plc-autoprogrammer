/// <reference types="node" />
/**
 * Commissioning checklist from the example project: every I/O point with the program's expected
 * result, every safety function and alarm test; ticks stick to their item; PDF / Excel export.
 * Run with:  npx tsx src/commissioning/checklist.test.ts
 */
import assert from 'node:assert/strict';
import { seedSampleProject } from '../preview/sampleProject';
import { collectProject } from '../deliverables/collect';
import { safetyFunctions } from '../deliverables/docs/safety';
import { alarmRows } from '../deliverables/docs/program';
import { cleanRecord, commissioningItems, dismissedText, exportRows, orphanFails, progress, signBlock, voidedText } from './checklist';
import { useNoticeStore } from '../store/useNoticeStore';
import { commissioningFor, mergeStored, useCommissioningStore } from './useCommissioningStore';
import { commissioningPdf, commissioningXlsx } from './export';

const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };

seedSampleProject();
const p = collectProject();
const items = commissioningItems(p);
const by = (section: string) => items.filter((i) => i.section === section);
const ids = items.map((i) => i.id);

// Every I/O point, inputs and outputs, with the field device and what the program does with it.
assert.equal(by('inputs').length, p.io.filter((x) => x.type === 'input').length);
assert.equal(by('outputs').length, p.io.filter((x) => x.type === 'output').length);
assert.ok(by('inputs').every((i) => /PLC (input|\S+ reads)/.test(i.expected)), 'inputs say what the PLC must show');
assert.ok(by('outputs').some((i) => /Program drives it in rung \d+/.test(i.expected)), 'outputs name the rung that drives them');
assert.ok(by('inputs').some((i) => /Program reads it in rung \d+/.test(i.expected)), 'inputs name the rungs that read them');
assert.ok(items.filter((i) => i.section === 'inputs' || i.section === 'outputs').some((i) => i.device), 'field devices from the wiring');
// Every safety function and alarm.
assert.equal(by('safety').length, safetyFunctions(p).length);
assert.ok(by('safety').length > 0);
assert.equal(by('alarms').length, alarmRows(p).length);
assert.ok(by('alarms').every((i) => /HMI shows/.test(i.expected)));
assert.equal(new Set(items.map((i) => i.id)).size, items.length, 'stable unique ids');

// Ticks, notes and sign-off are saved per project; the ids survive a rebuild of the checklist.
const st = useCommissioningStore.getState();
st.setTech('J. Tech');
st.setResult('proj', by('inputs')[0].id, { status: 'pass' });
st.setResult('proj', by('outputs')[0].id, { status: 'fail' });
st.setResult('proj', by('outputs')[0].id, { note: 'Contactor coil open circuit' });
st.setResult('proj', by('safety')[0].id, { status: 'na' });
const rec = () => commissioningFor('proj');
assert.equal(rec().results[by('inputs')[0].id].by, 'J. Tech');
assert.match(rec().results[by('outputs')[0].id].date, /^\d{4}-\d\d-\d\d \d\d:\d\d$/);
assert.equal(rec().results[by('outputs')[0].id].note, 'Contactor coil open circuit');
assert.deepEqual(progress(commissioningItems(collectProject()), rec().results), { done: 2, pass: 1, fail: 1, total: items.length }, 'a failed item is not done');
assert.match(signBlock(items, rec().results) ?? '', /^1 failed item \(.+\): fix it and test again before signing off\.$/, 'a failure blocks the sign-off');
st.setResult('proj', by('safety')[0].id, { status: undefined });
assert.equal(rec().results[by('safety')[0].id].status, undefined, 'untick');
assert.deepEqual(commissioningFor('other').results, {}, 'other project untouched');
const rows = exportRows(items, rec().results);
assert.equal(rows.find((r) => r.cells[0] === by('outputs')[0].title)?.cells[4], 'FAIL');
// fixed and tested again: it passes, the sign-off is allowed; a later failure voids the signature
st.setResult('proj', by('outputs')[0].id, { status: 'pass' });
assert.equal(signBlock(items, rec().results), null);
st.sign('proj', { name: 'J. Tech', company: 'ISA', signature: 'J. Tech', date: '2026-10-17 10:00' }, ids);
assert.equal(rec().signoff?.name, 'J. Tech');
st.setResult('proj', by('inputs')[0].id, { note: 'retightened' });
assert.ok(rec().signoff, 'a note keeps the signature');
st.setTech('A. Lead');
st.setResult('proj', by('inputs')[0].id, { status: 'fail' });
assert.equal(rec().signoff, null, 'a failure after the sign-off voids it');
// …not silently: the voided sign-off is kept (who signed, when, when voided and by whom, which item) and the user is told
const v = rec().voided!;
assert.equal(v.length, 1);
assert.deepEqual([v[0].signoff.name, v[0].signoff.date, v[0].voidedBy, v[0].itemId], ['J. Tech', '2026-10-17 10:00', 'A. Lead', by('inputs')[0].id]);
assert.match(v[0].voidedAt, /^\d{4}-\d\d-\d\d \d\d:\d\d$/);
assert.equal(voidedText(v[0], items), `J. Tech (ISA) signed 2026-10-17 10:00; voided ${v[0].voidedAt} by A. Lead: ${by('inputs')[0].title} failed.`);
assert.match(useNoticeStore.getState().message ?? '', /sign-off by J\. Tech \(2026-10-17 10:00\) is void/);
// the store itself refuses a sign-off while an item has failed (not only the button)
assert.equal(st.sign('proj', { name: 'J. Tech', company: 'ISA', signature: 'J. Tech', date: '2026-10-17 10:20' }, ids), false);
assert.equal(rec().signoff, null);
st.setResult('proj', by('inputs')[0].id, { status: 'fail' });
assert.equal(rec().voided!.length, 1, 'a second failure with nothing signed voids nothing');
st.setTech('J. Tech');
st.setResult('proj', by('inputs')[0].id, { status: 'pass' });
assert.equal(st.sign('proj', { name: 'J. Tech', company: 'ISA', signature: 'J. Tech', date: '2026-10-17 10:30' }, ids), true);
assert.equal(rec().voided!.length, 1, 'signing again keeps the record of the voided one');
// removing a signature, or signing again over a valid one, is on the record too
assert.equal(st.unsign('proj', ' '), false, 'no removal without a name');
assert.equal(st.unsign('proj', 'J. Tech'), true, 'removing a signature is allowed while items have failed, with a name');
assert.equal(rec().voided!.length, 2);
assert.deepEqual([rec().voided![1].reason, rec().voided![1].signoff.date, rec().voided![1].voidedBy], ['removed', '2026-10-17 10:30', 'J. Tech']);
assert.match(voidedText(rec().voided![1], items), /^J\. Tech \(ISA\) signed 2026-10-17 10:30; signature removed \d{4}-\d\d-\d\d \d\d:\d\d by J\. Tech\.$/);
st.sign('proj', { name: 'J. Tech', company: 'ISA', signature: 'J. Tech', date: '2026-10-17 10:40' }, ids);
assert.equal(rec().voided!.length, 2, 'signing with nothing signed replaces nothing');
st.sign('proj', { name: 'B. Owner', company: 'Plant', signature: 'B. Owner', date: '2026-10-17 10:50' }, ids);
assert.deepEqual([rec().voided!.length, rec().voided![2].reason, rec().voided![2].signoff.name, rec().voided![2].voidedBy], [3, 'replaced', 'J. Tech', 'B. Owner']);
assert.match(voidedText(rec().voided![2], items), /; replaced by a new sign-off .+ by B\. Owner\.$/);
// a failed result of an item no longer in the checklist (its I/O point deleted) blocks until dismissed — never for good
st.setResult('proj', 'io:gone', { status: 'fail', note: 'wired to nothing' });
assert.equal(rec().signoff, null, 'it voids the sign-off like any failure');
assert.deepEqual(orphanFails(items, rec().results), ['io:gone']);
assert.match(signBlock(items, rec().results, rec().dismissed) ?? '', /^1 failed result of item no longer in the checklist: dismiss it below\.$/);
assert.equal(st.dismiss('proj', by('inputs')[1].id, ids, 'J. Tech'), false, 'an item still in the checklist is not dismissed');
assert.equal(st.sign('proj', { name: 'B. Owner', company: 'Plant', signature: 'B. Owner', date: '2026-10-17 11:00' }, ids), false);
assert.equal(st.dismiss('proj', 'io:gone', ids, ''), false, 'no dismissal without a name');
assert.equal(st.dismiss('proj', 'io:gone', ids, 'J. Tech'), true);
assert.deepEqual(orphanFails(items, rec().results), []);
assert.equal(rec().results['io:gone'], undefined);
assert.equal(rec().dismissed!.length, 1);
assert.match(dismissedText(rec().dismissed![0]), /^Failed result of io:gone, failed by J\. Tech \d{4}-\d\d-\d\d \d\d:\d\d, note: wired to nothing: no longer in the checklist, dismissed \d{4}-.+ by J\. Tech\.$/);
assert.equal(signBlock(items, rec().results), null);
assert.equal(st.sign('proj', { name: 'B. Owner', company: 'Plant', signature: 'B. Owner', date: '2026-10-17 11:00' }, ids), true);
// the notice is sent after the state is saved (not from inside the store update)
useNoticeStore.getState().clear();
st.setResult('proj', by('alarms')[0].id, { status: 'fail' });
assert.ok(useNoticeStore.getState().message && rec().signoff === null && rec().voided!.at(-1)!.itemId === by('alarms')[0].id);
st.setResult('proj', by('alarms')[0].id, { status: 'pass' });
st.sign('proj', { name: 'B. Owner', company: 'Plant', signature: 'B. Owner', date: '2026-10-17 11:10' }, ids);
// an item that failed, was dismissed while it was removed, and is back: its failure stands until it is tested again
const back = by('inputs')[1];
const without = ids.filter((id) => id !== back.id);
st.setResult('proj', back.id, { status: 'fail', note: 'no signal', title: back.title });
assert.equal(st.dismiss('proj', back.id, ids, 'J. Tech'), false, 'not while it is in the checklist');
assert.equal(st.dismiss('proj', back.id, without, 'J. Tech'), true, 'dismissed while it is removed');
assert.match(dismissedText(rec().dismissed!.at(-1)!), new RegExp(`^Failed result of ${back.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\(${back.id}\\), failed by J\\. Tech .+, note: no signal: no longer in the checklist`), 'the record names the item, who failed it and when');
assert.equal(st.sign('proj', { name: 'B. Owner', company: 'Plant', signature: 'B. Owner', date: '2026-10-17 11:20' }, without), true, 'signed while it is removed');
assert.equal(st.unsign('proj', 'B. Owner'), true);
assert.equal(st.sign('proj', { name: 'B. Owner', company: 'Plant', signature: 'B. Owner', date: '2026-10-17 11:30' }, ids), false, 'back in the checklist without a new result: refused');
assert.match(signBlock(items, rec().results, rec().dismissed) ?? '', new RegExp(`^1 item failed before and was dismissed while removed \\(.+\\): test it again; only a Pass clears it\\.$`));
st.setResult('proj', back.id, { status: 'na', title: back.title });
assert.equal(st.sign('proj', { name: 'B. Owner', company: 'Plant', signature: 'B. Owner', date: '2026-10-17 11:35' }, ids), false, 'N/A does not clear a failure');
assert.match(signBlock(items, rec().results, rec().dismissed) ?? '', /only a Pass clears it/);
st.setResult('proj', back.id, { status: 'pass', title: back.title });
assert.equal(signBlock(items, rec().results, rec().dismissed), null, 'tested again and passed: it may be signed');
assert.equal(st.sign('proj', { name: 'B. Owner', company: 'Plant', signature: 'B. Owner', date: '2026-10-17 11:40' }, ids), true);
assert.equal(st.sign('proj', { name: ' ', company: '', signature: 'x', date: '2026-10-17 11:50' }, ids), false, 'a sign-off needs a name in the store too');
assert.ok(!('drawn' in rec().signoff!), 'no empty drawn key on a sign-off without a drawn signature');
assert.match(dismissedText({ itemId: 'old', result: { status: 'fail', note: '', by: '', date: '' }, at: '2026-01-01 08:00', by: '' }), /dismissed 2026-01-01 08:00\.$/, 'an old dismissal with no name reads cleanly');

// Records from storage or a project file: malformed ones are cleaned, never crash; legacy voided entries read as 'failed'.
assert.deepEqual(cleanRecord({ voided: {}, results: { x: null, y: { status: 'bogus', note: 3 }, z: { status: 'fail', note: 'n', by: 'b', date: 'd' } }, signoff: { company: 'no name' } }),
  { results: { y: { note: '', by: '', date: '' }, z: { status: 'fail', note: 'n', by: 'b', date: 'd' } }, signoff: null });
assert.deepEqual(cleanRecord({ results: {}, signoff: null, voided: [{}, { signoff: { name: 'Old', date: 'D' }, voidedAt: 'T', voidedBy: 'X', itemId: 'i1' }], dismissed: [{ itemId: 'q' }] }).voided,
  [{ signoff: { name: 'Old', company: '', signature: '', date: 'D' }, reason: 'failed', voidedAt: 'T', voidedBy: 'X', itemId: 'i1' }]);
for (const bad of [null, 7, 'x', [], { results: [] }, { results: { a: 1 } }, { voided: [null] }]) {
  const r = cleanRecord(bad);
  assert.doesNotThrow(() => { signBlock(items, r.results); progress(items, r.results); (r.voided ?? []).map((v) => voidedText(v, items)); exportRows(items, r.results); }, `malformed record ${JSON.stringify(bad)}`);
}
const proto = cleanRecord(JSON.parse('{"results":{"__proto__":{"status":"fail","note":"","by":"","date":""},"ok":{"status":"pass"}}}'));
assert.deepEqual(Object.keys(proto.results), ['ok'], 'a "__proto__" key from a file is skipped');
assert.equal(Object.getPrototypeOf(proto.results), Object.prototype);
assert.equal(signBlock(items, proto.results), null);
// browser storage written by an older or hand-edited version is cleaned when the store loads it
const rehydrated = mergeStored({ tech: 'T', byProject: { a: { results: { x: null }, voided: {} } } }, useCommissioningStore.getState());
assert.deepEqual(rehydrated.byProject.a, { results: {}, signoff: null });

// Exports.
const pdf = await commissioningPdf(p, items, rec());
assert.ok(pdf.size > 5000);
assert.equal(new TextDecoder().decode(new Uint8Array(await pdf.arrayBuffer()).slice(0, 5)), '%PDF-');
const xlsx = await commissioningXlsx(p.projectName, items, rec());
const { default: ExcelJS } = await import('exceljs');
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(await xlsx.arrayBuffer());
const ws = wb.getWorksheet('Commissioning')!;
const texts: string[] = [];
ws.eachRow((r) => texts.push((r.values as unknown[]).map(String).join('|')));
assert.ok(texts.some((t) => t.includes('Contactor coil open circuit') && t.includes('Pass')), 'the retested item: its note kept, now passed');
assert.ok(texts.some((t) => t.includes('Signature|B. Owner')));
assert.ok(texts.some((t) => t.includes('Voided|J. Tech (ISA) signed 2026-10-17 10:00; voided')), 'the voided sign-off is in the workbook');
assert.ok(texts.some((t) => t.includes('Removed|J. Tech')) && texts.some((t) => t.includes('Replaced|J. Tech')), 'each row says why the sign-off no longer holds');
// …and in the PDF (its text, uncompressed)
const { inflateSync } = await import('node:zlib');
const raw = Buffer.from(await pdf.arrayBuffer()).toString('latin1');
const streams = [...raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map((m) => { try { return inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1'); } catch { return m[1]; } }).join('');
assert.ok(/Voided sign-offs/.test(streams), 'the PDF has the voided sign-offs');
assert.ok(texts.some((t) => t.includes('Dismissed|Failed result of io:gone')), 'the dismissed result is in the workbook');
assert.ok(/Dismissed results/.test(streams), '…and in the PDF');

// (the .isap round trip of the record is in e2e/field.e2e.cjs: the project file needs the browser's storage)
// On an S7 the checklist speaks the PLC's own names: %I / %Q terminals and the exported tag names, never X001 / C21 / DS1003.
{
  const { applyEquipment } = await import('../spec/equipment');
  applyEquipment({ cpuId: '6ES7214-1AG40-0XB0', modules: [], hmiPartNumber: null }, null);
  const s7 = commissioningItems(collectProject());
  const ins = s7.filter((i) => i.section === 'inputs');
  assert.ok(ins.length && ins.every((i) => /^%I\d+\.\d /.test(i.title)), ins.map((i) => i.title).join(' | '));
  assert.ok(ins.every((i) => /PLC input %I\d+\.\d/.test(i.expected) || /reads the matching value/.test(i.expected)), ins[0].expected);
  // An alarm message is quoted as the HMI shows it (the user's text): its words are not the app's to rename.
  const snap0 = collectProject();
  const messages = (snap0.hmi?.alarms ?? []).map((m) => m.message).filter(Boolean);
  const text = s7.map((i) => `${i.title} ${i.procedure} ${i.expected}`).map((t) => messages.reduce((x, m) => x.split(m).join(''), t)).join('\n');
  const left = text.match(/\b(?:X|Y)\d{3}\b|\b(?:DS|DD|DF)\d+\b|\bC\d{1,4}\b/g) ?? [];
  assert.deepEqual([...new Set(left)], [], 'no app operand left on an S7 outside the user\'s own texts');
  assert.ok(s7.every((i) => /^(io|sf|alarm):/.test(i.id)), 'ids unchanged (ticks stay with their item)');
  // The user's own words are never renamed: only the operands the app wrote (the item's address) change.
  const snap = collectProject();
  const first = snap.io.find((x) => x.type === 'input' && snap.addresses.get(x.id))!;
  const own = commissioningItems({ ...snap, io: snap.io.map((x) => (x.id === first.id ? { ...x, description: 'Pusher extended (cylinder C1, tank T1)' } : x)) });
  const item = own.find((i) => i.id === `io:${first.id}`)!;
  assert.match(item.title, /^%I\d+\.\d Pusher extended \(cylinder C1, tank T1\)$/, item.title);
}

console.log(`commissioning tests passed (${items.length} items)`);
