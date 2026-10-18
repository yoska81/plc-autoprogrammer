/// <reference types="node" />
/**
 * The parse worker's operations give what the page-side functions give (DXF text and sheet pictures,
 * program import), and a DXF is parsed once for all its uses.
 * Run with:  npx tsx src/workers/parseOps.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runParse } from './parseOps';
import { dxfToText, parseDxfEntities, sheetFrames } from '../convert/dxf';
import { dxfSheetSvg } from '../convert/dxfPicture';
import { importProgramFiles } from '../plc/import';
import { parseOffThread } from '../lib/parseWorker';

let passed = 0;
const failures: string[] = [];
async function test(name: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { failures.push(name); console.log(`  FAIL ${name}\n       ${(e as Error).message}`); }
}

console.log('Parse worker operations');
const dxf = readFileSync(new URL('../../e2e/fixtures/convert/roll-former.dxf', import.meta.url), 'utf8');
const l5x = readFileSync(new URL('../plc/import/__fixtures__/capper.L5X', import.meta.url), 'utf8');

await test('DXF text for the AI is the same as on the page', () => {
  assert.equal(runParse({ op: 'dxf-text', key: 'rf', text: dxf, name: 'roll-former.dxf' }), dxfToText(dxf, 'roll-former.dxf'));
});

await test('DXF sheet picture: the sheet a title block numbers; none for a sheet the file has not', () => {
  const ents = parseDxfEntities(dxf);
  const svg = runParse({ op: 'dxf-sheet', key: 'rf', text: dxf, sheet: 3 });
  assert.equal(svg, dxfSheetSvg(ents, sheetFrames(ents)[2]));
  assert.match(svg ?? '', /CN1-19/);
  assert.equal(runParse({ op: 'dxf-sheet', key: 'rf', text: dxf, sheet: 99 }), null);
});

await test('a cached DXF is not parsed again (the text is not even read)', () => {
  assert.match(runParse({ op: 'dxf-sheet', key: 'rf', text: '', sheet: 3 }) ?? '', /CN1-19/);
});

await test('program import is the same as on the page; without a Worker (Node) it runs here', async () => {
  const files = [{ name: 'capper.L5X', text: l5x }];
  assert.deepEqual(runParse({ op: 'program', files }), importProgramFiles(files));
  const r = await parseOffThread({ op: 'program', files });
  assert.deepEqual(r, importProgramFiles(files));
});

console.log(failures.length ? `\n${failures.length} failed` : `\n${passed} passed, 0 failed`);
process.exit(failures.length ? 1 : 0);
