/**
 * Edits made from the flow diagram, as changes to the ladder (the program stays one: the diagram is drawn from it).
 * Steps of a step sequence: add one after a step (between it and the next, the arrows re-linked), delete one (the
 * arrows into it go on to where it went), rename one. Rungs: the ones shown beside a box edited in the ladder editor
 * and put back in their place. And what changed, in plain words, for the user to read before anything is sent.
 */
import { newRungId, type CompareElement, type LadderElement, type LadderOutput, type LadderProgram, type Rung } from '../core/ladder';
import { actionText, conditionLines, stepRegisters, type NameOf } from './flowModel';

const norm = (a: string) => a.trim().toUpperCase();
const isConst = (a: string) => /^-?\d+(\.\d+)?$/.test(a.trim());
const at = (reg: string, n: number): CompareElement => ({ type: 'CMP', left: reg, op: '==', right: String(n) });
const stepIn = (br: LadderElement[], reg: string): number | null => {
  const el = br.find((e) => e.type === 'CMP' && e.op === '==' && norm(e.left) === norm(reg) && isConst(e.right)) as CompareElement | undefined;
  return el ? Number(el.right) : null;
};
const goesTo = (r: Rung, reg: string): number | null => {
  const o = r.outputs.find((x) => x.type === 'COPY' && norm(x.dest) === norm(reg) && isConst(x.source));
  return o && o.type === 'COPY' ? Number(o.source) : null;
};
const setGoTo = (outputs: LadderOutput[], reg: string, to: number): LadderOutput[] =>
  outputs.map((o) => (o.type === 'COPY' && norm(o.dest) === norm(reg) && isConst(o.source) ? { ...o, source: String(to) } : o));

/** The steps of a register (every value compared or set), sorted. */
export function stepsOf(program: LadderProgram, reg: string): number[] {
  const s = new Set<number>();
  for (const r of program.rungs) {
    for (const br of r.branches) { const n = stepIn(br, reg); if (n !== null) s.add(n); }
    const g = goesTo(r, reg); if (g !== null) s.add(g);
  }
  return [...s].sort((a, b) => a - b);
}

/** What every step's way out needs besides its own wait (the cycle running, safety OK): kept by a new step. */
function guards(program: LadderProgram, reg: string): LadderElement[] {
  // the running cycle's steps (not the idle step's start, which has its own start conditions)
  const idle = stepsOf(program, reg)[0];
  const all = program.rungs.filter((r) => goesTo(r, reg) !== null).flatMap((r) => r.branches.filter((br) => stepIn(br, reg) !== null));
  const running = all.filter((br) => stepIn(br, reg) !== idle);
  const ways = running.length ? running : all;
  if (!ways.length) return [];
  const key = (e: LadderElement) => JSON.stringify(e);
  const rest = ways.map((br) => br.filter((e) => !(e.type === 'CMP' && norm(e.left) === norm(reg))));
  return rest[0].filter((e) => rest.every((br) => br.some((x) => key(x) === key(e))));
}

export interface EditResult { program: LadderProgram; message: string; focusRung?: string }

/**
 * A step after `after`: its value between `after` and where `after` goes (20 → 30 gives 25), the way out of `after`
 * now goes to it, and it goes on to where `after` went, when what every step needs is there (the user then says
 * what it turns on and what it waits for, in its ladder).
 */
export function addStepAfter(program: LadderProgram, reg: string, after: number, name: string): EditResult | { error: string } {
  const outs = program.rungs.filter((r) => goesTo(r, reg) !== null && r.branches.some((br) => stepIn(br, reg) === after));
  if (!outs.length) return { error: `Step ${after} has no way out to put a step after it.` };
  const next = goesTo(outs[0], reg)!;
  const taken = new Set(stepsOf(program, reg));
  let value: number | null = null;
  if (next > after) { for (let v = Math.floor((after + next) / 2); v > after; v--) if (!taken.has(v)) { value = v; break; } }
  else { value = Math.max(...taken) + 10; }
  if (value === null) return { error: `There is no free step number between ${after} and ${next}: renumber the steps first.` };
  const label = name.trim() || `Step ${value}`;
  const rung: Rung = {
    id: newRungId(), block: outs[0].block, comment: `Step ${value} — ${label}: done at once (set what it waits for) → step ${next}`,
    branches: [[...guards(program, reg), at(reg, value)]], outputs: [{ type: 'COPY', source: String(next), dest: reg }],
  };
  const rungs = program.rungs.map((r) => (outs.includes(r) ? { ...r, outputs: setGoTo(r.outputs, reg, value!), comment: r.comment.replace(new RegExp(`(→\\s*step\\s*)${next}\\b`, 'i'), `$1${value}`) } : r));
  // written before the way out of `after` (as the app writes them, last step first: a step lasts at least one scan)
  const i = rungs.findIndex((r) => outs.some((o) => o.id === r.id));
  rungs.splice(i, 0, rung);
  return { program: { ...program, rungs }, message: `Step ${value} "${label}" added after step ${after}; it goes on to step ${next}. Say what it waits for in its ladder.`, focusRung: rung.id };
}

/** Delete a step: the arrows into it go on to where it went; its way out and what it did are removed. */
export function deleteStep(program: LadderProgram, reg: string, step: number): EditResult | { error: string } {
  const outs = program.rungs.filter((r) => goesTo(r, reg) !== null && r.branches.some((br) => stepIn(br, reg) === step));
  if (!outs.length) return { error: `Step ${step} has no way out: nothing to go on to.` };
  const next = goesTo(outs[0], reg)!;
  if (next === step) return { error: `Step ${step} goes back to itself.` };
  const rungs: Rung[] = [];
  for (const r of program.rungs) {
    if (outs.includes(r)) {
      // a way out shared with other steps keeps their branches
      const keep = r.branches.filter((br) => stepIn(br, reg) !== step);
      if (keep.length) rungs.push({ ...r, branches: keep });
      continue;
    }
    let x = r;
    if (goesTo(x, reg) === step) x = { ...x, outputs: setGoTo(x.outputs, reg, next) };
    // what the step turned on: its branches go
    if (x.branches.some((br) => stepIn(br, reg) === step) && goesTo(x, reg) === null) {
      const keep = x.branches.filter((br) => stepIn(br, reg) !== step);
      if (!keep.length) continue;
      x = { ...x, branches: keep };
    }
    rungs.push(x);
  }
  return { program: { ...program, rungs }, message: `Step ${step} deleted: the steps that went to it go on to step ${next}.` };
}

/** Rename a step (its name is in its way out's comment: "Step 20 — Clamp: …"). */
export function renameStep(program: LadderProgram, reg: string, step: number, name: string): EditResult {
  const label = name.trim();
  const rx = new RegExp(`^(Step\\s*${step}\\s*[—:-]\\s*)([^:]+?)(:|$)`);
  const rungs = program.rungs.map((r) => {
    if (goesTo(r, reg) === null || !r.branches.some((br) => stepIn(br, reg) === step)) return r;
    return { ...r, comment: rx.test(r.comment) ? r.comment.replace(rx, `$1${label}$3`) : `Step ${step} — ${label}: ${r.comment}` };
  });
  return { program: { ...program, rungs }, message: `Step ${step} renamed "${label}".` };
}

/** The register of the sequence a step belongs to (the first in the block). */
export function registerOf(program: LadderProgram, block: string | undefined): string | undefined {
  return stepRegisters(program.rungs.filter((r) => (r.block ?? '') === (block ?? '')))[0];
}

/**
 * Some rungs edited (the ladder editor beside the diagram): put back in their place, the deleted ones removed, the
 * new ones after the last of them, in the same function.
 */
export function mergeRungs(full: LadderProgram, ids: string[], edited: Rung[]): LadderProgram {
  const set = new Set(ids);
  const first = full.rungs.findIndex((r) => set.has(r.id));
  const block = first >= 0 ? full.rungs[first].block : undefined;
  const mine = edited.map((r) => (r.block === undefined && block !== undefined ? { ...r, block } : r));
  const rest = full.rungs.filter((r) => !set.has(r.id));
  const pos = first < 0 ? rest.length : full.rungs.slice(0, first).filter((r) => !set.has(r.id)).length;
  return { ...full, rungs: [...rest.slice(0, pos), ...mine, ...rest.slice(pos)] };
}

export interface FlowChange { kind: 'added' | 'removed' | 'changed'; rungId: string; title: string; before: string[]; after: string[] }

/** One rung in plain words: IF … THEN …. */
export function rungWords(r: Rung, nameOf: NameOf): string[] {
  return [...(r.branches.length ? ['IF', ...conditionLines(r.branches, nameOf).map((l) => `  ${l}`)] : ['ALWAYS']), 'THEN', ...r.outputs.map((o) => `  ${actionText(o, nameOf)}`)];
}

/** What changed between two programs, rung by rung, in plain words (before → after). */
export function flowChanges(before: LadderProgram, after: LadderProgram, nameOf: NameOf): FlowChange[] {
  const old = new Map(before.rungs.map((r) => [r.id, r]));
  const now = new Map(after.rungs.map((r) => [r.id, r]));
  const out: FlowChange[] = [];
  for (const r of after.rungs) {
    const o = old.get(r.id);
    if (!o) out.push({ kind: 'added', rungId: r.id, title: r.comment || 'New rung', before: [], after: rungWords(r, nameOf) });
    else if (JSON.stringify({ ...o, block: undefined }) !== JSON.stringify({ ...r, block: undefined })) {
      out.push({ kind: 'changed', rungId: r.id, title: r.comment || o.comment || 'Rung', before: rungWords(o, nameOf), after: rungWords(r, nameOf) });
    }
  }
  for (const r of before.rungs) if (!now.has(r.id)) out.push({ kind: 'removed', rungId: r.id, title: r.comment || 'Rung', before: rungWords(r, nameOf), after: [] });
  return out;
}
