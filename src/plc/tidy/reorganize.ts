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

export type SectionId = 'remove-internal' | 'remove-registers' | 'remove-never' | 'merge' | 'reorder' | 'rename' | 'comment';

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
}

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
const hasEdge = (r: Rung) => r.branches.some((b) => b.some((e) => e.type === 'RISE' || e.type === 'FALL'));

/** Find what each transform would change. Nothing is changed here. */
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
    const reads = new Set<string>();
    for (const r of alive.values()) {
      const d = rungDeps(r);
      // Only what is really read (rungDeps counts written operands as read too, for the order).
      for (const b of r.branches) for (const el of b) if (el.type !== 'CMP' && el.type !== 'RAW') reads.add(el.address.trim().toUpperCase()); else if (el.type === 'CMP') [el.left, el.right].forEach((x) => reads.add(x.trim().toUpperCase()));
      for (const o of r.outputs) {
        if (o.type === 'TMR' || o.type === 'CNT') { reads.add(o.preset.trim().toUpperCase()); if (o.resetAddress) reads.add(o.resetAddress.trim().toUpperCase()); }
        if (o.type === 'COPY') reads.add(o.source.trim().toUpperCase());
        if (o.type === 'MATH') for (const t of o.expression.match(/[A-Za-z]+\d+/g) ?? []) reads.add(t.toUpperCase());
      }
      void d;
    }
    for (const r of [...alive.values()]) {
      if (hasRaw(r) || rungDeps(r).barrier) continue;
      const w = rungWrites(r).map((a) => a.trim().toUpperCase());
      if (!w.length) continue;
      const touched = w.flatMap((a) => { const t = /^(T|CT)(\d+)$/.exec(a); return t ? [a, `${t[1] === 'T' ? 'TD' : 'CTD'}${t[2]}`] : [a]; });
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
    { id: 'merge', title: `Merge ${merges.length} pair(s) of neighbouring rungs with the same conditions`, note: 'One rung with all the outputs, where neither reads what the other writes.', items: merges.map(([a, b]) => `rungs ${num.get(a)} and ${num.get(b)}`), defaultOn: true },
    { id: 'reorder', title: keepBlocks ? 'Order the rungs by machine function inside each block' : 'Group the rungs by machine function (one block each)', note: `${keepBlocks ? 'The blocks (drawings) and their order stay: the program is read-only on its original PLC. ' : ''}Every rung that depends on another keeps its order; kept instructions of the original PLC do not move.`, items: [...FUNCS], defaultOn: true },
    { id: 'rename', title: `Name ${names.size} unnamed internal bit(s) and register(s)`, note: 'Only the names change, never the addresses.', items: [...names].map(([a, n]) => `${a} → ${n}`), defaultOn: true },
    { id: 'comment', title: `Fill ${blanks} blank comment(s)`, note: 'Rung comments, block descriptions and tag comments, as Add comments does.', items: [], defaultOn: true },
  ];
  return { sections, removals: { 'remove-internal': internal, 'remove-registers': registers, 'remove-never': never }, merges, names, keepBlocks };
}

/** The program with the chosen transforms, in a fixed order: remove, merge, reorder, rename, comment. */
export function applyReorganize(p: ProjectSnapshot, plan: ReorgPlan, chosen: Set<SectionId>): LadderProgram {
  let l: LadderProgram = structuredClone(p.ladder);
  const drop = new Set<string>();
  for (const id of ['remove-internal', 'remove-registers', 'remove-never'] as const) if (chosen.has(id)) plan.removals[id]?.forEach((x) => drop.add(x));
  l = { ...l, rungs: l.rungs.filter((r) => !drop.has(r.id)) };
  if (chosen.has('merge')) {
    for (const [a, b] of plan.merges) {
      const ra = l.rungs.find((r) => r.id === a), rb = l.rungs.find((r) => r.id === b);
      if (!ra || !rb) continue;
      ra.outputs = [...ra.outputs, ...rb.outputs];
      ra.comment = [ra.comment, rb.comment].filter((c) => c.trim()).join(' Also: ');
      l.rungs = l.rungs.filter((r) => r.id !== b);
    }
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
