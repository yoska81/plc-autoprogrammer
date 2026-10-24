/**
 * Comments follow the operands they quote (shownNames.ts, ioChange.ts): the synthetic MPE720 demo commented on its
 * Yaskawa ("Turns on Horn (OB00001) …"), then remade for a Siemens S7-1200: the comments name what Explain shows
 * there ("Horn (Y002)"), whole tokens only, the rest of each comment as written.
 * Run with:  npx tsx src/plc/core/shownNames.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readYmw7 } from '../import/mpe720';
import { convertForeign } from '../import/convert';
import { applyUpgrade } from '../import/ui/applyUpgrade';
import { choosePlcBrand } from './choosePlc';
import { renameInComments } from './shownNames';
import { rulesComments } from '../tidy/comments';
import { programInfo } from '../../deliverables/docs/program';
import { collectProject } from '../../deliverables/collect';
import { useProgramStore } from '../../store/useProgramStore';
import '../../hmi/ioParticipant';

// The rename itself: whole tokens, all at once (no chains), the rest kept.
{
  const p = { rungs: [{ id: 'a', comment: 'X001 and X0012, then X002; #X001 kept', branches: [], outputs: [] }], tags: [{ address: 'C1', nickname: 'Run', comment: 'set by X002' }], blocks: [{ id: 'b', name: 'B', description: 'reads X001' }] };
  const r = renameInComments(p, new Map([['X001', 'X002'], ['X002', 'X003']]));
  assert.equal(r.rungs[0].comment, 'X002 and X0012, then X003; #X001 kept');
  assert.equal(r.tags[0].comment, 'set by X003');
  assert.equal(r.blocks![0].description, 'reads X002');
  assert.equal(renameInComments(p, new Map([['X009', 'X010']])), p, 'nothing to rename: the same program');
}

// The demo: commented on its Yaskawa, then remade for Siemens.
const bytes = new Uint8Array(readFileSync(new URL('../import/__fixtures__/demo_mp.YMW7', import.meta.url)));
applyUpgrade(convertForeign(readYmw7(bytes, 'demo_mp.YMW7'), 'demo_mp.YMW7'));
const commented = rulesComments(collectProject(), true).program;
useProgramStore.getState().editLadder(commented);
const yaskawa = commented.rungs.map((r) => r.comment).join('\n');
assert.match(yaskawa, /OB0000[0-9A-F]/, 'the comments name Yaskawa registers on the Yaskawa');
choosePlcBrand('siemens-s7');
const s = collectProject();
const info = programInfo(s);
const now = s.ladder.rungs.map((r) => r.comment).join('\n');
// A tag still called by its register (MB001000) is its name; the address in brackets is the Siemens one, as Explain shows it.
assert.doesNotMatch(now, /\(([IOM][BWLF][0-9A-F]{4,})\)/, `no Yaskawa address left in the comments:\n${now}`);
assert.match(now, /Start button \(X001\)/);
// The same words as before, with the names Explain shows on the Siemens PLC.
for (const [i, r] of s.ladder.rungs.entries()) {
  const was = commented.rungs[i].comment;
  if (!was) continue;
  assert.equal(r.comment.replace(/\((X|Y)\d{3}\)|\((DS|DD|DF|C|T|CT)\d+\)/g, '(#)'), was.replace(/\([IOM][BWLF][0-9A-F]{4,}\)/g, '(#)'), `rung ${i + 1}: only the names changed`);
}
const horn = s.ladder.rungs.find((r) => /Horn/i.test(r.comment));
if (horn) assert.ok(horn.comment.includes(info.ref(horn.outputs.find((o) => 'address' in o)!.type === 'OUT' ? (horn.outputs.find((o) => 'address' in o) as { address: string }).address : '')), `the horn's comment names it as Explain does: ${horn.comment}`);

console.log('shown names tests passed');
