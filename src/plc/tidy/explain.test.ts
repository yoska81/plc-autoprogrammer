/// <reference types="node" />
/**
 * "Explain the program": one section per block from the program itself; a step sequence read from its register;
 * the AI's paragraphs within the budget and dropped when the block changes; PDF and Word files; a read-only Yaskawa
 * program (synthetic fixture) and a synthetic 4,000-rung program.
 * Run with:  npx tsx src/plc/tidy/explain.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { seedSampleProject, LADDER } from '../../preview/sampleProject';
import { collectProject } from '../../deliverables/collect';
import { useProgramStore } from '../../store/useProgramStore';
import { setClaudeInterceptor, type ClaudeOptions } from '../../lib/ai/anthropic';
import { clearAiCache } from '../../lib/ai/cache';
import { importProgramFiles } from '../import';
import { applyUpgrade } from '../import/ui/applyUpgrade';
import { l5x as bigL5x } from '../import/__fixtures__/bigPrograms';
import type { LadderProgram } from '../core/ladder';
import { EXPLAIN_PART_BLOCKS, EXPLAIN_PART_CHARS, explainProgram, explainWithAi, explanationText } from './explain';
import { buildExplanationDocx, buildExplanationPdf } from './explainExport';

const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };
console.info = () => {};
const here = dirname(fileURLToPath(import.meta.url));
const ai = { provider: 'anthropic' as const, apiKey: 'k', model: 'm', effort: 'low' as const };

// The example: a section per block with what it reads, drives, hands over, its timers, counters and alarms.
{
  seedSampleProject();
  useProgramStore.getState().setGeneratedLadder(structuredClone(LADDER), 'x', null);
  const p = collectProject();
  const x = explainProgram(p);
  assert.deepEqual(x.blocks.map((b) => b.id), (p.ladder.blocks ?? []).map((b) => b.id), 'a section per block, in order');
  const by = (name: string) => x.blocks.find((b) => b.name === name)!;
  assert.ok(by('Outputs').outputs.some((o) => /^Conveyor motor contactor \(Y001\): on while .*Conv Auto Req \(C10\)/.test(o)), by('Outputs').outputs.join(' | '));
  assert.ok(by('Pusher').timers.some((t) => t.startsWith('Push Timeout (T1)')));
  assert.ok(by('Conveyor').counters.some((t) => t.startsWith('Part Count (CT1): counts up')));
  assert.ok(by('Alarms').alarms.length >= 2);
  assert.ok(by('Pusher').gives.some((g) => /Push Request \(C3\) to .*Outputs/.test(g)) && by('Outputs').uses.some((u) => /Push Request \(C3\) from Pusher/.test(u)), 'handovers both ways');
  assert.ok(by('Safety & modes').inputs.includes('Start Button (X002)'));
  assert.match(x.overview[0], /42 rungs in 7 blocks/);
  assert.ok(explanationText(x).includes('## Pusher (rungs 15–18)'));
}

// A step sequence: the register compared with step numbers and moved to the next; each step's actions and exits.
{
  seedSampleProject();
  const S = 'DS100';
  const l: LadderProgram = { tags: [{ address: S, nickname: 'Step', comment: '' }], blocks: [{ id: 'cyc', name: 'Cycle', description: '' }], rungs: [
    { id: 'a', block: 'cyc', comment: '', branches: [[{ type: 'CMP', left: S, op: '==', right: '0' }, { type: 'NO', address: 'X002' }]], outputs: [{ type: 'COPY', source: '10', dest: S }] },
    { id: 'b', block: 'cyc', comment: '', branches: [[{ type: 'CMP', left: S, op: '==', right: '10' }]], outputs: [{ type: 'OUT', address: 'Y002' }] },
    { id: 'c', block: 'cyc', comment: '', branches: [[{ type: 'CMP', left: S, op: '==', right: '10' }, { type: 'NO', address: 'X005' }]], outputs: [{ type: 'COPY', source: '20', dest: S }] },
    { id: 'd', block: 'cyc', comment: '', branches: [[{ type: 'CMP', left: S, op: '==', right: '20' }, { type: 'NO', address: 'X006' }]], outputs: [{ type: 'COPY', source: '0', dest: S }] },
  ] };
  useProgramStore.getState().setGeneratedLadder(l, 'x', null);
  const b = explainProgram(collectProject()).blocks[0];
  assert.ok(b.sequence, 'a step register found');
  assert.match(b.sequence!.register, /DS100/);
  assert.deepEqual(b.sequence!.steps.map((s) => s.step), ['0', '10', '20']);
  const s10 = b.sequence!.steps[1];
  assert.ok(s10.does.some((d) => /Y002/.test(d)), JSON.stringify(s10));
  assert.ok(s10.next.some((n) => /^to step 20 when .*X005/.test(n)), JSON.stringify(s10));
  assert.match(b.what, /step sequence/);
}

// AI: a paragraph per block, only {key, text}; dropped when the block's logic changes; a failing part leaves a note.
{
  await clearAiCache();
  seedSampleProject();
  useProgramStore.getState().setGeneratedLadder(structuredClone(LADDER), 'x', null);
  const p = collectProject();
  let asked: string[] = [];
  setClaudeInterceptor(async (o: ClaudeOptions) => {
    const content = String(o.messages[0].content);
    asked = (/Explain: (.*)$/.exec(content)?.[1] ?? '').split(', ');
    assert.ok(!/"branches"|"outputs"/.test(content), 'no program JSON sent');
    return { text: JSON.stringify({ items: [...asked.map((key) => ({ key, text: `About ${key}.` })), { key: 'block:nope', text: 'x' }] }), reasoning: null };
  });
  const r = await explainWithAi(p, ai);
  setClaudeInterceptor(null);
  assert.equal(Object.keys(r.summaries).length, (p.ladder.blocks ?? []).length, 'every block, nothing unknown');
  const x = explainProgram(p, r.summaries);
  assert.equal(x.blocks[3].aiSummary, `About block:${x.blocks[3].id}.`);
  // The pusher block changes: its paragraph no longer describes it.
  const changed = structuredClone(p.ladder);
  const r0 = changed.rungs.find((q) => q.block === x.blocks[3].id)!;
  r0.branches = [[...r0.branches[0], { type: 'NO', address: 'X001' }]];
  useProgramStore.getState().setGeneratedLadder(changed, 'x', null);
  const x2 = explainProgram(collectProject(), r.summaries);
  assert.equal(x2.blocks[3].aiSummary, undefined, 'a changed block drops its paragraph');
  assert.ok(x2.blocks[0].aiSummary, 'the others keep theirs');
  await clearAiCache();
  setClaudeInterceptor(async () => { throw Object.assign(new Error('not granted'), { code: 'not_granted' }); });
  const f = await explainWithAi(p, ai);
  setClaudeInterceptor(null);
  assert.equal(Object.keys(f.summaries).length, 0);
  assert.match(f.notes.join(' '), /did not answer/);
}

// Files: Word (a valid package with every block) and PDF.
{
  seedSampleProject();
  useProgramStore.getState().setGeneratedLadder(structuredClone(LADDER), 'x', null);
  const p = collectProject();
  const x = explainProgram(p);
  const docx = await buildExplanationDocx(x);
  const zip = await JSZip.loadAsync(await docx.arrayBuffer());
  const doc = await zip.file('word/document.xml')!.async('string');
  for (const f of ['[Content_Types].xml', '_rels/.rels', 'word/styles.xml', 'word/_rels/document.xml.rels']) assert.ok(zip.file(f), f);
  for (const b of x.blocks) assert.ok(doc.includes(b.name.replace(/&/g, '&amp;')), b.name);
  assert.ok(doc.includes('<w:pStyle w:val="Heading1"/>'));
  const pdf = await buildExplanationPdf(p, x);
  assert.ok(pdf.size > 3000, `PDF ${pdf.size} bytes`);
}

// Read-only Yaskawa program: its drawings as blocks, the kept boxes listed as not read.
{
  const bytes = new Uint8Array(readFileSync(join(here, '..', 'import', '__fixtures__', 'demo_mp.YMW7')));
  applyUpgrade(importProgramFiles([{ name: 'demo_mp.YMW7', text: '', bytes }]).program);
  const p = collectProject();
  const x = explainProgram(p);
  assert.equal(x.blocks.length, new Set(p.ladder.rungs.map((r) => r.block)).size);
  assert.ok(x.blocks.some((b) => b.notRead.length), 'kept boxes listed');
  assert.match(x.overview.join(' '), /instructions of the old PLC that the app cannot read/);
  assert.ok(!x.blocks.some((b) => /^Imported from/.test(b.what)), 'an import\'s own description is not taken for what a block does');
}

// A synthetic 4,000-rung program: fast, and the AI in few parts within the budget.
{
  await clearAiCache();
  applyUpgrade(importProgramFiles([{ name: 'big.L5X', text: bigL5x(80, 128) }]).program);
  const p = collectProject();
  const t = Date.now();
  const x = explainProgram(p);
  const ms = Date.now() - t;
  assert.equal(x.blocks.length, 80);
  assert.ok(ms < 5000, `${ms} ms`);
  const calls: { chars: number; keys: number; maxTokens?: number }[] = [];
  setClaudeInterceptor(async (o: ClaudeOptions) => {
    const content = String(o.messages[0].content);
    const keys = (/Explain: (.*)$/.exec(content)?.[1] ?? '').split(', ');
    calls.push({ chars: content.length + o.system.length, keys: keys.length, maxTokens: o.maxTokens });
    return { text: JSON.stringify({ items: keys.map((key) => ({ key, text: 'A paragraph.' })) }), reasoning: null };
  });
  const r = await explainWithAi(p, ai);
  setClaudeInterceptor(null);
  console.log(`  4,000 rungs: explained in ${ms} ms; AI ${calls.length} calls (largest ${Math.max(...calls.map((c) => c.chars))} characters, ${Math.max(...calls.map((c) => c.keys))} blocks, max_tokens ${[...new Set(calls.map((c) => c.maxTokens))].join('/')})`);
  assert.equal(Object.keys(r.summaries).length, 80);
  assert.ok(calls.every((c) => c.chars <= EXPLAIN_PART_CHARS * 1.1 && c.keys <= EXPLAIN_PART_BLOCKS && (c.maxTokens ?? 1e9) <= 16_000));
}

console.log('tidy explain tests passed');
