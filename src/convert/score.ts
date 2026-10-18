/**
 * Accuracy of a reading against the known facts of a drawing set (a shared fixture such as
 * cn-rollformer-01): signals, relays, the relay logic coil by coil, motors, motion and safety (including the
 * STO finding). Used by the tests and to score a real AI reading of the fixture's files.
 */
import { convertMachine, ioOnlyDevices, stoFinding } from './convert';
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
  /** Expected North-America device tags, old → new (NFPA 79 / JIC), when the fixture gives them. */
  tags?: [string, string][];
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
  // device tags of the conversion to North America (only devices the reading has)
  if (f.tags?.length) {
    const conv = convertMachine(m);
    const have = new Set([...m.components, ...ioOnlyDevices(m)].map((c) => c.tag));
    part('Tags', f.tags.filter(([o]) => have.has(o) || m.motors.some((x) => x.tag === o)).map(([o, n]): [string, boolean] => [`${o} → ${n}${conv.tags.get(o) && conv.tags.get(o) !== n ? ` (got ${conv.tags.get(o)})` : ''}`, conv.tags.get(o) === n]));
  }
  // the mean of every part (tags included), rounded down, and never 100 % while anything is missing
  const raw = Math.floor(parts.reduce((a, p) => a + (p.total ? p.found / p.total : 1), 0) / parts.length * 100);
  const percent = parts.some((p) => p.found < p.total) ? Math.min(raw, 99) : raw;
  return { parts, percent };
}

/** One line per part, e.g. "Signals 26/28 (93 %) — missing: SB9, H7CX". */
export const scoreText = (s: Score) => [...s.parts.map((p) => `${p.label} ${p.found}/${p.total} (${p.found < p.total ? Math.min(99, Math.floor(p.found / p.total * 100)) : 100} %)${p.misses.length ? ` — missing: ${p.misses.join('; ')}` : ''}`), `Overall ${s.percent} %`].join('\n');

/** The fixture's expected.json (fixtures/import/<name>/expected.json), in the parts the score reads. */
export interface ExpectedJson {
  fixture: string;
  sheets: { no: number; titleCn: string; title: string; inDxf?: boolean }[];
  hasPlc: boolean;
  supply: { voltage: number; frequencyHz: number; phases: number };
  motors: { tag: string; kW: number; starter?: string; starterTags?: string[] }[];
  signals: { tag: string; kind: string }[];
  relays: { tag: string }[];
  relayLogic: { id: string; coil: string; description: string }[];
  motion: { drive: { tag: string }; masterEncoder: { tag: string }; flyingShearMode: string; cutLengthMm: [number, number] };
  safety: { function: string; devices: string[]; category?: string; pl?: string }[];
  naNotes?: { topic: string; current: string; change: string }[];
}

const DEVICE = /\b(?:SB|SA|SQ|KA|KM|KT|FR|HL|YV|QF|U|B|G)\d+\b|\bH7CX\b/g;

/**
 * The facts to score against, straight from a fixture's expected.json. Each relay-logic entry is split
 * per coil ("SB5 -> KA3 11-12 -> KA2 coil; SB6 -> KA2 11-12 -> KA3 coil"): the devices before the coil are
 * its contacts; an entry that names no coil keeps its own coil and every device it mentions.
 */
export function factsFromExpected(e: ExpectedJson): ExpectedFacts {
  const logic: ExpectedFacts['relayLogic'] = [];
  const COIL = '\\b(?:KA|KM|KT|YV|HL)\\d+\\b|\\bH7CX\\b';
  for (const r of e.relayLogic) {
    const colon = r.description.indexOf(':');
    const head = colon > 0 ? r.description.slice(0, colon) : '';
    const body = r.description.slice(colon + 1).replace(/\s+/g, ' ').trim();
    // what the heading puts on every coil: "Jog (only while KA1 is off via KA1 41-42)", "Servo outputs (… U2 DO+ …)"
    const common = head.match(DEVICE) ?? [];
    // the coils of the entry: "KA2/KA3", "HL1-HL5", "YV1/KT1", "U1" (a drive: its inputs)
    const coils = r.coil.split('/').flatMap((c) => {
      const range = c.match(/^([A-Z]+)(\d+)-[A-Z]*(\d+)$/);
      return range ? Array.from({ length: Number(range[3]) - Number(range[2]) + 1 }, (_, i) => `${range[1]}${Number(range[2]) + i}`) : [c];
    });
    // fragments at ";", ", " and ". ", never inside brackets
    const frags: string[] = [];
    let depth = 0, cur = '';
    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      depth += ch === '(' ? 1 : ch === ')' ? -1 : 0;
      if (depth === 0 && (ch === ';' || ((ch === ',' || ch === '.') && body[i + 1] === ' '))) { frags.push(cur.trim()); cur = ''; } else cur += ch;
    }
    frags.push(cur.trim());
    const parallel = new Map<string, string>();
    for (const f of frags) { const x = f.match(new RegExp(`(${COIL}) in parallel with (${COIL})`)); if (x) parallel.set(x[1], x[2]); }
    const pathOf = (coil: string): string[] => {
      const out = new Set<string>();
      let targeted = false;
      for (const f of frags) {
        if (/in parallel with/.test(f) && new RegExp(`\\b${coil}\\b in parallel`).test(f)) continue;
        // the coil is the target of the fragment: "… -> KA2 coil", "SQ3 … switches KA9 coil", "DO1 SRDY -> KA5", "SQ1 energises KA8", "HL2 pump running (KM1 63-64)"
        // (a device followed by its terminals, "-> KA3 11-12", is a contact on the way, not the target)
        const at = f.search(new RegExp(`(?:->|energises|switches|lights|drops)\\s*(?:\\w+\\s+)?${coil}\\b(?! \\d+-\\d+)|\\b${coil}\\b(?= coil)`));
        if (at >= 0) { targeted = true; (f.slice(0, at).match(DEVICE) ?? []).forEach((d) => out.add(d)); }
        if (new RegExp(`^${coil}\\b`).test(f)) targeted = true; // "HL1 power on", "HL4 fault (KA6 21-24 or U1 RA-RC)"
        // a lamp or relay with its source in brackets: "HL4 fault (KA6 21-24 or U1 RA-RC)"
        const own = f.match(new RegExp(`\\b${coil}\\b[^(]*\\(([^)]*)\\)`));
        if (own && /^(HL|KA)/.test(coil)) (own[1].match(DEVICE) ?? []).forEach((d) => out.add(d));
      }
      // its own hold: "energises KA8, which holds through KA8 21-24 and SQ2 (up limit NC)"
      const hold = body.match(new RegExp(`\\b${coil}, which holds through ([^;]*)`));
      if (hold) (hold[1].split(/,\s(?![^(]*\))/)[0].match(DEVICE) ?? []).forEach((d) => out.add(d));
      // no fragment drives it by name (a counter): the devices of its input fragments, not of what it switches
      if (!targeted) for (const f of frags) if (new RegExp(`\\b${coil}\\b`).test(f) || !/opens|lights|drops|energises|->/.test(f)) if (!/opens|lights|drops|energises/.test(f)) (f.match(DEVICE) ?? []).forEach((d) => out.add(d));
      common.forEach((d) => out.add(d));
      out.delete(coil);
      if (/self-hold|holds through/.test(body) && new RegExp(`${coil} \\d+-\\d+ \\(self-hold\\)|${coil}, which holds through`).test(body)) out.add(coil);
      return [...out];
    };
    coils.filter((c) => !/^U\d/.test(c)).forEach((coil, i, all) => {
      const contacts = parallel.has(coil) ? pathOf(parallel.get(coil)!) : pathOf(coil);
      logic.push({ id: all.length > 1 ? `${r.id}${'abcdefgh'[i]}` : r.id, coil, contacts, sealIn: contacts.includes(coil) ? coil : null });
    });
    // a drive's inputs: "MI1 forward via KA1 21-24 or KA2 21-24"
    if (coils.some((c) => /^U\d/.test(c))) {
      for (const f of frags) {
        const x = f.match(/\b((?:MI|DI)\d+)\b.*?\bvia (.*)$/);
        if (x) logic.push({ id: `${r.id}-${x[1]}`, coil: `${coils[0]} ${x[1]}`, contacts: [...new Set(x[2].match(DEVICE) ?? [])], sealIn: null });
      }
    }
    void COIL;
  }
  // "QF0->DISC1, QF1-QF5->CB1-CB5, SB0/SB10->ESTOP1/ESTOP2, KM1->M2 (pump starter)": old → new pairs
  const tagNote = (e.naNotes ?? []).find((n) => /device tags/i.test(n.topic))?.change ?? '';
  const tags: [string, string][] = [];
  const expand = (spec: string): string[] => {
    const range = spec.match(/^([A-Z-]+)(\d+)-([A-Z-]+)(\d+)$/);
    if (range && range[1] === range[3]) return Array.from({ length: Number(range[4]) - Number(range[2]) + 1 }, (_, i) => `${range[1]}${Number(range[2]) + i}`);
    return spec.split('/');
  };
  for (const pair of tagNote.replace(/^[^:]*:\s*/, '').split(/,\s*/)) {
    const x = pair.match(/^([A-Z0-9/-]+)->([A-Z0-9/-]+)/);
    if (!x) continue;
    const from = expand(x[1]), to = expand(x[2]);
    if (from.length === to.length) from.forEach((o, i) => { if (/\d/.test(o)) tags.push([o, to[i]]); });
  }
  const safetyText = e.safety.map((x) => `${x.category ?? ''} ${x.pl ?? ''}`).join(' ');
  const noSto = (e.naNotes ?? []).some((n) => /no STO/i.test(n.current));
  return {
    name: e.fixture,
    hasPlc: e.hasPlc,
    supply: { volts: e.supply.voltage, hz: e.supply.frequencyHz, phases: e.supply.phases },
    motors: e.motors.map((m) => ({ tag: m.tag, kw: m.kW, driveTag: m.starterTags?.find((t) => /^U\d/.test(t)) ?? null, ...(/servo/i.test(m.starter ?? '') ? { servo: true } : {}) })),
    signals: e.signals.map((x) => x.tag),
    // the safety relay is scored under safety
    relays: [...e.relays.map((r) => r.tag), ...(e.signals.some((x) => x.tag === 'H7CX') ? ['H7CX'] : [])],
    relayLogic: logic,
    motion: { axisDrive: e.motion.drive.tag, encoder: e.motion.masterEncoder.tag, mode: /cam|flying/i, cutLength: e.motion.cutLengthMm },
    safety: {
      estops: e.signals.filter((x) => /e-stop/i.test(x.kind)).map((x) => x.tag),
      guards: e.signals.filter((x) => /guard/i.test(x.kind)).map((x) => x.tag),
      safetyRelay: e.safety.flatMap((x) => x.devices).find((d) => /^KA0$/.test(d)) ?? 'KA0',
      claimed: /3/.test(safetyText) && /d/i.test(safetyText) ? /cat\s*3|pl\s*d/i : /cat|pl/i,
      stoFinding: noSto,
    },
    ...(tags.length ? { tags } : {}),
  };
}
