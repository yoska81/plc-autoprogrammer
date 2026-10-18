/// <reference types="node" />
/**
 * Real Windows exports are CRLF: every reader gives the same program for the CRLF file as for the LF
 * one, and the L5X patch of a CRLF original is byte-exact (the LF result with CRLF line ends).
 * Run with:  npx tsx src/plc/import/crlf.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileText, importProgramFiles } from './index';
import { planUpgrade } from './upgrade';
import { exportUpgrade } from './exportUpgrade';
import { getCpu, getProfile } from '../core/profiles';
import { resolveAddresses, type ExportContext } from '../core/profile';
import { moduleSlots } from '../core/modules';
import type { LadderProgram, Rung } from '../core/ladder';
import type { IOPoint } from '../../types/io';

const here = dirname(fileURLToPath(import.meta.url));
const lf = (n: string) => fileText(n, new Uint8Array(readFileSync(join(here, '__fixtures__', n)))).replace(/\r\n?/g, '\n');
const crlf = (t: string) => t.replace(/\n/g, '\r\n');
const same = (files: string[]) => {
  const a = importProgramFiles(files.map((n) => ({ name: n, text: lf(n) }))).program;
  const b = importProgramFiles(files.map((n) => ({ name: n, text: crlf(lf(n)) }))).program;
  assert.deepEqual(b, a, `${files.join(' + ')}: CRLF reads the same as LF`);
};

for (const set of [
  ['capper.L5X'], ['conveyor_aoi.L5X'], ['palletizer.L5K'], ['filler_plcopen.xml'], ['mixer_tia_plcopen.xml'], ['Mixer.scl', 'PLC_Tags_Mixer.csv'],
  ['click_nicknames.csv'], ['CAPPER_MAIN.csv', 'CAPPER_DeviceComment.csv'], ['delta_conveyor_il.txt', 'delta_conveyor_comments.csv'],
  ['Conveyor_OB1.awl', 'PLC_Tags_Conveyor.sdf'], ['FB_Filler_tia.xml'],
]) same(set);

// GX Works as UTF-8 with CRLF (not only UTF-16).
{
  const p = importProgramFiles([{ name: 'MAIN.csv', text: crlf(lf('CAPPER_MAIN.csv')) }, { name: 'C.csv', text: crlf(lf('CAPPER_DeviceComment.csv')) }]).program;
  assert.equal(p.io.length, 24);
}

// L5X patch of a CRLF original: byte-exact.
for (const name of ['capper.L5X', 'conveyor_aoi.L5X']) {
  const patch = (text: string) => {
    const imp = importProgramFiles([{ name, text }]).program;
    const plan = planUpgrade(imp, 'logix', new Date(Date.UTC(2025, 0, 1)));
    let i = 0, q = 0;
    const io: IOPoint[] = plan.io.map((p) => ({ ...p, id: p.type === 'input' ? `I${String(++i).padStart(3, '0')}` : `Q${String(++q).padStart(3, '0')}` }));
    const profile = getProfile(plan.plcId);
    const addresses = resolveAddresses(profile, getCpu(profile, plan.cpuId), io, moduleSlots(plan.modules));
    const ctx: ExportContext = { io, addresses, labels: new Map(), header: 't', extraTags: [], cpuId: plan.cpuId, modules: moduleSlots(plan.modules), projectName: imp.source.projectName, now: new Date(Date.UTC(2025, 0, 1)) };
    // One rung changed and one rung (with a new timer) added in the second routine.
    const blk = plan.program.blocks![1].id;
    const first = plan.program.rungs.find((r) => r.block === blk)!;
    const added: Rung = { id: 'r_new', block: blk, comment: 'Upgraded', branches: [[{ type: 'NO', address: first.branches[0]?.[0] && 'address' in first.branches[0][0] ? first.branches[0][0].address : 'C1' }]], outputs: [{ type: 'TMR', address: 'T9', mode: 'ON_DELAY', preset: '2', unit: 'sec', accumulate: false, resetAddress: null }] };
    const now: LadderProgram = { ...plan.program, rungs: [...plan.program.rungs.map((r) => (r.id === first.id ? { ...r, comment: 'changed' } : r)), added], tags: [...plan.program.tags, { address: 'T9', nickname: 'New_Tmr', comment: '' }] };
    return exportUpgrade(plan.original, text, now, { plcId: 'logix', ctx, fullFiles: () => [] }).files[0].content;
  };
  const a = patch(lf(name)), b = patch(crlf(lf(name)));
  assert.notEqual(a, lf(name), 'something changed');
  assert.equal(b, crlf(a), `${name}: a CRLF original patches byte-exact (the LF result with CRLF line ends)`);
}

console.log('crlf.test: all passed');
