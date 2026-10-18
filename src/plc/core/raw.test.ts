/// <reference types="node" />
/**
 * RAW instructions (imported, not converted): kept word for word for their own PLC, a TODO comment for
 * any other (never dropped), a warning in the checks, open / no-op in the simulator.
 * Run with:  npx tsx src/plc/core/raw.test.ts
 */
import assert from 'node:assert/strict';
import type { LadderProgram } from './ladder';
import { buildL5x } from './profiles/l5x';
import { LOGIX_CPUS, logixProfile } from './profiles/logix';
import { toMicro800St } from './profiles/micro800';
import { clickProfile } from './profiles/click';
import { clickRungListing } from './clickExport';
import { validateProgram } from './validate';
import { createSimulator } from '../sim/engine';
import type { ExportContext } from './profile';

const program: LadderProgram = {
  tags: [{ address: 'C1', nickname: 'Run', comment: '' }],
  rungs: [
    { id: 'r1', comment: 'Send counts to the line PLC', branches: [[{ type: 'NO', address: 'C1' }]], outputs: [{ type: 'RAW', vendor: 'logix', text: 'MSG(Line_Msg)' }] },
    { id: 'r2', comment: 'Behind an instruction the app does not know', branches: [[{ type: 'RAW', vendor: 'logix', text: 'XIC(Remote.Ready)' }]], outputs: [{ type: 'OUT', address: 'C2' }] },
  ],
};
const ctx: ExportContext = { io: [], addresses: new Map(), labels: new Map(), header: 't', extraTags: [], cpuId: LOGIX_CPUS[0].id, modules: [], projectName: 'T', now: new Date(Date.UTC(2024, 0, 1)) };

// Same PLC: word for word.
const l5x = buildL5x(program, ctx);
assert.ok(l5x.includes('MSG(Line_Msg)'), 'Logix keeps its own MSG');
assert.ok(l5x.includes('XIC(Remote.Ready)'), 'and its own contact text');

// Another PLC: a TODO comment, never dropped.
const st = toMicro800St(program, ctx).body;
assert.match(st, /TODO \(from logix\): MSG\(Line_Msg\)/);
assert.match(st, /TODO \(from logix\): XIC\(Remote\.Ready\)/);
const click = clickRungListing(program, new Map(), 't');
assert.match(click, /TODO \(from logix\): MSG\(Line_Msg\)/);

// Checks: a warning, not an error (the program still exports).
const issues = validateProgram(program, logixProfile, new Set()).filter((i) => /Not understood/.test(i.message));
assert.equal(issues.length, 2);
assert.ok(issues.every((i) => i.severity === 'warning'));
assert.ok(validateProgram(program, clickProfile, new Set()).filter((i) => /Not understood/.test(i.message)).every((i) => i.severity === 'warning'));

// Simulator: the contact is open, the output does nothing; each reported once.
const sim = createSimulator(program);
sim.write('C1', true);
sim.run(100);
assert.equal(sim.readBit('C2'), false, 'nothing behind a RAW contact switches on');
assert.equal(sim.state.errors.filter((e) => /Remote\.Ready/.test(e)).length, 1);
assert.equal(sim.state.errors.filter((e) => /Line_Msg/.test(e)).length, 1);

console.log('raw.test: all passed');
