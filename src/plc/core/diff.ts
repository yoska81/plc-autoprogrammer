import type { LadderProgram, Rung } from './ladder';

export type RungChange = 'added' | 'removed' | 'changed' | 'unchanged';

export interface RungDiffEntry {
  change: RungChange;
  /** The rung as it is in the proposed program (or the old one if removed). */
  rung: Rung;
  before?: Rung;
}

const signature = (r: Rung) => JSON.stringify({ c: r.comment, b: r.branches, o: r.outputs });

/** Rung-level diff, matched by rung id, in the proposed program's order. */
export function diffPrograms(before: LadderProgram, after: LadderProgram): RungDiffEntry[] {
  const oldById = new Map(before.rungs.map((r) => [r.id, r]));
  const newIds = new Set(after.rungs.map((r) => r.id));
  const entries: RungDiffEntry[] = [];

  for (const rung of after.rungs) {
    const old = oldById.get(rung.id);
    if (!old) entries.push({ change: 'added', rung });
    else entries.push({ change: signature(old) === signature(rung) ? 'unchanged' : 'changed', rung, before: old });
  }
  // Show removed rungs after the rung that preceded them in the old program.
  before.rungs.forEach((rung, i) => {
    if (newIds.has(rung.id)) return;
    const prevId = before.rungs.slice(0, i).reverse().find((r) => newIds.has(r.id))?.id;
    const at = prevId ? entries.findIndex((e) => e.rung.id === prevId) + 1 : 0;
    entries.splice(at, 0, { change: 'removed', rung });
  });
  return entries;
}

export function summarizeDiff(entries: RungDiffEntry[]): string {
  const n = (c: RungChange) => entries.filter((e) => e.change === c).length;
  const parts = [
    n('added') && `${n('added')} added`,
    n('changed') && `${n('changed')} changed`,
    n('removed') && `${n('removed')} removed`,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : 'no rung changes';
}
