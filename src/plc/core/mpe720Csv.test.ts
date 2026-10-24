/// <reference types="node" />
/**
 * MPE720 register comments as CSV (register, comment, variable, structure): the I/O and the program's registers
 * of a project read from an MPE720 project, with the registers it had; locals go to their drawing's file.
 * Run with:  npx tsx src/plc/core/mpe720Csv.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importProgramFiles } from '../import';
import { planUpgrade } from '../import/upgrade';
import { mpe720CommentCsv } from './mpe720Csv';
import type { IOPoint } from '../../types/io';

const here = dirname(fileURLToPath(import.meta.url));
const ymw = new Uint8Array(readFileSync(join(here, '..', 'import', '__fixtures__', 'demo_mp.YMW7')));

// the synthetic MPE720 project, as "Use this program" makes it
{
  const { program } = importProgramFiles([{ name: 'demo_mp.YMW7', text: '', bytes: ymw }]);
  const plan = planUpgrade(program, 'click');
  const io: IOPoint[] = plan.io.map((p, k) => ({ ...p, id: `P${k}` }));
  const csv = mpe720CommentCsv(plan.program, io, new Map(io.map((p) => [p.id, p.plcAddress ?? ''])));
  const rows = csv.global.split('\r\n').filter(Boolean);
  assert.ok(rows.includes('IB00000,Start button,,'), 'an input with its comment');
  assert.ok(rows.includes('OB00000,Run lamp,,'), 'an output with its comment');
  assert.ok(rows.includes('MB001000,Conveyor running,,'), 'an M register the program uses, with its comment');
  assert.ok(rows.includes('MW00010,Part counter,,'));
  assert.deepEqual(rows, [...rows].sort(), 'in register order');
  assert.ok(csv.global.endsWith('\r\n'), 'CRLF lines');
  assert.deepEqual(csv.locals, {}, 'no commented local registers in this project');
  assert.equal(csv.count, rows.length);
  console.log('import → CSV: ok');
}

// locals by drawing, quoting, the program's own memory never given a register
{
  const csv = mpe720CommentCsv({
    rungs: [],
    tags: [
      { address: 'T1', nickname: 'H01_DW00001', comment: 'Fill timer' },
      { address: 'C9', nickname: 'H01_02_DB000090', comment: 'Step 2, "done"' },
      { address: 'C10', nickname: 'MB000237', comment: 'Original: MB000237 — Panel start' },
      { address: 'C11', nickname: 'Jam_Alarm', comment: 'Jam alarm' },
    ],
  }, [], new Map());
  assert.deepEqual(csv.locals, { H01: 'DW00001,Fill timer,,\r\n', 'H01.02': 'DB000090,"Step 2, ""done""",,\r\n' });
  assert.equal(csv.global, 'MB000237,Panel start,,\r\n');
  assert.deepEqual(csv.unplaced, [{ address: 'C11', name: 'Jam_Alarm' }]);
  assert.equal(csv.count, 3);
  console.log('locals, quoting, unplaced: ok');
}

console.log('mpe720Csv: all ok');
