/**
 * Accuracy of a reading against the known facts of a drawing set (a shared fixture such as
 * cn-rollformer-01): signals, relays, the relay logic coil by coil, motors, motion and safety (including the
 * STO finding). Used by the tests and to score a real AI reading of the fixture's files.
 */
import { stoFinding } from './convert';
import type { ExistingMachine } from './types';

export interface ExpectedFacts {
  name: string;
  hasPlc: boolean;
  supply: { volts: number; hz: number; phases: number };
  motors: { tag: string; kw: number; driveTag: string | null; servo?: boolean }[];
  /** Field signals by device tag; "U1 RA/RB/RC" counts as found when U1's relay output is read. */
  signals: string[];
  relays: string[];
  /** Each coil and the devices whose contacts are in its path. */
  relayLogic: { id: string; coil: string; contacts: string[]; sealIn: string | null }[];
  motion: { axisDrive: string; encoder: string; mode: RegExp; cutLength: [number, number] };
  safety: { estops: string[]; guards: string[]; safetyRelay: string; claimed: RegExp; stoFinding: boolean };
}

export interface ScorePart { label: string; found: number; total: number; misses: string[] }
export interface Score { parts: ScorePart[]; percent: number }

const word = (tag: string) => new RegExp(`(?<![A-Za-z0-9])${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![0-9])`, 'i');

/** Score a reading against the facts (each part in %, and the mean). */
export function scoreReading(m: ExistingMachine, f: ExpectedFacts): Score {
  const parts: ScorePart[] = [];
  const part = (label: string, items: [string, boolean][]) => parts.push({ label, found: items.filter(([, ok]) => ok).length, total: items.length, misses: items.filter(([, ok]) => !ok).map(([k]) => k) });
  const ioText = m.io.map((p) => `${p.deviceTag ?? ''} ${p.address} ${p.description}`).join('\n');
  const circuitText = m.circuits.map((c) => `${c.output} ${c.devices.join(' ')} ${c.conditions.join(' ')}`).join('\n');
  const tags = new Set(m.components.map((c) => c.tag));

  part('Signals', f.signals.map((s) => [s, word(s.split(/\s/)[0]).test(`${ioText}\n${circuitText}`)]));
  part('Relays', f.relays.map((r) => [r, tags.has(r) || word(r).test(circuitText)]));
  // relay logic: the coil's circuit is read, and every contact in its path (each one counts)
  const logic: [string, boolean][] = [];
  for (const e of f.relayLogic) {
    const c = m.circuits.find((x) => word(e.coil).test(x.output));
    const pathTags = (c?.path ?? []).flatMap((x) => (x.t === 'branch' ? x.paths.flat().map((y) => y.tag) : [x.tag]));
    const have = c ? new Set([...c.devices, ...pathTags, ...c.conditions.flatMap((t) => t.match(/[A-Z][A-Z0-9]*\d+|H7CX/g) ?? [])]) : new Set<string>();
    logic.push([`${e.id} ${e.coil} circuit`, Boolean(c)]);
    for (const d of e.contacts) logic.push([`${e.id} ${e.coil} ← ${d}`, have.has(d)]);
    if (e.sealIn) logic.push([`${e.id} ${e.coil} seal-in`, Boolean(c && (c.sealIn || c.kind === 'start-stop' || c.conditions.some((t) => /seal|self-hold|自锁|hold/i.test(t))))]);
  }
  part('Relay logic', logic);
  part('Motors', f.motors.map((x) => {
    const r = m.motors.find((y) => y.tag === x.tag);
    return [`${x.tag} ${x.kw} kW`, Boolean(r) && r!.kw === x.kw && (!x.servo || r!.kind === 'servo')];
  }));
  const axis = m.axes.find((a) => a.driveTag === f.motion.axisDrive);
  const spec = Object.values(m.spec).join('\n');
  part('Motion', [
    [`axis on ${f.motion.axisDrive}`, Boolean(axis)],
    [`encoder ${f.motion.encoder}`, Boolean(axis && word(f.motion.encoder).test(axis.encoder ?? ''))],
    ['flying shear / cam mode', Boolean(axis && f.motion.mode.test(`${axis.description} ${axis.signals.join(' ')}`))],
    [`cut length ${f.motion.cutLength.join('–')} mm`, f.motion.cutLength.every((n) => spec.includes(String(n)))],
  ]);
  part('Safety', [
    ...f.safety.estops.map((e): [string, boolean] => [`E-stop ${e}`, m.safety.estops.includes(e)]),
    ...f.safety.guards.map((g): [string, boolean] => [`guard ${g}`, m.safety.guards.includes(g)]),
    [`safety relay ${f.safety.safetyRelay}`, (m.safety.safetyRelay ?? '').includes(f.safety.safetyRelay)],
    ['claimed category', f.safety.claimed.test(m.safety.category ?? '')],
    ['no-STO finding', Boolean(stoFinding(m)) === f.safety.stoFinding],
    ['no PLC', (m.controller !== 'plc') === !f.hasPlc],
    ['supply', m.supplyDrawn.volts === f.supply.volts && m.supplyDrawn.hz === f.supply.hz],
  ]);
  const percent = Math.round(parts.reduce((a, p) => a + (p.total ? p.found / p.total : 1), 0) / parts.length * 100);
  return { parts, percent };
}

/** One line per part, e.g. "Signals 26/28 (93 %) — missing: SB9, H7CX". */
export const scoreText = (s: Score) => [...s.parts.map((p) => `${p.label} ${p.found}/${p.total} (${Math.round(p.found / Math.max(1, p.total) * 100)} %)${p.misses.length ? ` — missing: ${p.misses.join('; ')}` : ''}`), `Overall ${s.percent} %`].join('\n');
