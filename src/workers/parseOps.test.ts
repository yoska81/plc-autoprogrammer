/// <reference types="node" />
/**
 * The parse worker's operations give what the page-side functions give (DXF text and sheet pictures,
 * program import), and a DXF is parsed once for all its uses.
 * Run with:  npx tsx src/workers/parseOps.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NOT_PARSED, runParse } from './parseOps';
import { dxfToText, parseDxfEntities, sheetFrames } from '../convert/dxf';
import { dxfSheetSvg } from '../convert/dxfPicture';
import { importProgramFiles } from '../plc/import';
import { planUpgrade } from '../plc/import/upgrade';
import { useIOStore } from '../store/useIOStore';
import { dxfSheet, dxfText, parseOffThread } from '../lib/parseWorker';

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

await test('a cached DXF is not parsed again: asked by key only; an unknown key asks for the text', () => {
  assert.match(runParse({ op: 'dxf-sheet', key: 'rf', sheet: 3 }) ?? '', /CN1-19/);
  assert.throws(() => runParse({ op: 'dxf-sheet', key: 'other', sheet: 3 }), new RegExp(NOT_PARSED));
});

await test('dxfText / dxfSheet: the file text is read once; the key holds a hash of the bytes', async () => {
  let reads = 0;
  class Counted extends File { text() { reads++; return super.text(); } }
  const f = new Counted([dxf], 'roll-former.dxf', { lastModified: 1 });
  assert.equal(await dxfText(f), dxfToText(dxf, 'roll-former.dxf'));
  assert.match(await dxfSheet(f, 3) ?? '', /CN1-19/);
  assert.match(await dxfSheet(f, 4) ?? '', /<svg/);
  assert.equal(reads, 1, 'the sheet pictures are asked by key');
  // same name, size and date, other bytes: a different drawing
  const edited = new Counted([dxf.replace('CN1-19', 'CN1-91')], 'roll-former.dxf', { lastModified: 1 });
  assert.equal(edited.size, f.size);
  assert.match(await dxfSheet(edited, 3) ?? '', /CN1-91/);
});

await test('program import is the same as on the page; without a Worker (Node) it runs here', async () => {
  const files = [{ name: 'capper.L5X', text: l5x }];
  assert.deepEqual(runParse({ op: 'program', files }), importProgramFiles(files));
  const r = await parseOffThread({ op: 'program', files });
  assert.deepEqual(r, importProgramFiles(files));
});

await test('the plan that makes a program the project is the same off the page (dates aside)', async () => {
  const imp = importProgramFiles([{ name: 'capper.L5X', text: l5x }]).program;
  const now = (p: ReturnType<typeof planUpgrade>) => ({ ...p, original: { ...p.original, importedAt: '' } });
  assert.deepEqual(now(runParse({ op: 'plan', imp, plcId: 'logix' })), now(planUpgrade(imp, 'logix')));
  assert.deepEqual(now(await parseOffThread({ op: 'plan', imp, plcId: 'click' })), now(planUpgrade(imp, 'click')));
});

await test('imported I/O points take the lowest free numbers, inputs and outputs apart', () => {
  const io = useIOStore.getState();
  io.importPoints([{ description: 'a', type: 'input', category: 'sensor' }, { description: 'b', type: 'output', category: 'motor' }, { description: 'c', type: 'input', category: 'sensor' }] as never, true);
  io.deletePoint('I001');
  io.importPoints(Array.from({ length: 3 }, (_, k) => ({ description: `n${k}`, type: k === 1 ? 'output' : 'input', category: 'sensor' })) as never, false);
  assert.deepEqual(useIOStore.getState().projectIO.map((p) => p.id), ['Q001', 'I002', 'I001', 'Q002', 'I003']);
});

console.log(failures.length ? `\n${failures.length} failed` : `\n${passed} passed, 0 failed`);
process.exit(failures.length ? 1 : 0);
