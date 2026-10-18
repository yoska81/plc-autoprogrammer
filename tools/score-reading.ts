// Score a reading of the cn-rollformer-01 drawing set against its known facts.
//   npx tsx tools/score-reading.ts <project.isap | reading.json> [fixtures/import/<name>/expected.json]
// Read the fixture's files on the Import page (Drawings tab), save the project (.isap), then score it here.
// A .json file may hold the reading ({ machine }) or the machine itself (ExistingMachine).
import { existsSync, readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { normalizeMachine } from '../src/convert/derive';
import { factsFromExpected, scoreReading, scoreText, type ExpectedJson } from '../src/convert/score';
import { CN_ROLLFORMER_01 } from '../src/convert/__fixtures__/cnRollformer01.facts';
import type { ExistingMachine } from '../src/convert/types';

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

const file = process.argv[2];
if (!file) { console.error('usage: npx tsx tools/score-reading.ts <project.isap | reading.json>'); process.exit(2); }
const buf = readFileSync(file);
const data = file.endsWith('.isap') ? JSON.parse(await (await JSZip.loadAsync(buf)).file('project.json')!.async('string')) : JSON.parse(buf.toString('utf8'));
const m = findMachine(data);
if (!m) { console.error(`${file}: no reading found (read the drawings on the Import page first, then save).`); process.exit(1); }
// the facts: the fixture's own expected.json when it is in the repo, else the facts written from it
const expectedFile = process.argv[3] ?? 'fixtures/import/cn-rollformer-01/expected.json';
const facts = existsSync(expectedFile) ? factsFromExpected(JSON.parse(readFileSync(expectedFile, 'utf8')) as ExpectedJson) : CN_ROLLFORMER_01;
console.log(`${facts.name}: ${file}${existsSync(expectedFile) ? ` (facts: ${expectedFile})` : ''}`);
console.log(scoreText(scoreReading(normalizeMachine(m), facts)));
