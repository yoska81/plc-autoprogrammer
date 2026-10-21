/// <reference types="node" />
/**
 * "Add comments", what shipping needs: the AI budget on a big program (few calls of about 100 000 characters, small
 * answers, never the program asked back), the exports carrying the new comments (CLICK, Siemens SCL, Logix L5X there
 * and back, the MPE720 register comments), and an imported Yaskawa program (synthetic fixture) commented with its
 * logic and its own comments kept.
 * Run with:  npx tsx src/plc/tidy/comments.ship.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importProgramFiles, importProgramText } from '../import';
import { applyUpgrade } from '../import/ui/applyUpgrade';
import { collectProject } from '../../deliverables/collect';
import { exportContext } from '../../deliverables/exportContext';
import { useProgramStore } from '../../store/useProgramStore';
import { setClaudeInterceptor, type ClaudeOptions } from '../../lib/ai/anthropic';
import { clearAiCache } from '../../lib/ai/cache';
import { l5x as bigL5x } from '../import/__fixtures__/bigPrograms';
import { seedSampleProject } from '../../preview/sampleProject';
import { applyEquipment } from '../../spec/equipment';
import { buildScl } from '../core/profiles/siemens';
import { buildL5x } from '../core/profiles/l5x';
import { clickNicknameCsv, clickRungListing } from '../core/clickExport';
import { mpe720CommentCsv } from '../core/mpe720Csv';
import { addComments, PART_CHARS, PART_KEYS, rulesComments, sameLogic } from './comments';
import type { LadderProgram } from '../core/ladder';

const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };
console.info = () => {};
const here = dirname(fileURLToPath(import.meta.url));
const ai = { provider: 'anthropic' as const, apiKey: 'k', model: 'm', effort: 'high' as const };
const blankAll = (l: LadderProgram): LadderProgram => ({ ...l, rungs: l.rungs.map((r) => ({ ...r, comment: '' })) });

// ── AI budget on a synthetic ~2,000-rung program: few calls of about PART_CHARS, small answers, no program JSON ──
{
  await clearAiCache();
  const { program: imp } = importProgramFiles([{ name: 'big.L5X', text: bigL5x(40, 120) }]);
  applyUpgrade(imp);
  useProgramStore.getState().setGeneratedLadder(blankAll(useProgramStore.getState().ladder), 'x', null);
  const p = collectProject();
  const calls: { inChars: number; keys: number; maxTokens?: number; task?: string; schemaKeys: string[]; json: boolean }[] = [];
  let outChars = 0;
  setClaudeInterceptor(async (o: ClaudeOptions) => {
    const content = o.messages.map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('');
    const asked = (/Write comments for: (.*)$/.exec(content)?.[1] ?? '').split(', ').filter(Boolean).length;
    calls.push({ inChars: o.system.length + content.length, keys: asked, maxTokens: o.maxTokens, task: o.task, schemaKeys: Object.keys((o.schema as { properties: Record<string, unknown> }).properties), json: /"branches"|"outputs"/.test(content) });
    const keys = [...content.matchAll(/^(rung:[^\s]+)/gm)].map((m) => m[1]).slice(0, 3);
    const text = JSON.stringify({ items: keys.map((key) => ({ key, text: 'A comment.' })) });
    outChars += text.length;
    return { text, reasoning: null };
  });
  const r = await addComments(p, { ai });
  setClaudeInterceptor(null);
  const totalIn = calls.reduce((n, c) => n + c.inChars, 0);
  const totalKeys = calls.reduce((n, c) => n + c.keys, 0);
  // About 35 tokens a comment: the answer the largest part expects, against its cap.
  const expect = (c: (typeof calls)[number]) => 35 * c.keys;
  console.log(`  budget: ${p.ladder.rungs.length} rungs → ${calls.length} calls, input ${totalIn} characters (largest ${Math.max(...calls.map((c) => c.inChars))}), ${totalKeys} comments asked (most in one call ${Math.max(...calls.map((c) => c.keys))}, ≈${Math.max(...calls.map(expect))} answer tokens), output ${outChars} characters, max_tokens ${[...new Set(calls.map((c) => c.maxTokens))].join('/')}`);
  assert.ok(calls.every((c) => c.keys <= PART_KEYS), 'at most PART_KEYS comments asked in a call');
  assert.ok(calls.every((c) => c.maxTokens !== undefined && expect(c) * 2 <= c.maxTokens), 'the answer fits under its cap with room to think: no retry at 64 000');
  assert.ok(p.ladder.rungs.length >= 1900, `${p.ladder.rungs.length} rungs`);
  assert.ok(calls.length <= Math.max(Math.ceil(totalIn / (PART_CHARS * 0.7)), Math.ceil(totalKeys / (PART_KEYS * 0.7))), `${calls.length} calls for ${totalIn} characters, ${totalKeys} comments: parts as big as allowed`);
  assert.ok(calls.every((c) => c.inChars <= PART_CHARS * 1.2), 'no part much over PART_CHARS');
  assert.ok(calls.every((c) => c.maxTokens !== undefined && c.maxTokens <= 16_000), 'small answers, never 64 000 tokens');
  assert.ok(calls.every((c) => c.task === 'comments'), 'the comments task (low effort)');
  assert.ok(calls.every((c) => c.schemaKeys.join() === 'items' && !c.json), 'only {key, text} items asked; no program JSON sent or asked back');
  assert.ok(sameLogic(p.ladder, r.program) && r.program.rungs.every((x) => x.comment.trim()));
  // A part with no blank key is not sent.
  await clearAiCache();
  let n = 0;
  setClaudeInterceptor(async () => { n++; return { text: '{"items":[]}', reasoning: null }; });
  await addComments({ ...p, ladder: r.program }, { ai });
  setClaudeInterceptor(null);
  assert.equal(n, 0, 'nothing blank: no call');
}

// ── Exports carry the new comments: CLICK (listing, nicknames), Siemens SCL, Logix L5X there and back ──
{
  seedSampleProject();
  const l = blankAll(structuredClone(useProgramStore.getState().ladder));
  l.tags = l.tags.map((t, i) => (i === 0 ? { ...t, comment: '' } : t));
  useProgramStore.getState().setGeneratedLadder(l, 'x', null);
  const before = collectProject();
  const r = rulesComments(before);
  useProgramStore.getState().setGeneratedLadder(r.program, 'commented', null);
  const p = collectProject();
  const tag0 = r.program.tags[0];
  assert.ok(tag0.comment.trim(), 'the blank tag comment is filled');
  const listing = clickRungListing(p.ladder, p.labels, 'h');
  assert.ok(r.program.rungs.every((x) => listing.includes(x.comment.split(' (')[0])), 'CLICK listing has every rung comment');
  assert.ok(clickNicknameCsv(p.ladder, p.io, p.addresses).includes(tag0.comment.split(',')[0]), 'CLICK nickname CSV has the tag comment');
  // Siemens: the comments in the SCL (operands named the TIA way, so compared by their first words).
  applyEquipment({ cpuId: '6ES7214-1AG40-0XB0', modules: [], hmiPartNumber: null }, null);
  const s7 = collectProject();
  const scl = buildScl(s7.ladder, exportContext(s7)).scl;
  const head = (c: string) => c.split(/\s+/).slice(0, 2).join(' ');
  assert.ok(s7.ladder.rungs.every((x) => scl.includes(`(* ${head(x.comment)}`)), 'every rung comment in the SCL');
  // Logix: export and read back, the rung comments come back.
  applyEquipment({ cpuId: '5069-L310ER', modules: ['5069-IB16', '5069-OB16'], hmiPartNumber: null }, null);
  const lx = collectProject();
  const file = buildL5x(lx.ladder, exportContext(lx));
  const back = importProgramText('back.L5X', file);
  const comments = back.program.rungs.map((x) => x.comment);
  assert.ok(lx.ladder.rungs.filter((x) => x.comment.trim()).every((x) => comments.some((c) => c.includes(head(x.comment)))), 'L5X round trip keeps the rung comments');
}

// ── Yaskawa (synthetic MPE720 fixture): read-only program with kept boxes, commented, its own comments kept ──
{
  const bytes = new Uint8Array(readFileSync(join(here, '..', 'import', '__fixtures__', 'demo_mp.YMW7')));
  const { program: imp } = importProgramFiles([{ name: 'demo_mp.YMW7', text: '', bytes }]);
  applyUpgrade(imp);
  const p = collectProject();
  const kept = new Map(p.ladder.rungs.filter((x) => x.comment.trim()).map((x) => [x.id, x.comment]));
  const keptTags = new Map(p.ladder.tags.filter((t) => t.comment.trim()).map((t) => [t.address, t.comment]));
  const r = rulesComments(p);
  assert.ok(sameLogic(p.ladder, r.program));
  assert.ok(r.program.rungs.every((x) => x.comment.trim()), 'every rung commented');
  for (const [id, c] of kept) assert.equal(r.program.rungs.find((x) => x.id === id)!.comment, c, 'an MPE720 rung comment is kept');
  for (const [a, c] of keptTags) assert.equal(r.program.tags.find((t) => t.address === a)!.comment, c, 'an MPE720 register comment is kept');
  const csv = mpe720CommentCsv(r.program, p.io, p.addresses);
  assert.ok(csv.count >= mpe720CommentCsv(p.ladder, p.io, p.addresses).count, 'the register comments export still carries every comment');
  console.log(`  yaskawa: ${p.ladder.rungs.length} rungs (${p.ladder.rungs.filter((x) => x.outputs.some((o) => o.type === 'RAW') || x.branches.some((b) => b.some((e) => e.type === 'RAW'))).length} with kept boxes), ${r.rungs} rung and ${r.tags} tag comments filled, ${kept.size} + ${keptTags.size} kept`);
}

console.log('tidy comments ship tests passed');
