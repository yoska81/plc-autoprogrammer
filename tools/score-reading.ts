// Score a reading of the cn-rollformer-01 drawing set against its known facts.
//   npx tsx tools/score-reading.ts <project.isap | reading.json> [fixtures/import/<name>/expected.json]
// Read the fixture's files on the Import page (Drawings tab), save the project (.isap), then score it here.
// A .json file may hold the reading ({ machine }) or the machine itself (ExistingMachine).
//
// Or read the drawings here and score that reading (DXF and PNG/JPG need no browser; PDFs are read on the Import page):
//   ANTHROPIC_API_KEY=… [READ_SPLIT=1] npx tsx tools/score-reading.ts --read fixtures/import/cn-rollformer-01/drawings.dxf
// READ_SPLIT=1 reads in three parts at once on the cached files (src/lib/ai/parallelCached.ts); default one
// request, as the app does. The model and effort are the app's defaults (ANTHROPIC_MODEL / READ_EFFORT override).
import { existsSync, readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { normalizeMachine } from '../src/convert/derive';
import { factsFromExpected, scoreReading, scoreText, type ExpectedJson } from '../src/convert/score';
import { CN_ROLLFORMER_01 } from '../src/convert/__fixtures__/cnRollformer01.facts';
import type { ExistingMachine } from '../src/convert/types';
import type { Effort } from '../src/store/useSettingsStore';

/** The first reading (draft "convert.read") or applied machine ("convert.machine") anywhere in the data. */
function findMachine(x: unknown): ExistingMachine | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const read = o['convert.read'] as { machine?: ExistingMachine } | undefined;
  if (read?.machine) return read.machine;
  if (o['convert.machine']) return o['convert.machine'] as ExistingMachine;
  if ('machine' in o && o.machine && typeof o.machine === 'object' && 'circuits' in (o.machine as object)) return o.machine as ExistingMachine;
  if ('supplyDrawn' in o && 'components' in o) return o as unknown as ExistingMachine;
  for (const v of Object.values(o)) { const m = findMachine(v); if (m) return m; }
  return null;
}

const reading = process.argv[2] === '--read';
const args = reading ? process.argv.slice(3) : process.argv.slice(2);
const file = args[0];
if (!file) { console.error('usage: npx tsx tools/score-reading.ts <project.isap | reading.json>  |  --read <drawings.dxf>'); process.exit(2); }

/** Read the drawing with the AI, as the Import page does (one request, or READ_SPLIT=1: three parts). */
async function readHere(path: string): Promise<ExistingMachine> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error('--read needs ANTHROPIC_API_KEY'); process.exit(2); }
  if (/\.pdf$/i.test(path)) { console.error('PDFs are read on the Import page (the browser); here use the DXF or a PNG/JPG.'); process.exit(2); }
  const { deriveFromUpload } = await import('../src/convert/derive');
  const { DEFAULT_ANTHROPIC_MODEL } = await import('../src/store/useSettingsStore');
  const name = path.split('/').pop()!;
  const type = /\.png$/i.test(name) ? 'image/png' : /\.jpe?g$/i.test(name) ? 'image/jpeg' : '';
  const split = process.env.READ_SPLIT === '1';
  const t0 = Date.now();
  const { machine } = await deriveFromUpload({
    apiKey, model: process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL,
    effort: (process.env.READ_EFFORT as Effort | undefined) ?? 'max', split,
  }, [new File([readFileSync(path)], name, { type })], '', [], (t) => console.log(`  ${t}`));
  console.log(`read ${split ? 'in three parts' : 'in one request'}: ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  return machine;
}

const m = reading ? await readHere(file) : await (async () => {
  const buf = readFileSync(file);
  const data = file.endsWith('.isap') ? JSON.parse(await (await JSZip.loadAsync(buf)).file('project.json')!.async('string')) : JSON.parse(buf.toString('utf8'));
  return findMachine(data);
})();
if (!m) { console.error(`${file}: no reading found (read the drawings on the Import page first, then save).`); process.exit(1); }
// the facts: the fixture's own expected.json when it is in the repo, else the facts written from it
const expectedFile = args[1] ?? 'fixtures/import/cn-rollformer-01/expected.json';
const facts = existsSync(expectedFile) ? factsFromExpected(JSON.parse(readFileSync(expectedFile, 'utf8')) as ExpectedJson) : CN_ROLLFORMER_01;
console.log(`${facts.name}: ${file}${existsSync(expectedFile) ? ` (facts: ${expectedFile})` : ''}`);
console.log(scoreText(scoreReading(normalizeMachine(m), facts)));
