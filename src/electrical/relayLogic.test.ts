/// <reference types="node" />
/**
 * Relay logic → NFPA 79 ladder: one terminal = one net, shared rung starts, terminals only as read, every coil
 * drawn, drive inputs to the drive's input common, line wrapping, the ladder sheets and the wire list — on a
 * small machine and on the converter's roll former (e2e/fixtures/convert/cn-rollformer-01.relayLogic.json).
 * Run with:  npx tsx src/electrical/relayLogic.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { coilMatchesRail, LADDER, relayLadder, relayPins, type Ladder } from './relayLogic';
import { buildModel, designWarnings, type DrawingContext } from './derive';
import { planDrawings } from './drawings/plan';
import { getPart } from './catalog';
import { DESIGN } from '../preview/sampleProject';
import type { RelayLogic } from './types';

// A start / stop seal-in through the overload, an on-delay timer and a drive run input.
const LOGIC: RelayLogic = {
  supply: '24VDC',
  rungs: [
    { id: 'C1', description: 'Pump 1 start / stop', path: [
      { t: 'contact', tag: 'PB1', nc: true, terms: '11-12', kind: 'pb' },
      { t: 'branch', paths: [[{ t: 'contact', tag: 'PB2', nc: false, terms: '13-14', kind: 'pb' }], [{ t: 'contact', tag: 'K1', nc: false, terms: '13-14', kind: 'relay' }]] },
      { t: 'contact', tag: 'OL1', nc: true, terms: '95-96', kind: 'ol' },
      { t: 'coil', tag: 'K1', kind: 'contactor' },
    ] },
    { id: 'C2', description: 'Start delay', path: [{ t: 'contact', tag: 'K1', nc: false, terms: '23-24', kind: 'relay' }, { t: 'coil', tag: 'CR11', kind: 'timer-on', preset: '2 s' }] },
    { id: 'C3', description: 'Drive run', path: [{ t: 'contact', tag: 'CR11', nc: false, terms: '15-18', kind: 'timer' }, { t: 'coil', tag: 'VFD1', kind: 'drive-input', terms: 'MI1' }] },
  ],
  devices: [{ tag: 'VFD1', category: 'vfd', description: 'Pump drive', partNumber: 'GS23-47P5' }],
};

/** Every device terminal belongs to exactly one net (one wire number). */
function oneNetPerTerminal(l: Ladder) {
  const nets = new Map<string, Set<string>>();
  for (const w of l.wires) for (const e of [w.from, w.to]) {
    if (e.includes('?') || e.startsWith('TB1 ')) continue;
    nets.set(e, new Set([...(nets.get(e) ?? []), w.wire]));
  }
  const bad = [...nets].filter(([, s]) => s.size > 1).map(([t, s]) => `${t} = ${[...s].join('/')}`);
  assert.deepEqual(bad, [], `one terminal, one wire number: ${bad.join('; ')}`);
}

// ---- terminals: only what was read
assert.deepEqual(relayPins({ t: 'contact', tag: 'K1', nc: false, terms: '13-14' }), ['13', '14']);
assert.deepEqual(relayPins({ t: 'contact', tag: 'PB1', nc: true }), ['?', '?'], 'no terminals read: "?" (not an invented 11-12)');
assert.deepEqual(relayPins({ t: 'contact', tag: 'U2', nc: false, terms: 'DO1' }), ['DO1', '?'], 'one terminal read: the other is "?"');
assert.deepEqual(relayPins({ t: 'coil', tag: 'H7CX', kind: 'counter', terms: 'CP1' }), ['CP1', '?'], 'the counter\'s count input');
assert.deepEqual(relayPins({ t: 'coil', tag: 'K1', kind: 'relay' }), ['A1', 'A2']);

// ---- the small machine
const lad = relayLadder(LOGIC);
assert.deepEqual(lad.rails, ['24+', '0V']);
const [r1, r2, r3] = lad.rungs;
assert.equal(r1.rows, 2, 'the seal-in branch takes a second row');
assert.ok(r1.cols[1].kind === 'branch' && r1.cols[1].wIn === '101' && r1.cols[1].wOut === '101A');
assert.equal(r2.cols[1].kind === 'el' && r2.cols[1].e.wIn, '102');
assert.ok(r3.driveEnd && r3.start.kind === 'node' && r3.start.label === 'VFD1 DCM', 'the drive input switches to the drive\'s DCM, not +24V');
assert.ok(!lad.wires.some((w) => w.to === 'VFD1:MI1' && w.wire === '24+'), 'MI1 never on 24+');
assert.ok(lad.wires.some((w) => [w.from, w.to].includes('VFD1:DCM')), 'DCM in the wire list');
oneNetPerTerminal(lad);
assert.deepEqual(lad.questions, []);
// a terminal the panel already wires (the engine's safety relay 13-14 on 24+S) is never joined to a ladder net
const occ = relayLadder(LOGIC, { occupied: new Map([['K1:13', '24+S']]) });
assert.ok(!occ.wires.some((w) => [w.from, w.to].includes('K1:13')), 'K1:13 stays on 24+S');
assert.ok(occ.questions.some((q) => /K1 13-14: terminal 13 is already wired by the panel \(wire 24\+S\)/.test(q)), 'and the reading is asked');
assert.deepEqual(relayLadder({ supply: '120VAC', rungs: LOGIC.rungs.slice(0, 1) }).rails, ['X1', 'X2']);
assert.ok(coilMatchesRail('24VDC', '24VDC') && coilMatchesRail('24VDC', '24 VAC/VDC') && !coilMatchesRail('24VDC', '120VAC') && coilMatchesRail('120VAC', '120 VAC') && !coilMatchesRail('120VAC', '24 VDC'));

// ---- the converter's roll former: 22 circuits read from a Chinese drawing
const roll = JSON.parse(readFileSync(new URL('../../e2e/fixtures/convert/cn-rollformer-01.relayLogic.json', import.meta.url), 'utf8')) as RelayLogic;
const rl = relayLadder(roll);
oneNetPerTerminal(rl);
// a rung that repeats an earlier rung's chain starts at its node (the line-running lamp behind the line-run chain)
const key = (r: RelayLogic['rungs'][number]) => JSON.stringify(r.path.slice(0, -1));
for (const r of rl.rungs) {
  const twin = rl.rungs.find((o) => o.n < r.n && o.rung.path.length > 1 && key(o.rung) === key(r.rung) && r.rung.path.length > 1);
  if (twin) assert.equal(r.start.kind, 'node', `${r.rung.id} repeats ${twin.rung.id}'s chain: starts at its node`);
}
// every relay / timer used by a contact has its coil drawn
const flat = (r: RelayLogic['rungs'][number]) => r.path.flatMap((e) => (e.t === 'branch' ? e.paths.flat() : [e]));
const coilTags = new Set(rl.rungs.flatMap((r) => flat(r.rung)).filter((e) => e.t === 'coil').map((e) => e.tag));
for (const c of rl.rungs.flatMap((r) => flat(r.rung)).filter((e) => e.t === 'contact' && (e.kind === 'relay' || e.kind === 'timer'))) assert.ok(coilTags.has(c.tag), `${c.tag}: coil drawn`);
assert.ok(rl.rungs.some((r) => r.placeholder) && rl.questions.some((q) => /coil was not read/.test(q)), 'a coil the reading missed gets a rung and a question');
// no invented second terminal on a single-terminal contact
for (const r of rl.rungs) for (const c of r.cols) for (const e of c.kind === 'el' ? [c.e] : c.paths.flat()) {
  if (e.el.t === 'contact' && e.el.terms && !/-/.test(e.el.terms)) assert.equal(e.pins[1], '?', `${e.el.tag} ${e.el.terms}: second terminal "?"`);
  if (e.el.t === 'coil' && e.el.kind === 'counter' && e.el.terms) assert.equal(e.pins[0], e.el.terms, 'counter count input');
}
// drive inputs switch to the drive's common
for (const r of rl.rungs.filter((x) => x.driveEnd)) assert.ok(r.start.kind === 'node' && / (DCM|COM)$/.test(r.start.label), `${r.rung.id}: from the drive common`);
// lines: no line wider than the room before the load
for (const r of rl.rungs) for (const l of r.lines) {
  const w = l.cols.filter((c) => !(c.kind === 'el' && c.e.el.t === 'coil')).reduce((s, c) => s + (c.kind === 'el' ? LADDER.unit : Math.max(...c.paths.map((p) => p.length)) * LADDER.unit + LADDER.lead), 0);
  assert.ok(w <= LADDER.avail || l.cols.length === 1, `${r.rung.id}: line ${l.row} is ${w} mm`);
}

// ---- ladder sheets and the wire list of a design that keeps relay logic
const ctx: DrawingContext = {
  projectName: 'Relay', getPart, plc: { vendor: 'AutomationDirect', name: 'CLICK', cpuPartNumber: 'C0-10DD1E-D', cpuLabel: '' },
  design: { ...DESIGN, inputs: { ...DESIGN.inputs, relayLogic: LOGIC } },
  io: DESIGN.ioWiring.map((w) => ({ address: w.address, description: w.description, type: w.address.startsWith('X') ? 'input' : 'output' })),
};
const plan = planDrawings(ctx);
const sheets = plan.sheets.filter((s) => s.spec.kind === 'ladder');
assert.equal(sheets.length, 1);
assert.match(sheets[0].title, /RELAY CONTROL CIRCUIT 24VDC — RUNGS 1–3/);
const n = sheets[0].n;
assert.equal(plan.xref.get('coil:K1'), `${n}.01`);
assert.equal(plan.xref.get('coil:CR11'), `${n}.03`, 'rung 2 starts below rung 1\'s branch row');
assert.equal(plan.xref.get('rung:C3'), `${n}.04`);
assert.ok((plan.contacts.get('K1') ?? []).some((c) => c.term === '23-24' && c.line === `${n}.03`), 'K1 lists its 23-24 contact');
assert.ok((plan.contacts.get('K1') ?? []).some((c) => c.term === '13-14' && c.line === `${n}.02`), 'the seal-in contact is on the branch row');
for (const t of ['PB1', 'PB2', 'K1', 'OL1', 'CR11', 'VFD1']) assert.ok(plan.where.get(t)?.includes(n), `${t} drawn on the ladder sheet`);
const m = buildModel(ctx);
assert.ok(m.wires.some((w) => w.wire === '101A' && w.color === 'BU'), 'ladder wires in the wire list');
const warn = designWarnings(ctx);
assert.ok(warn.some((w) => /^Relay logic: .*CR11.*not in the design's parts/.test(w)), 'tags without a part are flagged');
// a 120 VAC contactor coil on the 24 VDC rail is flagged
const k1 = ctx.design.components.find((c) => c.tag === 'K1')!;
const ac = { ...ctx, design: { ...ctx.design, components: ctx.design.components.map((c) => (c.tag === 'K1' ? { ...c, partNumber: k1.partNumber.replace(/24VDC$/, '120VAC') } : c)) } };
if (getPart(ac.design.components.find((c) => c.tag === 'K1')!.partNumber)) assert.ok(designWarnings(ac).some((w) => /^Relay logic: K1 .* 24 VDC rail/.test(w)), 'coil voltage against the rail');
// the roll former: every page's rungs fit their sheet, and the questions reach the design review
const rp = planDrawings({ ...ctx, design: { ...ctx.design, inputs: { ...ctx.design.inputs, relayLogic: roll } } });
for (const s of rp.sheets.filter((x) => x.spec.kind === 'ladder')) {
  const sp = s.spec as Extract<typeof s.spec, { kind: 'ladder' }>;
  assert.ok(sp.rungs.every(({ r, idx }) => idx + r.rows - 1 <= 14), `${s.title}: rungs inside the sheet`);
}
assert.ok(designWarnings({ ...ctx, design: { ...ctx.design, inputs: { ...ctx.design.inputs, relayLogic: roll } } }).some((w) => /^Relay logic: Terminal numbers not read/.test(w)));

// the converted machine's own safety relay (MSR1, an IDEM Viper whose catalog application names light curtains) is on
// its ladder, never one of the panel's light-curtain relays (whose OSSD wires it would draw without a wire list)
{
  const msr = { tag: 'MSR1', partNumber: 'SCR73-280005', quantity: 1, function: 'Safety relay (kept from the relay logic)' };
  const lc = { ...ctx, design: { ...ctx.design, components: [...ctx.design.components, msr], inputs: { ...ctx.design.inputs, relayLogic: { ...LOGIC, devices: [...(LOGIC.devices ?? []), { tag: 'MSR1', category: 'safetyRelay', description: 'Safety relay', partNumber: 'SCR73-280005' }] } } } } as DrawingContext;
  const mm = buildModel(lc);
  assert.ok(!(mm.safety.extraRelays ?? []).some((x) => x.relay.tag === 'MSR1') && mm.safety.relay?.tag !== 'MSR1', 'MSR1 is not a panel safety relay');
  const drawn = planDrawings(lc).sheets.flatMap((s) => (s.spec.kind === 'control' ? s.spec.rungs.flatMap((r) => r.wires) : []));
  assert.ok(drawn.every((w) => !w || mm.wires.some((x) => x.wire === w)), `every control wire number is in the wire list: ${drawn.filter((w) => w && !mm.wires.some((x) => x.wire === w)).join(', ')}`);
}

console.log('relayLogic.test: ok');
