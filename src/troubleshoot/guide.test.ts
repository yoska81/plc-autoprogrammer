/// <reference types="node" />
/**
 * Guided fault finding: wiring paths shaped like Debug 4's WiringPath, answered by a truthful meter for a known
 * fault, must end on the right span; settings / logic findings end at once with their action.
 * Run with:  npx tsx src/troubleshoot/guide.test.ts
 */
import assert from 'node:assert/strict';
import { answer, startGuide, type Answer, type GuideHop, type GuidePath, type GuideState } from './guide';
import { createSimulator } from '../plc/sim/engine';
import { CONVEYOR_IO, CONVEYOR_PROGRAM } from '../plc/sim/__fixtures__/conveyor';
import type { LadderProgram } from '../plc/core/ladder';

const hop = (kind: string, tag: string, label: string, m?: [string, string, string]): GuideHop => ({
  kind, tag, label, where: { sheet: 'CNV-E-07', line: '7.03' }, location: 'cabinet', wire: `W-${tag}`,
  ...(m ? { measure: { between: [m[0], m[1]], kind: 'VDC', expect: m[2], when: '' } } : {}),
});
// X001 safety relay OK: PLC terminal ← TB2-1 ← cable core ← JB1-1 ← SR1 13-14 (supply 24 V through F1, return TB1 0V).
const X001: GuidePath = {
  address: 'X001', description: 'E-Stop OK (safety relay)', type: 'input', device: 'SR1', reference: 'TB1 0V',
  signal: [hop('plc', 'PLC', 'PLC terminal X001', ['X001', 'TB1 0V', 'about 24 VDC']), hop('terminal', 'TB2', 'Terminal strip TB2, terminal 1', ['TB2-1', 'TB1 0V', 'about 24 VDC']),
    hop('cable', 'W002', 'Cable W002, core 1'), hop('device', 'SR1', 'Safety relay SR1, terminal 14', ['SR1-14', 'TB1 0V', 'about 24 VDC'])],
  supply: [hop('device', 'SR1', 'Safety relay SR1, terminal 13', ['SR1-13', 'TB1 0V', 'about 24 VDC']), hop('protection', 'F1', 'Fuse F1 (load side)', ['F1-2', 'TB1 0V', 'about 24 VDC']), hop('supply', 'PS1', 'Power supply PS1 +V', ['PS1 +V', 'PS1 -V', 'about 24 VDC'])],
  ret: [hop('device', 'SR1', 'Safety relay SR1, A2', ['SR1-A2', 'TB1 0V', 'about 0 V (continuity)'])],
};
// Y002 pusher solenoid: PLC terminal → TB3-2 → SOL1 (output supply V1 through F2; return SOL1 − to TB1 0V).
const Y002: GuidePath = {
  address: 'Y002', description: 'Pusher solenoid', type: 'output', device: 'SOL1', reference: 'TB1 0V',
  signal: [hop('plc', 'PLC', 'PLC terminal Y002', ['Y002', 'TB1 0V', 'about 24 VDC with the output ON']), hop('terminal', 'TB3', 'Terminal strip TB3, terminal 2', ['TB3-2', 'TB1 0V', 'about 24 VDC']), hop('device', 'SOL1', 'Solenoid SOL1 coil +', ['SOL1+', 'TB1 0V', 'about 24 VDC'])],
  supply: [hop('plc', 'PLC', 'PLC output supply V1', ['V1', 'TB1 0V', 'about 24 VDC']), hop('protection', 'F2', 'Fuse F2 (load side)', ['F2-2', 'TB1 0V', 'about 24 VDC']), hop('supply', 'PS1', 'Power supply PS1 +V', ['PS1 +V', 'PS1 -V', 'about 24 VDC'])],
  ret: [hop('device', 'SOL1', 'Solenoid SOL1 coil −', ['SOL1-', 'TB1 0V', 'about 0 V (continuity)'])],
};

/** Answer every question with `meter` (step id → reading right?) until the guide ends. */
const run = (s: GuideState, meter: (id: string) => Answer, faults?: (tag: string, k: string) => unknown[]): GuideState => {
  for (let n = 0; n < 30 && s.step; n++) s = answer(s, meter(s.step.id), faults ? { deviceFaults: faults } : {});
  return s;
};
const values = (bits: Record<string, boolean>, words: Record<string, number> = {}) => ({ bit: (a: string) => bits[a] ?? false, word: (a: string) => words[a] ?? 0 });
const ctx = { io: CONVEYOR_IO.map((p) => ({ ...p })) };

// ---- 1. Safety input never arrives: open wire between the cable and TB2 → "lost between TB2-1 and SR1-14".
{
  const sim = createSimulator(CONVEYOR_PROGRAM);
  sim.setInput('X003', true); // Stop (NC) released
  sim.run(200);
  let s = startGuide({ program: CONVEYOR_PROGRAM, values: { bit: (a) => sim.readBit(a), word: (a) => sim.readWord(a) }, target: { output: 'Y001' }, ctx, paths: [X001] });
  assert.equal(s.blocker?.point, 'X001');
  assert.match(s.step!.text, /input LED of X001 ON/);
  const reads: Record<string, Answer> = { plc: 'no', 'signal:0': 'no', 'signal:1': 'no', 'signal:3': 'yes' };
  s = run(s, (id) => reads[id] ?? 'yes');
  assert.match(s.result!.text, /^The signal is lost between Terminal strip TB2, terminal 1 \(wire W-TB2\) — CNV-E-07 line 7\.03 and Safety relay SR1, terminal 14/);
  assert.deepEqual(s.history.map((h) => h.step.id), ['plc', 'signal:0', 'signal:1', 'signal:3'], 'the cable hop has no reading: not asked');
}

// ---- 2. Input with no supply: nothing at the device, the fuse F1 blown → "supply lost between F1 and PS1".
{
  const s0 = startGuide({ program: CONVEYOR_PROGRAM, values: values({ X003: true }), target: { output: 'Y001' }, ctx, paths: (p) => (p === 'X001' ? X001 : null) });
  const reads: Record<string, Answer> = { plc: 'no', 'signal:0': 'no', 'signal:1': 'no', 'signal:3': 'no', 'supply:0': 'no', 'supply:1': 'no', 'supply:2': 'yes' };
  const s = run(s0, (id) => reads[id]);
  assert.match(s.result!.text, /^The supply is lost between Fuse F1 \(load side\).* and Power supply PS1 \+V/);
  assert.match(s.result!.fix[0], /blown fuse/);
}

// ---- 3. Input: signal right at the PLC terminal, LED off → the input common; device dead with supply → device faults.
{
  const s0 = startGuide({ program: CONVEYOR_PROGRAM, values: values({ X003: true }), target: { output: 'Y001' }, ctx, paths: [X001] });
  assert.match(run(s0, (id) => (id === 'plc' ? 'no' : 'yes')).result!.text, /common .* is open/);
  const dev = run(s0, (id) => (id.startsWith('signal') || id === 'plc' ? 'no' : id.startsWith('ret') ? 'yes' : 'yes'), (tag, k) => [`${tag}:${k}`]);
  // Signal dead everywhere, supply right at the device, return fine → the device.
  assert.match(dev.result!.text, /SR1 has its supply and its return but gives no signal/);
  assert.deepEqual(dev.result!.deviceFaults, ['SR1:no-input'], 'Dev 1\'s device faults for the device');
}

// ---- 4. Output ON, nothing moves: blown output fuse F2; then a dead coil; then an open return.
{
  const p: LadderProgram = { tags: [], rungs: [{ id: 'r', comment: 'Push', branches: [[{ type: 'NO', address: 'C1' }]], outputs: [{ type: 'OUT', address: 'Y002' }] }] };
  const s0 = startGuide({ program: p, values: values({ C1: true, Y002: true }), target: { output: 'Y002' }, ctx, paths: [Y002] });
  assert.equal(s0.blocker?.kind, 'output-no-motion');
  const fuse = run(s0, (id) => (({ plc: 'yes', 'signal:0': 'no', 'supply:0': 'no', 'supply:1': 'no', 'supply:2': 'yes' } as Record<string, Answer>)[id]));
  assert.match(fuse.result!.text, /^The supply is lost between Fuse F2/);
  const coil = run(s0, (id) => (id.startsWith('ret') ? 'yes' : 'yes'), (tag, k) => [`${tag}:${k}`]);
  assert.match(coil.result!.text, /SOL1 gets its voltage and its return: the load itself/);
  assert.deepEqual(coil.result!.deviceFaults, ['SOL1:output-no-motion']);
  const ret = run(s0, (id) => (id.startsWith('ret') ? 'no' : 'yes'));
  assert.match(ret.result!.text, /^The return \(0 V \/ neutral\) is open at or before Solenoid SOL1 coil −/);
  const term = run(s0, (id) => (({ plc: 'yes', 'signal:0': 'yes', 'signal:1': 'no' } as Record<string, Answer>)[id] ?? 'yes'));
  assert.match(term.result!.text, /^The output voltage is lost between PLC terminal Y002 .* and Terminal strip TB3/);
  const point = run(s0, (id) => (({ plc: 'yes', 'signal:0': 'no', 'supply:0': 'yes' } as Record<string, Answer>)[id]));
  assert.match(point.result!.text, /output's supply is right but the PLC terminal Y002 has no voltage/);
  // A skipped reading is reported as unchecked.
  const skip = run(s0, (id) => (({ plc: 'yes', 'signal:0': 'yes', 'signal:1': 'skip', 'signal:2': 'no' } as Record<string, Answer>)[id]));
  assert.match(skip.result!.unchecked ?? '', /Skipped: Terminal strip TB3, terminal 2/);
}

// ---- 5. Input stuck ON (needed OFF): isolate — still ON → shorted wire; OFF → the device.
{
  const p: LadderProgram = { tags: [], rungs: [{ id: 'r', comment: 'Run while clear', branches: [[{ type: 'NC', address: 'X001' }]], outputs: [{ type: 'OUT', address: 'Y001' }] }] };
  const s0 = startGuide({ program: p, values: values({ X001: true }), target: { output: 'Y001' }, ctx, paths: [X001] });
  assert.equal(s0.step!.phase, 'isolate');
  assert.match(answer(s0, 'yes').result!.text, /shorted to 24 V/);
  assert.match(answer(s0, 'no', { deviceFaults: (t, k) => [`${t}:${k}`] }).result!.text, /the device itself is made/);
  assert.deepEqual(answer(s0, 'no', { deviceFaults: (t, k) => [`${t}:${k}`] }).result!.deviceFaults, ['SR1:stuck-on']);
}

// ---- 6. Not wiring: a setting ends at once with the live change; a panel bit with CLICK edit steps; no path → by hand.
{
  const p: LadderProgram = { tags: [], rungs: [
    { id: 'a', comment: 'Hot enough', branches: [[{ type: 'CMP', left: 'DF1', op: '>=', right: 'DS6' }]], outputs: [{ type: 'OUT', address: 'Y001' }] },
    { id: 'b', comment: 'Panel start', branches: [[{ type: 'NO', address: 'C1001' }]], outputs: [{ type: 'OUT', address: 'Y002' }] },
    { id: 'c', comment: 'First scan: DS6 outside 50-300 → 160', branches: [[{ type: 'NO', address: 'SC2' }, { type: 'CMP', left: 'DS6', op: '<', right: '50' }], [{ type: 'NO', address: 'SC2' }, { type: 'CMP', left: 'DS6', op: '>', right: '300' }]], outputs: [{ type: 'COPY', source: '160', dest: 'DS6' }] },
  ] };
  const v = values({}, { DF1: 150, DS6: 180 });
  const st = startGuide({ program: p, values: v, target: { output: 'Y001' }, ctx: { io: [{ address: 'DF1', description: 'Temp', type: 'input' }] }, paths: [] });
  assert.equal(st.step, null);
  assert.deepEqual([st.result!.settingChange?.address, st.result!.settingChange?.to], ['DS6', 160], 'the declared default, never a made-up value');
  const lg = startGuide({ program: p, values: v, target: { output: 'Y002' }, paths: [] });
  assert.ok(lg.result!.editSteps?.some((x) => /Replace the contact C1001/.test(x)));
  const none = startGuide({ program: CONVEYOR_PROGRAM, values: values({ X003: true }), target: { output: 'Y001' }, ctx, paths: [] });
  assert.match(none.result!.text, /not in the electrical design/);
}

console.log('guide tests passed');
