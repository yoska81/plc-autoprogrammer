/// <reference types="node" />
/**
 * Rule-based HMI engine: content from the I/O list, screens on every panel size with no layout issue,
 * consistent tags, AI failure falls back to the rules. Goldens: __fixtures__/hmi-*.txt.
 * Run with:  npx tsx src/hmi/engine/engine.test.ts      (UPDATE=1 regenerates the goldens)
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHmi, defaultHmiContent } from './index';
import { checkDesign } from '../layout';
import { setClaudeInterceptor } from '../../lib/ai/anthropic';
import { generateRuleBasedHmi } from '../../lib/ai/hmiContentAI';
import { getCpu, getProfile } from '../../plc/core/profiles';
import { resolveAddresses } from '../../plc/core/profile';
import { moduleSlots } from '../../plc/core/modules';
import { DESIGN } from '../../preview/sampleProject';
import type { IOPoint } from '../../types/io';
import type { HmiDesign } from '../types';

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), '__fixtures__');
type P = Pick<IOPoint, 'description' | 'type'> & Partial<IOPoint>;
const pt = (description: string, type: 'input' | 'output', extra: Partial<IOPoint> = {}): P => ({ description, type, ...extra });

function project(points: P[], cpuId = 'C0-10DD1E-D', modules: string[] = []) {
  const io = points.map((p, i) => ({ category: 'Operator/HMI', ...p, id: `p${i}` })) as IOPoint[];
  const profile = getProfile('click');
  const addresses = resolveAddresses(profile, getCpu(profile, cpuId), io, moduleSlots(modules));
  return { io, addresses };
}

const EXAMPLE = [
  pt('E-Stop OK (safety relay)', 'input'), pt('Start Button', 'input'), pt('Stop Button', 'input'), pt('Part at end photo-eye', 'input'),
  pt('Pusher extended', 'input'), pt('Pusher retracted', 'input'), pt('Conveyor motor contactor', 'output'), pt('Pusher solenoid', 'output'), pt('Main air dump valve', 'output'),
];
const BIG = [
  ...EXAMPLE.filter((p) => p.type === 'input'),
  ...Array.from({ length: 24 }, (_, i) => pt(`${i < 12 ? 'Infeed' : 'Outfeed'} part present ${i + 1}`, 'input', { deviceType: 'sensor-pnp' })),
  ...[1, 2, 3, 4].map((n) => pt(`Belt ${n} VFD fault`, 'input')),
  ...EXAMPLE.filter((p) => p.type === 'output'),
  ...[1, 2, 3, 4].map((n) => pt(`Belt ${n} VFD run`, 'output')),
  ...Array.from({ length: 6 }, (_, i) => pt(`Diverter ${i + 2} solenoid`, 'output')),
  pt('Belt 1 speed reference', 'output', { signal: 'analog', analog: { range: '4-20mA', min: 0, max: 60, units: 'Hz' } }),
  pt('Tank level', 'input', { signal: 'analog', analog: { range: '4-20mA', min: 0, max: 100, units: '%' } }),
];
const SEALING = [
  pt('Safety OK', 'input'), pt('Left palm button', 'input', { deviceType: 'pushbutton-no' }), pt('Head up sensor', 'input'), pt('Head down sensor', 'input'),
  pt('Sealing bar temperature OK', 'input'), pt('Heater contactor', 'output'), pt('Head down solenoid', 'output'), pt('Head up solenoid', 'output'),
];
const PANELS: [number, number][] = [[480, 272], [800, 480], [1024, 600], [1280, 800]];

/** Every rule the HMI page's layout check and the PLC program rely on. */
function checkAll(d: HmiDesign, w: number, h: number, ioAddresses: Set<string>, what: string) {
  const issues = checkDesign(d, w, h, { text: true });
  assert.deepEqual(issues.map((i) => `${i.screenId}: ${i.message}`), [], `${what} ${w}x${h}: layout issues`);
  const ids = new Set(d.screens.map((s) => s.id));
  assert.equal(ids.size, d.screens.length, 'unique screen ids');
  const tagAddr = new Set(d.tags.map((t) => t.address));
  assert.equal(tagAddr.size, d.tags.length, 'unique tag addresses');
  for (const s of d.screens) {
    assert.equal(new Set(s.elements.map((e) => e.id)).size, s.elements.length, `${s.id}: unique element ids`);
    assert.ok(s.elements.some((e) => e.kind === 'header'), `${s.id}: header`);
    for (const e of s.elements) {
      if (e.kind === 'nav') assert.ok(e.targetScreenId && ids.has(e.targetScreenId), `${s.id}: nav ${e.label} -> ${e.targetScreenId}`);
      for (const a of [e.address, e.interlock, ...(e.symbols ?? []).map((x) => x.address)]) if (a) assert.ok(tagAddr.has(a) || ioAddresses.has(a), `${what} ${s.id}: ${e.label} bound to ${a}, which is neither an HMI tag nor an I/O point`);
    }
  }
  for (const a of d.alarms) assert.ok(tagAddr.has(a.address), `alarm ${a.address} has a tag`);
  // The navigation bar is identical on every screen (same buttons, same places).
  const navOf = (s: HmiDesign['screens'][number]) => s.elements.filter((e) => e.kind === 'nav' && e.id.includes('-nav-')).map((e) => `${e.label}@${e.x},${e.y}`).join('|');
  assert.equal(new Set(d.screens.map(navOf)).size, 1, 'same navigation on every screen');
}

function golden(name: string, d: HmiDesign) {
  const g = [
    `machine ${d.machineName}`,
    ...d.screens.map((s) => `screen ${s.id} "${s.name}"${s.level ? ` [${s.level}]` : ''}: ${s.elements.filter((e) => !e.id.includes('-nav-') && e.kind !== 'header').map((e) => `${e.kind}${e.label ? ` "${e.label}"` : ''}${e.address ? ` ${e.address}` : ''}`).join(', ')}`),
    '', ...d.tags.map((t) => `${t.address.padEnd(7)} ${t.name.padEnd(28)} ${t.dataType.padEnd(5)} ${t.access.padEnd(10)} ${t.description}`),
    '', ...d.alarms.map((a) => `alarm ${a.address} ${a.severity}: ${a.message}`), '', ...d.notes.map((n) => `note: ${n}`), '',
  ].join('\n');
  const file = path.join(FIX, `hmi-${name}.txt`);
  if (process.env.UPDATE) { fs.mkdirSync(FIX, { recursive: true }); fs.writeFileSync(file, g); }
  assert.equal(g, fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'), `hmi-${name}: golden differs (UPDATE=1 to regenerate after an intended change)`);
}

// --- Example: content read from the I/O list + the electrical wiring
const ex = project(EXAMPLE);
const motorOf = new Map(DESIGN.components.filter((c) => c.motorTag).map((c) => [c.tag, { tag: c.motorTag!, description: 'Conveyor motor' }]));
const exContent = defaultHmiContent({ ...ex, machineName: 'Conveyor Cell', wiring: DESIGN.ioWiring, motorOf });
assert.deepEqual(exContent.actuators.map((a) => [a.name, a.kind, a.manual, a.feedback.map((f) => f.address)]), [
  ['Conveyor', 'motor', true, []], ['Pusher', 'cylinder', true, ['X005', 'X006']], ['Main Air Dump', 'valve', false, []],
]);
assert.equal(exContent.safetyOk?.address, 'X001');
assert.equal(exContent.partSensor?.address, 'X004');
const exIo = new Set(ex.addresses.values());
for (const [w, h] of PANELS) {
  const t0 = performance.now();
  const d = buildHmi(exContent, { partNumber: 'P', widthPx: w, heightPx: h, now: 'T' });
  assert.ok(performance.now() - t0 < 200, 'built in well under a second');
  checkAll(d, w, h, exIo, 'example');
}
const ex7 = buildHmi(exContent, { partNumber: 'CM5-T7W', widthPx: 800, heightPx: 480, now: 'T', plcText: 'CLICK C0-10DD1E-D' });
assert.deepEqual(ex7.screens.map((s) => s.name), ['Main', 'Manual', 'Setup', 'Alarms', 'Diagnostics', 'Maintenance']);
const manual = ex7.screens.find((s) => s.id === 'manual')!;
for (const b of manual.elements.filter((e) => e.kind === 'button' && e.action === 'momentary')) assert.ok(b.interlock, `${b.label}: hold-to-run with an interlock`);
assert.ok(!manual.elements.some((e) => /dump/i.test(e.label)), 'no jog for the safety dump valve');
const diag = ex7.screens.find((s) => s.id === 'diag')!;
for (const a of exIo) assert.ok(diag.elements.some((e) => e.address === a), `Diagnostics shows ${a}`);
golden('example', ex7);

// --- Big: 4 drives, diverters, analog level + speed reference; small panels get continuation pages
const big = project(BIG, 'C0-11DD1E-D', ['C0-16ND3', 'C0-16ND3', 'C0-16TD1', 'C0-04AD-1', 'C0-04DA-1']);
const bigContent = defaultHmiContent({ ...big, machineName: 'Sorter Line' });
assert.equal(bigContent.actuators.filter((a) => a.kind === 'drive').length, 4);
assert.ok(bigContent.actuators.filter((a) => a.kind === 'drive').every((a) => a.fault), 'each drive has its fault input');
assert.ok(bigContent.actuators.find((a) => a.name === 'Belt 1')?.speedRef, 'speed reference linked to Belt 1');
const bigIo = new Set(big.addresses.values());
for (const [w, h] of PANELS) checkAll(buildHmi(bigContent, { partNumber: 'P', widthPx: w, heightPx: h }), w, h, bigIo, 'big');
const big7 = buildHmi(bigContent, { partNumber: 'P', widthPx: 800, heightPx: 480, now: 'T' });
assert.ok(big7.screens.some((s) => s.id === 'diag2'), 'Diagnostics continues on a second page');
assert.ok(big7.screens.some((s) => s.id === 'process' && s.elements.some((e) => e.kind === 'bar')), 'Process screen with bars');
assert.ok(big7.tags.some((t) => /^DF1\d\d$/.test(t.address) && /Belt_1_Speed/.test(t.name)), 'drive speed setpoint DF');
assert.equal(big7.alarms.filter((a) => /drive fault/.test(a.message)).length, 4);
golden('big', big7);

// --- Sealing head: heater not jogged, head down / up coils on one actuator with both sensors
const seal = project(SEALING);
const sealContent = defaultHmiContent({ ...seal, machineName: 'Sealing Head' });
const head = sealContent.actuators.find((a) => a.kind === 'cylinder')!;
assert.deepEqual([head.name, head.extend?.description, head.retract?.description, head.feedback.length], ['Head', 'Head down solenoid', 'Head up solenoid', 2]);
assert.equal(sealContent.actuators.find((a) => a.kind === 'heater')?.manual, false);
for (const [w, h] of PANELS) checkAll(buildHmi(sealContent, { partNumber: 'P', widthPx: w, heightPx: h }), w, h, new Set(seal.addresses.values()), 'sealing');

// --- AI on top: fails -> rules; no key -> no call; recorded names / states merged
const base = { ...ex, machineName: 'Conveyor Cell', spec: 'Conveyor with a pusher.', electrical: DESIGN, panel: { partNumber: 'CM5-T7W', widthPx: 800, heightPx: 480 }, now: 'T' };
setClaudeInterceptor(async () => { throw new Error('Anthropic API is overloaded'); });
const failed = await generateRuleBasedHmi({ ...base, apiKey: 'k', model: 'm', effort: 'low' });
assert.equal(failed.source, 'rules');
assert.match(failed.design.notes[0], /AI could not name the screens/);
let calls = 0;
setClaudeInterceptor(async () => { calls++; throw new Error('no'); });
const noKey = await generateRuleBasedHmi(base);
assert.equal(calls, 0);
assert.deepEqual(noKey.design.screens.map((s) => s.elements.length), failed.design.screens.map((s) => s.elements.length));
let prompt = 0;
setClaudeInterceptor(async (o) => {
  prompt = o.system.length + JSON.stringify(o.messages).length + JSON.stringify(o.schema).length;
  return { reasoning: null, text: JSON.stringify({
    machineName: 'Pusher Cell', actuators: [{ index: 0, name: 'Infeed Belt', manual: true }, { index: 2, name: 'Air Dump', manual: true }],
    states: [{ value: 0, text: 'Stopped', style: 'normal' }, { value: 1, text: 'Running', style: 'ok' }, { value: 2, text: 'Pushing', style: 'ok' }, { value: 3, text: 'Faulted', style: 'alarm' }, { value: 4, text: 'Manual', style: 'warning' }, { value: 5, text: 'Safety Stop', style: 'alarm' }],
    questions: ['Which password levels are needed?'],
  }) };
});
const t0 = performance.now();
const named = await generateRuleBasedHmi({ ...base, apiKey: 'k', model: 'm', effort: 'low' });
setClaudeInterceptor(null);
assert.equal(named.source, 'ai');
assert.equal(named.design.machineName, 'Pusher Cell');
assert.ok(named.design.screens.find((s) => s.id === 'manual')!.elements.some((e) => e.label === 'Infeed Belt'));
assert.ok(!named.design.screens.find((s) => s.id === 'manual')!.elements.some((e) => e.label === 'Air Dump'), 'a dump valve stays off the Manual screen whatever the AI says');
assert.ok(named.design.tags.find((t) => t.name === 'Machine_State')!.description.includes('2 Pushing'));
assert.ok(named.design.askUser?.includes('Which password levels are needed?'));
checkAll(named.design, 800, 480, exIo, 'named');
console.log(`hmi content prompt ${prompt} chars (~${Math.round(prompt / 4)} tokens), answer ~0.5k chars; rules + merge ${(performance.now() - t0).toFixed(0)} ms`);
console.log('hmi engine tests passed');
