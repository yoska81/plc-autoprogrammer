/// <reference types="node" />
/**
 * Scores the importer against the answer keys of the real fixture programs (fixtures/import/*: the
 * expected.json of each): I/O found with their tags and in/out, and every known issue found by the app.
 * Run with:  npx tsx src/plc/import/fixtures.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileText, importProgramFiles } from './index';
import { planUpgrade } from './upgrade';
import { programFindings } from './findings';
import { validateProgram } from '../core/validate';
import { getProfile } from '../core/profiles';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'fixtures', 'import');
const file = (dir: string, n: string) => ({ name: n, text: fileText(n, new Uint8Array(readFileSync(join(root, dir, n)))) });
interface Expected { io: { address: string; tag: string; type: 'input' | 'output' }[]; knownIssues: { id: string }[] }
const expected = (dir: string) => JSON.parse(readFileSync(join(root, dir, 'expected.json'), 'utf8')) as Expected;

/** Every expected I/O point found, by tag name, with the right direction. */
function scoreIo(dir: string, io: { name: string; type: string }[]) {
  const exp = expected(dir).io;
  const got = new Map(io.map((p) => [p.name.toLowerCase(), p.type]));
  const missing = exp.filter((e) => got.get(e.tag.toLowerCase()) !== e.type).map((e) => `${e.tag} (${e.type})`);
  assert.deepEqual(missing, [], `${dir}: I/O not found`);
  console.log(`  ${dir}: I/O ${exp.length}/${exp.length}`);
}

// ── AB palletizer: AB-1 (missing seal-in), AB-2 (pusher on the infeed eye) ──
{
  const dir = 'ab-palletizer-01';
  const { program } = importProgramFiles([file(dir, 'Palletizer_PL01.L5X')]);
  scoreIo(dir, program.io);
  const plan = planUpgrade(program, 'click');
  const f = programFindings(plan.program);
  const ab1 = f.find((x) => x.kind === 'seal-in' && /^Machine_Running /.test(x.message));
  const ab2 = f.find((x) => x.kind === 'interlock' && /^Pusher_Extend_Sol waits for Infeed_Case_PE/.test(x.message));
  assert.ok(ab1, 'AB-1 found');
  assert.ok(ab2, 'AB-2 found');
  assert.match(ab2!.message, /Should it check Pallet_Present_PE\?/, 'only the pallet eye offered (comment match), not a routine-name-only match');
  assert.equal(f.length, 2, `no other findings: ${f.map((x) => x.message).join(' | ')}`);
  console.log(`  ${dir}: AB-1, AB-2 found`);
}

// ── Siemens mixer (PLCopen + tag table): S7-1 (NORM_X MAX 32767) ──
{
  const dir = 'siemens-mixer-01';
  const { program } = importProgramFiles([file(dir, 'MixTank_MT01.xml'), file(dir, 'PLC_Tags_MT01.csv')]);
  scoreIo(dir, program.io);
  const plan = planUpgrade(program, 'click');
  assert.equal(plan.plcId, 'siemens-s7');
  const s71 = validateProgram(plan.program, getProfile('siemens-s7'), new Set()).find((i) => /NORM_X MAX := 32767/.test(i.message));
  assert.ok(s71, 'S7-1 found');
  assert.deepEqual(programFindings(plan.program), [], 'no false findings on the mixer');
  console.log(`  ${dir}: S7-1 found`);
}

// ── Mitsubishi capper (GX Works3 CSV + device comments): MEL-1 (double coil on Y4) ──
{
  const dir = 'mitsubishi-capper-01';
  const { program } = importProgramFiles([file(dir, 'CAPPER_MAIN.csv'), file(dir, 'CAPPER_DeviceComment.csv')]);
  scoreIo(dir, program.io);
  assert.equal(program.report.notConverted.filter((n) => !n.kept).length, 0);
  const mel1 = program.report.notes.find((n) => /^Double coil: .*\(Y4\).*steps 138 and 169/.test(n));
  assert.ok(mel1, `MEL-1 found with both rung steps: ${program.report.notes.join(' | ')}`);
  assert.deepEqual(programFindings(planUpgrade(program, 'click').program), [], 'no false findings on the capper');
  console.log(`  ${dir}: MEL-1 found`);
}

console.log('fixtures.test: all passed');
