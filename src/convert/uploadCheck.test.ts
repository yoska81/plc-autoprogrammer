// npx tsx src/convert/uploadCheck.test.ts — empty or damaged drawing files get a plain message and never reach the AI.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkUploadFile, checkUploadFiles } from './uploadCheck';
import { deriveFromUpload, readUpload } from './derive';
import { setClaudeInterceptor } from '../lib/ai/anthropic';

const fixture = (name: string) => readFileSync(new URL(`../../e2e/fixtures/convert/${name}`, import.meta.url));
const file = (name: string, bytes: Uint8Array | string) => new File([typeof bytes === 'string' ? bytes : new Uint8Array(bytes)], name);

let passed = 0;
const test = async (name: string, fn: () => Promise<void>) => { await fn(); passed++; console.log('  ok ', name); };

await test('real drawings pass: PDF, DXF, DWG, PNG, JPEG', async () => {
  assert.equal(await checkUploadFile(file('Drawings.pdf', fixture('sorting_conveyor_drawings.pdf'))), null);
  assert.equal(await checkUploadFile(file('E-03.dxf', fixture('E-03_PLC_IO.dxf'))), null);
  assert.equal(await checkUploadFile(file('Cell.dwg', fixture('dwg-sample.dwg'))), null);
  assert.equal(await checkUploadFile(file('sheet.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))), null);
  assert.equal(await checkUploadFile(file('sheet.JPG', new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]))), null);
});

await test('empty, renamed, cut-off or drawing-less files: what is wrong, in plain words', async () => {
  assert.match(String(await checkUploadFile(file('E-01.pdf', new Uint8Array()))), /^E-01\.pdf is empty \(0 bytes\)/);
  assert.match(String(await checkUploadFile(file('E-01.pdf', 'Hello, this is a Word file renamed'))), /is not a PDF/);
  const pdf = fixture('sorting_conveyor_drawings.pdf');
  assert.match(String(await checkUploadFile(file('half.pdf', pdf.subarray(0, Math.floor(pdf.length / 2))))), /is cut off/);
  assert.match(String(await checkUploadFile(file('photo.png', 'GIF89a…'))), /is not a PNG image/);
  assert.match(String(await checkUploadFile(file('E-03.dxf', 'garbage, not a drawing\n'))), /is not a DXF file/);
  assert.match(String(await checkUploadFile(file('E-03.dxf', 'AutoCAD Binary DXF\r\n\u001a\u0000…'))), /binary DXF.*ASCII/);
  assert.match(String(await checkUploadFile(file('blank.dxf', '0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n'))), /has no drawing in it/);
  assert.match(String(await checkUploadFile(file('Cell.dwg', '%PDF-1.7 renamed'))), /is not a DWG file/);
  assert.deepEqual(await checkUploadFiles([file('a.pdf', fixture('sorting_conveyor_drawings.pdf')), file('b.pdf', new Uint8Array())]), ['b.pdf is empty (0 bytes). Export or copy it again.']);
});

await test('a bad file stops the reading before any AI request (no retries)', async () => {
  let calls = 0;
  setClaudeInterceptor(async () => { calls++; throw new Error('the AI must not be asked'); });
  try {
    await assert.rejects(readUpload([file('E-03.dxf', fixture('E-03_PLC_IO.dxf')), file('E-01.pdf', new Uint8Array())]), /E-01\.pdf is empty/);
    await assert.rejects(deriveFromUpload({ apiKey: 'sk-test', model: 'm', effort: 'low' }, [file('E-01.pdf', 'not a pdf')]), /E-01\.pdf is not a PDF/);
    assert.equal(calls, 0);
  } finally {
    setClaudeInterceptor(null);
  }
});

console.log(`${passed} passed`);
