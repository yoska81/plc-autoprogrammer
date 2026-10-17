/// <reference types="node" />
/**
 * Hand edits: values typed over generated ones are kept by a stable key, used in totals and
 * files, survive a regeneration of the design, and "back to generated" removes them.
 * Run with:  npx tsx src/edits/edits.test.ts
 */
import assert from 'node:assert/strict';
import { DESIGN } from '../preview/sampleProject';
import { getPart } from '../electrical/catalog';
import { cableSchedule, wireNumbers, type DrawingContext } from '../electrical/derive';
import { buildOrderList, orderListCsv, PANEL_ORDER, SPARES_ORDER, supplierCsv, userPriced, unitPrice } from '../deliverables/purchasing';
import { priceBasis } from '../deliverables/purchaseSummaryPdf';
import type { ProjectSnapshot } from '../deliverables/collect';
import { listLabels } from '../electrical/labels/list';
import { currentEdits, textOr, useEditsStore } from './useEditsStore';
import { cableKey, cableScheduleCsvWithNotes, parseRow, wireKey, wireListCsvWithNotes } from './lists';
import { keepRungComments, recordRungComment, rungKey } from './rungComments';
import { alarmEdit, alarmKey, keepAlarmTexts } from './hmiTexts';
import { PROJECT_STORE_LIST } from '../store/useProjectsStore';
import type { LadderProgram } from '../plc/core/ladder';
import type { HmiDesign } from '../hmi/types';

// The stores persist to localStorage, which node doesn't have: silence the warnings.
const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };

const reset = () => useEditsStore.setState({ bom: {}, labels: {}, notes: {}, texts: {} });
const ctx = (): DrawingContext => ({
  projectName: 'test', design: structuredClone(DESIGN), getPart,
  plc: { vendor: 'AutomationDirect', name: 'CLICK', cpuPartNumber: 'C0-10DD1E-D', cpuLabel: '' },
  io: DESIGN.ioWiring.map((w) => ({ address: w.address, description: w.description, type: w.address.startsWith('X') ? 'input' : 'output' })),
});
const snap = (c = ctx()) => ({ drawingCtx: c, hmi: null }) as unknown as ProjectSnapshot;

// ── The store: part of the project data, tidy entries, back to generated ──
assert.ok(PROJECT_STORE_LIST.some((s) => s.key === 'edits'), 'hand edits are saved with the project (per project, backups, .isap)');
reset();
const st = useEditsStore.getState();
st.setBom('ABC', { price: 12.5 });
st.setBom('ABC', { description: 'Mine' });
assert.deepEqual(useEditsStore.getState().bom.ABC, { price: 12.5, description: 'Mine' }, 'bom edits merge');
st.resetBom('ABC', 'price');
assert.deepEqual(useEditsStore.getState().bom.ABC, { description: 'Mine' }, 'one field back to generated');
st.resetBom('ABC', 'description');
assert.equal(useEditsStore.getState().bom.ABC, undefined, 'no fields left: the line is generated again');
st.setBom('ABC', { qty: Number.NaN, partNumber: '' });
assert.equal(useEditsStore.getState().bom.ABC, undefined, 'empty / invalid values are not stored');

st.setText('k', 'one', 'generated');
st.setText('k', 'two', 'one'); // the first generated value is kept
assert.equal(useEditsStore.getState().texts.k.generated, 'generated', 'the generated value of the first edit is remembered');
assert.equal(textOr('k', 'generated'), 'two');
st.setText('k', 'generated', 'x');
assert.equal(useEditsStore.getState().texts.k, undefined, 'typing the generated text again removes the edit');
st.setText('io:I001', 'a', 'b'); st.setText('io:I002', 'a', 'b'); st.setText('rung:r1', 'a', 'b');
st.clearTexts('io:');
assert.deepEqual(Object.keys(useEditsStore.getState().texts), ['rung:r1'], 'clearTexts drops one kind only');
st.setNote('cable:W001', '  ');
assert.equal(useEditsStore.getState().notes['cable:W001'], undefined, 'blank notes are not stored');

// ── Order list: price, quantity, part number, description ──
reset();
const base = buildOrderList(snap(), { ...PANEL_ORDER, labels: false });
const lines = base.groups.flatMap((g) => g.lines);
assert.ok(lines.length > 5, 'the example has an order list');
const unpriced = lines.find((l) => !l.price) ?? lines[0];
const priced = lines.find((l) => l.price && l !== unpriced);
const pn = unpriced.partNumber;

useEditsStore.getState().setBom(pn, { price: 100 });
let ol = buildOrderList(snap(), { ...PANEL_ORDER, labels: false });
let line = ol.groups.flatMap((g) => g.lines).find((l) => l.generatedPartNumber === pn)!;
assert.equal(line.userPrice, 100);
assert.equal(unitPrice(line), 100);
assert.equal(line.extended, +(100 * line.orderQty).toFixed(2), 'a typed price gives the extended price');
assert.ok(line.edited?.price, 'marked as entered by the user');
assert.equal(ol.total, +(base.total + (unpriced.price ? -unpriced.extended! : 0) + 100 * line.orderQty).toFixed(2), 'typed prices count in the total');
assert.equal(ol.unpriced, base.unpriced - (unpriced.price ? 0 : 1), 'the line no longer waits for a price');
assert.equal(userPriced(ol), 1);
assert.match(priceBasis(ol), /1 price entered by you is included/);
assert.match(orderListCsv(ol), /entered by you/, 'the CSV says where the price came from');

useEditsStore.getState().setBom(pn, { qty: 7, partNumber: 'MY-PART-1', description: 'My own description' });
ol = buildOrderList(snap(), { ...PANEL_ORDER, labels: false });
line = ol.groups.flatMap((g) => g.lines).find((l) => l.generatedPartNumber === pn)!;
assert.equal(line.orderQty, 7, 'typed order quantity');
assert.equal(line.extended, 700, 'extended follows the typed quantity');
assert.equal(line.partNumber, 'MY-PART-1', 'typed part number');
assert.equal(line.edited?.partNumber, pn, 'the generated part number is kept to go back to');
assert.equal(line.description, 'My own description');
const group = ol.groups.find((g) => g.lines.includes(line))!;
assert.match(supplierCsv(group), /^MY-PART-1,7\r$/m, 'the supplier order file uses the typed part number and quantity');

// Regenerated design (a new design object): the edits stay, keyed by the generated part number.
const again = buildOrderList(snap(ctx()), { ...PANEL_ORDER, labels: false });
const kept = again.groups.flatMap((g) => g.lines).find((l) => l.generatedPartNumber === pn)!;
assert.equal(kept.partNumber, 'MY-PART-1', 'edits survive a regeneration');
assert.equal(kept.userPrice, 100);

// The spares order keeps its own quantities.
const sp = buildOrderList({ ...snap(), questions: [] } as unknown as ProjectSnapshot, SPARES_ORDER);
for (const l of sp.groups.flatMap((g) => g.lines)) if (l.generatedPartNumber === pn) assert.notEqual(l.orderQty, 7, 'a typed panel quantity is not the spares quantity');

// Back to generated.
useEditsStore.getState().resetBom(pn);
const back = buildOrderList(snap(), { ...PANEL_ORDER, labels: false });
assert.deepEqual(back.groups.flatMap((g) => g.lines).find((l) => l.generatedPartNumber === pn), lines.find((l) => l.partNumber === pn), 'back to the generated line');
assert.equal(back.total, base.total);
if (priced) {
  useEditsStore.getState().setBom(priced.partNumber, { price: priced.price!.price + 1 });
  const over = buildOrderList(snap(), { ...PANEL_ORDER, labels: false }).groups.flatMap((g) => g.lines).find((l) => l.generatedPartNumber === priced.partNumber)!;
  assert.equal(unitPrice(over), priced.price!.price + 1, 'a typed price replaces a list price too');
  assert.ok(over.price, 'the list price is still known (shown as the generated value)');
}

// ── Labels ──
reset();
const labels = listLabels(ctx());
const lab = labels.find((l) => l.kind === 'device')!;
useEditsStore.getState().setLabel(lab.id, { code: 'K-MAIN', description: 'Main contactor' });
const edited = listLabels(ctx()).find((l) => l.id === lab.id)!;
assert.equal(edited.code, 'K-MAIN', 'typed label text is printed');
assert.equal(edited.description, 'Main contactor');
assert.deepEqual(edited.edited, { code: lab.code, description: lab.description }, 'generated texts kept to go back to');
assert.equal(listLabels(ctx()).length, labels.length, 'same labels');
assert.ok(listLabels(ctx(), {}).find((l) => l.id === lab.id && l.code === lab.code && !l.edited), 'without edits: the generated label');

// ── Cable and wire notes in the files ──
reset();
const c0 = ctx();
const cable = cableSchedule(c0)[0];
const wire = wireNumbers(c0).find((w) => w.wire)!;
useEditsStore.getState().setNote(cableKey(cable), 'Route through the left gland, "M25"');
useEditsStore.getState().setNote(wireKey(wire), 'Checked');
const cableCsv = cableScheduleCsvWithNotes(c0).split('\r\n');
assert.equal(parseRow(cableCsv[0]).at(-1), 'Note', 'cable schedule has a Note column');
const cableRow = cableCsv.find((r) => parseRow(r)[0] === cable.tag)!;
assert.equal(parseRow(cableRow).at(-1), 'Route through the left gland, "M25"', 'the note (with commas and quotes) is in the CSV');
const wireCsv = wireListCsvWithNotes(c0).split('\r\n');
assert.ok(wireCsv.some((r) => { const c = parseRow(r); return c[0] === wire.wire && c[1] === wire.from && c.at(-1) === 'Checked'; }), 'wire note in the wire list CSV');
assert.equal(parseRow(wireCsv[1]).length, parseRow(wireCsv[0]).length, 'every row has the Note column');
assert.deepEqual(parseRow('a,"b,""c""",d'), ['a', 'b,"c"', 'd']);

// ── Rung comments ──
reset();
const prog: LadderProgram = { rungs: [
  { id: 'r1', comment: 'Start the conveyor', branches: [], outputs: [] },
  { id: 'r2', comment: 'Stop', branches: [], outputs: [] },
], tags: [] };
recordRungComment('r1', 'Conveyor start when door closed', 'Start the conveyor');
recordRungComment('r1', 'Conveyor start (door closed)', 'Conveyor start when door closed');
assert.equal(currentEdits().texts[rungKey('r1')].generated, 'Start the conveyor', 'the generated comment is kept');
const regenerated: LadderProgram = { ...prog, rungs: [...prog.rungs.map((r) => ({ ...r })), { id: 'r3', comment: 'New', branches: [], outputs: [] }] };
const out = keepRungComments(regenerated);
assert.equal(out.rungs[0].comment, 'Conveyor start (door closed)', 'a regenerated rung keeps the user comment');
assert.equal(out.rungs[1].comment, 'Stop');
assert.equal(out.rungs[2].comment, 'New');
assert.equal(keepRungComments(out), out, 'nothing to change: the same program');

// ── HMI alarm messages ──
reset();
const hmi = { hmiPartNumber: 'x', screens: [], tags: [], notes: [], generatedAt: '', alarms: [
  { address: 'C1101', message: 'Guard door open', severity: 'alarm' as const },
  { address: 'C1102', message: 'Low air', severity: 'warning' as const },
] } as unknown as HmiDesign;
useEditsStore.getState().setText(alarmKey('Guard door open'), 'Close the guard door', 'Guard door open');
const kept2 = keepAlarmTexts(hmi)!;
assert.equal(kept2.alarms[0].message, 'Close the guard door', 'a regenerated HMI shows the user alarm text');
assert.equal(kept2.alarms[1].message, 'Low air');
assert.equal(alarmEdit(kept2.alarms[0])?.edit.generated, 'Guard door open', 'the edit is found from the shown text');
assert.equal(alarmEdit(kept2.alarms[1]), null);

reset();
console.log('edits.test: all passed');
