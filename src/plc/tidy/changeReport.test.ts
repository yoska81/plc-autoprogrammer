/// <reference types="node" />
/**
 * The Change report (synthetic fixtures only): a change offered as a proposal is recorded when approved and dropped
 * when rejected; Reorganize's removals come with their reason and what was kept back; a move to another PLC with
 * how much converts; the AI's kept and dropped blocks; comments per block; a behaviour-check line per change; the
 * PDF and the Word file with the three sections.
 * Run with:  npx tsx src/plc/tidy/changeReport.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { seedSampleProject } from '../../preview/sampleProject';
import { collectProject } from '../../deliverables/collect';
import { useProgramStore } from '../../store/useProgramStore';
import { importProgramFiles } from '../import';
import { applyUpgrade } from '../import/ui/applyUpgrade';
import { choosePlcBrand } from '../core/choosePlc';
import type { LadderProgram } from '../core/ladder';
import { checkEquivalence } from './equivalence';
import { applyReorganize, planReorganize, plcBaseline, type SectionId } from './reorganize';
import { commentsEntry, projectChanges, recordConversion, reorganizeEntry, simplifyEntry, stageChange, useChangeLog } from './changeLog';
import { buildChangeReport, changeReportDocx, changeReportPdf } from './changeReport';

const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };
console.info = () => {};
const here = dirname(fileURLToPath(import.meta.url));
const NO = (address: string) => ({ type: 'NO' as const, address });
const OUT = (address: string) => ({ type: 'OUT' as const, address });

// A small program: a timer only a counter reads (the counter is in the registers group, off), a dead bit, an output.
function project() {
  seedSampleProject();
  const l: LadderProgram = { tags: [], blocks: [{ id: 'm', name: 'Main', description: '' }], rungs: [
    { id: 'tmr', block: 'm', comment: '', branches: [[NO('X001')]], outputs: [{ type: 'TMR', address: 'T5', mode: 'ON_DELAY', preset: '1', unit: 'sec', accumulate: false, resetAddress: null }] },
    { id: 'cnt', block: 'm', comment: '', branches: [[NO('T5')]], outputs: [{ type: 'CNT', address: 'CT5', direction: 'UP', preset: '3', resetAddress: null }] },
    { id: 'done', block: 'm', comment: '', branches: [[NO('CT5')]], outputs: [OUT('C40')] },
    { id: 'dead', block: 'm', comment: '', branches: [[NO('X002')]], outputs: [OUT('C41')] },
    { id: 'out', block: 'm', comment: '', branches: [[NO('X003')]], outputs: [OUT('Y001')] },
  ] };
  useProgramStore.getState().setGeneratedLadder(l, 'x', null);
  useChangeLog.setState({ entries: [], pending: null });
  return collectProject();
}

// A proposal: recorded on Approve, dropped on Reject.
{
  const p = project();
  const plan = planReorganize(p);
  const chosen = new Set<SectionId>(['remove-internal']);
  const after = applyReorganize(p, plan, chosen);
  const check = checkEquivalence(plcBaseline(p, plan, chosen), after, { random: 20, steps: 20 });
  const st = useProgramStore.getState();
  st.setProposal({ program: after, explanation: 'x', reasoning: null });
  stageChange(reorganizeEntry(p, plan, chosen, after, check));
  useProgramStore.getState().rejectProposal();
  assert.equal(projectChanges().length, 0, 'rejected: not in the report');
  useProgramStore.getState().setProposal({ program: after, explanation: 'x', reasoning: null });
  stageChange(reorganizeEntry(p, plan, chosen, after, check));
  useProgramStore.getState().applyProposal();
  const [e] = projectChanges();
  assert.equal(e?.kind, 'reorganize', 'approved: in the report');
  if (e.kind !== 'reorganize') throw new Error();
  assert.deepEqual(e.removed.map((r) => r.rung).sort(), [3, 4], 'the dead bits; the timer the counter reads stays');
  assert.ok(e.removed.every((r) => /nothing in the program, the outputs or the screen uses what it sets/.test(r.reason)));
  assert.deepEqual(e.keptBack.map((k) => [k.rung, k.why]), [[1, 'rung 2, which stays, still uses what it sets']]);
  assert.equal(e.check.passed, true);
}

// The report: the three sections, each change's check line, header totals; the Word file and the PDF.
{
  const p = project();
  const plan = planReorganize(p);
  const chosen = new Set<SectionId>(['remove-internal', 'reorder']);
  const after = applyReorganize(p, plan, chosen);
  useProgramStore.getState().setProposal({ program: after, explanation: 'x', reasoning: null });
  stageChange(reorganizeEntry(p, plan, chosen, after, checkEquivalence(plcBaseline(p, plan, chosen), after, { random: 20, steps: 20 })));
  useProgramStore.getState().applyProposal();
  // Add comments and an AI simplify (one block kept, one dropped), each approved.
  const before = useProgramStore.getState().ladder;
  const commented: LadderProgram = { ...before, rungs: before.rungs.map((r) => ({ ...r, comment: r.comment || 'A note.' })) };
  useProgramStore.getState().setProposal({ program: commented, explanation: 'x', reasoning: null });
  stageChange(commentsEntry(before, commented, 3, 0));
  useProgramStore.getState().applyProposal();
  const sim = checkEquivalence(commented, commented, { random: 5, steps: 5 });
  useProgramStore.getState().setProposal({ program: { ...commented, rungs: commented.rungs.slice() }, explanation: 'x', reasoning: null });
  stageChange(simplifyEntry({ program: commented, kept: [{ id: 'm', name: 'Main', before: 12, after: 8, rungsBefore: 3, rungsAfter: 2, summary: 'Same behaviour in 40 test sequences (0 differences). Details: …', explanation: '' }], dropped: [{ id: 'x', name: 'Other', why: 'not simpler (5 parts against 4)' }], final: sim }));
  useProgramStore.getState().applyProposal();
  const r = buildChangeReport(collectProject(), projectChanges(), 'line.L5X, Allen-Bradley 1769-L33ER');
  assert.deepEqual(r.sections.map((s) => s.title), ['Converted', 'Deleted', 'Changed']);
  const text = (t: string) => r.sections.find((s) => s.title === t)!.parts.map((x) => Object.values(x)[0]).join('\n');
  assert.match(text('Converted'), /Nothing was converted in this session\./);
  assert.match(text('Deleted'), /Rung 3: .*— nothing in the program, the outputs or the screen uses what it sets/);
  assert.match(text('Deleted'), /Kept, although offered for removal:\nRung 1: .*rung 2, which stays, still uses what it sets/);
  assert.match(text('Changed'), /Group the rungs by machine part/);
  assert.match(text('Changed'), /Main: 3 → 2 rungs \(12 → 8 parts\)\. Same behaviour in 40 test sequences \(0 differences\)\./);
  assert.match(text('Changed'), /Other: not simpler/);
  assert.match(text('Changed'), /\n\w+: \d+ rung comments?\n/, 'comments per block');
  assert.equal(r.checks.length, 3);
  assert.match(r.checks[0], /Reorganize: equivalence check passed — Same behaviour in/);
  assert.match(r.checks[1], /Add comments: equivalence check not needed/);
  assert.match(r.checks[2], /Simplify blocks with AI: equivalence check passed/);
  assert.deepEqual(r.header.map(([k]) => k), ['Project', 'Program from', 'Now on', 'Date', 'Totals']);
  assert.match(r.header[4][1], /0 conversions; 2 parts deleted \(1 kept back\)/);
  const zip = await JSZip.loadAsync(await (await changeReportDocx(r)).arrayBuffer());
  const doc = await zip.file('word/document.xml')!.async('string');
  for (const h of ['Behaviour check per change', 'Converted', 'Deleted', 'Changed']) assert.ok(doc.includes(`<w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t xml:space="preserve">${h}<`), h);
  assert.ok((await changeReportPdf(collectProject(), r)).size > 3000);
}

// A move to another PLC (a read-only Yaskawa program, synthetic fixture, to Siemens): how much converts, what is
// kept to redo by hand; the check line says the equivalence check was not run.
{
  const bytes = new Uint8Array(readFileSync(join(here, '..', 'import', '__fixtures__', 'demo_mp.YMW7')));
  applyUpgrade(importProgramFiles([{ name: 'demo_mp.YMW7', text: '', bytes }]).program);
  useChangeLog.setState({ entries: [], pending: null });
  recordConversion('siemens-s7', () => choosePlcBrand('siemens-s7'));
  const [e] = projectChanges();
  assert.equal(e?.kind, 'convert');
  if (e.kind !== 'convert') throw new Error();
  assert.match(e.from, /^Yaskawa /);
  assert.match(e.to, /^Siemens /);
  assert.ok(e.coverage && e.coverage.rungs > 0 && e.coverage.converted <= e.coverage.rungs);
  const r = buildChangeReport(collectProject(), projectChanges());
  const conv = r.sections[0].parts.map((x) => Object.values(x)[0]).join('\n');
  assert.match(conv, /Yaskawa .* → Siemens S7-1200 \/ S7-1500/);
  assert.match(conv, /\d+ of \d+ rungs convert \(\d+%\)\./);
  assert.match(conv, /instruction the app can't read/);
  assert.match(r.checks[0], /Move to another PLC: equivalence check not run/);
  // A second choice of the same PLC is not a move.
  recordConversion('siemens-s7', () => choosePlcBrand('siemens-s7'));
  assert.equal(projectChanges().length, 1);
}

console.log('tidy change report tests passed');
