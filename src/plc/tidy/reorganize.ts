/**
 * "Reorganize program": the same behaviour in a simpler shape, as separate transforms the user picks one by one.
 *  - remove: rungs that write values nothing reads (opt-in per group: internal bits on by default; registers another
 *    device could read, retentive memory and never-true rungs off by default);
 *  - merge: neighbouring rungs with the same conditions become one rung with all their outputs;
 *  - reorder: rungs grouped by machine function (safety, modes, each station, alarms, HMI), keeping every scan-order
 *    dependency (deps.ts); a read-only imported program (Yaskawa drawings) only within its own blocks;
 *  - rename: every unnamed internal bit and register gets a name from what drives it;
 *  - comment: every blank comment filled (Add comments' rules).
 * Addresses never change and kept instructions of another PLC stay as they are. The chosen combination is checked
 * with the simulator (equivalence.ts) before it is offered.
 */
import type { ProjectSnapshot } from '../../deliverables/collect';
import { programInfo } from '../../deliverables/docs/program';
import { logixName } from '../core/profiles/logixExport';
import { rungWrites, type LadderElement, type LadderProgram, type ProgramBlock, type Rung } from '../core/ladder';
import { reorder, rungDeps } from './deps';
import { rulesComments } from './comments';

export type SectionId = 'remove-internal' | 'remove-registers' | 'remove-never' | 'remove-uncalled' | 'remove-jumped' | 'remove-tags' | 'merge' | 'flatten' | 'seal' | 'split' | 'reorder' | 'rename' | 'comment';

/** Removals of code the original PLC never runs: the behaviour check compares against the program without it. */
export const NEVER_RUN: SectionId[] = ['remove-uncalled', 'remove-jumped'];

export interface PlanSection {
  id: SectionId;
  title: string;
  /** Why it is on or off by default. */
  note: string;
  /** What it changes, one line each (rung numbers, names). */
  items: string[];
  defaultOn: boolean;
}

export interface ReorgPlan {
  sections: PlanSection[];
  /** Rung ids to remove per removal section. */
  removals: Partial<Record<SectionId, Set<string>>>;
  /** Pairs of rung ids merged (the second into the first). */
  merges: [string, string][];
  /** New names for unnamed internal addresses. */
  names: Map<string, string>;
  /** Rungs that only a block's order keeps (read-only import): no regrouping across blocks. */
  keepBlocks: boolean;
  /** Tag entries (addresses) nothing in the project uses. */
  unusedTags: Set<string>;
  /** Found, nothing to change (e.g. a label no jump goes to), each with its reason. */
  findings: string[];
  /** Rungs whose branches lose duplicates, contradictions and absorbed paths. */
  flatten: Set<string>;
  /** SET / RESET pairs (neighbouring rungs) that become one seal-in rung. */
  seals: SealIn[];
  /** Mega-rungs split into a few rungs, with the internal bits the split may use. */
  splits: Set<string>;
  /** Free internal bits the splits may use (in order); empty when the PLC's memory has none the app knows. */
  freeBits: string[];
}

export interface SealIn { setId: string; rstId: string; address: string; setFirst: boolean }

const WORD = /^(DS|DD|DH|DF|TXT|SD|MW|DW|ML|MF|MB|D|DB|R|N|F)\d/i;
const FUNCS = ['Safety', 'Modes', 'Stations', 'Alarms', 'HMI', 'Other'] as const;
type Func = (typeof FUNCS)[number];

/**
 * Addresses outside the program can see: every I/O point's address (outputs whatever the brand calls them: Y001,
 * OB00000, %Q0.0…) and the HMI's tags. Never removed, always compared by the behaviour check.
 */
export function externalAddresses(p: ProjectSnapshot): Set<string> {
  return new Set([...(p.hmi?.tags ?? []).map((t) => t.address.trim().toUpperCase()), ...[...p.addresses.values()].map((a) => a.trim().toUpperCase())]);
}
const externalReads = externalAddresses;

/** The machine function of a rung, from the names of what it writes and reads. */
function functionOf(r: Rung, name: (a: string) => string, hmi: Set<string>): Func {
  const w = rungWrites(r).map((a) => a.trim().toUpperCase());
  const text = (as: string[]) => as.map((a) => `${a} ${name(a)}`).join(' ').toLowerCase();
  const wt = text(w), rt = text([...rungDeps(r).reads]);
  if (/safety|e-?stop|guard|light curtain|safe/.test(wt)) return 'Safety';
  if (/alarm|fault|alm_|timeout|warning/.test(wt)) return 'Alarms';
  if (/\b(auto|manual|mode|running|run|start|stop|reset|first scan|machine state)\b/.test(wt)) return 'Modes';
  if (w.some((a) => /^Y/.test(a))) return 'Stations';
  if (w.length && w.every((a) => hmi.has(a)) || /\b(hmi|sts_|status|heartbeat|hours|count|rate|per min)\b/.test(wt)) return 'HMI';
  if (/safety|e-?stop/.test(rt)) return 'Safety';
  return 'Other';
}

/** The station a rung belongs to: the first output it drives (by name), else its first written address. */
function stationOf(r: Rung, name: (a: string) => string): string {
  const y = rungWrites(r).find((a) => /^Y/i.test(a.trim()));
  const n = y ? name(y) : '';
  return (n.split(/\s+/).slice(0, 2).join(' ') || y || 'General').replace(/\b(solenoid|contactor|motor|run|valve|lamp)\b/gi, '').trim() || 'General';
}

const hasRaw = (r: Rung) => r.outputs.some((o) => o.type === 'RAW') || r.branches.some((b) => b.some((e) => e.type === 'RAW'));
/** The kept-instruction texts of a rung. */
const rawTexts = (r: Rung) => [...r.branches.flat(), ...r.outputs].flatMap((x) => (x.type === 'RAW' ? [x.text] : []));
const JMP = /^\s*JMP\(\s*(\w+)\s*\)\s*;?\s*$/i;
const LBL = /\bLBL\(\s*(\w+)\s*\)/i;

/**
 * Code the original PLC never runs: rungs of a routine no call names (block.called === false), and rungs an
 * unconditional JMP skips (after the jump, before its label, in the same block). Labels no jump goes to are findings.
 */
function neverRun(l: LadderProgram, rungNo: (r: Rung) => number): { uncalled: Map<string, string>; jumped: Map<string, string>; findings: string[] } {
  const uncalled = new Map<string, string>(), jumped = new Map<string, string>(), findings: string[] = [];
  const blocks = new Map((l.blocks ?? []).map((b) => [b.id, b] as const));
  for (const r of l.rungs) {
    const b = r.block ? blocks.get(r.block) : undefined;
    if (b?.called === false) uncalled.set(r.id, `routine "${b.name}" is never called (no JSR names it, and it is not the program's main routine)`);
  }
  const targets = new Set<string>();
  l.rungs.forEach((r, i) => {
    for (const t of rawTexts(r)) {
      const m = /\bJMP\(\s*(\w+)/i.exec(t);
      if (m) targets.add(`${r.block ?? ''}|${m[1].toUpperCase()}`);
      // An unconditional jump: the rung holds only the JMP.
      const j = JMP.exec(t);
      if (!j || r.branches.some((br) => br.some((e) => e.type !== 'RAW')) || r.outputs.length !== 1) continue;
      const label = j[1].toUpperCase();
      const end = l.rungs.findIndex((x, k) => k > i && (x.block ?? '') === (r.block ?? '') && rawTexts(x).some((tx) => LBL.exec(tx)?.[1].toUpperCase() === label));
      if (end < 0) continue;
      for (let k = i + 1; k < end; k++) if ((l.rungs[k].block ?? '') === (r.block ?? '') && !jumped.has(l.rungs[k].id)) jumped.set(l.rungs[k].id, `skipped by the unconditional JMP ${label} in rung ${rungNo(r)} (its label is in rung ${rungNo(l.rungs[end])})`);
    }
  });
  for (const r of l.rungs) for (const t of rawTexts(r)) {
    const m = LBL.exec(t);
    if (m && !targets.has(`${r.block ?? ''}|${m[1].toUpperCase()}`)) findings.push(`Rung ${rungNo(r)}: label ${m[1]} — no JMP goes to it (a label does nothing on its own; kept).`);
  }
  return { uncalled, jumped, findings };
}

const hasEdge = (r: Rung) => r.branches.some((b) => b.some((e) => e.type === 'RISE' || e.type === 'FALL'));

/** Find what each transform would change. Nothing is changed here. */
/** What a rung really reads (rungDeps counts written operands as read too, for the order). */
function realReads(r: Rung): string[] {
  const reads: string[] = [];
  for (const b of r.branches) for (const el of b) if (el.type !== 'CMP' && el.type !== 'RAW') reads.push(el.address.trim().toUpperCase()); else if (el.type === 'CMP') [el.left, el.right].forEach((x) => reads.push(x.trim().toUpperCase()));
  for (const o of r.outputs) {
    if (o.type === 'TMR' || o.type === 'CNT') { reads.push(o.preset.trim().toUpperCase()); if (o.resetAddress) reads.push(o.resetAddress.trim().toUpperCase()); }
    if (o.type === 'COPY') reads.push(o.source.trim().toUpperCase());
    if (o.type === 'MATH') for (const t of o.expression.match(/[A-Za-z]+\d+/g) ?? []) reads.push(t.toUpperCase());
  }
  return reads;
}

/** What a rung writes, a timer's or counter's value with it. */
function touchedBy(r: Rung): string[] {
  return rungWrites(r).map((a) => a.trim().toUpperCase()).flatMap((a) => { const t = /^(T|CT)(\d+)$/.exec(a); return t ? [a, `${t[1] === 'T' ? 'TD' : 'CTD'}${t[2]}`] : [a]; });
}

// ── Simplify transforms (each re-checked on the rung as it is when applied) ──

const elKey = (e: LadderElement) => JSON.stringify(e);
const isEdge = (e: LadderElement) => e.type === 'RISE' || e.type === 'FALL';

/**
 * Branches without what changes nothing: a contact repeated in a path, a path with a contact and its opposite (never
 * true), a path repeated, a path that contains every contact of a shorter one (A OR (A AND B) is A). null: no change,
 * or nothing left (that rung is never true: Remove never-true rungs handles it).
 */
export function flattenRung(r: Rung): Rung | null {
  if (r.branches.length === 0 || hasRaw(r)) return null;
  let bs = r.branches.map((b) => b.filter((e, i) => isEdge(e) || b.findIndex((x) => elKey(x) === elKey(e)) === i));
  const opposite = (b: LadderElement[]) => b.some((e) => e.type === 'NO' && b.some((x) => x.type === 'NC' && x.address.trim().toUpperCase() === e.address.trim().toUpperCase()));
  bs = bs.filter((b) => !opposite(b));
  const sets = bs.map((b) => new Set(b.map(elKey)));
  bs = bs.filter((_b, i) => !sets.some((a, j) => j !== i && [...a].every((k) => sets[i].has(k)) && (a.size < sets[i].size || j < i)));
  if (!bs.length) return null;
  const same = bs.length === r.branches.length && bs.every((b, i) => b.length === r.branches[i].length);
  return same ? null : { ...r, branches: bs };
}

/** One contact the other way round (a RESET condition of one plain contact). */
const negate = (e: LadderElement): LadderElement | null => (e.type === 'NO' ? { type: 'NC', address: e.address } : e.type === 'NC' ? { type: 'NO', address: e.address } : null);

/**
 * SET / RESET pairs that are one seal-in: the only writers of a non-retentive bit, neighbouring rungs, each with just
 * that output; the reset is one plain contact (not the bit itself); with the reset first, the set does not read the
 * bit. SET then RESET: A = (set OR A) AND NOT reset; RESET then SET: A = (A AND NOT reset) OR set.
 */
export function sealInPairs(l: LadderProgram, retentive: (a: string) => boolean): SealIn[] {
  const writers = new Map<string, number>();
  for (const r of l.rungs) for (const a of rungWrites(r)) writers.set(a.trim().toUpperCase(), (writers.get(a.trim().toUpperCase()) ?? 0) + 1);
  const out: SealIn[] = [];
  const only = (r: Rung, type: 'SET' | 'RST') => (r.outputs.length === 1 && r.outputs[0].type === type && !hasRaw(r) ? r.outputs[0].address.trim().toUpperCase() : null);
  for (let i = 1; i < l.rungs.length; i++) {
    const a = l.rungs[i - 1], b = l.rungs[i];
    for (const [s, rs, setFirst] of [[a, b, true], [b, a, false]] as const) {
      const addr = only(s, 'SET');
      if (!addr || only(rs, 'RST') !== addr || writers.get(addr) !== 2 || retentive(addr) || (a.block ?? '') !== (b.block ?? '')) continue;
      if (rs.branches.length !== 1 || rs.branches[0].length !== 1 || !negate(rs.branches[0][0]) || (rs.branches[0][0] as { address: string }).address.trim().toUpperCase() === addr) continue;
      if (!s.branches.length || (!setFirst && s.branches.some((br) => br.some((e) => e.type !== 'CMP' && e.type !== 'RAW' && e.address.trim().toUpperCase() === addr)))) continue;
      if (out.some((x) => [x.setId, x.rstId].some((id) => id === s.id || id === rs.id))) continue;
      out.push({ setId: s.id, rstId: rs.id, address: addr, setFirst });
    }
  }
  return out;
}

/** The seal-in rung for a pair (in the place of the second of the two). */
function sealRung(s: Rung, rs: Rung, x: SealIn): Rung {
  const notR = negate(rs.branches[0][0])!;
  const self: LadderElement = { type: 'NO', address: x.address };
  const branches = x.setFirst ? [...s.branches.map((b) => [...b, notR]), [self, notR]] : [[self, notR], ...s.branches];
  return { ...(x.setFirst ? rs : s), id: s.id, comment: [s.comment, rs.comment].filter((c) => c.trim()).join(' / ') || `Seal-in of ${x.address}`, branches, outputs: [{ type: 'OUT', address: x.address }] };
}

/** A mega-rung: many outputs, or many paths. */
const MANY_OUTPUTS = 6, MANY_BRANCHES = 6, CHUNK = 3;
const isMega = (r: Rung) => !hasRaw(r) && !rungDeps(r).barrier && (r.outputs.length >= MANY_OUTPUTS || r.branches.length >= MANY_BRANCHES);

/**
 * A mega-rung in a few rungs. Many outputs: the conditions once into an internal bit, then the outputs a few at a
 * time on that bit (the conditions repeated instead when they are one short path that reads nothing the outputs
 * write). Many paths: a few paths at a time into internal bits, then the outputs on any of them. The internal bits
 * come from `free` (taken in order); null when it would need more than there are.
 */
export function splitRung(r: Rung, free: string[]): { rungs: Rung[]; used: string[] } | null {
  if (!isMega(r)) return null;
  const writes = new Set(rungWrites(r).map((a) => a.trim().toUpperCase()));
  const chunks = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
  const used: string[] = [];
  const take = () => { const b = free[used.length]; if (b) used.push(b); return b; };
  let cond: LadderElement[][] = r.branches;
  const pre: Rung[] = [];
  if (r.branches.length >= MANY_BRANCHES) {
    const parts = chunks(r.branches, CHUNK);
    const bits = parts.map(() => take());
    if (bits.some((b) => !b)) return null;
    parts.forEach((part, i) => pre.push({ id: `${r.id}_p${i + 1}`, ...(r.block ? { block: r.block } : {}), comment: `${r.comment || 'Conditions'} (paths ${i * CHUNK + 1}–${i * CHUNK + part.length})`, branches: part, outputs: [{ type: 'OUT', address: bits[i]! }] }));
    cond = bits.map((b) => [{ type: 'NO', address: b! }]);
  }
  if (r.outputs.length < MANY_OUTPUTS) return { rungs: [...pre, { ...r, branches: cond }], used };
  const short = cond.length === 1 && cond[0].length <= 2 && cond[0].every((e) => e.type === 'NO' || e.type === 'NC' || e.type === 'CMP')
    && !cond[0].some((e) => (e.type === 'CMP' ? [e.left, e.right] : e.type === 'RAW' ? [] : [e.address]).some((a) => writes.has(a.trim().toUpperCase()) || /^(T|CT)\d/i.test(a.trim())));
  if (!short) {
    const bit = take();
    if (!bit) return null;
    pre.push({ id: `${r.id}_c`, ...(r.block ? { block: r.block } : {}), comment: `${r.comment || 'Conditions'} (all of them, for the outputs below)`, branches: cond, outputs: [{ type: 'OUT', address: bit }] });
    cond = [[{ type: 'NO', address: bit }]];
  }
  return { rungs: [...pre, ...chunks(r.outputs, CHUNK).map((outs, i) => ({ ...r, id: i ? `${r.id}_o${i + 1}` : r.id, comment: i ? `${r.comment || 'Outputs'} (continued)` : r.comment, branches: cond, outputs: outs }))], used };
}

/** Internal bits nothing uses, from the top of the PLC's C memory down (CLICK-style memory only). */
function freeBitsOf(p: ProjectSnapshot, l: LadderProgram, need: number): string[] {
  if (p.profile.parseAddress('C1999')?.kind !== 'bit') return [];
  const used = new Set([...l.rungs.flatMap((r) => [...rungDeps(r).reads, ...rungDeps(r).writes]), ...l.tags.map((t) => t.address.trim().toUpperCase()), ...externalAddresses(p)]);
  const out: string[] = [];
  for (let n = 1999; n > 1500 && out.length < need; n--) if (!used.has(`C${n}`)) out.push(`C${n}`);
  return out;
}

export function planReorganize(p: ProjectSnapshot): ReorgPlan {
  const info = programInfo(p);
  const name = (a: string) => info.name(a);
  const l = p.ladder;
  const num = new Map(l.rungs.map((r, i) => [r.id, i + 1]));
  const hmi = externalReads(p);
  const retentive = (a: string) => Boolean(p.profile.simSemantics?.retentive(a));
  const keepBlocks = Boolean(p.profile.readOnly);

  // Removal: rungs whose every write is read by nothing (no rung, no HMI tag, not an output), again until nothing more.
  const internal = new Set<string>(), registers = new Set<string>();
  const alive = new Map(l.rungs.map((r) => [r.id, r]));
  for (let changed = true; changed;) {
    changed = false;
    const reads = new Set([...alive.values()].flatMap(realReads));
    for (const r of [...alive.values()]) {
      if (hasRaw(r) || rungDeps(r).barrier) continue;
      const touched = touchedBy(r);
      if (!touched.length) continue;
      if (touched.some((a) => /^Y/.test(a) || hmi.has(a) || reads.has(a))) continue;
      // Words (another device may read registers), retentive memory: their own group, off by default.
      (touched.some((a) => WORD.test(a) || retentive(a)) ? registers : internal).add(r.id);
      alive.delete(r.id);
      changed = true;
    }
  }
  // Never true: a normally-open contact on a bit nothing writes and nothing outside sets (not an input, not the HMI's).
  const written = new Set(l.rungs.flatMap((r) => rungWrites(r).map((a) => a.trim().toUpperCase())));
  const inputs = new Set([...p.addresses.values()].map((a) => a.toUpperCase()));
  const never = new Set<string>();
  for (const r of l.rungs) {
    if (internal.has(r.id) || registers.has(r.id) || hasRaw(r) || !r.branches.length) continue;
    const dead = (el: LadderElement) => el.type === 'NO' && /^C\d+$/i.test(el.address.trim()) && !written.has(el.address.trim().toUpperCase()) && !inputs.has(el.address.trim().toUpperCase()) && !hmi.has(el.address.trim().toUpperCase());
    if (r.branches.every((b) => b.some(dead))) never.add(r.id);
  }

  // Code the original PLC never runs, and tag entries nothing uses (not I/O, not the HMI's; registers and retentive
  // memory kept: another device may read them).
  const nr = neverRun(l, (r) => num.get(r.id) ?? 0);
  const findings = [...nr.findings];
  const usedAddr = new Set(l.rungs.flatMap((r) => [...rungDeps(r).reads, ...rungDeps(r).writes, ...rungWrites(r).map((a) => a.trim().toUpperCase())]));
  const unusedTags = new Set(l.tags.map((t) => t.address.trim().toUpperCase()).filter((a) => !usedAddr.has(a) && !hmi.has(a) && !WORD.test(a) && !retentive(a)));

  // Simplify: branches, SET / RESET pairs, mega-rungs (internal bits from the top of free memory where needed).
  const flatten = new Set(l.rungs.filter((r) => flattenRung(r)).map((r) => r.id));
  const seals = sealInPairs(l, retentive);
  const freeBits = freeBitsOf(p, l, 200);
  const splitItems: string[] = [];
  const splits = new Set<string>();
  let spent = 0;
  for (const r of l.rungs) {
    if (!isMega(r)) continue;
    const s = splitRung(r, freeBits.slice(spent));
    if (!s) { findings.push(`Rung ${num.get(r.id)}: ${r.outputs.length} outputs, ${r.branches.length} paths — not split (it needs internal bits this PLC's memory has no free ones the app knows).`); continue; }
    splits.add(r.id);
    spent += s.used.length;
    splitItems.push(`rung ${num.get(r.id)}: ${r.outputs.length} outputs, ${r.branches.length} paths → ${s.rungs.length} rungs${s.used.length ? ` (internal bit${s.used.length === 1 ? '' : 's'} ${s.used.join(', ')})` : ''}`);
  }

  // Merge: neighbours with the same conditions and only coils, the second not reading what the first writes.
  const merges: [string, string][] = [];
  const coilsOnly = (r: Rung) => r.outputs.every((o) => o.type === 'OUT' || o.type === 'SET' || o.type === 'RST');
  const removed = new Set([...internal, ...registers]);
  const kept = l.rungs.filter((r) => !removed.has(r.id));
  for (let i = 1; i < kept.length; i++) {
    const a = kept[i - 1], b = kept[i];
    if (!a.branches.length || hasRaw(a) || hasRaw(b) || hasEdge(a) || hasEdge(b) || !coilsOnly(a) || !coilsOnly(b) || (a.block ?? '') !== (b.block ?? '')) continue;
    if (JSON.stringify(a.branches) !== JSON.stringify(b.branches)) continue;
    const aw = new Set(rungWrites(a).map((x) => x.toUpperCase()));
    if ([...rungDeps(b).reads].some((x) => aw.has(x)) || rungWrites(b).some((x) => aw.has(x.toUpperCase()))) continue;
    if (merges.some(([, y]) => y === a.id)) continue;
    merges.push([a.id, b.id]);
  }

  // Rename: internal addresses the program writes that have no name.
  const named = new Set([...l.tags.filter((t) => t.nickname.trim()).map((t) => t.address.toUpperCase()), ...[...p.addresses.values()].map((a) => a.toUpperCase()), ...hmi]);
  const used = new Set(l.tags.map((t) => t.nickname.toLowerCase()));
  const names = new Map<string, string>();
  for (const r of l.rungs) for (const a0 of rungWrites(r)) {
    const a = a0.trim().toUpperCase();
    if (named.has(a) || names.has(a) || !/^[A-Z]+\d+$/.test(a) || /^Y/.test(a)) continue;
    const from = r.comment.trim() ? r.comment.split(/[.:;(]/)[0] : [...rungDeps(r).reads].filter((x) => x !== a).map(name).find(Boolean) ?? '';
    const kind = /^T\d/.test(a) ? 'Timer' : /^CT\d/.test(a) ? 'Counter' : WORD.test(a) ? 'Value' : 'Flag';
    const words = from.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !/^(the|and|when|with|turns|sets|latches|resets|used|rung|rungs)$/i.test(w)).slice(0, 3).join('_');
    names.set(a, logixName(words ? `${words}_${kind}` : `${kind}_${a}`, used, `${kind}_${a}`).slice(0, 24));
  }

  const list = (ids: Set<string>) => [...ids].map((id) => `rung ${num.get(id)}: ${rungWrites(l.rungs.find((r) => r.id === id)!).map((a) => info.ref(a)).join(', ')}`);
  const blanks = l.rungs.filter((r) => !r.comment.trim()).length + (l.blocks ?? []).filter((b) => !b.description.trim()).length + l.tags.filter((t) => !t.comment.trim()).length;
  const sections: PlanSection[] = [
    { id: 'remove-internal', title: `Remove ${internal.size} rung(s) that write internal values nothing reads`, note: 'Internal bits and timers no rung, output or HMI tag reads. On by default.', items: list(internal), defaultOn: true },
    { id: 'remove-registers', title: `Remove ${registers.size} rung(s) that write registers or retentive memory nothing in the project reads`, note: 'Off by default: a SCADA, another PLC or Modbus master may read registers the project does not know about.', items: list(registers), defaultOn: false },
    { id: 'remove-never', title: `Remove ${never.size} rung(s) that can never be true`, note: 'Off by default: each needs a bit that nothing in the project sets (another device may set it).', items: list(never), defaultOn: false },
    ...(nr.uncalled.size ? [{ id: 'remove-uncalled' as const, title: `Remove ${nr.uncalled.size} rung(s) of routines the original PLC never calls`, note: 'Off by default. The app runs every block; the PLC runs a routine only when a JSR calls it. Checked against the program without them (what the PLC really runs).', items: [...nr.uncalled].map(([id, why]) => `rung ${num.get(id)}: ${why}`), defaultOn: false }] : []),
    ...(nr.jumped.size ? [{ id: 'remove-jumped' as const, title: `Remove ${nr.jumped.size} rung(s) an unconditional jump always skips`, note: 'Off by default. The PLC never runs them; the app runs them (it does not jump). Checked against the program without them.', items: [...nr.jumped].map(([id, why]) => `rung ${num.get(id)}: ${why}`), defaultOn: false }] : []),
    ...(unusedTags.size ? [{ id: 'remove-tags' as const, title: `Remove ${unusedTags.size} tag entr${unusedTags.size === 1 ? 'y' : 'ies'} nothing uses`, note: 'Names and comments of bits, timers and counters no rung, I/O point or HMI tag uses. Registers and retentive memory are kept (another device may read them).', items: [...unusedTags].map((a) => `${a}${l.tags.find((t) => t.address.trim().toUpperCase() === a)?.nickname ? ` ${l.tags.find((t) => t.address.trim().toUpperCase() === a)!.nickname}` : ''}: no rung reads or writes it`), defaultOn: true }] : []),
    ...(flatten.size ? [{ id: 'flatten' as const, title: `Flatten the paths of ${flatten.size} rung(s)`, note: 'Repeated contacts and paths, paths with a contact and its opposite, and paths that contain a shorter one (A OR (A AND B) is A) go.', items: [...flatten].map((id) => { const r = l.rungs.find((x) => x.id === id)!; return `rung ${num.get(id)}: ${r.branches.length} paths → ${flattenRung(r)!.branches.length}`; }), defaultOn: true }] : []),
    ...(seals.length ? [{ id: 'seal' as const, title: `Make ${seals.length} SET / RESET pair(s) one seal-in rung`, note: 'Only for a bit set and reset in neighbouring rungs, written nowhere else and not retentive (a seal-in drops at power-up like the bit does).', items: seals.map((x) => `${info.ref(x.address)}: rungs ${num.get(x.setId)} and ${num.get(x.rstId)} → one rung`), defaultOn: true }] : []),
    ...(splits.size ? [{ id: 'split' as const, title: `Split ${splits.size} long rung(s)`, note: `Rungs with ${MANY_OUTPUTS} or more outputs or ${MANY_BRANCHES} or more paths, a few at a time; internal bits only where the conditions cannot simply be repeated.`, items: splitItems, defaultOn: false }] : []),
    { id: 'merge', title: `Merge ${merges.length} pair(s) of neighbouring rungs with the same conditions`, note: 'One rung with all the outputs, where neither reads what the other writes.', items: merges.map(([a, b]) => `rungs ${num.get(a)} and ${num.get(b)}`), defaultOn: true },
    { id: 'reorder', title: keepBlocks ? 'Order the rungs by machine function inside each block' : 'Group the rungs by machine function (one block each)', note: `${keepBlocks ? 'The blocks (drawings) and their order stay: the program is read-only on its original PLC. ' : ''}Every rung that depends on another keeps its order; kept instructions of the original PLC do not move.`, items: [...FUNCS], defaultOn: true },
    { id: 'rename', title: `Name ${names.size} unnamed internal bit(s) and register(s)`, note: 'Only the names change, never the addresses.', items: [...names].map(([a, n]) => `${a} → ${n}`), defaultOn: true },
    { id: 'comment', title: `Fill ${blanks} blank comment(s)`, note: 'Rung comments, block descriptions and tag comments, as Add comments does.', items: [], defaultOn: true },
  ];
  return { sections, removals: { 'remove-internal': internal, 'remove-registers': registers, 'remove-never': never, 'remove-uncalled': new Set(nr.uncalled.keys()), 'remove-jumped': new Set(nr.jumped.keys()) }, merges, names, keepBlocks, unusedTags, findings, flatten, seals, splits, freeBits };
}

/** The program with the chosen transforms, in a fixed order: remove, merge, reorder, rename, comment. */
export function applyReorganize(p: ProjectSnapshot, plan: ReorgPlan, chosen: Set<SectionId>): LadderProgram {
  let l: LadderProgram = structuredClone(p.ladder);
  const drop = new Set<string>();
  for (const id of ['remove-internal', 'remove-registers', 'remove-never', ...NEVER_RUN] as const) if (chosen.has(id)) plan.removals[id]?.forEach((x) => drop.add(x));
  // Unread only once the rungs reading it go too: a rung a kept rung still reads stays (one group on, the other off).
  // Code the PLC never runs (and never-true rungs) goes whatever reads it.
  const never = new Set([...(plan.removals['remove-never'] ?? []), ...NEVER_RUN.flatMap((id) => (chosen.has(id) ? [...(plan.removals[id] ?? [])] : []))]);
  for (let changed = true; changed;) {
    changed = false;
    const reads = new Set(l.rungs.filter((r) => !drop.has(r.id)).flatMap(realReads));
    for (const r of l.rungs) if (drop.has(r.id) && !never.has(r.id) && touchedBy(r).some((a) => reads.has(a))) { drop.delete(r.id); changed = true; }
  }
  l = { ...l, rungs: l.rungs.filter((r) => !drop.has(r.id)), ...(chosen.has('remove-tags') ? { tags: l.tags.filter((t) => !plan.unusedTags.has(t.address.trim().toUpperCase())) } : {}) };
  if (chosen.has('merge')) {
    for (const [a, b] of plan.merges) {
      const ra = l.rungs.find((r) => r.id === a), rb = l.rungs.find((r) => r.id === b);
      if (!ra || !rb) continue;
      ra.outputs = [...ra.outputs, ...rb.outputs];
      ra.comment = [ra.comment, rb.comment].filter((c) => c.trim()).join(' Also: ');
      l.rungs = l.rungs.filter((r) => r.id !== b);
    }
  }
  if (chosen.has('flatten')) l = { ...l, rungs: l.rungs.map((r) => (plan.flatten.has(r.id) ? flattenRung(r) ?? r : r)) };
  if (chosen.has('seal')) {
    // Pairs as they still are after the steps before (a removal or merge may have changed one).
    const retentive = (a: string) => Boolean(p.profile.simSemantics?.retentive(a));
    for (const x of sealInPairs(l, retentive).filter((y) => plan.seals.some((z) => z.setId === y.setId && z.rstId === y.rstId))) {
      const s = l.rungs.find((r) => r.id === x.setId)!, rs = l.rungs.find((r) => r.id === x.rstId)!;
      const second = x.setFirst ? rs.id : s.id;
      l = { ...l, rungs: l.rungs.flatMap((r) => (r.id === second ? [sealRung(s, rs, x)] : r.id === s.id || r.id === rs.id ? [] : [r])) };
    }
  }
  if (chosen.has('split')) {
    let spent = 0;
    const rungs: Rung[] = [];
    const bits: string[] = [];
    for (const r of l.rungs) {
      const sp = plan.splits.has(r.id) ? splitRung(r, plan.freeBits.slice(spent)) : null;
      if (!sp) { rungs.push(r); continue; }
      spent += sp.used.length;
      bits.push(...sp.used);
      rungs.push(...sp.rungs);
    }
    l = { ...l, rungs, tags: [...l.tags, ...bits.map((address) => ({ address, nickname: '', comment: 'Conditions of a long rung split in parts (Reorganize)' }))] };
  }
  if (chosen.has('reorder')) {
    const info = programInfo({ ...p, ladder: l });
    const hmi = externalReads(p);
    const fn = new Map(l.rungs.map((r) => [r.id, functionOf(r, info.name, hmi)] as const));
    const station = new Map(l.rungs.map((r) => [r.id, stationOf(r, info.name)] as const));
    const stations = [...new Set(l.rungs.filter((r) => fn.get(r.id) === 'Stations').map((r) => station.get(r.id)!))];
    const blockIx = new Map((l.blocks ?? []).map((b, i) => [b.id, i]));
    const rank = (r: Rung) => FUNCS.indexOf(fn.get(r.id)!) * 1000 + (fn.get(r.id) === 'Stations' ? stations.indexOf(station.get(r.id)!) : 0);
    l = { ...l, rungs: reorder(l.rungs, (r) => (plan.keepBlocks ? (blockIx.get(r.block ?? '') ?? 0) * 1e6 : 0) + rank(r)) };
    if (!plan.keepBlocks) {
      // One block per function (each station its own), in the new order; a block's rungs need not be together for
      // the order kept above, so a block name says where a rung belongs, not that the block is contiguous.
      const blocks: ProgramBlock[] = [];
      const idOf = (r: Rung) => {
        const f = fn.get(r.id)!;
        const nm = f === 'Stations' ? station.get(r.id)! : f === 'Modes' ? 'Safety and modes' : f;
        const id = `f_${nm.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
        if (!blocks.some((b) => b.id === id)) blocks.push({ id, name: f === 'Safety' ? 'Safety' : nm, description: '' });
        return id;
      };
      l = { ...l, rungs: l.rungs.map((r) => ({ ...r, block: idOf(r) })), blocks };
    }
  }
  if (chosen.has('rename') && plan.names.size) {
    const have = new Set(l.tags.map((t) => t.address.toUpperCase()));
    l = {
      ...l,
      tags: [
        ...l.tags.map((t) => (!t.nickname.trim() && plan.names.has(t.address.toUpperCase()) ? { ...t, nickname: plan.names.get(t.address.toUpperCase())! } : t)),
        ...[...plan.names].filter(([a]) => !have.has(a)).map(([address, nickname]) => ({ address, nickname, comment: '' })),
      ],
    };
  }
  if (chosen.has('comment')) l = rulesComments({ ...p, ladder: l }).program;
  return l;
}

/**
 * What the behaviour check compares against: the program as the original PLC runs it, i.e. without the code the
 * chosen never-run removals take out (the app's simulator runs every block and does not jump).
 */
export function plcBaseline(p: ProjectSnapshot, plan: ReorgPlan, chosen: Set<SectionId>): LadderProgram {
  const out = new Set(NEVER_RUN.flatMap((id) => (chosen.has(id) ? [...(plan.removals[id] ?? [])] : [])));
  return out.size ? { ...p.ladder, rungs: p.ladder.rungs.filter((r) => !out.has(r.id)) } : p.ladder;
}
