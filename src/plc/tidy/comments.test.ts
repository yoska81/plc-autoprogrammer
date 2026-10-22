/// <reference types="node" />
/**
 * "Add comments": the blanks are filled (rules, or the AI with the rules as fallback), nothing else changes.
 * Run with:  npx tsx src/plc/tidy/comments.test.ts
 */
import assert from 'node:assert/strict';
import { seedSampleProject, LADDER } from '../../preview/sampleProject';
import { collectProject } from '../../deliverables/collect';
import { useProgramStore } from '../../store/useProgramStore';
import { setClaudeInterceptor } from '../../lib/ai/anthropic';
import { clearAiCache } from '../../lib/ai/cache';
import { addComments, rulesComments, sameLogic } from './comments';
import type { LadderProgram } from '../core/ladder';

const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };
const ai = { provider: 'anthropic' as const, apiKey: 'k', model: 'm', effort: 'low' as const };

/** The example program with every other rung comment, one block description and one tag comment blanked. */
function project() {
  seedSampleProject();
  const l: LadderProgram = structuredClone(LADDER);
  l.rungs.forEach((r, i) => { if (i % 2 === 0) r.comment = ''; });
  if (l.blocks?.length) l.blocks[0].description = '';
  if (l.tags.length) l.tags[0].comment = '';
  useProgramStore.getState().setGeneratedLadder(l, 'x', null);
  return collectProject();
}

// Rules: every blank filled, every existing comment kept, the logic untouched.
{
  const p = project();
  const r = rulesComments(p);
  assert.ok(sameLogic(p.ladder, r.program));
  assert.equal(r.rungs, p.ladder.rungs.filter((x) => !x.comment.trim()).length);
  r.program.rungs.forEach((x, i) => {
    assert.ok(x.comment.trim(), `rung ${i + 1} has a comment`);
    if (p.ladder.rungs[i].comment.trim()) assert.equal(x.comment, p.ladder.rungs[i].comment, 'an existing comment is kept');
  });
  const first = r.program.rungs[0].comment;
  assert.match(first, / when /, first);
  if (p.ladder.blocks?.length) assert.ok(r.program.blocks![0].description.trim());
  if (p.ladder.tags.length) assert.match(r.program.tags[0].comment, /rung|Not used/);
  assert.equal(r.byAi, 0);
}

// Rewrite all: every comment is written again; still only comments.
{
  const p = project();
  const r = rulesComments(p, true);
  assert.equal(r.rungs, p.ladder.rungs.length);
  assert.ok(sameLogic(p.ladder, r.program));
  assert.notEqual(r.program.rungs[1].comment, p.ladder.rungs[1].comment, 'an existing comment is rewritten');
}

// The check: a change of logic is never taken for a comment change.
{
  const p = project();
  const other: LadderProgram = structuredClone(p.ladder);
  const out = other.rungs.find((x) => x.outputs.some((o) => o.type === 'OUT'))!.outputs.find((o) => o.type === 'OUT')! as { address: string };
  out.address = 'Y099';
  assert.ok(!sameLogic(p.ladder, other));
}

// AI: its comments for the keys asked; a key not asked (an existing comment, an unknown rung) is ignored; the rules
// fill what it leaves out.
{
  await clearAiCache();
  const p = project();
  const blankId = p.ladder.rungs.find((x) => !x.comment.trim())!.id;
  const keptId = p.ladder.rungs.find((x) => x.comment.trim())!.id;
  setClaudeInterceptor(async () => ({ text: JSON.stringify({ items: [
    { key: `rung:${blankId}`, text: 'Starts the conveyor when the operator presses Start and safety is OK.' },
    { key: `rung:${keptId}`, text: 'SHOULD NOT REPLACE' },
    { key: 'rung:nope', text: 'unknown' },
  ] }), reasoning: null }));
  const r = await addComments(p, { ai });
  setClaudeInterceptor(null);
  assert.ok(sameLogic(p.ladder, r.program));
  assert.equal(r.program.rungs.find((x) => x.id === blankId)!.comment, 'Starts the conveyor when the operator presses Start and safety is OK.');
  assert.equal(r.program.rungs.find((x) => x.id === keptId)!.comment, p.ladder.rungs.find((x) => x.id === keptId)!.comment);
  assert.ok(r.program.rungs.every((x) => x.comment.trim()), 'the rules fill the rest');
  assert.equal(r.byAi, 1);
}

// AI failing: the rules' comments, and a note says so.
{
  await clearAiCache();
  const p = project();
  setClaudeInterceptor(async () => { throw Object.assign(new Error('not granted'), { code: 'not_granted' }); });
  const r = await addComments(p, { ai });
  setClaudeInterceptor(null);
  assert.ok(r.program.rungs.every((x) => x.comment.trim()));
  assert.equal(r.byAi, 0);
  assert.match(r.notes.join(' '), /did not answer \(/);
}

console.log('tidy comments tests passed');
