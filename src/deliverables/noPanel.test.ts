/// <reference types="node" />
/**
 * Machines without a touch panel (equipment chosen with "No touch panel"): the snapshot, the
 * documents, the design review and the stages describe the operator station, never the HMI,
 * even when screens made for an earlier panel are still in the store.
 *   npx tsx src/deliverables/noPanel.test.ts
 */
import assert from 'node:assert/strict';
import { seedSampleProject } from '../preview/sampleProject';
import { collectProject } from './collect';
import { useHmiStore } from '../store/useHmiStore';
import { useStageStore } from '../store/useStageStore';
import { useSpecStore } from '../store/useSpecStore';
import { operatorManual } from './docs/manual';
import { specLines } from './docs/table';
import { fatProcedure, satChecklist } from './docs/fat';
import { docMeta } from './docs/meta';
import { abbreviationsTable } from './docs/codes';
import { systemDescription } from './docs/fds';
import { residualRisks } from './docs/safety';
import { alarmTable, tagTable } from './docs/program';
import { machineSpecText } from './machineSpec';
import { operatorDevices, operatorInterfaceText } from './docs/operatorStation';
import { projectSummary } from '../review/reviewAI';
import { checksFor } from '../review/actions';
import { stagesNow } from '../spec/useStages';
import { activeHmiDesign, noTouchPanel, noTouchPanelNow, projectPanelPartNow } from '../hmi/projectPanel';

// The stores persist to localStorage, which node doesn't have: silence the warnings.
const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log('  ok ', name); };
/** Mentions of the HMI or the touch panel other than "no touch panel". */
const mentionsHmi = (t: string) => /\bHMI\b/.test(t) || /(?<!no )touch panel/i.test(t);
const textOf = (rows: unknown[]) => JSON.stringify(rows);

seedSampleProject();
const withPanel = collectProject();
// "No touch panel" chosen on the equipment page: the panel is cleared, the earlier screens stay in the store.
if (!useStageStore.getState().sources.equipment) useStageStore.getState().markGenerated('equipment', { specFp: '', spec: useSpecStore.getState().sections });
useHmiStore.getState().setHmiPartNumber('');
const p = collectProject();

test('the rule: no panel only once the equipment is chosen without one', () => {
  assert.equal(noTouchPanel({ equipmentChosen: false, hmiPartNumber: '' }), false, 'equipment not chosen yet: undecided, not "no panel"');
  assert.equal(noTouchPanel({ equipmentChosen: true, hmiPartNumber: 'CM5-T7W' }), false);
  assert.equal(noTouchPanel({ equipmentChosen: true, hmiPartNumber: '' }), true);
  assert.equal(noTouchPanelNow(), true);
  assert.ok(useHmiStore.getState().design, 'the earlier screens are kept');
  assert.equal(activeHmiDesign(), null, 'but not in use');
  assert.equal(projectPanelPartNow(), null);
});

test('snapshot: no HMI, no panel on the door, the earlier screens ignored', () => {
  assert.ok(withPanel.hmi && !withPanel.noHmi, 'the example has a panel');
  assert.equal(p.noHmi, true);
  assert.equal(p.hmi, null);
  assert.equal(p.drawingCtx?.hmiPartNumber ?? null, null);
  assert.equal(p.equipment?.hmi ?? null, null);
});

test('stages: the HMI stage is done', () => {
  assert.equal(stagesNow().hmi.status, 'ready');
});

test('operator station: the door pushbuttons, selector, E-stop and lamps', () => {
  const devices = operatorDevices(p);
  assert.ok(devices.length >= 3, `${devices.length} devices`);
  assert.ok(devices.some((d) => /pushbutton/.test(d.kind)), 'a pushbutton');
  assert.ok(devices.some((d) => /emergency stop|E-stop/i.test(`${d.kind} ${d.description}`)), 'the E-stop');
  assert.ok(/^No touch panel: the operator runs the machine from the operator station/.test(operatorInterfaceText(p)));
  assert.equal(operatorInterfaceText(withPanel), '', 'nothing to say on a machine with a panel');
});

test('operator manual: operator station section, no HMI, sections numbered without gaps', () => {
  const m = operatorManual(p);
  m.forEach((s, i) => assert.ok(s.title.startsWith(`${i + 1}. `), `section ${i + 1}: ${s.title}`));
  assert.ok(m.some((s) => /Operator station/.test(s.title)), 'operator station section');
  // The app's own wording only: the example's specification (customer text) and the alarm lines taken
  // from the example program (written for a panel) still name the HMI.
  const customer = new Set(Object.values(p.spec).flatMap((t) => specLines(typeof t === 'string' ? t : '')));
  for (const s of m) for (const t of [s.title, ...s.paragraphs]) if (!customer.has(t) && !/\(ALM-\d+\)/.test(t)) assert.ok(!mentionsHmi(t), `manual mentions the HMI: ${t}`);
  assert.ok(operatorManual(withPanel).some((s) => /Operator panel screens/.test(s.title)), 'a panel machine keeps its screens section');
});

test('FAT / SAT: operator station tests, no HMI steps, sections numbered without gaps', () => {
  const fat = fatProcedure(p, docMeta(p));
  const sections = [...new Set(fat.map((r) => r.section))];
  sections.forEach((s, i) => assert.ok(s.startsWith(`${i + 1}. `), `FAT section ${i + 1}: ${s}`));
  assert.ok(sections.some((s) => /Operator station/.test(s)), 'operator station tests');
  // Alarm tests quote the example program's reset conditions (written for a panel) and sequence tests the
  // customer's specification; the rest is the app's wording.
  const customer = new Set(Object.values(p.spec).flatMap((t) => specLines(typeof t === 'string' ? t : '')));
  for (const r of [...fat, ...satChecklist(p)].filter((x) => !/^ALM-/.test(x.description) && !customer.has(x.procedure))) assert.ok(!mentionsHmi(`${r.description} ${r.procedure} ${r.expected}`), `test mentions the HMI: ${r.description} — ${r.procedure} — ${r.expected}`);
  assert.ok(fatProcedure(withPanel, docMeta(withPanel)).some((r) => /HMI/.test(r.section)), 'a panel machine keeps its HMI tests');
});

test('engineering texts: description, abbreviations, residual risks and program tables', () => {
  assert.ok(systemDescription(p).some((t) => /No touch panel/.test(t)), 'the system description says how the machine is operated');
  // The equipment recommendation's own reasoning was written when the example had its panel.
  for (const t of systemDescription(p).filter((x) => !x.startsWith('Controller selection:'))) assert.ok(!mentionsHmi(t), t);
  assert.ok(!textOf(abbreviationsTable(p).rows).includes('Human-machine interface'), 'no HMI abbreviation');
  for (const t of residualRisks(p)) assert.ok(!mentionsHmi(t), t);
  assert.ok(!alarmTable(p).columns.some((c) => /HMI/.test(c.header)), 'alarm table without "(HMI)"');
  assert.ok(!tagTable(p).columns.some((c) => /HMI/.test(c.header)), 'tag table without the HMI screens column');
  assert.ok(tagTable(withPanel).columns.some((c) => /HMI/.test(c.header)), 'a panel machine keeps it');
});

test('machine specification: operator station instead of the screens', () => {
  const t = machineSpecText(p);
  assert.ok(/Operator station \(no touch panel\)/.test(t));
  assert.ok(!/Operator screens/.test(t) && !/Operator panel \(HMI\)/.test(t));
});

test('design review: the AI is told there is no panel by choice; panel-only commands are flagged', () => {
  const summary = projectSummary(p, []);
  assert.ok(/No touch panel, by the customer's choice/.test(summary) && !/^# HMI/m.test(summary));
  const findings = checksFor(p);
  assert.ok(!findings.some((f) => /^(hmi-|alm-)/.test(f.id)), 'no checks against the old screens');
  // The example program still reads the panel's command bits (C1001 Start …): nothing would ever set them.
  const panelInputs = findings.filter((f) => f.id.startsWith('nohmi-input:'));
  assert.ok(panelInputs.length > 0, 'the panel-only commands are reported');
  assert.ok(panelInputs.every((f) => f.severity === 'major' && /No touch panel, but the program waits for/.test(f.title)));
  assert.ok(!checksFor(withPanel).some((f) => f.id.startsWith('nohmi-input:')), 'not on a machine with a panel');
});

console.log(`\n${passed} passed`);
