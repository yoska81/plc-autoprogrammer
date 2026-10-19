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
import { commissioningItems, exportRows, progress } from './checklist';
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
assert.deepEqual(progress(commissioningItems(collectProject()), rec().results), { done: 3, pass: 1, fail: 1, total: items.length });
st.setResult('proj', by('safety')[0].id, { status: undefined });
assert.equal(rec().results[by('safety')[0].id].status, undefined, 'untick');
assert.deepEqual(commissioningFor('other').results, {}, 'other project untouched');
st.sign('proj', { name: 'J. Tech', company: 'ISA', signature: 'J. Tech', date: '2026-10-17 10:00' });
const rows = exportRows(items, rec().results);
assert.equal(rows.find((r) => r.cells[0] === by('outputs')[0].title)?.cells[4], 'FAIL');

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
assert.ok(texts.some((t) => t.includes('Contactor coil open circuit') && t.includes('FAIL')));
assert.ok(texts.some((t) => t.includes('Signature|J. Tech')));
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
