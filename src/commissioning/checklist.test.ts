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
import { commissioningItems, exportRows, progress, signBlock, voidedText } from './checklist';
import { useNoticeStore } from '../store/useNoticeStore';
import { commissioningFor, useCommissioningStore } from './useCommissioningStore';
import { commissioningPdf, commissioningXlsx } from './export';

const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };

seedSampleProject();
const p = collectProject();
const items = commissioningItems(p);
const by = (section: string) => items.filter((i) => i.section === section);

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
st.sign('proj', { name: 'J. Tech', company: 'ISA', signature: 'J. Tech', date: '2026-10-17 10:00' });
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
assert.equal(st.sign('proj', { name: 'J. Tech', company: 'ISA', signature: 'J. Tech', date: '2026-10-17 10:20' }), false);
assert.equal(rec().signoff, null);
st.setResult('proj', by('inputs')[0].id, { status: 'fail' });
assert.equal(rec().voided!.length, 1, 'a second failure with nothing signed voids nothing');
st.setTech('J. Tech');
st.setResult('proj', by('inputs')[0].id, { status: 'pass' });
assert.equal(st.sign('proj', { name: 'J. Tech', company: 'ISA', signature: 'J. Tech', date: '2026-10-17 10:30' }), true);
assert.equal(rec().voided!.length, 1, 'signing again keeps the record of the voided one');
assert.equal(st.sign('proj', null), true, 'removing a signature is always allowed');
st.sign('proj', { name: 'J. Tech', company: 'ISA', signature: 'J. Tech', date: '2026-10-17 10:30' });
// a failure on an item no longer in the checklist still blocks (the store and the page agree)
assert.match(signBlock(items, { ...rec().results, gone: { status: 'fail', note: '', by: '', date: '' } }) ?? '', /gone \(no longer in the checklist\)/);

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
assert.ok(texts.some((t) => t.includes('Signature|J. Tech')));
assert.ok(texts.some((t) => t.includes('Voided|J. Tech (ISA) signed 2026-10-17 10:00; voided')), 'the voided sign-off is in the workbook');
// …and in the PDF (its text, uncompressed)
const { inflateSync } = await import('node:zlib');
const raw = Buffer.from(await pdf.arrayBuffer()).toString('latin1');
const streams = [...raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map((m) => { try { return inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1'); } catch { return m[1]; } }).join('');
assert.ok(/Voided sign-offs/.test(streams), 'the PDF has the voided sign-offs');
console.log(`commissioning tests passed (${items.length} items)`);
