/// <reference types="node" />
/**
 * A program read from a file (Upgrade, a printout) is the user's: "Build program from my project" says it replaces
 * that program and where it stays; an app-made program keeps the short question.
 * Run with:  npx tsx src/plc/import/ui/applyUpgrade.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importProgramText } from '../index';
import { applyUpgrade } from './applyUpgrade';
import { replaceProgramQuestion, useProgramStore } from '../../../store/useProgramStore';
import { seedSampleProject, LADDER } from '../../../preview/sampleProject';

const warn = console.warn;
console.warn = (...a: unknown[]) => { if (!String(a[0]).includes('zustand persist')) warn(...a); };

const here = dirname(fileURLToPath(import.meta.url));
const capper = importProgramText('capper.L5X', readFileSync(join(here, '..', '__fixtures__', 'capper.L5X'), 'utf8'));

seedSampleProject();
useProgramStore.getState().setGeneratedLadder(structuredClone(LADDER), 'Example.', null);
assert.equal(replaceProgramQuestion(useProgramStore.getState()), 'Build a new program from your project? (The current one is kept in History.)', 'app-made: the short question');

applyUpgrade(capper);
const st = useProgramStore.getState();
assert.equal(st.ladderOrigin, 'user');
assert.equal(st.ladderSource, 'capper.L5X');
assert.equal(replaceProgramQuestion(st), `Replace the program read from capper.L5X (${st.ladder.rungs.length} rungs) with a new one built from the description? The imported program stays in History (Restore).`);

// Edited, it is still the program read from that file; a restored version or a new generation is not.
st.editLadder({ ...st.ladder, rungs: st.ladder.rungs.slice(1) });
assert.match(replaceProgramQuestion(useProgramStore.getState()), /^Replace the program read from capper\.L5X/);
useProgramStore.getState().setGeneratedLadder(structuredClone(LADDER), 'New.', null);
assert.equal(useProgramStore.getState().ladderSource, undefined);

console.log('applyUpgrade tests passed');
